import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request } from 'express';
import { createHash, randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, QueryRunner, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import {
  ContractCommercialContext,
  ContractEntity,
  ContractLegalSignatureStatus,
  ContractMilestoneSnapshotItem,
  ContractStatus,
} from '../../database/entities/contract.entity';
import {
  ProjectEntity,
  ProjectStaffInviteStatus,
  ProjectStatus,
} from '../../database/entities/project.entity';
import {
  ProjectSpecEntity,
  ProjectSpecStatus,
  SpecPhase,
} from '../../database/entities/project-spec.entity';
import {
  DeliverableType,
  MilestoneEntity,
  MilestoneStatus,
} from '../../database/entities/milestone.entity';
import { EscrowEntity, EscrowStatus } from '../../database/entities/escrow.entity';
import { DigitalSignatureEntity } from '../../database/entities/digital-signature.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { normalizeContractPdfUrl } from '../../common/utils/contract-pdf-url.util';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import {
  CreateSignatureSessionDto,
  SignatureProviderWebhookDto,
  UpdateContractDraftDto,
  UpdateContractDraftMilestoneDto,
} from './dto';
import { ContractArchiveStorageService } from './contract-archive.storage';
import { NotificationsService } from '../notifications/notifications.service';

type ContractPartyRole = 'CLIENT' | 'BROKER' | 'FREELANCER';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);
  private static readonly MONEY_TOLERANCE = new Decimal(0.01);
  private static readonly DEFAULT_CURRENCY = 'USD';
  private static readonly DEFAULT_ESCROW_SPLIT = {
    developerPercentage: 85,
    brokerPercentage: 10,
    platformPercentage: 5,
  } as const;
  private interDevLogoDataUri?: string | null;

  constructor(
    @InjectRepository(ContractEntity)
    private readonly contractsRepository: Repository<ContractEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectsRepository: Repository<ProjectEntity>,
    @InjectRepository(ProjectSpecEntity)
    private readonly projectSpecsRepository: Repository<ProjectSpecEntity>,
    @InjectRepository(ProjectRequestEntity)
    private readonly projectRequestsRepository: Repository<ProjectRequestEntity>,
    @InjectRepository(ProjectRequestProposalEntity)
    private readonly projectRequestProposalsRepository: Repository<ProjectRequestProposalEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly contractArchiveStorage: ContractArchiveStorageService,
  ) {}

  private sortMilestones(milestones: MilestoneEntity[]): MilestoneEntity[] {
    return [...milestones].sort((a, b) => {
      const sortOrderDiff =
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
      if (sortOrderDiff !== 0) {
        return sortOrderDiff;
      }
      return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    });
  }

  private sortSnapshot(
    snapshot: ContractMilestoneSnapshotItem[],
  ): ContractMilestoneSnapshotItem[] {
    return [...snapshot].sort((a, b) => {
      const sortOrderDiff =
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
      if (sortOrderDiff !== 0) {
        return sortOrderDiff;
      }
      return a.contractMilestoneKey.localeCompare(b.contractMilestoneKey);
    });
  }

  private toMoneyDecimal(input: Decimal.Value | null | undefined): Decimal {
    return new Decimal(input ?? 0).toDecimalPlaces(2);
  }

  private normalizeMoney(input: Decimal.Value | null | undefined): number {
    return Number(this.toMoneyDecimal(input).toFixed(2));
  }

  private normalizeOptionalDate(input: string | Date | null | undefined): string | null {
    if (!input) {
      return null;
    }
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO date string.');
    }
    return parsed.toISOString();
  }

  private normalizeCurrency(input: string | null | undefined): string {
    const currency = (input || ContractsService.DEFAULT_CURRENCY).trim().toUpperCase();
    if (currency.length < 3 || currency.length > 10) {
      throw new BadRequestException('Currency must be between 3 and 10 characters.');
    }
    return currency;
  }

  private normalizeLegalSignatureProvider(input: string | null | undefined): string {
    const provider = `${input || 'VN_CA_SANDBOX'}`.trim().toUpperCase();
    if (provider.length < 2 || provider.length > 120) {
      throw new BadRequestException('Signature provider must be between 2 and 120 characters.');
    }
    return provider;
  }

  private normalizeWebhookLegalStatus(
    status: string,
  ): ContractLegalSignatureStatus {
    const normalized = `${status || ''}`.trim().toUpperCase();
    if (['VERIFIED', 'SUCCESS', 'COMPLETED', 'APPROVED'].includes(normalized)) {
      return ContractLegalSignatureStatus.VERIFIED;
    }
    if (['FAILED', 'REJECTED', 'DECLINED', 'EXPIRED', 'CANCELED'].includes(normalized)) {
      return ContractLegalSignatureStatus.FAILED;
    }
    if (['SESSION_CREATED', 'CREATED'].includes(normalized)) {
      return ContractLegalSignatureStatus.SESSION_CREATED;
    }
    return ContractLegalSignatureStatus.PENDING_PROVIDER;
  }

  private getContractParticipantIds(contract: ContractEntity): string[] {
    const project = contract.project as ProjectEntity | undefined;
    if (!project) {
      return [];
    }

    return Array.from(
      new Set([project.clientId, project.brokerId, project.freelancerId].filter(Boolean)),
    );
  }

  private mergeLegalSignatureEvidence(
    existing: Record<string, unknown> | null | undefined,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...(existing ?? {}),
      ...patch,
    };
  }

  private resetLegalSignatureProgress(contract: ContractEntity) {
    contract.legalSignatureStatus = ContractLegalSignatureStatus.NOT_STARTED;
    contract.provider = null;
    contract.verifiedAt = null;
    contract.certificateSerial = null;
    contract.legalSignatureEvidence = null;
  }

  private emitContractUpdated(
    contract: Pick<ContractEntity, 'id' | 'projectId'> & { project?: ProjectEntity | null },
    extraUserIds: Array<string | null | undefined> = [],
  ) {
    const requestId = contract.project?.requestId ?? null;
    const userIds = Array.from(
      new Set([
        ...(contract.project
          ? [contract.project.clientId, contract.project.brokerId, contract.project.freelancerId]
          : []),
        ...extraUserIds,
      ].filter(Boolean)),
    );

    userIds.forEach((userId) => {
      this.eventEmitter.emit('contract.updated', {
        userId,
        contractId: contract.id,
        projectId: contract.projectId,
        requestId,
        entityType: 'Contract',
        entityId: contract.id,
      });
    });
  }

  private async notifyContractParticipants(
    contract: ContractEntity,
    input: { title: string; body: string; userIds?: Array<string | null | undefined> },
  ) {
    const userIds =
      input.userIds && input.userIds.length > 0
        ? Array.from(new Set(input.userIds.filter(Boolean)))
        : this.getContractParticipantIds(contract);

    if (userIds.length === 0) {
      return;
    }

    await this.notificationsService.createMany(
      userIds.map((userId) => ({
        userId,
        title: input.title,
        body: input.body,
        relatedType: 'Contract',
        relatedId: contract.id,
      })),
    );
  }

  private getRequiredContractSignerIds(contract: ContractEntity): string[] {
    const project = contract.project as ProjectEntity | undefined;
    if (!project) {
      return [];
    }

    const signerIds = new Set<string>();
    signerIds.add(project.clientId);
    signerIds.add(project.brokerId);
    if (project.freelancerId) {
      signerIds.add(project.freelancerId);
    }
    return Array.from(signerIds);
  }

  private getContractPartyRole(contract: ContractEntity, userId: string): ContractPartyRole {
    const project = contract.project as ProjectEntity | undefined;
    if (!project) {
      throw new BadRequestException('Contract project context is missing.');
    }
    if (userId === project.clientId) {
      return 'CLIENT';
    }
    if (userId === project.brokerId) {
      return 'BROKER';
    }
    if (project.freelancerId && userId === project.freelancerId) {
      return 'FREELANCER';
    }
    throw new ForbiddenException('You are not a party of this contract');
  }

  private assertUserIsContractParty(
    user: UserEntity,
    contract: ContractEntity,
    action: 'view' | 'sign' | 'activate',
  ) {
    const allowedUserIds = this.getRequiredContractSignerIds(contract);
    if (!allowedUserIds.includes(user.id)) {
      throw new ForbiddenException(`You are not allowed to ${action} this contract`);
    }
  }

  private isAcceptedSupervisingStaff(user: UserEntity, contract: ContractEntity): boolean {
    const project = contract.project as ProjectEntity | undefined;
    if (!project) {
      return false;
    }

    return (
      user.role === UserRole.STAFF &&
      project.staffId === user.id &&
      project.staffInviteStatus === ProjectStaffInviteStatus.ACCEPTED
    );
  }

  private assertUserCanViewContract(user: UserEntity, contract: ContractEntity) {
    if (this.isAcceptedSupervisingStaff(user, contract)) {
      return;
    }

    this.assertUserIsContractParty(user, contract, 'view');
  }

  private assertUserCanManageDraft(user: UserEntity, contract: ContractEntity) {
    const project = contract.project as ProjectEntity | undefined;
    if (!project || project.brokerId !== user.id) {
      throw new ForbiddenException(
        'Only the assigned broker can manage the contract before signing.',
      );
    }
  }

  private async resolveAcceptedFreelancerId(requestId: string): Promise<string | null> {
    const acceptedProposals = await this.projectRequestProposalsRepository.find({
      where: { requestId, status: 'ACCEPTED' },
      order: { createdAt: 'ASC' },
    });

    if (acceptedProposals.length > 1) {
      throw new BadRequestException(
        'Invalid request state: multiple accepted freelancers found for this request.',
      );
    }

    if (acceptedProposals.length === 1) {
      return acceptedProposals[0].freelancerId;
    }

    const legacyPendingProposals = await this.projectRequestProposalsRepository.find({
      where: { requestId, status: 'PENDING' },
      order: { createdAt: 'ASC' },
    });
    if (legacyPendingProposals.length > 1) {
      throw new BadRequestException(
        'Invalid request state: multiple legacy pending freelancer proposals found.',
      );
    }
    if (legacyPendingProposals.length === 1) {
      this.logger.warn(
        `Using legacy PENDING freelancer proposal as accepted signer for request ${requestId}.`,
      );
      return legacyPendingProposals[0].freelancerId;
    }

    return null;
  }

  private selectSpecForContract(specs: ProjectSpecEntity[], sourceSpecId: string | null) {
    if (!specs?.length) return null;
    if (sourceSpecId) {
      const exact = specs.find((spec) => spec.id === sourceSpecId);
      if (exact) return exact;
    }

    const allSignedFull = specs.find(
      (spec) =>
        spec.specPhase === SpecPhase.FULL_SPEC && spec.status === ProjectSpecStatus.ALL_SIGNED,
    );
    if (allSignedFull) return allSignedFull;

    const approvedFull = specs.find(
      (spec) =>
        spec.specPhase === SpecPhase.FULL_SPEC && spec.status === ProjectSpecStatus.APPROVED,
    );
    if (approvedFull) return approvedFull;

    return specs[0];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private cloneJsonValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private normalizeNarrativeRichContent(
    value: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!this.isRecord(value) || value.type !== 'doc') {
      return null;
    }
    return this.cloneJsonValue(value);
  }

  private renderNarrativeInlineText(nodes: unknown[]): string {
    const parts = nodes.map((node) => this.renderNarrativeInlineNode(node)).join('');
    return parts
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  private renderNarrativeInlineNode(node: unknown): string {
    if (!this.isRecord(node)) {
      return '';
    }

    const type = typeof node.type === 'string' ? node.type : '';
    if (type === 'text') {
      const baseText = typeof node.text === 'string' ? node.text : '';
      if (!baseText) {
        return '';
      }

      const linkMark = Array.isArray(node.marks)
        ? node.marks.find(
            (mark) =>
              this.isRecord(mark) &&
              mark.type === 'link' &&
              this.isRecord(mark.attrs) &&
              typeof mark.attrs.href === 'string' &&
              mark.attrs.href.trim(),
          )
        : null;
      if (linkMark && this.isRecord(linkMark.attrs)) {
        const href = String(linkMark.attrs.href).trim();
        if (href && baseText.trim() !== href) {
          return `${baseText} (${href})`;
        }
      }

      return baseText;
    }

    if (type === 'hardBreak') {
      return '\n';
    }

    return Array.isArray(node.content) ? this.renderNarrativeInlineText(node.content) : '';
  }

  private renderNarrativeListItem(
    node: unknown,
    depth: number,
    kind: 'bullet' | 'ordered' | 'task',
    orderedIndex: number,
  ): string[] {
    if (!this.isRecord(node)) {
      return [];
    }

    const indent = '  '.repeat(depth);
    const checked =
      kind === 'task' && this.isRecord(node.attrs) ? Boolean(node.attrs.checked) : false;
    const marker =
      kind === 'ordered' ? `${orderedIndex}. ` : kind === 'task' ? `- [${checked ? 'x' : ' '}] ` : '- ';

    const childNodes = Array.isArray(node.content) ? node.content : [];
    if (childNodes.length === 0) {
      return [`${indent}${marker}`];
    }

    const lines: string[] = [];
    let wroteMarker = false;

    for (const child of childNodes) {
      if (!this.isRecord(child)) {
        continue;
      }

      const childType = typeof child.type === 'string' ? child.type : '';
      const childContent = Array.isArray(child.content) ? child.content : [];

      if (childType === 'paragraph') {
        const paragraphText = this.renderNarrativeInlineText(childContent)
          .replace(/\n+/g, ' ')
          .trim();
        if (paragraphText) {
          lines.push(`${indent}${marker}${paragraphText}`);
          wroteMarker = true;
        }
        continue;
      }

      if (childType === 'bulletList' || childType === 'orderedList' || childType === 'taskList') {
        if (!wroteMarker) {
          lines.push(`${indent}${marker}`.trimEnd());
          wroteMarker = true;
        }
        lines.push(...this.renderNarrativeBlock(child, depth + 1));
        continue;
      }

      const fallbackLines = this.renderNarrativeBlock(child, depth + 1);
      if (fallbackLines.length === 0) {
        continue;
      }

      if (!wroteMarker) {
        const [firstLine, ...rest] = fallbackLines;
        if (firstLine) {
          lines.push(`${indent}${marker}${firstLine}`);
        } else {
          lines.push(`${indent}${marker}`.trimEnd());
        }
        lines.push(...rest);
        wroteMarker = true;
      } else {
        lines.push(...fallbackLines);
      }
    }

    if (!wroteMarker) {
      lines.push(`${indent}${marker}`.trimEnd());
    }

    return lines;
  }

  private renderNarrativeList(
    nodes: unknown[],
    depth: number,
    kind: 'bullet' | 'ordered' | 'task',
    orderedStart = 1,
  ): string[] {
    const lines: string[] = [];
    let orderedIndex = Number.isFinite(orderedStart) && orderedStart > 0 ? orderedStart : 1;

    for (const node of nodes) {
      lines.push(...this.renderNarrativeListItem(node, depth, kind, orderedIndex));
      if (kind === 'ordered') {
        orderedIndex += 1;
      }
    }

    if (lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push('');
    }

    return lines;
  }

  private renderNarrativeBlock(node: unknown, depth = 0): string[] {
    if (!this.isRecord(node)) {
      return [];
    }

    const type = typeof node.type === 'string' ? node.type : '';
    const content = Array.isArray(node.content) ? node.content : [];

    switch (type) {
      case 'paragraph': {
        const text = this.renderNarrativeInlineText(content).replace(/\n+/g, ' ').trim();
        return text ? [text, ''] : [];
      }
      case 'heading': {
        const headingLevel =
          this.isRecord(node.attrs) && Number.isInteger(node.attrs.level)
            ? Math.min(Math.max(Number(node.attrs.level), 1), 3)
            : 2;
        const text = this.renderNarrativeInlineText(content).replace(/\n+/g, ' ').trim();
        return text ? [`${'#'.repeat(headingLevel)} ${text}`, ''] : [];
      }
      case 'bulletList':
        return this.renderNarrativeList(content, depth, 'bullet');
      case 'orderedList': {
        const orderedStart =
          this.isRecord(node.attrs) && Number.isFinite(Number(node.attrs.start))
            ? Number(node.attrs.start)
            : 1;
        return this.renderNarrativeList(content, depth, 'ordered', orderedStart);
      }
      case 'taskList':
        return this.renderNarrativeList(content, depth, 'task');
      case 'blockquote': {
        const quoteLines = this.renderNarrativeBlocks(content, depth)
          .map((line) => (line ? `> ${line}` : ''))
          .filter((line, index, arr) => line || (index > 0 && arr[index - 1] !== ''));
        return quoteLines.length > 0 ? [...quoteLines, ''] : [];
      }
      case 'horizontalRule':
        return ['---', ''];
      default: {
        const fallbackInline = this.renderNarrativeInlineText(content)
          .replace(/\n+/g, ' ')
          .trim();
        if (fallbackInline) {
          return [fallbackInline, ''];
        }
        return this.renderNarrativeBlocks(content, depth);
      }
    }
  }

  private renderNarrativeBlocks(nodes: unknown[], depth = 0): string[] {
    const lines: string[] = [];
    for (const node of nodes) {
      lines.push(...this.renderNarrativeBlock(node, depth));
    }
    return lines;
  }

  private renderNarrativePlainText(
    value: Record<string, unknown> | null | undefined,
  ): string | null {
    const narrative = this.normalizeNarrativeRichContent(value);
    if (!narrative || !Array.isArray(narrative.content)) {
      return null;
    }

    const content = this.renderNarrativeBlocks(narrative.content)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return content || null;
  }

  private getFrozenNarrativeContext(
    spec?: Pick<ProjectSpecEntity, 'richContentJson'> | null,
  ): Pick<ContractCommercialContext, 'scopeNarrativeRichContent' | 'scopeNarrativePlainText'> {
    const scopeNarrativeRichContent = this.normalizeNarrativeRichContent(spec?.richContentJson);
    return {
      scopeNarrativeRichContent,
      scopeNarrativePlainText: this.renderNarrativePlainText(scopeNarrativeRichContent),
    };
  }

  private demoteMarkdownHeadings(markdown: string): string {
    return markdown
      .split(/\r?\n/)
      .map((line) => {
        const match = line.match(/^(#{1,6})\s+(.+)$/);
        if (!match) {
          return line;
        }
        const nextLevel = Math.min(match[1].length + 2, 6);
        return `${'#'.repeat(nextLevel)} ${match[2]}`;
      })
      .join('\n');
  }

  private buildCommercialContextFromSpec(
    spec: ProjectSpecEntity,
    project: ProjectEntity,
    freelancerId: string | null,
    snapshot: ContractMilestoneSnapshotItem[],
  ): ContractCommercialContext {
    const frozenNarrative = this.getFrozenNarrativeContext(spec);
    return {
      sourceSpecId: spec.id,
      sourceSpecUpdatedAt: spec.updatedAt ? new Date(spec.updatedAt).toISOString() : null,
      requestId: spec.requestId ?? null,
      projectTitle: spec.title,
      clientId: project.clientId,
      brokerId: project.brokerId,
      freelancerId,
      totalBudget: this.normalizeMoney(this.sumSnapshotAmounts(snapshot)),
      currency: this.normalizeCurrency(project.currency),
      description: spec.description ?? null,
      techStack: spec.techStack ?? null,
      ...frozenNarrative,
      features: Array.isArray(spec.features)
        ? spec.features.map((feature) => ({
            title: feature.title,
            description: feature.description,
            complexity: feature.complexity,
            acceptanceCriteria: [...(feature.acceptanceCriteria || [])],
            inputOutputSpec: feature.inputOutputSpec ?? null,
          }))
        : null,
      escrowSplit: { ...ContractsService.DEFAULT_ESCROW_SPLIT },
    };
  }

  private buildCommercialContextFallback(
    contract: ContractEntity,
    fallbackSpec?: ProjectSpecEntity | null,
  ): ContractCommercialContext {
    const project = contract.project as ProjectEntity | undefined;
    if (!project) {
      throw new BadRequestException('Contract project context is missing.');
    }

    const snapshot = this.sortSnapshot(contract.milestoneSnapshot || []);
    const spec = fallbackSpec ?? null;
    const frozenNarrative = this.getFrozenNarrativeContext(spec);
    return {
      sourceSpecId: contract.sourceSpecId ?? spec?.id ?? null,
      sourceSpecUpdatedAt: spec?.updatedAt ? new Date(spec.updatedAt).toISOString() : null,
      requestId: project.requestId ?? null,
      projectTitle: project.title || contract.title || spec?.title || 'Untitled Project',
      clientId: project.clientId,
      brokerId: project.brokerId,
      freelancerId: project.freelancerId ?? null,
      totalBudget: this.normalizeMoney(
        snapshot.length > 0 ? this.sumSnapshotAmounts(snapshot) : project.totalBudget,
      ),
      currency: this.normalizeCurrency(project.currency),
      description: spec?.description ?? project.description ?? null,
      techStack: spec?.techStack ?? null,
      ...frozenNarrative,
      features: Array.isArray(spec?.features)
        ? spec!.features.map((feature) => ({
            title: feature.title,
            description: feature.description,
            complexity: feature.complexity,
            acceptanceCriteria: [...(feature.acceptanceCriteria || [])],
            inputOutputSpec: feature.inputOutputSpec ?? null,
          }))
        : null,
      escrowSplit: { ...ContractsService.DEFAULT_ESCROW_SPLIT },
    };
  }

  private normalizeSnapshotItem(
    item: UpdateContractDraftMilestoneDto | ContractMilestoneSnapshotItem,
  ): ContractMilestoneSnapshotItem {
    const title = item.title?.trim();
    if (!title) {
      throw new BadRequestException('Milestone title is required');
    }

    const amount = this.normalizeMoney(item.amount);
    if (amount < 0) {
      throw new BadRequestException('Milestone amount must be a non-negative number');
    }

    const retentionAmount =
      item.retentionAmount === null || item.retentionAmount === undefined
        ? 0
        : this.normalizeMoney(item.retentionAmount);
    if (new Decimal(retentionAmount).greaterThan(new Decimal(amount))) {
      throw new BadRequestException('Milestone retentionAmount cannot exceed milestone amount');
    }

    const startDate = this.normalizeOptionalDate(item.startDate ?? null);
    const dueDate = this.normalizeOptionalDate(item.dueDate ?? null);
    if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
      throw new BadRequestException('Milestone dueDate must be greater than or equal to startDate');
    }

    const deliverableType = item.deliverableType ?? DeliverableType.OTHER;
    const contractMilestoneKey =
      item.contractMilestoneKey?.trim() ||
      item.sourceSpecMilestoneId ||
      item.projectMilestoneId ||
      randomUUID();

    return {
      contractMilestoneKey,
      sourceSpecMilestoneId: item.sourceSpecMilestoneId ?? null,
      title,
      description: item.description?.trim() || null,
      amount,
      startDate,
      dueDate,
      sortOrder:
        item.sortOrder === null || item.sortOrder === undefined ? null : Number(item.sortOrder),
      deliverableType,
      retentionAmount,
      acceptanceCriteria: Array.isArray(item.acceptanceCriteria)
        ? item.acceptanceCriteria.map((criterion) => criterion.trim()).filter(Boolean)
        : [],
      projectMilestoneId: item.projectMilestoneId ?? null,
    };
  }

  private assertUniqueSnapshotSortOrders(snapshot: ContractMilestoneSnapshotItem[]) {
    const seenSortOrders = new Set<number>();
    for (const milestone of snapshot) {
      if (!Number.isInteger(milestone.sortOrder)) {
        throw new ConflictException(
          `Milestone "${milestone.title}" is missing a valid sortOrder.`,
        );
      }
      if (seenSortOrders.has(milestone.sortOrder as number)) {
        throw new ConflictException(
          `Milestone snapshot contains duplicate sortOrder ${milestone.sortOrder}.`,
        );
      }
      seenSortOrders.add(milestone.sortOrder as number);
    }
  }

  private sumSnapshotAmounts(snapshot: ContractMilestoneSnapshotItem[]): Decimal {
    return snapshot.reduce(
      (total, milestone) => total.plus(this.toMoneyDecimal(milestone.amount)),
      new Decimal(0),
    );
  }

  private buildSnapshotFromSpecMilestones(
    spec: ProjectSpecEntity,
  ): ContractMilestoneSnapshotItem[] {
    const milestones = this.sortMilestones(spec.milestones || []);
    return milestones.map((milestone, index) =>
      this.normalizeSnapshotItem({
        contractMilestoneKey: milestone.id || randomUUID(),
        sourceSpecMilestoneId: milestone.id ?? null,
        title: milestone.title,
        description: milestone.description ?? null,
        amount: Number(milestone.amount ?? 0),
        startDate: milestone.startDate ?? null,
        dueDate: milestone.dueDate ?? null,
        sortOrder: milestone.sortOrder ?? index,
        deliverableType: milestone.deliverableType ?? DeliverableType.OTHER,
        retentionAmount: Number(milestone.retentionAmount ?? 0),
        acceptanceCriteria: Array.isArray(milestone.acceptanceCriteria)
          ? [...milestone.acceptanceCriteria]
          : [],
      }),
    );
  }

  private buildCommercialContextFromDraft(
    contract: ContractEntity,
    project: ProjectEntity,
    snapshot: ContractMilestoneSnapshotItem[],
    overrides?: { currency?: string },
  ): ContractCommercialContext {
    const current = contract.commercialContext ?? this.buildCommercialContextFallback(contract);
    return {
      ...current,
      sourceSpecId: contract.sourceSpecId ?? current.sourceSpecId ?? null,
      requestId: project.requestId ?? current.requestId ?? null,
      projectTitle: project.title || current.projectTitle || contract.title || 'Untitled Project',
      clientId: project.clientId,
      brokerId: project.brokerId,
      freelancerId: project.freelancerId ?? current.freelancerId ?? null,
      totalBudget: this.normalizeMoney(this.sumSnapshotAmounts(snapshot)),
      currency: this.normalizeCurrency(overrides?.currency ?? current.currency ?? project.currency),
      escrowSplit: current.escrowSplit ?? { ...ContractsService.DEFAULT_ESCROW_SPLIT },
    };
  }

  private validateSnapshotInvariants(
    snapshot: ContractMilestoneSnapshotItem[],
    commercialContext: ContractCommercialContext,
    project?: ProjectEntity,
  ) {
    if (!Array.isArray(snapshot) || snapshot.length === 0) {
      throw new BadRequestException('Contract snapshot must contain at least one milestone.');
    }

    this.assertUniqueSnapshotSortOrders(snapshot);

    const snapshotBudget = this.sumSnapshotAmounts(snapshot);
    const commercialBudget = this.toMoneyDecimal(commercialContext.totalBudget);
    if (!snapshotBudget.minus(commercialBudget).abs().lte(ContractsService.MONEY_TOLERANCE)) {
      throw new ConflictException(
        'Contract snapshot budget does not match the frozen commercial totalBudget.',
      );
    }

    if (project) {
      const projectBudget = this.toMoneyDecimal(project.totalBudget);
      if (!snapshotBudget.minus(projectBudget).abs().lte(ContractsService.MONEY_TOLERANCE)) {
        throw new ConflictException(
          'Contract snapshot budget does not match the linked project totalBudget.',
        );
      }
    }

    for (const milestone of snapshot) {
      if (!milestone.contractMilestoneKey?.trim()) {
        throw new BadRequestException('Each contract milestone snapshot item needs a key.');
      }
    }
  }

  private assertExistingMilestonesMatchSnapshot(
    existingMilestones: MilestoneEntity[],
    snapshot: ContractMilestoneSnapshotItem[],
  ) {
    const sortedMilestones = [...existingMilestones].sort((a, b) => {
      const sortOrderDiff =
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
      if (sortOrderDiff !== 0) {
        return sortOrderDiff;
      }
      return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    });
    const sortedSnapshot = this.sortSnapshot(snapshot);

    if (sortedMilestones.length !== sortedSnapshot.length) {
      throw new ConflictException(
        'Existing project milestones do not match the frozen contract snapshot.',
      );
    }

    sortedMilestones.forEach((milestone, index) => {
      const snapshotEntry =
        milestone.sourceContractMilestoneKey
          ? sortedSnapshot.find(
              (entry) => entry.contractMilestoneKey === milestone.sourceContractMilestoneKey,
            )
          : undefined;
      const fallbackEntry =
        snapshotEntry ??
        (Number.isInteger(milestone.sortOrder)
          ? sortedSnapshot.find((entry) => entry.sortOrder === milestone.sortOrder)
          : undefined) ??
        sortedSnapshot[index];

      if (!fallbackEntry) {
        throw new ConflictException(
          'Existing project milestones cannot be aligned with the contract snapshot.',
        );
      }

      const milestoneAmount = this.toMoneyDecimal(milestone.amount);
      const snapshotAmount = this.toMoneyDecimal(fallbackEntry.amount);
      const milestoneRetention = this.toMoneyDecimal(milestone.retentionAmount ?? 0);
      const snapshotRetention = this.toMoneyDecimal(fallbackEntry.retentionAmount ?? 0);
      const milestoneCriteria = JSON.stringify(milestone.acceptanceCriteria ?? []);
      const snapshotCriteria = JSON.stringify(fallbackEntry.acceptanceCriteria ?? []);
      const milestoneStartDate = milestone.startDate ? new Date(milestone.startDate).toISOString() : null;
      const milestoneDueDate = milestone.dueDate ? new Date(milestone.dueDate).toISOString() : null;

      if (milestone.title !== fallbackEntry.title) {
        throw new ConflictException('Existing project milestone title differs from contract snapshot.');
      }
      if ((milestone.description ?? null) !== (fallbackEntry.description ?? null)) {
        throw new ConflictException(
          'Existing project milestone description differs from contract snapshot.',
        );
      }
      if (!milestoneAmount.equals(snapshotAmount)) {
        throw new ConflictException(
          'Existing project milestone amount differs from contract snapshot.',
        );
      }
      if ((milestone.deliverableType ?? null) !== (fallbackEntry.deliverableType ?? null)) {
        throw new ConflictException(
          'Existing project milestone deliverable type differs from contract snapshot.',
        );
      }
      if (!milestoneRetention.equals(snapshotRetention)) {
        throw new ConflictException(
          'Existing project milestone retention differs from contract snapshot.',
        );
      }
      if (milestoneCriteria !== snapshotCriteria) {
        throw new ConflictException(
          'Existing project milestone acceptance criteria differs from contract snapshot.',
        );
      }
      if (milestoneStartDate !== this.normalizeOptionalDate(fallbackEntry.startDate ?? null)) {
        throw new ConflictException(
          'Existing project milestone start date differs from contract snapshot.',
        );
      }
      if (milestoneDueDate !== this.normalizeOptionalDate(fallbackEntry.dueDate ?? null)) {
        throw new ConflictException(
          'Existing project milestone due date differs from contract snapshot.',
        );
      }
    });
  }

  private buildSignablePayload(contract: ContractEntity) {
    const context = contract.commercialContext ?? this.buildCommercialContextFallback(contract);
    const snapshot = this.sortSnapshot(contract.milestoneSnapshot || []).map((milestone) => ({
      contractMilestoneKey: milestone.contractMilestoneKey,
      sourceSpecMilestoneId: milestone.sourceSpecMilestoneId ?? null,
      title: milestone.title,
      description: milestone.description ?? null,
      amount: this.normalizeMoney(milestone.amount),
      startDate: this.normalizeOptionalDate(milestone.startDate ?? null),
      dueDate: this.normalizeOptionalDate(milestone.dueDate ?? null),
      sortOrder: milestone.sortOrder ?? null,
      deliverableType: milestone.deliverableType ?? null,
      retentionAmount: this.normalizeMoney(milestone.retentionAmount ?? 0),
      acceptanceCriteria: Array.isArray(milestone.acceptanceCriteria)
        ? [...milestone.acceptanceCriteria]
        : [],
    }));

    return {
      id: contract.id,
      projectId: contract.projectId,
      sourceSpecId: contract.sourceSpecId ?? context.sourceSpecId ?? null,
      title: contract.title ?? '',
      termsContent: contract.termsContent ?? '',
      commercialContext: {
        sourceSpecId: context.sourceSpecId ?? null,
        sourceSpecUpdatedAt: context.sourceSpecUpdatedAt ?? null,
        requestId: context.requestId ?? null,
        projectTitle: context.projectTitle,
        clientId: context.clientId,
        brokerId: context.brokerId,
        freelancerId: context.freelancerId ?? null,
        totalBudget: this.normalizeMoney(context.totalBudget),
        currency: this.normalizeCurrency(context.currency),
        description: context.description ?? null,
        techStack: context.techStack ?? null,
        scopeNarrativeRichContent: this.normalizeNarrativeRichContent(
          context.scopeNarrativeRichContent ?? null,
        ),
        scopeNarrativePlainText: context.scopeNarrativePlainText ?? null,
        features: Array.isArray(context.features)
          ? context.features.map((feature) => ({
              title: feature.title,
              description: feature.description,
              complexity: feature.complexity,
              acceptanceCriteria: [...(feature.acceptanceCriteria || [])],
              inputOutputSpec: feature.inputOutputSpec ?? null,
            }))
          : [],
        escrowSplit: context.escrowSplit ?? { ...ContractsService.DEFAULT_ESCROW_SPLIT },
      },
      milestoneSnapshot: snapshot,
    };
  }

  private computeContentHash(contract: ContractEntity): string {
    return createHash('sha256')
      .update(JSON.stringify(this.buildSignablePayload(contract)))
      .digest('hex');
  }

  private computeContractDocumentHash(contract: ContractEntity): string {
    const payload = JSON.stringify({
      contentHash: contract.contentHash ?? this.computeContentHash(contract),
      status: contract.status ?? ContractStatus.DRAFT,
      activatedAt: contract.activatedAt?.toISOString?.() ?? null,
      signatures: Array.isArray(contract.signatures)
        ? contract.signatures
            .map((signature) => ({
              userId: signature.userId,
              signerRole: signature.signerRole ?? null,
              contentHash: signature.contentHash ?? null,
              signatureHash: signature.signatureHash,
              signedAt: signature.signedAt,
            }))
            .sort((a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime())
        : null,
    });

    return createHash('sha256').update(payload).digest('hex');
  }

  private generateContractTermsFromSnapshot(
    title: string,
    commercialContext: ContractCommercialContext,
    snapshot: ContractMilestoneSnapshotItem[],
  ): string {
    let sectionNumber = 1;
    let terms = `# DEVELOPMENT AGREEMENT\n\n`;
    terms += `## ${sectionNumber}. Scope of Work\n`;
    terms += `Project: ${commercialContext.projectTitle || title}\n`;
    if (commercialContext.description) {
      terms += `${commercialContext.description}\n\n`;
    }
    terms += `Budget: $${this.normalizeMoney(commercialContext.totalBudget).toFixed(2)} ${
      commercialContext.currency
    }\n\n`;
    sectionNumber += 1;

    if (Array.isArray(commercialContext.features) && commercialContext.features.length > 0) {
      terms += `## ${sectionNumber}. Features & Acceptance Criteria\n`;
      commercialContext.features.forEach((feature, idx) => {
        terms += `### ${sectionNumber}.${idx + 1} ${feature.title} (${feature.complexity})\n`;
        terms += `${feature.description}\n`;
        if (feature.acceptanceCriteria?.length) {
          terms += `**Acceptance Criteria:**\n`;
          feature.acceptanceCriteria.forEach((criterion) => {
            terms += `- ${criterion}\n`;
          });
        }
        terms += `\n`;
      });
      sectionNumber += 1;
    }

    if (commercialContext.scopeNarrativePlainText) {
      terms += `## ${sectionNumber}. Detailed Scope Notes\n`;
      terms += `${this.demoteMarkdownHeadings(commercialContext.scopeNarrativePlainText)}\n\n`;
      sectionNumber += 1;
    }

    terms += `## ${sectionNumber}. Tech Stack\n${
      commercialContext.techStack || 'As specified in proposal'
    }\n\n`;
    sectionNumber += 1;
    terms += `## ${sectionNumber}. Payment Schedule (Milestones)\n`;
    this.sortSnapshot(snapshot).forEach((milestone, index) => {
      terms += `### ${sectionNumber}.${index + 1} Milestone ${index + 1}: ${milestone.title}\n`;
      terms += `- Amount: $${this.normalizeMoney(milestone.amount).toFixed(2)}\n`;
      terms += `- Deliverable: ${milestone.deliverableType || DeliverableType.OTHER}\n`;
      if (milestone.startDate) {
        terms += `- Start Date: ${new Date(milestone.startDate).toLocaleDateString('en-US')}\n`;
      }
      if (milestone.dueDate) {
        terms += `- Due Date: ${new Date(milestone.dueDate).toLocaleDateString('en-US')}\n`;
      }
      if (Number(milestone.retentionAmount || 0) > 0) {
        terms += `- Retention (Warranty): $${this.normalizeMoney(
          milestone.retentionAmount,
        ).toFixed(2)}\n`;
      }
      if (milestone.acceptanceCriteria?.length) {
        terms += `- Acceptance Criteria:\n`;
        milestone.acceptanceCriteria.forEach((criterion) => {
          terms += `  - ${criterion}\n`;
        });
      }
      terms += `\n`;
    });

    return terms;
  }

  private ensureContractContentHash(contract: ContractEntity): string {
    if (!contract.commercialContext) {
      contract.commercialContext = this.buildCommercialContextFallback(contract);
    }
    if (!Array.isArray(contract.milestoneSnapshot)) {
      contract.milestoneSnapshot = [];
    }
    const nextContentHash = this.computeContentHash(contract);
    contract.contentHash = nextContentHash;
    return nextContentHash;
  }

  private normalizeStoredContractUrl(contract: Pick<ContractEntity, 'id' | 'contractUrl'>): string {
    return normalizeContractPdfUrl(contract.id, contract.contractUrl);
  }

  private async hydrateContractReadModel(
    contract: ContractEntity,
  ): Promise<ContractEntity & { documentHash?: string }> {
    let selectedSpec: ProjectSpecEntity | null = null;
    if (contract.project?.request?.specs) {
      selectedSpec = this.selectSpecForContract(
        contract.project.request.specs,
        contract.sourceSpecId ?? null,
      );
      contract.project.request.spec = selectedSpec;
    }

    if (!contract.commercialContext) {
      contract.commercialContext = this.buildCommercialContextFallback(contract, selectedSpec);
    }
    if (!Array.isArray(contract.milestoneSnapshot) || contract.milestoneSnapshot.length === 0) {
      if (selectedSpec?.milestones?.length) {
        contract.milestoneSnapshot = this.buildSnapshotFromSpecMilestones(selectedSpec);
      } else {
        contract.milestoneSnapshot = [];
      }
    }

    const updatePayload: Partial<ContractEntity> = {};

    const currentContentHash = this.computeContentHash(contract);
    if (contract.contentHash !== currentContentHash) {
      contract.contentHash = currentContentHash;
      updatePayload.contentHash = currentContentHash;
    }

    const nextContractUrl = this.normalizeStoredContractUrl(contract);
    if (contract.contractUrl !== nextContractUrl) {
      contract.contractUrl = nextContractUrl;
      updatePayload.contractUrl = nextContractUrl;
    }

    if (Object.keys(updatePayload).length > 0) {
      await this.contractsRepository.update(contract.id, updatePayload);
    }

    if (contract.projectId) {
      const escrowRepository = this.dataSource.getRepository(EscrowEntity);
      const escrows = await escrowRepository.find({
        where: { projectId: contract.projectId },
        select: {
          id: true,
          status: true,
        },
      });

      const releasedEscrows = escrows.filter((item) => item.status === EscrowStatus.RELEASED).length;
      const disputedEscrows = escrows.filter((item) => item.status === EscrowStatus.DISPUTED).length;
      const fundedEscrows = escrows.filter((item) => item.status === EscrowStatus.FUNDED).length;

      (contract as any).runtimeEscrowSummary = {
        totalEscrows: escrows.length,
        fundedEscrows,
        releasedEscrows,
        disputedEscrows,
        refundableEscrows: fundedEscrows,
        cancelShortcutAvailable: releasedEscrows === 0 && disputedEscrows === 0,
      };
    }

    (contract as any).documentHash = this.computeContractDocumentHash(contract);
    return contract as ContractEntity & { documentHash?: string };
  }

  private async persistSignedContractArchiveIfPossible(contractId: string): Promise<boolean> {
    try {
      const contract = await this.findContractForRead(contractId);
      await this.hydrateContractReadModel(contract);

      if (contract.status !== ContractStatus.SIGNED) {
        return false;
      }

      const documentHash =
        (contract as any).documentHash || this.computeContractDocumentHash(contract);

      if (
        contract.archiveStoragePath &&
        contract.archiveDocumentHash === documentHash &&
        contract.archivePersistedAt
      ) {
        return true;
      }

      const pdfBuffer = await this.buildPdfBufferForContract(
        contract as ContractEntity & { documentHash?: string },
      );
      const persisted = await this.contractArchiveStorage.persistPdfArtifact(
        contract.id,
        documentHash,
        pdfBuffer,
      );

      if (!persisted) {
        this.logger.warn(
          `Contract ${contract.id} signed without persisted archive artifact; dynamic PDF fallback remains available.`,
        );
        return false;
      }

      await this.contractsRepository.update(contract.id, {
        contractUrl: this.normalizeStoredContractUrl(contract),
        archiveStoragePath: persisted.storagePath,
        archivePersistedAt: new Date(),
        archiveDocumentHash: documentHash,
      });

      return true;
    } catch (error) {
      this.logger.warn(
        `Contract ${contractId} signed but archive persistence was skipped: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return false;
    }
  }

  private normalizeClientIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].split(',')[0].trim();
    }
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || null;
  }

  private buildServerSignatureHash(params: {
    contractId: string;
    userId: string;
    contentHash: string;
    signerRole: ContractPartyRole;
    signedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          contractId: params.contractId,
          userId: params.userId,
          contentHash: params.contentHash,
          signerRole: params.signerRole,
          signedAt: params.signedAt.toISOString(),
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        }),
      )
      .digest('hex');
  }

  private async loadContractForUpdate(
    queryRunner: QueryRunner,
    contractId: string,
  ): Promise<ContractEntity> {
    const contract = await queryRunner.manager.findOne(ContractEntity, {
      where: { id: contractId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const project = await queryRunner.manager.findOne(ProjectEntity, {
      where: { id: contract.projectId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!project) {
      throw new BadRequestException(
        'Contract is not linked to an existing project. Please re-initialize contract.',
      );
    }

    contract.project = project;
    return contract;
  }

  private async findContractForRead(id: string): Promise<ContractEntity> {
    const contract = await this.contractsRepository.findOne({
      where: { id },
      relations: [
        'project',
        'project.client',
        'project.broker',
        'project.freelancer',
        'project.request',
        'project.request.specs',
        'project.request.specs.milestones',
        'signatures',
        'signatures.user',
      ],
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    return contract;
  }

  private async resolveSpecForLegacyActivation(
    queryRunner: QueryRunner,
    contract: ContractEntity,
  ): Promise<ProjectSpecEntity | null> {
    const project = contract.project as ProjectEntity | undefined;
    if (!project) {
      return null;
    }

    if (contract.sourceSpecId) {
      const sourceSpec = await queryRunner.manager.findOne(ProjectSpecEntity, {
        where: { id: contract.sourceSpecId },
        relations: ['milestones'],
      });
      if (sourceSpec) {
        return sourceSpec;
      }
    }

    if (!project.requestId) {
      return null;
    }

    return queryRunner.manager.findOne(ProjectSpecEntity, {
      where: [
        {
          requestId: project.requestId,
          status: ProjectSpecStatus.ALL_SIGNED,
          specPhase: SpecPhase.FULL_SPEC,
        },
        {
          requestId: project.requestId,
          status: ProjectSpecStatus.APPROVED,
          specPhase: SpecPhase.FULL_SPEC,
        },
      ],
      relations: ['milestones'],
      order: { createdAt: 'DESC' },
    });
  }

  private async hydrateSnapshotFromLegacySpec(
    queryRunner: QueryRunner,
    contract: ContractEntity,
    project: ProjectEntity,
  ): Promise<ContractMilestoneSnapshotItem[]> {
    const spec = await this.resolveSpecForLegacyActivation(queryRunner, contract);
    if (!spec) {
      throw new BadRequestException('Cannot resolve source spec for this legacy contract.');
    }

    const snapshot = this.buildSnapshotFromSpecMilestones(spec);
    contract.commercialContext =
      contract.commercialContext ??
      this.buildCommercialContextFromSpec(
        spec,
        project,
        project.freelancerId ?? null,
        snapshot,
      );
    contract.milestoneSnapshot = snapshot;
    this.ensureContractContentHash(contract);
    await queryRunner.manager.save(ContractEntity, contract);
    return snapshot;
  }

  private async repairActivatedLegacyMilestones(
    queryRunner: QueryRunner,
    contract: ContractEntity,
    existingMilestones: MilestoneEntity[],
  ) {
    const snapshot = this.sortSnapshot(contract.milestoneSnapshot || []);
    if (snapshot.length === 0 || existingMilestones.length === 0) {
      return;
    }

    const snapshotBySortOrder = new Map<number, ContractMilestoneSnapshotItem>();
    snapshot.forEach((item) => {
      if (Number.isInteger(item.sortOrder)) {
        snapshotBySortOrder.set(item.sortOrder as number, item);
      }
    });

    const milestonesToUpdate: MilestoneEntity[] = [];
    for (const milestone of existingMilestones) {
      const snapshotEntry =
        milestone.sourceContractMilestoneKey
          ? snapshot.find((entry) => entry.contractMilestoneKey === milestone.sourceContractMilestoneKey)
          : undefined;
      const fallbackEntry =
        snapshotEntry ??
        (Number.isInteger(milestone.sortOrder)
          ? snapshotBySortOrder.get(milestone.sortOrder as number)
          : undefined);

      if (fallbackEntry && milestone.sourceContractMilestoneKey !== fallbackEntry.contractMilestoneKey) {
        milestone.sourceContractMilestoneKey = fallbackEntry.contractMilestoneKey;
        milestonesToUpdate.push(milestone);
      }
    }

    if (milestonesToUpdate.length > 0) {
      await queryRunner.manager.save(MilestoneEntity, milestonesToUpdate);
    }
  }

  private async createEscrowsFromSnapshot(
    queryRunner: QueryRunner,
    project: ProjectEntity,
    savedMilestones: MilestoneEntity[],
    commercialContext: ContractCommercialContext,
  ) {
    const split = commercialContext.escrowSplit ?? { ...ContractsService.DEFAULT_ESCROW_SPLIT };
    const escrows: EscrowEntity[] = savedMilestones.map((milestone) => {
      const escrow = new EscrowEntity();
      escrow.projectId = project.id;
      escrow.milestoneId = milestone.id;
      escrow.totalAmount = milestone.amount;

      const amount = new Decimal(milestone.amount);
      escrow.developerShare = amount.times(split.developerPercentage).div(100).toNumber();
      escrow.brokerShare = amount.times(split.brokerPercentage).div(100).toNumber();
      escrow.platformFee = amount.times(split.platformPercentage).div(100).toNumber();
      escrow.fundedAmount = 0;
      escrow.releasedAmount = 0;
      escrow.developerPercentage = split.developerPercentage;
      escrow.brokerPercentage = split.brokerPercentage;
      escrow.platformPercentage = split.platformPercentage;
      escrow.currency = commercialContext.currency || project.currency || ContractsService.DEFAULT_CURRENCY;
      escrow.clientApproved = false;
      escrow.status = EscrowStatus.PENDING;
      return escrow;
    });

    if (escrows.length > 0) {
      await queryRunner.manager.save(EscrowEntity, escrows);
    }
  }

  private buildRuntimeMilestoneFromSnapshot(
    projectId: string,
    sourceSpecId: string | null,
    snapshotItem: ContractMilestoneSnapshotItem,
  ): MilestoneEntity {
    const milestone = new MilestoneEntity();
    milestone.projectId = projectId;
    milestone.projectSpecId = sourceSpecId;
    milestone.sourceContractMilestoneKey = snapshotItem.contractMilestoneKey;
    milestone.title = snapshotItem.title;
    milestone.description = snapshotItem.description ?? null;
    milestone.amount = snapshotItem.amount;
    milestone.deliverableType =
      (snapshotItem.deliverableType as DeliverableType | null) ?? DeliverableType.OTHER;
    milestone.retentionAmount = snapshotItem.retentionAmount ?? 0;
    milestone.acceptanceCriteria = snapshotItem.acceptanceCriteria ?? [];
    milestone.sortOrder = snapshotItem.sortOrder ?? null;
    milestone.startDate = snapshotItem.startDate ? new Date(snapshotItem.startDate) : null;
    milestone.dueDate = snapshotItem.dueDate ? new Date(snapshotItem.dueDate) : null;
    milestone.status = MilestoneStatus.PENDING;
    return milestone;
  }

  private assertContractCanBeActivated(contract: ContractEntity) {
    if (contract.activatedAt) {
      return;
    }
    if (contract.status !== ContractStatus.SIGNED) {
      throw new BadRequestException('Contract must be SIGNED before activation.');
    }
    if (contract.legalSignatureStatus !== ContractLegalSignatureStatus.VERIFIED) {
      throw new BadRequestException(
        'Contract must be legally verified by the signature provider before activation.',
      );
    }
  }

  private async activateProjectInTransaction(
    queryRunner: QueryRunner,
    contractId: string,
    options?: { requireAllSignatures?: boolean; actor?: UserEntity },
  ) {
    const contract = await this.loadContractForUpdate(queryRunner, contractId);
    const project = contract.project as ProjectEntity;

    if (options?.actor) {
      this.assertUserIsContractParty(options.actor, contract, 'activate');
    }

    if (!contract.commercialContext || !contract.milestoneSnapshot?.length) {
      await this.hydrateSnapshotFromLegacySpec(queryRunner, contract, project);
    }

    const existingMilestones = await queryRunner.manager.find(MilestoneEntity, {
      where: { projectId: project.id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const snapshot = this.sortSnapshot(contract.milestoneSnapshot || []);
    const commercialContext = contract.commercialContext ?? this.buildCommercialContextFallback(contract);

    this.validateSnapshotInvariants(snapshot, commercialContext, project);

    if (options?.requireAllSignatures) {
      this.assertContractCanBeActivated(contract);
      const signatures = await queryRunner.manager.find(DigitalSignatureEntity, {
        where: { contractId },
      });
      const signedUserIds = new Set(signatures.map((signature) => signature.userId));
      const allRequiredSigned = this.getRequiredContractSignerIds(contract).every((id) =>
        signedUserIds.has(id),
      );
      if (!allRequiredSigned) {
        throw new BadRequestException(
          'Contract must have all required signatures before activation.',
        );
      }
    }

    if (contract.activatedAt) {
      await this.repairActivatedLegacyMilestones(queryRunner, contract, existingMilestones);
      if (contract.status !== ContractStatus.ACTIVATED) {
        contract.status = ContractStatus.ACTIVATED;
        await queryRunner.manager.save(ContractEntity, contract);
      }
      return {
        status: 'Already activated',
        alreadyActivated: true,
        activatedAt: contract.activatedAt,
        clonedMilestones: existingMilestones.length,
      };
    }

    let clonedMilestones = existingMilestones.length;
    if (existingMilestones.length === 0) {
      const milestonesToSave = snapshot.map((item) =>
        this.buildRuntimeMilestoneFromSnapshot(project.id, contract.sourceSpecId ?? null, item),
      );
      const savedMilestones =
        milestonesToSave.length > 0
          ? await queryRunner.manager.save(MilestoneEntity, milestonesToSave)
          : [];
      clonedMilestones = savedMilestones.length;
      await this.createEscrowsFromSnapshot(queryRunner, project, savedMilestones, commercialContext);
    } else {
      this.assertExistingMilestonesMatchSnapshot(existingMilestones, snapshot);
      await this.repairActivatedLegacyMilestones(queryRunner, contract, existingMilestones);
      const existingEscrows = await queryRunner.manager.find(EscrowEntity, {
        where: { projectId: project.id },
      });
      const escrowedMilestoneIds = new Set(existingEscrows.map((escrow) => escrow.milestoneId));
      const milestonesNeedingEscrow = existingMilestones.filter(
        (milestone) => !escrowedMilestoneIds.has(milestone.id),
      );
      await this.createEscrowsFromSnapshot(
        queryRunner,
        project,
        milestonesNeedingEscrow,
        commercialContext,
      );
    }

    project.status = ProjectStatus.IN_PROGRESS;
    project.totalBudget = commercialContext.totalBudget;
    project.currency = commercialContext.currency;
    await queryRunner.manager.save(ProjectEntity, project);

    if (project.requestId) {
      await queryRunner.manager.update(
        ProjectRequestEntity,
        { id: project.requestId },
        { status: RequestStatus.CONVERTED_TO_PROJECT },
      );
    }

    contract.activatedAt = contract.activatedAt ?? new Date();
    contract.status = ContractStatus.ACTIVATED;
    await queryRunner.manager.save(ContractEntity, contract);

    this.logger.log(
      `Project ${project.id} activated from contract ${contract.id}. Cloned ${clonedMilestones} milestones.`,
    );

    return {
      status: 'Activated',
      clonedMilestones,
      activatedAt: contract.activatedAt,
      alreadyActivated: false,
    };
  }

  async findOneForUser(user: UserEntity, id: string) {
    const contract = await this.findContractForRead(id);
    this.assertUserCanViewContract(user, contract);
    await this.hydrateContractReadModel(contract);
    (contract as any).requiredSignerCount = this.getRequiredContractSignerIds(contract).length;
    (contract as any).signedCount = Array.isArray(contract.signatures) ? contract.signatures.length : 0;
    return contract;
  }

  async listByUser(userId: string) {
    const contracts = await this.contractsRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.project', 'project')
      .leftJoinAndSelect('project.client', 'client')
      .leftJoinAndSelect('project.freelancer', 'freelancer')
      .where(
        new Brackets((qb) => {
          qb.where('project.clientId = :userId', { userId })
            .orWhere('project.brokerId = :userId', { userId })
            .orWhere('project.freelancerId = :userId', { userId })
            .orWhere(
              'project.staffId = :userId AND project.staffInviteStatus = :acceptedInviteStatus',
              {
                userId,
                acceptedInviteStatus: ProjectStaffInviteStatus.ACCEPTED,
              },
            );
        }),
      )
      .andWhere('contract.status <> :archivedStatus', { archivedStatus: ContractStatus.ARCHIVED })
      .orderBy('contract.createdAt', 'DESC')
      .getMany();

    return contracts.map((contract) => ({
      id: contract.id,
      projectId: contract.projectId,
      requestId: contract.project.requestId ?? null,
      activatedAt: contract.activatedAt ?? null,
      projectStatus: contract.project.status ?? null,
      projectTitle: contract.project.title,
      title: contract.title,
      status: contract.status,
      legalSignatureStatus: contract.legalSignatureStatus,
      provider: contract.provider ?? null,
      verifiedAt: contract.verifiedAt ?? null,
      certificateSerial: contract.certificateSerial ?? null,
      createdAt: contract.createdAt,
      clientName: contract.project.client?.fullName || 'Unknown',
      freelancerName: contract.project.freelancer?.fullName || null,
    }));
  }

  async initializeProjectAndContract(user: UserEntity, specId: string, freelancerId?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const spec = await queryRunner.manager.findOne(ProjectSpecEntity, {
        where: { id: specId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!spec) {
        throw new NotFoundException('Spec not found');
      }

      const request = await queryRunner.manager.findOne(ProjectRequestEntity, {
        where: { id: spec.requestId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request) {
        throw new BadRequestException('Spec is not linked to a project request');
      }

      spec.request = request;
      spec.milestones = await queryRunner.manager.find(MilestoneEntity, {
        where: { projectSpecId: spec.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });

      if (spec.lockedByContractId) {
        throw new ConflictException('This spec is already locked by an existing contract.');
      }
      if (user.id !== request.brokerId) {
        throw new ForbiddenException('Only Broker can initialize contract');
      }

      const isPhasedFlowReady =
        spec.specPhase === SpecPhase.FULL_SPEC && spec.status === ProjectSpecStatus.ALL_SIGNED;
      const isLegacyReady = spec.status === ProjectSpecStatus.APPROVED;
      if (!isPhasedFlowReady && !isLegacyReady) {
        throw new BadRequestException(
          `Spec must be ALL_SIGNED (new flow) or APPROVED (legacy). Current: ${spec.status}`,
        );
      }

      const acceptedFreelancerId = await this.resolveAcceptedFreelancerId(spec.requestId);
      if (freelancerId && acceptedFreelancerId && freelancerId !== acceptedFreelancerId) {
        throw new BadRequestException(
          'freelancerId does not match the accepted freelancer for this request.',
        );
      }

      const resolvedFreelancerId = acceptedFreelancerId ?? freelancerId ?? null;
      if (isPhasedFlowReady && !resolvedFreelancerId) {
        throw new BadRequestException(
          'Cannot initialize contract: no accepted freelancer found for this request.',
        );
      }

      const existingContract = await queryRunner.manager.findOne(ContractEntity, {
        where: { sourceSpecId: spec.id },
      });
      if (existingContract && existingContract.status !== ContractStatus.ARCHIVED) {
        throw new BadRequestException('Contract already initialized for this spec');
      }

      const snapshot = this.buildSnapshotFromSpecMilestones(spec);
      const project = queryRunner.manager.create(ProjectEntity, {
        requestId: spec.requestId,
        brokerId: request.brokerId,
        clientId: request.clientId,
        freelancerId: resolvedFreelancerId,
        title: spec.title,
        description: spec.description,
        totalBudget: this.normalizeMoney(this.sumSnapshotAmounts(snapshot)),
        currency: ContractsService.DEFAULT_CURRENCY,
        status: ProjectStatus.INITIALIZING,
        createdAt: new Date(),
      });
      const savedProject = await queryRunner.manager.save(project);

      const commercialContext = this.buildCommercialContextFromSpec(
        spec,
        savedProject,
        resolvedFreelancerId,
        snapshot,
      );
      this.validateSnapshotInvariants(snapshot, commercialContext, savedProject);

      const contract = queryRunner.manager.create(ContractEntity, {
        projectId: savedProject.id,
        sourceSpecId: spec.id,
        title: spec.title,
        contractUrl: `contracts/${savedProject.id}.pdf`,
        status: ContractStatus.SENT,
        legalSignatureStatus: ContractLegalSignatureStatus.NOT_STARTED,
        commercialContext,
        milestoneSnapshot: snapshot,
        createdBy: user.id,
      });
      contract.termsContent = this.generateContractTermsFromSnapshot(
        contract.title,
        commercialContext,
        snapshot,
      );
      const savedContract = await queryRunner.manager.save(contract);
      savedContract.contentHash = this.computeContentHash(savedContract);
      savedContract.contractUrl = this.normalizeStoredContractUrl(savedContract);
      await queryRunner.manager.save(ContractEntity, savedContract);

      spec.lockedByContractId = savedContract.id;
      spec.lockedAt = new Date();
      await queryRunner.manager.save(ProjectSpecEntity, spec);

      await queryRunner.commitTransaction();
      savedContract.project = savedProject;
      this.emitContractUpdated(savedContract);
      await this.notifyContractParticipants(savedContract, {
        title: 'Contract initialized',
        body: `Contract "${savedContract.title}" is ready for review and signature preparation.`,
      });
      return this.findOneForUser(user, savedContract.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to init contract: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateDraft(user: UserEntity, contractId: string, dto: UpdateContractDraftDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const contract = await this.loadContractForUpdate(queryRunner, contractId);
      const project = contract.project as ProjectEntity;
      this.assertUserCanManageDraft(user, contract);

      if (contract.status !== ContractStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT contracts can be edited.');
      }

      const signatures = await queryRunner.manager.find(DigitalSignatureEntity, {
        where: { contractId },
      });
      if (signatures.length > 0) {
        throw new BadRequestException('Contract draft can no longer be edited after signing starts.');
      }

      const currentSnapshot = this.sortSnapshot(contract.milestoneSnapshot || []);
      const nextSnapshot =
        dto.milestoneSnapshot !== undefined
          ? this.sortSnapshot(dto.milestoneSnapshot.map((item) => this.normalizeSnapshotItem(item)))
          : currentSnapshot;

      if (dto.title !== undefined) {
        const nextTitle = dto.title.trim();
        if (!nextTitle) {
          throw new BadRequestException('Contract title cannot be empty.');
        }
        contract.title = nextTitle;
      }

      const commercialContext = this.buildCommercialContextFromDraft(contract, project, nextSnapshot, {
        currency: dto.currency,
      });
      this.validateSnapshotInvariants(nextSnapshot, commercialContext, {
        ...project,
        totalBudget: commercialContext.totalBudget,
      } as ProjectEntity);

      contract.commercialContext = commercialContext;
      contract.milestoneSnapshot = nextSnapshot;
      contract.termsContent = this.generateContractTermsFromSnapshot(
        contract.title,
        commercialContext,
        nextSnapshot,
      );
      this.resetLegalSignatureProgress(contract);
      contract.contentHash = this.computeContentHash(contract);

      project.totalBudget = commercialContext.totalBudget;
      project.currency = commercialContext.currency;
      await queryRunner.manager.save(ProjectEntity, project);
      await queryRunner.manager.save(ContractEntity, contract);

      await queryRunner.commitTransaction();
      this.emitContractUpdated(contract);
      return this.findOneForUser(user, contractId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async sendDraft(user: UserEntity, contractId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const contract = await this.loadContractForUpdate(queryRunner, contractId);
      const project = contract.project as ProjectEntity;
      this.assertUserCanManageDraft(user, contract);

      if (contract.status !== ContractStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT contracts can be sent for signatures.');
      }

      const signatures = await queryRunner.manager.find(DigitalSignatureEntity, {
        where: { contractId },
      });
      if (signatures.length > 0) {
        throw new BadRequestException('Contract has already entered the signing phase.');
      }

      if (!contract.commercialContext || !contract.milestoneSnapshot?.length) {
        await this.hydrateSnapshotFromLegacySpec(queryRunner, contract, project);
      }

      this.validateSnapshotInvariants(
        contract.milestoneSnapshot || [],
        contract.commercialContext as ContractCommercialContext,
        project,
      );
      contract.termsContent = this.generateContractTermsFromSnapshot(
        contract.title,
        contract.commercialContext as ContractCommercialContext,
        contract.milestoneSnapshot || [],
      );
      this.resetLegalSignatureProgress(contract);
      contract.contentHash = this.computeContentHash(contract);
      contract.status = ContractStatus.SENT;
      await queryRunner.manager.save(ContractEntity, contract);

      await queryRunner.commitTransaction();
      this.emitContractUpdated(contract);
      await this.notifyContractParticipants(contract, {
        title: 'Contract sent for signing',
        body: `Contract "${contract.title}" is now ready for all required parties to sign.`,
      });
      return this.findOneForUser(user, contractId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async discardDraft(user: UserEntity, contractId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const contract = await this.loadContractForUpdate(queryRunner, contractId);
      const project = contract.project as ProjectEntity;
      this.assertUserCanManageDraft(user, contract);

      if (![ContractStatus.DRAFT, ContractStatus.SENT].includes(contract.status)) {
        throw new BadRequestException(
          'Only contracts that have not been signed yet can be discarded.',
        );
      }

      const signatures = await queryRunner.manager.find(DigitalSignatureEntity, {
        where: { contractId },
      });
      if (signatures.length > 0) {
        throw new BadRequestException('Cannot discard a contract after signing starts.');
      }

      contract.status = ContractStatus.ARCHIVED;
      this.resetLegalSignatureProgress(contract);
      await queryRunner.manager.save(ContractEntity, contract);

      project.status = ProjectStatus.CANCELED;
      await queryRunner.manager.save(ProjectEntity, project);

      if (contract.sourceSpecId) {
        const spec = await queryRunner.manager.findOne(ProjectSpecEntity, {
          where: { id: contract.sourceSpecId },
          lock: { mode: 'pessimistic_write' },
        });
        if (spec && spec.lockedByContractId === contract.id) {
          spec.lockedByContractId = null;
          spec.lockedAt = null;
          await queryRunner.manager.save(ProjectSpecEntity, spec);
        }
      }

      await queryRunner.commitTransaction();
      this.emitContractUpdated(contract);
      await this.notifyContractParticipants(contract, {
        title: 'Contract archived',
        body: `Contract "${contract.title}" was archived before signature completion.`,
      });
      return { status: 'Archived', contractId };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private formatDateForDisplay(input: string | Date | null | undefined): string {
    if (!input) {
      return 'Not set';
    }
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      return 'Invalid date';
    }
    return parsed.toLocaleDateString('en-US');
  }

  private formatDateTimeForDisplay(input: string | Date | null | undefined): string {
    if (!input) {
      return 'Not set';
    }
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      return 'Invalid date';
    }
    return parsed.toLocaleString('en-US');
  }

  private formatMoneyForDisplay(amount: Decimal.Value | null | undefined, currency?: string | null) {
    return `${this.normalizeMoney(amount).toFixed(2)} ${this.normalizeCurrency(currency)}`;
  }

  private stripTermsPresentationMarkers(line: string): string {
    return line.replace(/\*\*(.*?)\*\*/g, '$1').trim();
  }

  private buildTermsPdfBlocks(termsContent: string | null | undefined) {
    if (!termsContent?.trim()) {
      return [{ text: 'No agreement text available.', color: '#64748b' }];
    }

    const lines = termsContent.split(/\r?\n/);
    const blocks: Array<Record<string, unknown>> = [];
    let paragraphBuffer: string[] = [];

    const flushParagraph = () => {
      if (paragraphBuffer.length === 0) {
        return;
      }

      blocks.push({
        text: paragraphBuffer.join(' '),
        style: 'termsParagraph',
      });
      paragraphBuffer = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();

      if (!trimmed) {
        flushParagraph();
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph();
        const markerCount = headingMatch[1].length;
        blocks.push({
          text: this.stripTermsPresentationMarkers(headingMatch[2]),
          style:
            markerCount === 1
              ? 'termsHeadingPrimary'
              : markerCount === 2
                ? 'termsHeadingSecondary'
                : 'termsHeadingTertiary',
        });
        continue;
      }

      const taskMatch = line.match(/^(\s*)-\s+\[(x|X| )\]\s+(.+)$/);
      if (taskMatch) {
        flushParagraph();
        blocks.push({
          text: `${taskMatch[2].toLowerCase() === 'x' ? '☑' : '☐'} ${this.stripTermsPresentationMarkers(
            taskMatch[3],
          )}`,
          style: 'termsBullet',
          margin: [taskMatch[1].length >= 2 ? 18 : 0, 0, 0, 4],
        });
        continue;
      }

      const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (orderedMatch) {
        flushParagraph();
        blocks.push({
          text: `${orderedMatch[2]}. ${this.stripTermsPresentationMarkers(orderedMatch[3])}`,
          style: 'termsBullet',
          margin: [orderedMatch[1].length >= 2 ? 18 : 0, 0, 0, 4],
        });
        continue;
      }

      const bulletMatch = line.match(/^(\s*)-\s+(.+)$/);
      if (bulletMatch) {
        flushParagraph();
        blocks.push({
          text: `• ${this.stripTermsPresentationMarkers(bulletMatch[2])}`,
          style: 'termsBullet',
          margin: [bulletMatch[1].length >= 2 ? 18 : 0, 0, 0, 4],
        });
        continue;
      }

      const quoteMatch = trimmed.match(/^>\s+(.+)$/);
      if (quoteMatch) {
        flushParagraph();
        blocks.push({
          text: this.stripTermsPresentationMarkers(quoteMatch[1]),
          style: 'termsQuote',
        });
        continue;
      }

      if (/^---+$/.test(trimmed)) {
        flushParagraph();
        blocks.push({
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 0.8,
              lineColor: '#cbd5e1',
            },
          ],
          margin: [0, 6, 0, 8],
        });
        continue;
      }

      const emphasisMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/);
      if (emphasisMatch) {
        flushParagraph();
        blocks.push({
          text: this.stripTermsPresentationMarkers(emphasisMatch[1]),
          style: 'termsLabel',
        });
        continue;
      }

      paragraphBuffer.push(this.stripTermsPresentationMarkers(trimmed));
    }

    flushParagraph();
    return blocks;
  }

  private buildPdfSignatureTrail(
    contract: ContractEntity,
    signatures: Array<DigitalSignatureEntity & { user?: UserEntity | null }>,
  ) {
    if (signatures.length === 0) {
      return [['No signatures recorded yet.', '—', '—', 'No audit trail available yet.']];
    }

    return signatures
      .slice()
      .sort((a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime())
      .map((signature) => {
        const signerName =
          signature.user?.fullName ||
          (signature.userId === contract.project?.clientId
            ? contract.project?.client?.fullName
            : signature.userId === contract.project?.brokerId
              ? contract.project?.broker?.fullName
              : signature.userId === contract.project?.freelancerId
                ? contract.project?.freelancer?.fullName
                : null) ||
          signature.userId;

        const auditDetails = [
          `Signature hash: ${signature.signatureHash}`,
          signature.ipAddress ? `IP: ${signature.ipAddress}` : null,
          signature.userAgent ? `Agent: ${signature.userAgent}` : null,
        ]
          .filter(Boolean)
          .join('\n');

        return [
          signerName,
          signature.signerRole || signature.userId,
          this.formatDateTimeForDisplay(signature.signedAt),
          auditDetails,
        ];
      });
  }

  private getInterDevLogoDataUri(): string | null {
    if (this.interDevLogoDataUri !== undefined) {
      return this.interDevLogoDataUri;
    }

    const candidates = [
      resolve(process.cwd(), '..', 'client', 'public', 'assets', 'logo', 'LogoIcon.png'),
      resolve(process.cwd(), 'client', 'public', 'assets', 'logo', 'LogoIcon.png'),
      resolve(__dirname, '../../../..', 'client', 'public', 'assets', 'logo', 'LogoIcon.png'),
      resolve(__dirname, '../../../../..', 'client', 'public', 'assets', 'logo', 'LogoIcon.png'),
    ];

    const logoPath = candidates.find((candidate) => existsSync(candidate));
    if (!logoPath) {
      this.logger.warn('InterDev logo asset not found for contract PDF branding.');
      this.interDevLogoDataUri = null;
      return this.interDevLogoDataUri;
    }

    try {
      const logoBuffer = readFileSync(logoPath);
      this.interDevLogoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      return this.interDevLogoDataUri;
    } catch (error) {
      this.logger.warn(
        `Failed to load InterDev logo for contract PDF branding: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      this.interDevLogoDataUri = null;
      return this.interDevLogoDataUri;
    }
  }

  private async buildPdfBufferForContract(
    contract: ContractEntity & { documentHash?: string },
  ): Promise<Buffer> {
    const signatures = (contract.signatures || []) as Array<
      DigitalSignatureEntity & { user?: UserEntity | null }
    >;

    const pdfmake = require('pdfmake');
    pdfmake.addFonts({
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    });

    const snapshotMilestones = Array.isArray(contract.milestoneSnapshot)
      ? this.sortSnapshot(contract.milestoneSnapshot)
      : [];

    const requiredSignerIds = this.getRequiredContractSignerIds(contract);
    const signedUserIds = new Set(signatures.map((signature) => signature.userId));
    const missingSignerIds = requiredSignerIds.filter((id) => !signedUserIds.has(id));
    const commercialContext =
      contract.commercialContext ?? this.buildCommercialContextFallback(contract);
    const signatureRows = this.buildPdfSignatureTrail(contract, signatures);
    const termsBlocks = this.buildTermsPdfBlocks(contract.termsContent);
    const interDevLogo = this.getInterDevLogoDataUri();
    const milestoneRows =
      snapshotMilestones.length > 0
        ? snapshotMilestones.map((milestone, index) => [
            `${index + 1}. ${milestone.title}`,
            String(milestone.deliverableType || DeliverableType.OTHER).replace(/_/g, ' '),
            [
              milestone.startDate ? `Start: ${this.formatDateForDisplay(milestone.startDate)}` : null,
              milestone.dueDate ? `Due: ${this.formatDateForDisplay(milestone.dueDate)}` : null,
            ]
              .filter(Boolean)
              .join('\n') || 'Dates not set',
            this.formatMoneyForDisplay(milestone.amount, commercialContext.currency),
            this.formatMoneyForDisplay(milestone.retentionAmount ?? 0, commercialContext.currency),
          ])
        : [['No milestone snapshot available', '—', '—', '—', '—']];

    const signatureTimeline =
      signatures.length > 0
        ? signatures
            .slice()
            .sort((a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime())
            .map((signature) => ({
              text: [
                {
                  text: `${
                    signature.user?.fullName ||
                    signature.signerRole ||
                    signature.userId
                  }`,
                  bold: true,
                },
                {
                  text: ` · ${signature.signerRole || signature.userId} · ${this.formatDateTimeForDisplay(signature.signedAt)}`,
                },
              ],
              margin: [0, 0, 0, 6],
            }))
        : [{ text: 'No signatures recorded yet.', color: '#64748b' }];

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [32, 32, 32, 36],
      footer: (currentPage: number, pageCount: number) => ({
        margin: [32, 0, 32, 16],
        columns: [
          {
            stack: [
              { text: 'InterDev', style: 'footerBrand' },
              { text: 'Contract workspace artifact', style: 'footerMeta' },
            ],
          },
          {
            text: `${contract.id.slice(0, 8)} · Page ${currentPage}/${pageCount}`,
            alignment: 'right',
            style: 'footerMeta',
            margin: [0, 8, 0, 0],
          },
        ],
      }),
      defaultStyle: { font: 'Helvetica', fontSize: 10, color: '#0f172a' },
      content: [
        {
          columns: [
            interDevLogo
              ? {
                  columns: [
                    { image: interDevLogo, width: 28, margin: [0, 0, 8, 0] },
                    {
                      stack: [
                        {
                          text: [
                            { text: 'Inter', color: '#0f172a' },
                            { text: 'Dev', color: '#0f766e' },
                          ],
                          style: 'brandWordmark',
                        },
                        { text: 'Contract workspace', style: 'brandSubmark' },
                      ],
                      margin: [0, 2, 0, 0],
                      width: '*',
                    },
                  ],
                  width: 180,
                }
              : { text: 'InterDev', style: 'brandFallback', margin: [0, 6, 0, 0] },
            {
              stack: [
                { text: 'Contract Record', style: 'brandKicker', alignment: 'right' },
                {
                  text: 'Branded agreement artifact for signature, activation, and audit.',
                  style: 'brandCaption',
                  alignment: 'right',
                },
              ],
              width: '*',
            },
          ],
          columnGap: 12,
          margin: [0, 0, 0, 10],
        },
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    { text: contract.title || commercialContext.projectTitle, style: 'heroTitle' },
                    { text: 'Frozen commercial agreement for activation and escrow setup.', style: 'heroSubtitle' },
                    {
                      text: `Contract ${contract.id} · ${contract.status}`,
                      style: 'heroMeta',
                    },
                  ],
                  fillColor: '#0f766e',
                  margin: [18, 16, 18, 16],
                },
              ],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 14],
        },
        {
          columns: [
            [
              { text: 'Agreement Summary', style: 'section' },
              {
                table: {
                  widths: ['*', '*'],
                  body: [
                    [
                      { text: `Project\n${commercialContext.projectTitle}`, style: 'metricCard' },
                      {
                        text: `Budget\n${this.formatMoneyForDisplay(
                          commercialContext.totalBudget,
                          commercialContext.currency,
                        )}`,
                        style: 'metricCard',
                      },
                    ],
                    [
                      {
                        text: `Created\n${this.formatDateTimeForDisplay(contract.createdAt)}`,
                        style: 'metricCardMuted',
                      },
                      {
                        text: `Activated\n${this.formatDateTimeForDisplay(contract.activatedAt)}`,
                        style: 'metricCardMuted',
                      },
                    ],
                  ],
                },
                layout: {
                  hLineWidth: () => 0,
                  vLineWidth: () => 0,
                  paddingLeft: () => 0,
                  paddingRight: () => 10,
                  paddingTop: () => 0,
                  paddingBottom: () => 10,
                },
                margin: [0, 0, 0, 10],
              },
              { text: 'Commercial Snapshot', style: 'section' },
              {
                stack: [
                  {
                    text: `Currency: ${commercialContext.currency} · Escrow split: ${commercialContext.escrowSplit?.developerPercentage ?? 85}% developer / ${commercialContext.escrowSplit?.brokerPercentage ?? 10}% broker / ${commercialContext.escrowSplit?.platformPercentage ?? 5}% platform`,
                    style: 'bodyMuted',
                  },
                  commercialContext.techStack
                    ? { text: `Tech stack: ${commercialContext.techStack}`, style: 'bodyMuted' }
                    : { text: 'Tech stack: As specified in the signed spec.', style: 'bodyMuted' },
                  commercialContext.description
                    ? { text: commercialContext.description, style: 'bodyCopy' }
                    : { text: 'No additional project summary was captured.', style: 'bodyMuted' },
                ],
              },
            ],
            [
              { text: 'Parties', style: 'section' },
              {
                stack: [
                  {
                    text: `Client\n${contract.project?.client?.fullName || 'N/A'}\n${contract.project?.client?.email || 'N/A'}`,
                    style: 'partyCard',
                  },
                  {
                    text: `Broker\n${contract.project?.broker?.fullName || 'N/A'}\n${contract.project?.broker?.email || 'N/A'}`,
                    style: 'partyCard',
                  },
                  {
                    text: `Freelancer\n${contract.project?.freelancer?.fullName || 'N/A'}\n${contract.project?.freelancer?.email || 'N/A'}`,
                    style: 'partyCard',
                  },
                ],
              },
              { text: 'Signature Progress', style: 'section' },
              {
                text:
                  missingSignerIds.length > 0
                    ? `${signatures.length}/${requiredSignerIds.length} completed · Waiting for ${missingSignerIds
                        .map((id) => {
                          if (id === contract.project?.clientId) return 'Client';
                          if (id === contract.project?.brokerId) return 'Broker';
                          if (id === contract.project?.freelancerId) return 'Freelancer';
                          return id;
                        })
                        .join(', ')}`
                    : `${signatures.length}/${requiredSignerIds.length} completed · All required signers finished.`,
                style: 'bodyCopy',
                margin: [0, 0, 0, 8],
              },
              ...signatureTimeline,
            ],
          ],
          columnGap: 18,
        },
        { text: 'Frozen Milestone & Payment Schedule', style: 'section' },
        {
          text: 'Every runtime milestone and escrow record must match this frozen snapshot.',
          style: 'bodyMuted',
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 76, 84, 68, 68],
            body: [
              ['Milestone', 'Deliverable', 'Schedule', 'Amount', 'Retention'],
              ...milestoneRows,
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 8],
        },
        {
          text: `Snapshot total: ${this.formatMoneyForDisplay(
            this.sumSnapshotAmounts(snapshotMilestones),
            commercialContext.currency,
          )}`,
          style: 'bodyCopy',
        },
        { text: 'Full Agreement Text', style: 'section' },
        {
          text: 'Rendered from the canonical stored agreement text for this contract version.',
          style: 'bodyMuted',
          margin: [0, 0, 0, 6],
        },
        ...termsBlocks,
        { text: 'Audit Appendix', style: 'section' },
        {
          columns: [
            {
              text: `Content hash (signable version)\n${
                contract.contentHash || this.computeContentHash(contract)
              }`,
              style: 'hashBlock',
            },
            {
              text: `Document hash (audit/export)\n${
                (contract as any).documentHash || this.computeContractDocumentHash(contract)
              }`,
              style: 'hashBlock',
            },
          ],
          columnGap: 10,
          margin: [0, 0, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: [110, 72, 120, '*'],
            body: [['Signer', 'Role', 'Signed At', 'Audit Details'], ...signatureRows],
          },
          layout: 'lightHorizontalLines',
        },
      ],
      styles: {
        brandWordmark: { fontSize: 15, bold: true, color: '#1e3a8a', margin: [0, 1, 0, 1] },
        brandSubmark: { fontSize: 8, color: '#64748b' },
        brandKicker: {
          fontSize: 8,
          bold: true,
          color: '#0f766e',
          characterSpacing: 0.8,
          margin: [0, 0, 0, 3],
        },
        brandCaption: { fontSize: 8.25, color: '#475569' },
        brandFallback: { fontSize: 20, bold: true, color: '#0f766e' },
        heroTitle: { fontSize: 20, bold: true, color: '#f8fafc', margin: [0, 0, 0, 4] },
        heroSubtitle: { fontSize: 9, color: '#ccfbf1', margin: [0, 0, 0, 6] },
        heroMeta: { fontSize: 9, color: '#99f6e4' },
        section: { fontSize: 12.5, bold: true, color: '#0f172a', margin: [0, 6, 0, 6] },
        metricCard: {
          fillColor: '#f0fdfa',
          color: '#0f172a',
          bold: true,
          margin: [10, 10, 10, 10],
        },
        metricCardMuted: {
          fillColor: '#f8fafc',
          color: '#334155',
          margin: [10, 10, 10, 10],
        },
        partyCard: {
          fillColor: '#f8fafc',
          margin: [10, 10, 10, 10],
          color: '#0f172a',
          lineHeight: 1.3,
        },
        bodyCopy: { fontSize: 9.5, lineHeight: 1.3, margin: [0, 0, 0, 5] },
        bodyMuted: { fontSize: 8.75, color: '#475569', lineHeight: 1.3, margin: [0, 0, 0, 5] },
        hashBlock: {
          fontSize: 8,
          color: '#0f172a',
          fillColor: '#f8fafc',
          margin: [0, 0, 0, 0],
        },
        termsHeadingPrimary: { fontSize: 15, bold: true, margin: [0, 8, 0, 5] },
        termsHeadingSecondary: { fontSize: 12.5, bold: true, margin: [0, 6, 0, 4] },
        termsHeadingTertiary: { fontSize: 10.5, bold: true, margin: [0, 5, 0, 3] },
        termsLabel: { fontSize: 9.5, bold: true, margin: [0, 3, 0, 3] },
        termsParagraph: { fontSize: 9.5, lineHeight: 1.32, margin: [0, 0, 0, 5] },
        termsBullet: { fontSize: 9.5, lineHeight: 1.28 },
        termsQuote: {
          fontSize: 9.25,
          color: '#334155',
          fillColor: '#f0fdfa',
          margin: [0, 2, 0, 5],
          italics: true,
        },
        footerBrand: { fontSize: 8.25, bold: true, color: '#0f766e' },
        footerMeta: { fontSize: 7.5, color: '#64748b' },
      },
    };

    const pdfDocument = pdfmake.createPdf(docDefinition);
    return pdfDocument.getBuffer();
  }

  async generatePdfForUser(user: UserEntity, contractId: string): Promise<Buffer> {
    const contract = (await this.findOneForUser(user, contractId)) as ContractEntity & {
      documentHash?: string;
    };

    const canUseArchivedArtifact =
      Boolean(contract.archiveStoragePath && contract.archiveDocumentHash) &&
      (contract.status === ContractStatus.SIGNED || contract.status === ContractStatus.ACTIVATED);

    if (canUseArchivedArtifact) {
      const archivedBuffer = await this.contractArchiveStorage.downloadPdfArtifact(
        contract.archiveStoragePath!,
      );

      if (archivedBuffer) {
        return archivedBuffer;
      }

      this.logger.warn(
        `Archived contract PDF missing for ${contract.id} at ${contract.archiveStoragePath}; falling back to dynamic rendering.`,
      );
    }

    return this.buildPdfBufferForContract(contract);
  }

  async signContract(user: UserEntity, contractId: string, contentHash: string, req: Request) {
    const normalizedContentHash = contentHash?.trim();
    if (!normalizedContentHash) {
      throw new BadRequestException('contentHash is required');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let requiredSignerCount = 0;
    let signaturesCount = 0;
    let allRequiredSigned = false;
    let contractForEvents: ContractEntity | null = null;
    let archivePersisted = false;

    try {
      const contract = await this.loadContractForUpdate(queryRunner, contractId);
      contractForEvents = contract;
      this.assertUserIsContractParty(user, contract, 'sign');

      if (contract.status !== ContractStatus.SENT) {
        throw new BadRequestException('Contract must be in SENT status before signing.');
      }

      if (!contract.commercialContext || !contract.milestoneSnapshot?.length) {
        await this.hydrateSnapshotFromLegacySpec(queryRunner, contract, contract.project as ProjectEntity);
      }

      const currentContentHash = this.ensureContractContentHash(contract);
      if (normalizedContentHash !== currentContentHash) {
        throw new ConflictException(
          'Contract content changed since you loaded it. Refresh and review the latest version before signing.',
        );
      }

      const requiredSignerIds = this.getRequiredContractSignerIds(contract);
      requiredSignerCount = requiredSignerIds.length;

      const existingSig = await queryRunner.manager.findOne(DigitalSignatureEntity, {
        where: { contractId, userId: user.id },
      });
      if (existingSig) {
        throw new BadRequestException('You have already signed this contract');
      }

      const signedAt = new Date();
      const signerRole = this.getContractPartyRole(contract, user.id);
      const ds = new DigitalSignatureEntity();
      ds.contractId = contractId;
      ds.userId = user.id;
      ds.contentHash = currentContentHash;
      ds.signerRole = signerRole;
      ds.provider = 'INTERDEV_AUDIT';
      ds.legalStatus = 'AUDIT_RECORDED';
      ds.ipAddress = this.normalizeClientIp(req);
      ds.userAgent = req.get('user-agent') || null;
      ds.signatureHash = this.buildServerSignatureHash({
        contractId,
        userId: user.id,
        contentHash: currentContentHash,
        signerRole,
        signedAt,
        ipAddress: ds.ipAddress ?? null,
        userAgent: ds.userAgent,
      });
      ds.providerPayload = {
        contentHash: currentContentHash,
        recordedAt: signedAt.toISOString(),
        auditOnly: true,
      };
      ds.signedAt = signedAt;

      try {
        await queryRunner.manager.save(DigitalSignatureEntity, ds);
      } catch (error: any) {
        if (error?.code === '23505') {
          throw new BadRequestException('You have already signed this contract');
        }
        throw error;
      }

      const signatures = await queryRunner.manager.find(DigitalSignatureEntity, {
        where: { contractId },
      });
      signaturesCount = signatures.length;

      const signedUserIds = new Set(signatures.map((signature) => signature.userId));
      allRequiredSigned = requiredSignerIds.every((id) => signedUserIds.has(id));

      if (allRequiredSigned) {
        contract.status = ContractStatus.SIGNED;
        await queryRunner.manager.save(ContractEntity, contract);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    if (allRequiredSigned) {
      archivePersisted = await this.persistSignedContractArchiveIfPossible(contractId);
      await this.auditLogsService.log({
        actorId: user.id,
        action: 'CONTRACT_FULLY_SIGNED',
        entityType: 'Contract',
        entityId: contractId,
        newData: {
          status: ContractStatus.SIGNED,
        },
        req: undefined,
      });
    }

    if (contractForEvents) {
      this.emitContractUpdated(contractForEvents, [user.id]);
      await this.notifyContractParticipants(contractForEvents, {
        title: allRequiredSigned ? 'Contract fully signed' : 'Contract signing updated',
        body: allRequiredSigned
          ? `All required parties signed "${contractForEvents.title}". Legal provider verification is now required before activation.`
          : `${user.fullName || user.email} signed "${contractForEvents.title}". ${signaturesCount}/${requiredSignerCount} required signatures are complete.`,
      });
    }

    return {
      status: allRequiredSigned ? 'Signed' : 'Pending Signatures',
      signaturesCount,
      requiredSignerCount,
      allRequiredSigned,
      archivePersisted,
    };
  }

  async createSignatureSession(
    user: UserEntity,
    contractId: string,
    dto: CreateSignatureSessionDto,
  ) {
    const provider = this.normalizeLegalSignatureProvider(dto.provider);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let contractForEvents: ContractEntity | null = null;
    let providerSessionId: string | null = null;

    try {
      const contract = await this.loadContractForUpdate(queryRunner, contractId);
      contractForEvents = contract;
      this.assertUserIsContractParty(user, contract, 'sign');

      if (contract.activatedAt) {
        throw new BadRequestException('Cannot create a signature session for an activated contract.');
      }

      if (contract.status !== ContractStatus.SIGNED) {
        throw new BadRequestException(
          'All required parties must complete contract signing before creating a legal signature session.',
        );
      }

      if (contract.legalSignatureStatus === ContractLegalSignatureStatus.VERIFIED) {
        return {
          contractId: contract.id,
          provider: contract.provider ?? provider,
          sessionId: (contract.legalSignatureEvidence?.sessionId as string | undefined) ?? null,
          status: contract.legalSignatureStatus,
          callbackPath: `/signature-providers/${contract.provider ?? provider}/webhooks`,
          contentHash: contract.contentHash,
          verifiedAt: contract.verifiedAt ?? null,
          certificateSerial: contract.certificateSerial ?? null,
        };
      }

      providerSessionId = `sigsess_${uuidv4()}`;
      contract.provider = provider;
      contract.legalSignatureStatus = ContractLegalSignatureStatus.SESSION_CREATED;
      contract.verifiedAt = null;
      contract.certificateSerial = null;
      contract.legalSignatureEvidence = this.mergeLegalSignatureEvidence(
        contract.legalSignatureEvidence,
        {
          sessionId: providerSessionId,
          createdAt: new Date().toISOString(),
          callbackPath: `/signature-providers/${provider}/webhooks`,
          provider,
          requestedByUserId: user.id,
          contentHash: contract.contentHash,
        },
      );
      await queryRunner.manager.save(ContractEntity, contract);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    if (contractForEvents) {
      this.emitContractUpdated(contractForEvents, [user.id]);
      await this.notifyContractParticipants(contractForEvents, {
        title: 'Legal signature session created',
        body: `A legal signature session was created for "${contractForEvents.title}" with provider ${provider}.`,
      });
    }

    return {
      contractId,
      provider,
      sessionId: providerSessionId,
      status: ContractLegalSignatureStatus.SESSION_CREATED,
      callbackPath: `/signature-providers/${provider}/webhooks`,
      contentHash: contractForEvents?.contentHash ?? null,
    };
  }

  async handleSignatureProviderWebhook(
    providerCode: string,
    dto: SignatureProviderWebhookDto,
  ) {
    const provider = this.normalizeLegalSignatureProvider(providerCode);
    const nextLegalStatus = this.normalizeWebhookLegalStatus(dto.status);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let contractForEvents: ContractEntity | null = null;

    try {
      const contract = await this.loadContractForUpdate(queryRunner, dto.contractId);
      contractForEvents = contract;

      if (
        nextLegalStatus === ContractLegalSignatureStatus.VERIFIED &&
        !contract.activatedAt &&
        contract.status !== ContractStatus.SIGNED
      ) {
        throw new BadRequestException(
          'Cannot mark legal signature as verified before all required contract signatures are complete.',
        );
      }

      contract.provider = provider;
      contract.legalSignatureStatus = nextLegalStatus;
      contract.verifiedAt =
        nextLegalStatus === ContractLegalSignatureStatus.VERIFIED
          ? new Date(dto.verifiedAt ?? Date.now())
          : null;
      contract.certificateSerial = dto.certificateSerial?.trim() || null;
      contract.legalSignatureEvidence = this.mergeLegalSignatureEvidence(
        contract.legalSignatureEvidence,
        {
          provider,
          providerSessionId: dto.providerSessionId ?? null,
          providerStatus: dto.status,
          webhookReceivedAt: new Date().toISOString(),
          certificateSerial: contract.certificateSerial,
          verifiedAt: contract.verifiedAt?.toISOString?.() ?? null,
          evidence: dto.evidence ?? null,
        },
      );
      await queryRunner.manager.save(ContractEntity, contract);

      const signatures = await queryRunner.manager.find(DigitalSignatureEntity, {
        where: { contractId: contract.id },
      });
      for (const signature of signatures) {
        signature.provider = provider;
        signature.providerSessionId = dto.providerSessionId?.trim() || signature.providerSessionId;
        signature.legalStatus = nextLegalStatus;
        signature.certificateSerial = contract.certificateSerial;
        signature.verifiedAt = contract.verifiedAt;
        signature.providerPayload = this.mergeLegalSignatureEvidence(signature.providerPayload, {
          provider,
          providerStatus: dto.status,
          evidence: dto.evidence ?? null,
        });
      }
      if (signatures.length > 0) {
        await queryRunner.manager.save(DigitalSignatureEntity, signatures);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    if (contractForEvents) {
      this.emitContractUpdated(contractForEvents);
      await this.notifyContractParticipants(contractForEvents, {
        title:
          nextLegalStatus === ContractLegalSignatureStatus.VERIFIED
            ? 'Legal signature verified'
            : nextLegalStatus === ContractLegalSignatureStatus.FAILED
              ? 'Legal signature verification failed'
              : 'Legal signature updated',
        body:
          nextLegalStatus === ContractLegalSignatureStatus.VERIFIED
            ? `Provider ${provider} verified the legal signature for "${contractForEvents.title}".`
            : nextLegalStatus === ContractLegalSignatureStatus.FAILED
              ? `Provider ${provider} reported a failed legal verification for "${contractForEvents.title}".`
              : `Provider ${provider} updated legal signature status for "${contractForEvents.title}".`,
      });
    }

    return {
      success: true,
      contractId: dto.contractId,
      provider,
      legalSignatureStatus: nextLegalStatus,
      verifiedAt: contractForEvents?.verifiedAt ?? null,
      certificateSerial: contractForEvents?.certificateSerial ?? null,
    };
  }

  async activateProject(user: UserEntity, contractId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let contractForEvents: ContractEntity | null = null;

    try {
      contractForEvents = await this.loadContractForUpdate(queryRunner, contractId);
      const result = await this.activateProjectInTransaction(queryRunner, contractId, {
        actor: user,
        requireAllSignatures: true,
      });
      await queryRunner.commitTransaction();
      if (contractForEvents) {
        this.emitContractUpdated(contractForEvents, [user.id]);
        await this.notifyContractParticipants(contractForEvents, {
          title: 'Project activated',
          body: `Project execution for "${contractForEvents.title}" has been activated.`,
        });
      }
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
