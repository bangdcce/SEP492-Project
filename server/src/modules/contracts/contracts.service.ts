import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import {
  ContractEntity,
  ContractMilestoneSnapshotItem,
} from '../../database/entities/contract.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import {
  ProjectSpecEntity,
  ProjectSpecStatus,
  SpecPhase,
} from '../../database/entities/project-spec.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import { EscrowEntity, EscrowStatus } from '../../database/entities/escrow.entity';
import { DigitalSignatureEntity } from '../../database/entities/digital-signature.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

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
    private readonly dataSource: DataSource,
  ) {}

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

  private computeContractDocumentHash(contract: ContractEntity): string {
    const payload = JSON.stringify({
      id: contract.id,
      projectId: contract.projectId,
      sourceSpecId: contract.sourceSpecId ?? null,
      title: contract.title ?? '',
      termsContent: contract.termsContent ?? '',
      milestoneSnapshot: contract.milestoneSnapshot ?? null,
    });
    return createHash('sha256').update(payload).digest('hex');
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

    // Legacy compatibility: previous invite flow stored accepted freelancer as PENDING.
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

  private getRequiredContractSignerIds(contract: ContractEntity): string[] {
    const signerIds = new Set<string>();
    signerIds.add(contract.project.clientId);
    signerIds.add(contract.project.brokerId);
    if (contract.project.freelancerId) {
      signerIds.add(contract.project.freelancerId);
    }
    return Array.from(signerIds);
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

  private async resolveSpecForActivation(
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

  private buildMilestoneSnapshot(
    savedMilestones: MilestoneEntity[],
    sourceMilestones: MilestoneEntity[],
  ): ContractMilestoneSnapshotItem[] {
    return savedMilestones.map((projectMilestone, index) => {
      const sourceMilestone = sourceMilestones[index];
      const dueDateValue = projectMilestone.dueDate ?? sourceMilestone?.dueDate ?? null;
      return {
        projectMilestoneId: projectMilestone.id,
        sourceSpecMilestoneId: sourceMilestone?.id ?? null,
        title: projectMilestone.title,
        description: projectMilestone.description ?? null,
        amount: Number(projectMilestone.amount ?? 0),
        dueDate: dueDateValue ? new Date(dueDateValue).toISOString() : null,
        sortOrder: projectMilestone.sortOrder ?? null,
        deliverableType: projectMilestone.deliverableType ?? null,
        retentionAmount:
          projectMilestone.retentionAmount !== undefined &&
          projectMilestone.retentionAmount !== null
            ? Number(projectMilestone.retentionAmount)
            : null,
        acceptanceCriteria: Array.isArray(projectMilestone.acceptanceCriteria)
          ? [...projectMilestone.acceptanceCriteria]
          : null,
      };
    });
  }

  private async activateProjectInTransaction(
    queryRunner: QueryRunner,
    contractId: string,
    options?: { requireAllSignatures?: boolean },
  ) {
    const contract = await this.loadContractForUpdate(queryRunner, contractId);
    const project = contract.project as ProjectEntity;

    const existingMilestones = await queryRunner.manager.find(MilestoneEntity, {
      where: { projectId: project.id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const hasSnapshot =
      Array.isArray(contract.milestoneSnapshot) && contract.milestoneSnapshot.length > 0;

    if (contract.activatedAt && existingMilestones.length > 0 && !hasSnapshot) {
      const spec = await this.resolveSpecForActivation(queryRunner, contract);
      const sourceMilestones = spec?.milestones
        ? [...spec.milestones].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        : [];
      contract.milestoneSnapshot = this.buildMilestoneSnapshot(existingMilestones, sourceMilestones);
      await queryRunner.manager.save(ContractEntity, contract);

      this.logger.warn(
        `Contract ${contract.id} was activated without milestone snapshot. Snapshot repaired from existing project milestones.`,
      );
      return {
        status: 'Already activated',
        alreadyActivated: true,
        activatedAt: contract.activatedAt,
        clonedMilestones: existingMilestones.length,
      };
    }

    if (contract.activatedAt && hasSnapshot) {
      return {
        status: 'Already activated',
        alreadyActivated: true,
        activatedAt: contract.activatedAt,
        clonedMilestones: existingMilestones.length,
      };
    }

    if (options?.requireAllSignatures) {
      const requiredSignerIds = this.getRequiredContractSignerIds(contract);
      const signatures = await queryRunner.manager.find(DigitalSignatureEntity, {
        where: { contractId },
      });
      const signedUserIds = new Set(signatures.map((signature) => signature.userId));
      const allRequiredSigned = requiredSignerIds.every((id) => signedUserIds.has(id));
      if (!allRequiredSigned) {
        throw new BadRequestException(
          'Contract must have all required signatures before activation.',
        );
      }
    }

    let clonedMilestones = existingMilestones.length;
    let warning: string | undefined;
    let milestoneSnapshot: ContractMilestoneSnapshotItem[] | null = hasSnapshot
      ? contract.milestoneSnapshot
      : null;

    const spec = await this.resolveSpecForActivation(queryRunner, contract);

    if (spec && existingMilestones.length === 0) {
      const sortedSourceMilestones = [...(spec.milestones || [])].sort(
        (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
      );

      const clonedMilestonesToSave: MilestoneEntity[] = sortedSourceMilestones.map(
        (specMilestone) => {
          const newMilestone = new MilestoneEntity();
          newMilestone.projectId = project.id;
          newMilestone.projectSpecId = spec.id;
          newMilestone.title = specMilestone.title;
          newMilestone.description = specMilestone.description;
          newMilestone.amount = specMilestone.amount;
          newMilestone.deliverableType = specMilestone.deliverableType;
          newMilestone.retentionAmount = specMilestone.retentionAmount;
          newMilestone.acceptanceCriteria = specMilestone.acceptanceCriteria;
          newMilestone.sortOrder = specMilestone.sortOrder;
          newMilestone.startDate = specMilestone.startDate;
          newMilestone.dueDate = specMilestone.dueDate;
          newMilestone.status = MilestoneStatus.PENDING;
          return newMilestone;
        },
      );

      const savedMilestones =
        clonedMilestonesToSave.length > 0
          ? await queryRunner.manager.save(MilestoneEntity, clonedMilestonesToSave)
          : [];

      clonedMilestones = savedMilestones.length;
      milestoneSnapshot = this.buildMilestoneSnapshot(savedMilestones, sortedSourceMilestones);

      const escrows: EscrowEntity[] = savedMilestones.map((m) => {
        const escrow = new EscrowEntity();
        escrow.projectId = project.id;
        escrow.milestoneId = m.id;
        escrow.totalAmount = m.amount;

        const amount = new Decimal(m.amount);
        escrow.developerShare = amount.times(0.85).toNumber();
        escrow.brokerShare = amount.times(0.1).toNumber();
        escrow.platformFee = amount.times(0.05).toNumber();
        // Set explicit numeric defaults to avoid NULL inserts when DB defaults are bypassed.
        escrow.fundedAmount = 0;
        escrow.releasedAmount = 0;
        escrow.developerPercentage = 85;
        escrow.brokerPercentage = 10;
        escrow.platformPercentage = 5;
        escrow.currency = project.currency || 'USD';
        escrow.clientApproved = false;
        escrow.status = EscrowStatus.PENDING;
        return escrow;
      });

      if (escrows.length > 0) {
        await queryRunner.manager.save(EscrowEntity, escrows);
      }
    } else if (!spec) {
      warning = 'Spec not found';
      this.logger.warn(`No eligible source spec found for Contract ${contract.id}.`);
    } else if (existingMilestones.length > 0 && !hasSnapshot) {
      const sortedSourceMilestones = [...(spec.milestones || [])].sort(
        (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
      );
      milestoneSnapshot = this.buildMilestoneSnapshot(existingMilestones, sortedSourceMilestones);
    }

    project.status = ProjectStatus.IN_PROGRESS;
    await queryRunner.manager.save(ProjectEntity, project);

    if (project.requestId) {
      await queryRunner.manager.update(
        ProjectRequestEntity,
        { id: project.requestId },
        { status: RequestStatus.CONVERTED_TO_PROJECT },
      );
    }

    if (!contract.activatedAt) {
      contract.activatedAt = new Date();
    }
    contract.milestoneSnapshot = milestoneSnapshot;
    await queryRunner.manager.save(ContractEntity, contract);

    this.logger.log(
      `Project ${project.id} activated! Cloned ${clonedMilestones} milestones & escrows.`,
    );

    return {
      status: 'Activated',
      clonedMilestones,
      warning,
      activatedAt: contract.activatedAt,
      alreadyActivated: false,
    };
  }

  /**
   * Phase 1: Initialize Project & Contract from Spec
   * - Creates Project (INITIALIZING)
   * - Generates Contract Terms (Dynamic)
   * - Creates Contract (DRAFT)
   */
  /**
   * List contracts for a user (Client or Broker)
   */
  /**
   * Get contract ID
   */
  async findOne(id: string) {
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
    if (contract.project?.request?.specs) {
      const selectedSpec = this.selectSpecForContract(
        contract.project.request.specs,
        contract.sourceSpecId ?? null,
      );
      contract.project.request.spec = selectedSpec;
    }
    (contract as any).documentHash = this.computeContractDocumentHash(contract);
    return contract;
  }

  async listByUser(userId: string) {
    const contracts = await this.contractsRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.project', 'project')
      .leftJoinAndSelect('project.client', 'client')
      .leftJoinAndSelect('project.freelancer', 'freelancer')
      .where('project.clientId = :userId', { userId })
      .orWhere('project.brokerId = :userId', { userId })
      .orWhere('project.freelancerId = :userId', { userId })
      .orderBy('contract.createdAt', 'DESC')
      .getMany();

    return contracts.map((c) => ({
      id: c.id,
      projectId: c.projectId,
      requestId: c.project.requestId ?? null,
      activatedAt: c.activatedAt ?? null,
      projectStatus: c.project.status ?? null,
      projectTitle: c.project.title,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt,
      clientName: c.project.client?.fullName || 'Unknown',
      freelancerName: c.project.freelancer?.fullName || null,
    }));
  }

  async initializeProjectAndContract(user: UserEntity, specId: string) {
    const spec = await this.projectSpecsRepository.findOne({
      where: { id: specId },
      relations: ['milestones', 'request', 'request.client', 'request.broker'],
    });

    if (!spec) throw new NotFoundException('Spec not found');
    if (!spec.request) throw new BadRequestException('Spec is not linked to a project request');

    if (user.id !== spec.request.brokerId) {
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

    const freelancerId = await this.resolveAcceptedFreelancerId(spec.requestId);
    if (isPhasedFlowReady && !freelancerId) {
      throw new BadRequestException(
        'Cannot initialize contract: no accepted freelancer found for this request.',
      );
    }

    const existingContract = await this.contractsRepository.findOne({
      where: { sourceSpecId: spec.id },
    });
    if (existingContract) {
      throw new BadRequestException('Contract already initialized for this spec');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Project (INITIALIZING)
      const project = queryRunner.manager.create(ProjectEntity, {
        requestId: spec.requestId, // Link to Request for Spec access
        brokerId: spec.request.brokerId,
        clientId: spec.request.clientId,
        freelancerId: freelancerId ?? undefined,
        title: spec.title,
        description: spec.description,
        totalBudget: spec.totalBudget,
        status: ProjectStatus.INITIALIZING, // Need to ensure Enum has this
        createdAt: new Date(),
      });
      const savedProject = await queryRunner.manager.save(project);

      // 2. Generate Contract Terms (Dynamic from Spec)
      const termsContent = this.generateContractTerms(spec);

      // 3. Create Contract
      const contract = queryRunner.manager.create(ContractEntity, {
        projectId: savedProject.id,
        sourceSpecId: spec.id,
        title: `Contract for ${spec.title}`,
        contractUrl: `contracts/${savedProject.id}.pdf`, // Placeholder
        termsContent,
        status: 'DRAFT',
        createdBy: user.id,
      });
      const savedContract = await queryRunner.manager.save(contract);

      await queryRunner.commitTransaction();

      return savedContract;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to init contract: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Generate dynamic contract terms based on Governance Spec
   */
  private generateContractTerms(spec: ProjectSpecEntity): string {
    let terms = `# DEVELOPMENT AGREEMENT\n\n`;
    terms += `## 1. Scope of Work\n`;
    terms += `Project: ${spec.title}\n`;
    terms += `Budget: $${spec.totalBudget}\n\n`;

    if (spec.features && spec.features.length > 0) {
      terms += `## 2. Features & Acceptance Criteria\n`;
      spec.features.forEach((feature, idx) => {
        terms += `### 2.${idx + 1} ${feature.title} (${feature.complexity})\n`;
        terms += `${feature.description}\n`;
        terms += `**Acceptance Criteria:**\n`;
        feature.acceptanceCriteria.forEach((ac) => {
          terms += `- ${ac}\n`;
        });
        terms += `\n`;
      });
    }

    terms += `## 3. Tech Stack\n${spec.techStack || 'As specified in proposal'}\n\n`;

    terms += `## 4. Payment Schedule (Milestones)\n`;
    spec.milestones
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .forEach((m, idx) => {
        terms += `### Milestone ${idx + 1}: ${m.title}\n`;
        terms += `- Amount: $${m.amount}\n`;
        terms += `- Deliverable: ${m.deliverableType}\n`;
        if (m.retentionAmount > 0) {
          terms += `- Retention (Warranty): $${m.retentionAmount}\n`;
        }
        terms += `\n`;
      });

    return terms;
  }

  async generatePdf(contractId: string): Promise<Buffer> {
    const contract = (await this.findOne(contractId)) as ContractEntity & {
      documentHash?: string;
    };
    const requestRecord: unknown = contract.project?.request;
    const requestSpec =
      requestRecord && typeof requestRecord === 'object'
        ? (Reflect.get(requestRecord, 'spec') as ProjectSpecEntity | undefined)
        : undefined;
    const signatures = (contract.signatures || []) as Array<
      DigitalSignatureEntity & { user?: UserEntity | null }
    >;

    // pdfmake v0.3 server-side API
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
      ? [...contract.milestoneSnapshot]
      : [];
    const milestoneLines =
      snapshotMilestones.length > 0
        ? snapshotMilestones
            .slice()
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
            .map((milestone, index) => [
              `${index + 1}. ${milestone.title}`,
              `$${Number(milestone.amount || 0).toFixed(2)}`,
              String(milestone.deliverableType || 'OTHER').replace(/_/g, ' '),
            ])
        : (requestSpec?.milestones || [])
            .slice()
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
            .map((milestone, index) => [
              `${index + 1}. ${milestone.title}`,
              `$${Number(milestone.amount || 0).toFixed(2)}`,
              String(milestone.deliverableType || 'OTHER').replace(/_/g, ' '),
            ]);

    const requiredSignerIds = this.getRequiredContractSignerIds(contract);
    const signedUserIds = new Set(signatures.map((signature) => signature.userId));
    const missingSignerIds = requiredSignerIds.filter((id) => !signedUserIds.has(id));

    const signatureRows = signatures
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

        return [
          signerName,
          signature.userId,
          new Date(signature.signedAt).toLocaleString('en-US'),
          signature.signatureHash,
        ];
      });

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      content: [
        { text: 'DEVELOPMENT AGREEMENT', style: 'header' },
        { text: `Contract ID: ${contract.id}`, margin: [0, 0, 0, 2] },
        { text: `Status: ${contract.status}`, margin: [0, 0, 0, 2] },
        { text: `Created At: ${new Date(contract.createdAt).toLocaleString('en-US')}` },
        contract.activatedAt
          ? { text: `Activated At: ${new Date(contract.activatedAt).toLocaleString('en-US')}` }
          : { text: 'Activated At: Not activated yet' },
        {
          text: `Signature Progress: ${signatures.length}/${requiredSignerIds.length} required signatures`,
        },
        missingSignerIds.length > 0
          ? {
              text: `Missing Signers: ${missingSignerIds
                .map((id) => {
                  if (id === contract.project?.clientId) return 'Client';
                  if (id === contract.project?.brokerId) return 'Broker';
                  if (id === contract.project?.freelancerId) return 'Freelancer';
                  return id;
                })
                .join(', ')}`,
            }
          : { text: 'All required signers completed.' },
        {
          text: `Document Hash (SHA-256): ${(contract as any).documentHash || this.computeContractDocumentHash(contract)}`,
          style: 'monoBlock',
          margin: [0, 10, 0, 12],
        },

        { text: 'Parties', style: 'section' },
        {
          text: `Client: ${contract.project?.client?.fullName || 'N/A'} (${contract.project?.client?.email || 'N/A'})`,
        },
        {
          text: `Broker: ${contract.project?.broker?.fullName || 'N/A'} (${contract.project?.broker?.email || 'N/A'})`,
        },
        {
          text: `Freelancer: ${contract.project?.freelancer?.fullName || 'N/A'} (${contract.project?.freelancer?.email || 'N/A'})`,
          margin: [0, 0, 0, 10],
        },

        { text: 'Project Scope Summary', style: 'section' },
        { text: `Project: ${contract.project?.title || contract.title || 'N/A'}` },
        { text: `Budget: $${Number(contract.project?.totalBudget || 0).toFixed(2)}` },
        requestSpec?.techStack
          ? { text: `Tech Stack: ${requestSpec.techStack}` }
          : { text: 'Tech Stack: N/A' },
        requestSpec?.description
          ? { text: requestSpec.description, margin: [0, 6, 0, 10] }
          : { text: 'No spec description available.', margin: [0, 6, 0, 10] },

        milestoneLines.length > 0
          ? {
              text:
                snapshotMilestones.length > 0
                  ? 'Milestones (Locked Contract Snapshot)'
                  : 'Milestones (From Spec)',
              style: 'section',
            }
          : { text: 'Milestones', style: 'section' },
        milestoneLines.length > 0
          ? {
              table: {
                headerRows: 1,
                widths: ['*', 90, 130],
                body: [['Milestone', 'Amount', 'Deliverable'], ...milestoneLines],
              },
              layout: 'lightHorizontalLines',
              margin: [0, 0, 0, 10],
            }
          : { text: 'No milestones available', margin: [0, 0, 0, 10] },

        { text: 'Terms & Conditions', style: 'section' },
        { text: contract.termsContent || 'No terms content available.', margin: [0, 0, 0, 10] },

        { text: 'Digital Signatures (Audit Trail)', style: 'section' },
        signatureRows.length > 0
          ? {
              table: {
                headerRows: 1,
                widths: [110, '*', 120, '*'],
                body: [['Signer', 'User ID', 'Signed At', 'Signature Hash'], ...signatureRows],
              },
              layout: 'lightHorizontalLines',
            }
          : { text: 'No signatures recorded yet.' },
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        section: { fontSize: 12, bold: true, margin: [0, 8, 0, 6] },
        monoBlock: {
          fontSize: 9,
          background: '#f8fafc',
          margin: [0, 6, 0, 6],
        },
      },
    };

    const pdfDocument = pdfmake.createPdf(docDefinition);
    return pdfDocument.getBuffer();
  }

  async signContract(user: UserEntity, contractId: string, signatureHash: string) {
    const normalizedSignatureHash = signatureHash?.trim();
    if (!normalizedSignatureHash) {
      throw new BadRequestException('signatureHash is required');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let requiredSignerCount = 0;
    let signaturesCount = 0;
    let allRequiredSigned = false;
    let activationResult:
      | { alreadyActivated?: boolean; activatedAt?: Date | null; clonedMilestones?: number }
      | undefined;

    try {
      const contract = await this.loadContractForUpdate(queryRunner, contractId);

      const requiredSignerIds = this.getRequiredContractSignerIds(contract);
      requiredSignerCount = requiredSignerIds.length;

      if (!requiredSignerIds.includes(user.id)) {
        throw new ForbiddenException('You are not a party to this contract');
      }

      const existingSig = await queryRunner.manager.findOne(DigitalSignatureEntity, {
        where: { contractId, userId: user.id },
      });
      if (existingSig) {
        throw new BadRequestException('You have already signed this contract');
      }

      const ds = new DigitalSignatureEntity();
      ds.contractId = contractId;
      ds.userId = user.id;
      ds.signatureHash = normalizedSignatureHash;
      ds.signedAt = new Date();
      await queryRunner.manager.save(DigitalSignatureEntity, ds);

      const signatures = await queryRunner.manager.find(DigitalSignatureEntity, {
        where: { contractId },
      });
      signaturesCount = signatures.length;

      const signedUserIds = new Set(signatures.map((signature) => signature.userId));
      allRequiredSigned = requiredSignerIds.every((id) => signedUserIds.has(id));

      if (allRequiredSigned) {
        contract.status = 'SIGNED';
        await queryRunner.manager.save(ContractEntity, contract);
        activationResult = await this.activateProjectInTransaction(queryRunner, contractId, {
          requireAllSignatures: false,
        });
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    if (allRequiredSigned) {
      await this.auditLogsService.log({
        actorId: user.id,
        action: 'CONTRACT_FULLY_SIGNED',
        entityType: 'Contract',
        entityId: contractId,
        newData: {
          status: 'SIGNED',
          activatedAt: activationResult?.activatedAt?.toISOString?.() ?? null,
          alreadyActivated: Boolean(activationResult?.alreadyActivated),
        },
        req: undefined,
      });
    }

    return {
      status: allRequiredSigned ? 'Signed' : 'Pending Signatures',
      signaturesCount,
      requiredSignerCount,
      allRequiredSigned,
    };
  }

  /**
   * Phase 3: Activate Project
   * - Validates budget matches sum of milestones
   * - Clones Milestones from Spec -> Project
   * - Creates Escrow
   */
  async activateProject(user: UserEntity, contractId: string) {
    void user;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await this.activateProjectInTransaction(queryRunner, contractId, {
        requireAllSignatures: true,
      });
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
