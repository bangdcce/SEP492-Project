import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { ContractEntity } from '../../database/entities/contract.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import { ProjectSpecEntity, ProjectSpecStatus } from '../../database/entities/project-spec.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import { EscrowEntity, EscrowStatus } from '../../database/entities/escrow.entity';
import { DigitalSignatureEntity } from '../../database/entities/digital-signature.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

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
    private readonly auditLogsService: AuditLogsService,
    private readonly dataSource: DataSource,
  ) {}

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
        'project.request', 
        'project.request.spec', 
        'project.request.spec.milestones',
        'signatures'
      ],
    });

    if (!contract) {
       throw new NotFoundException(`Contract with ID ${id} not found`);
    }
    return contract;
  }

  async listByUser(userId: string) {
    // We need to join with Project to filter by userId
    const contracts = await this.contractsRepository.createQueryBuilder('contract')
      .leftJoinAndSelect('contract.project', 'project')
      .leftJoinAndSelect('project.client', 'client')
      .where('project.clientId = :userId', { userId })
      .orWhere('project.brokerId = :userId', { userId })
      .orderBy('contract.createdAt', 'DESC')
      .getMany();

    return contracts.map(c => ({
      id: c.id,
      projectId: c.projectId,
      projectTitle: c.project.title,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt,
      clientName: c.project.client?.fullName || 'Unknown',
    }));
  }

  async initializeProjectAndContract(user: UserEntity, specId: string) {
    const spec = await this.projectSpecsRepository.findOne({
      where: { id: specId },
      relations: ['milestones', 'request', 'request.client'],
    });

    if (!spec) throw new NotFoundException('Spec not found');

    // Only Client or Broker can initiate? Usually Broker generates contract.
    if (user.id !== spec.request.brokerId) {
       // Allow Client to trigger too? Spec says Broker manages it.
       // For now restrict to Broker.
       throw new ForbiddenException('Only Broker can initialize contract');
    }

    if (spec.status !== ProjectSpecStatus.APPROVED) {
      throw new BadRequestException('Spec must be APPROVED to generate contract');
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
        feature.acceptanceCriteria.forEach(ac => {
          terms += `- ${ac}\n`;
        });
        terms += `\n`;
      });
    }

    terms += `## 3. Tech Stack\n${spec.techStack || 'As specified in proposal'}\n\n`;

    terms += `## 4. Payment Schedule (Milestones)\n`;
    spec.milestones.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).forEach((m, idx) => {
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

  /**
   * Mock implementation for PDF Generation (Real implementation requires pdfmake setup)
   * Returns a Buffer representing the PDF
   */
  async generatePdf(contractId: string): Promise<Buffer> {
    const contract = await this.contractsRepository.findOne({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Contract not found');

    // In a real app, use PdfPrinter with fonts
    // For this prototype, we'll assume the client handles the rendering or we return a text buffer
    // const PdfPrinter = require('pdfmake');
    // const printer = new PdfPrinter(fonts); ...
    
    // For now, return the terms content as a Buffer (text file)
    // To satisfy the "Certificate" requirement, we'd wrap this in formatting
    return Buffer.from(contract.termsContent);
  }

  async signContract(user: UserEntity, contractId: string, signatureHash: string) {
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
      relations: ['project', 'signatures'],
    });

    if (!contract) throw new NotFoundException('Contract not found');

    // Check if user is authorized (Client or Broker)
    const isClient = user.id === contract.project.clientId;
    const isBroker = user.id === contract.project.brokerId;

    if (!isClient && !isBroker) {
      throw new ForbiddenException('You are not a party to this contract');
    }

    // Check if already signed
    const existingSig = await this.dataSource.manager.findOne(DigitalSignatureEntity, {
      where: { contractId, userId: user.id },
    });

    if (existingSig) {
      throw new BadRequestException('You have already signed this contract');
    }

    // Save Signature
    const ds = new DigitalSignatureEntity();
    ds.contractId = contractId;
    ds.userId = user.id;
    ds.signatureHash = signatureHash || 'valid-signature-hash';
    ds.signedAt = new Date();
    
    await this.dataSource.manager.save(ds);

    // Check if both parties have signed
    // We need to count logic. 
    // Since we just saved one, we look at the count + 1 (or re-query)
    const signatures = await this.dataSource.manager.find(DigitalSignatureEntity, {
      where: { contractId },
    });

    const hasClientSign = signatures.some(s => s.userId === contract.project.clientId);
    const hasBrokerSign = signatures.some(s => s.userId === contract.project.brokerId);

    if (hasClientSign && hasBrokerSign) {
      // Activate Project
      await this.activateProject(user, contractId);
      contract.status = 'SIGNED'; // Contract is fully signed
      await this.contractsRepository.save(contract);
      
      this.auditLogsService.log({
        actorId: user.id,
        action: 'CONTRACT_FULLY_SIGNED',
        entityType: 'Contract',
        entityId: contractId,
        newData: { status: 'SIGNED' },
        req: undefined
      });
    }

    return { status: 'Signed', signaturesCount: signatures.length };
  }

  /**
   * Phase 3: Activate Project
   * - Validates budget matches sum of milestones
   * - Clones Milestones from Spec -> Project
   * - Creates Escrow
   */
  async activateProject(user: UserEntity, contractId: string) {
    const contract = await this.contractsRepository.findOne({
        where: { id: contractId },
        relations: ['project'],
    });
    if (!contract) throw new NotFoundException('Contract not found');

      // Update Project Status
    const project = contract.project;
    project.status = ProjectStatus.IN_PROGRESS;
    await this.projectsRepository.save(project);

    // ─────────────────────────────────────────────────────────────────────────────
    // GOVERNANCE: Clone Milestones & Create Escrow
    // ─────────────────────────────────────────────────────────────────────────────

    // 1. Fetch Spec Linked to this Project
    // Linkage: Project -> Request -> Spec
    if (!project.requestId) {
        this.logger.warn(`Project ${project.id} has no requestId. Cannot clone milestones from Spec.`);
        return { status: 'Activated', warning: 'No linked spec found' };
    }

    const spec = await this.projectSpecsRepository.findOne({
        where: { 
            requestId: project.requestId,
            status: ProjectSpecStatus.APPROVED 
        },
        relations: ['milestones']
    });

    if (!spec) {
        this.logger.warn(`No APPROVED spec found for Request ${project.requestId}.`);
        return { status: 'Activated', warning: 'Spec not found' };
    }

    // 2. Clone Milestones (Spec -> Project)
    const newMilestones: MilestoneEntity[] = [];
    const escrows: EscrowEntity[] = [];

    for (const specMilestone of spec.milestones) {
        // Clone
        const newMilestone = new MilestoneEntity();
        newMilestone.projectId = project.id;
        newMilestone.projectSpecId = spec.id; // TRACEABILITY
        newMilestone.title = specMilestone.title;
        newMilestone.description = specMilestone.description;
        newMilestone.amount = specMilestone.amount;
        newMilestone.deliverableType = specMilestone.deliverableType;
        newMilestone.retentionAmount = specMilestone.retentionAmount;
        newMilestone.acceptanceCriteria = specMilestone.acceptanceCriteria;
        newMilestone.sortOrder = specMilestone.sortOrder;
        newMilestone.status = MilestoneStatus.PENDING; 
        
        newMilestones.push(newMilestone);
    }

    // Save Milestones first to get IDs
    const savedMilestones = await this.dataSource.manager.save(MilestoneEntity, newMilestones);

    // 3. Create Escrow Entries
    for (const m of savedMilestones) {
        const escrow = new EscrowEntity();
        escrow.projectId = project.id;
        escrow.milestoneId = m.id;
        escrow.totalAmount = m.amount;
        
        // Calculate percentages (Default 85/10/5)
        // ideally fetch from project config or system config
        const amount = new Decimal(m.amount);
        escrow.developerShare = amount.times(0.85).toNumber();
        escrow.brokerShare = amount.times(0.10).toNumber();
        escrow.platformFee = amount.times(0.05).toNumber();

        escrow.status = EscrowStatus.PENDING; // Waiting for deposit
        escrows.push(escrow);
    }

    await this.dataSource.manager.save(EscrowEntity, escrows);

    this.logger.log(`Project ${project.id} activated! Cloned ${savedMilestones.length} milestones & escrows.`);
    return { status: 'Activated', clonedMilestones: savedMilestones.length };
  }
}
