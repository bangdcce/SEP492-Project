import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';

import { ContractEntity } from '../../database/entities/contract.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import { ProjectSpecEntity, ProjectSpecStatus } from '../../database/entities/project-spec.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import { EscrowEntity, EscrowStatus } from '../../database/entities/escrow.entity';
import { DigitalSignatureEntity } from '../../database/entities/digital-signature.entity';
import { AuditLogsService, RequestContext } from '../audit-logs/audit-logs.service';
import { UserEntity } from '../../database/entities/user.entity';

// DTO Interfaces
interface InitializeContractDto {
  specId: string;
  freelancerId: string;
}

interface SignContractDto {
  contractId: string;
}

// Fee configuration (should be from config in production)
const FEE_CONFIG = {
  DEVELOPER_PERCENTAGE: 85,
  BROKER_PERCENTAGE: 10,
  PLATFORM_PERCENTAGE: 5,
};

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    @InjectRepository(ContractEntity)
    private readonly contractsRepository: Repository<ContractEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectsRepository: Repository<ProjectEntity>,
    @InjectRepository(ProjectSpecEntity)
    private readonly specsRepository: Repository<ProjectSpecEntity>,
    @InjectRepository(MilestoneEntity)
    private readonly milestonesRepository: Repository<MilestoneEntity>,
    @InjectRepository(EscrowEntity)
    private readonly escrowsRepository: Repository<EscrowEntity>,
    @InjectRepository(DigitalSignatureEntity)
    private readonly signaturesRepository: Repository<DigitalSignatureEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * PHASE 1: Initialize Project and Contract from Approved Spec
   * Creates Project (INITIALIZING) and Contract (DRAFT) in a single transaction.
   */
  async initializeProjectAndContract(
    user: UserEntity,
    dto: InitializeContractDto,
    req: RequestContext,
  ): Promise<{ projectId: string; contractId: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate Spec exists and is APPROVED
      const spec = await queryRunner.manager.findOne(ProjectSpecEntity, {
        where: { id: dto.specId },
        relations: ['request', 'request.client', 'request.broker', 'milestones'],
      });

      if (!spec) {
        throw new NotFoundException(`Spec with ID ${dto.specId} not found`);
      }

      if (spec.status !== ProjectSpecStatus.APPROVED) {
        throw new BadRequestException(
          `Spec must be APPROVED before creating contract. Current status: ${spec.status}`,
        );
      }

      // 2. Check if Contract already exists for this Spec
      const existingProject = await queryRunner.manager.findOne(ProjectEntity, {
        where: { requestId: spec.requestId },
      });

      if (existingProject) {
        throw new BadRequestException(
          `A project already exists for this request (Project ID: ${existingProject.id})`,
        );
      }

      // 3. Get Request details
      const request = spec.request;
      if (!request) {
        throw new NotFoundException('Project Request not found for this Spec');
      }

      // 4. Create Project with INITIALIZING status
      const newProject = queryRunner.manager.create(ProjectEntity, {
        requestId: spec.requestId,
        clientId: request.clientId,
        brokerId: request.brokerId,
        freelancerId: dto.freelancerId,
        title: spec.title,
        description: spec.description,
        totalBudget: spec.totalBudget,
        currency: 'USD', // Default, should come from Spec/Request
        status: ProjectStatus.INITIALIZING,
      });

      const savedProject = await queryRunner.manager.save(newProject);
      this.logger.log(`Created Project (INITIALIZING): ${savedProject.id}`);

      // 5. Create Contract linked to Project
      const newContract = queryRunner.manager.create(ContractEntity, {
        projectId: savedProject.id,
        title: `Contract for ${spec.title}`,
        contractUrl: '', // Will be generated/uploaded later
        termsContent: this.generateTermsContent(spec, request),
        status: 'DRAFT',
        createdBy: user.id,
      });

      const savedContract = await queryRunner.manager.save(newContract);
      this.logger.log(`Created Contract (DRAFT): ${savedContract.id}`);

      // 6. Audit Log
      await this.auditLogsService.log({
        actorId: user.id,
        action: 'INITIALIZE_CONTRACT',
        entityType: 'Contract',
        entityId: savedContract.id,
        newData: {
          projectId: savedProject.id,
          specId: dto.specId,
          freelancerId: dto.freelancerId,
        },
        req,
      });

      await queryRunner.commitTransaction();

      return {
        projectId: savedProject.id,
        contractId: savedContract.id,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to initialize contract: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Sign a contract (Client or Freelancer)
   */
  async signContract(
    user: UserEntity,
    dto: SignContractDto,
    req: RequestContext,
  ): Promise<{ signed: boolean; allPartiesSigned: boolean }> {
    const contract = await this.contractsRepository.findOne({
      where: { id: dto.contractId },
      relations: ['project', 'signatures'],
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${dto.contractId} not found`);
    }

    if (contract.status !== 'DRAFT') {
      throw new BadRequestException(`Contract is not in DRAFT status`);
    }

    // Check if user is allowed to sign (Client or Freelancer)
    const project = contract.project;
    const isClient = project.clientId === user.id;
    const isFreelancer = project.freelancerId === user.id;

    if (!isClient && !isFreelancer) {
      throw new ForbiddenException('You are not authorized to sign this contract');
    }

    // Check if already signed
    const existingSignature = await this.signaturesRepository.findOne({
      where: { contractId: contract.id, userId: user.id },
    });

    if (existingSignature) {
      throw new BadRequestException('You have already signed this contract');
    }

    // Create signature
    const signature = this.signaturesRepository.create({
      contractId: contract.id,
      userId: user.id,
      signatureHash: `SIGNED_BY_${user.id}_AT_${new Date().toISOString()}`,
    });

    await this.signaturesRepository.save(signature);

    // Check if all parties have signed
    const allSignatures = await this.signaturesRepository.find({
      where: { contractId: contract.id },
    });

    const clientSigned = allSignatures.some((s) => s.userId === project.clientId);
    const freelancerSigned = allSignatures.some((s) => s.userId === project.freelancerId);
    const allPartiesSigned = clientSigned && freelancerSigned;

    // Audit
    await this.auditLogsService.log({
      actorId: user.id,
      action: 'SIGN_CONTRACT',
      entityType: 'Contract',
      entityId: contract.id,
      newData: { role: isClient ? 'CLIENT' : 'FREELANCER', allPartiesSigned },
      req,
    });

    return { signed: true, allPartiesSigned };
  }

  /**
   * PHASE 2: Activate Project after all signatures
   * Clones Milestones, validates financial integrity, creates Escrow entries.
   */
  async activateProject(
    user: UserEntity,
    contractId: string,
    req: RequestContext,
  ): Promise<{ projectId: string; milestonesCreated: number; escrowsCreated: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get Contract with relations
      const contract = await queryRunner.manager.findOne(ContractEntity, {
        where: { id: contractId },
        relations: ['project', 'signatures'],
      });

      if (!contract) {
        throw new NotFoundException(`Contract ${contractId} not found`);
      }

      if (contract.status === 'ACTIVE') {
        throw new BadRequestException('Contract is already active');
      }

      // 2. Verify all signatures
      const project = contract.project;
      const signatures = contract.signatures || [];

      const clientSigned = signatures.some((s) => s.userId === project.clientId);
      const freelancerSigned = signatures.some((s) => s.userId === project.freelancerId);

      if (!clientSigned || !freelancerSigned) {
        throw new BadRequestException(
          `All parties must sign before activation. Client: ${clientSigned}, Freelancer: ${freelancerSigned}`,
        );
      }

      // 3. Get Spec and its Milestones
      const spec = await queryRunner.manager.findOne(ProjectSpecEntity, {
        where: { requestId: project.requestId },
        relations: ['milestones'],
      });

      if (!spec) {
        throw new NotFoundException('Project Spec not found');
      }

      const specMilestones = spec.milestones || [];
      if (specMilestones.length === 0) {
        throw new BadRequestException('Spec has no milestones to clone');
      }

      // 4. FINANCIAL INTEGRITY CHECK using Decimal.js
      const totalMilestoneAmount = specMilestones.reduce(
        (sum, m) => sum.plus(new Decimal(m.amount)),
        new Decimal(0),
      );

      const projectBudget = new Decimal(project.totalBudget);
      const difference = totalMilestoneAmount.minus(projectBudget).abs();

      if (difference.greaterThan(0.01)) {
        throw new BadRequestException(
          `Financial integrity check failed! ` +
            `Total milestones: $${totalMilestoneAmount.toFixed(2)}, ` +
            `Project budget: $${projectBudget.toFixed(2)}, ` +
            `Difference: $${difference.toFixed(2)}`,
        );
      }

      this.logger.log(
        `Financial check passed: Milestones=$${totalMilestoneAmount.toFixed(2)}, Budget=$${projectBudget.toFixed(2)}`,
      );

      // 5. CLONE Milestones from Spec to Project
      const clonedMilestones: MilestoneEntity[] = [];

      for (const specMilestone of specMilestones) {
        const newMilestone = queryRunner.manager.create(MilestoneEntity, {
          projectId: project.id,
          projectSpecId: spec.id, // TRACEABILITY LINK - Critical!
          title: specMilestone.title,
          description: specMilestone.description,
          amount: specMilestone.amount,
          startDate: specMilestone.startDate,
          dueDate: specMilestone.dueDate, // Clone as-is per Architect's instruction
          status: MilestoneStatus.PENDING,
          sortOrder: specMilestone.sortOrder,
        });

        const savedMilestone = await queryRunner.manager.save(newMilestone);
        clonedMilestones.push(savedMilestone);
      }

      this.logger.log(`Cloned ${clonedMilestones.length} milestones for project ${project.id}`);

      // 6. MANDATORY: Create Escrow entries for each cloned Milestone
      const escrowsCreated: EscrowEntity[] = [];

      for (const milestone of clonedMilestones) {
        const milestoneAmount = new Decimal(milestone.amount);

        // Calculate fee splits using Decimal.js
        const developerShare = milestoneAmount
          .times(FEE_CONFIG.DEVELOPER_PERCENTAGE)
          .dividedBy(100)
          .toDecimalPlaces(2);
        const brokerShare = milestoneAmount
          .times(FEE_CONFIG.BROKER_PERCENTAGE)
          .dividedBy(100)
          .toDecimalPlaces(2);
        const platformFee = milestoneAmount
          .times(FEE_CONFIG.PLATFORM_PERCENTAGE)
          .dividedBy(100)
          .toDecimalPlaces(2);

        const escrow = queryRunner.manager.create(EscrowEntity, {
          projectId: project.id,
          milestoneId: milestone.id,
          totalAmount: milestone.amount,
          fundedAmount: 0,
          releasedAmount: 0,
          developerShare: developerShare.toNumber(),
          brokerShare: brokerShare.toNumber(),
          platformFee: platformFee.toNumber(),
          developerPercentage: FEE_CONFIG.DEVELOPER_PERCENTAGE,
          brokerPercentage: FEE_CONFIG.BROKER_PERCENTAGE,
          platformPercentage: FEE_CONFIG.PLATFORM_PERCENTAGE,
          currency: 'USD',
          status: EscrowStatus.PENDING, // Strictly following DB Enum
        });

        const savedEscrow = await queryRunner.manager.save(escrow);
        escrowsCreated.push(savedEscrow);
      }

      this.logger.log(`Created ${escrowsCreated.length} escrow entries`);

      // 7. Update Contract status to ACTIVE
      contract.status = 'ACTIVE';
      await queryRunner.manager.save(contract);

      // 8. Update Project status to IN_PROGRESS
      project.status = ProjectStatus.IN_PROGRESS;
      project.startDate = new Date();
      await queryRunner.manager.save(project);

      // 9. Audit Log
      await this.auditLogsService.log({
        actorId: user.id,
        action: 'ACTIVATE_PROJECT',
        entityType: 'Project',
        entityId: project.id,
        newData: {
          contractId,
          milestonesCloned: clonedMilestones.length,
          escrowsCreated: escrowsCreated.length,
          totalBudget: project.totalBudget,
        },
        req,
      });

      await queryRunner.commitTransaction();

      return {
        projectId: project.id,
        milestonesCreated: clonedMilestones.length,
        escrowsCreated: escrowsCreated.length,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to activate project: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get contract details
   */
  async getContract(contractId: string): Promise<ContractEntity> {
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
      relations: ['project', 'signatures', 'creator'],
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    return contract;
  }

  /**
   * List contracts for a project
   */
  async getContractsByProject(projectId: string): Promise<ContractEntity[]> {
    return this.contractsRepository.find({
      where: { projectId },
      relations: ['signatures'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Generate terms content from Spec (simplified version)
   */
  private generateTermsContent(
    spec: ProjectSpecEntity,
    request: { clientId: string; brokerId: string },
  ): string {
    const milestones = spec.milestones || [];
    const milestonesText = milestones
      .map(
        (m, i) =>
          `${i + 1}. ${m.title}: $${m.amount} (Due: ${m.dueDate ? new Date(m.dueDate).toLocaleDateString() : 'TBD'})`,
      )
      .join('\n');

    return `
INTERDEV SOFTWARE DEVELOPMENT CONTRACT

Project: ${spec.title}
Total Budget: $${spec.totalBudget}

SCOPE OF WORK:
${spec.description}

MILESTONES:
${milestonesText}

TERMS:
1. Payment will be held in escrow and released upon milestone completion.
2. Developer receives 85%, Broker receives 10%, Platform fee is 5%.
3. Disputes will be resolved by InterDev Admin team.

Generated at: ${new Date().toISOString()}
    `.trim();
  }
}
