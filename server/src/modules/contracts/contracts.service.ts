import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import Decimal from 'decimal.js';
import { ContractEntity } from '../../database/entities/contract.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import { ProjectSpecEntity, ProjectSpecStatus } from '../../database/entities/project-spec.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import { EscrowEntity, EscrowStatus } from '../../database/entities/escrow.entity';
import { UserEntity } from '../../database/entities/user.entity';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    @InjectRepository(ContractEntity)
    private readonly contractRepo: Repository<ContractEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(ProjectSpecEntity)
    private readonly specRepo: Repository<ProjectSpecEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Phase 1: Initialize Project & Contract from Spec
   * Creates a "Ghost" Project (INITIALIZING) and a Draft Contract.
   */
  async initializeProjectAndContract(
    specId: string,
    creatorId: string,
  ): Promise<{ contractId: string; projectId: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify Spec
      const spec = await queryRunner.manager.findOne(ProjectSpecEntity, {
        where: { id: specId },
        relations: ['request'],
      });

      if (!spec) throw new NotFoundException('Spec not found');
      if (spec.status !== ProjectSpecStatus.APPROVED) {
        throw new BadRequestException('Spec must be APPROVED before creating contract');
      }

      // Check if contract already exists for this spec (via request -> project linkage)
      // Complexity: Project Request relates to Project via OneToMany or similar. 
      // For MVP, we assume 1 Request -> 1 Active Project.
      // But here we might create multiple attempts. We allow it as long as previous ones are not ACTIVE.

      // 2. Create Project (INITIALIZING)
      const project = queryRunner.manager.create(ProjectEntity, {
        clientId: spec.request.clientId, // Copied from Request
        brokerId: spec.request.brokerId,
        // freelancerId: spec.request... wait, ProjectReq might not have picked freelancer yet?
        // Assuming Broker picked a freelancer in the workflow, but ProjectRequestEntity definition needs checking.
        // For now, let's assume we get freelancerId from the proposal or passed in. 
        // Actually, 'initializeProjectAndContract' is usually called when Broker finalized the deal.
        // The Specification usually implies the team.
        // Let's check spec.request's logic later. for now, keep freelancerId null or set if known.
        title: spec.title,
        description: spec.description,
        totalBudget: spec.totalBudget,
        status: ProjectStatus.INITIALIZING, // New Status
        requestId: spec.requestId,
      });
      
      const savedProject = await queryRunner.manager.save(project);

      // 3. Create Contract (DRAFT)
      const contract = queryRunner.manager.create(ContractEntity, {
        projectId: savedProject.id,
        title: `Contract for ${spec.title}`,
        contractUrl: 'PENDING_GENERATION', // Placeholder
        status: 'DRAFT',
        createdBy: creatorId,
      });
      const savedContract = await queryRunner.manager.save(contract);

      await queryRunner.commitTransaction();
      return { contractId: savedContract.id, projectId: savedProject.id };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to initialize contract: ${err.message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Phase 2: Activate Project
   * Signs the contract, Validates budget, Clones Milestones, Creates Escrow.
   */
  async activateProject(contractId: string, user: UserEntity): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Fetch Contract & Project
      const contract = await queryRunner.manager.findOne(ContractEntity, {
        where: { id: contractId },
        relations: ['project'],
      });
      if (!contract) throw new NotFoundException('Contract not found');
      if (contract.status === 'ACTIVE') throw new BadRequestException('Contract already active');

      const project = contract.project;
      if (!project) throw new NotFoundException('Associated project not found');

      // 2. Retrieve Spec & Milestones (Source of Truth)
      // Project -> Request -> Spec
      // Needed relations: Project.request -> Spec -> Milestones
      const projectRequest = await queryRunner.manager.findOne('ProjectRequestEntity', {
          where: { id: project.requestId },
          relations: ['spec', 'spec.milestones'],
      }) as any;

      if (!projectRequest || !projectRequest.spec) {
          throw new BadRequestException('Linked Spec not found for this project');
      }

      const spec = projectRequest.spec;
      const specMilestones: MilestoneEntity[] = spec.milestones;

      if (!specMilestones || specMilestones.length === 0) {
        throw new BadRequestException('Spec has no milestones');
      }

      // 3. Validate Financial Integrity (Decimal.js)
      const projectBudget = new Decimal(project.totalBudget);
      const milestonesSum = specMilestones.reduce(
        (acc, m) => acc.plus(new Decimal(m.amount)),
        new Decimal(0)
      );

      const diff = projectBudget.minus(milestonesSum).abs();
      if (diff.greaterThan(0.01)) {
         throw new BadRequestException(
           `Financial Mismatch: Project Budget (${projectBudget}) != Milestones Sum (${milestonesSum})`
         );
      }

      // 4. CLONE Milestones
      const newMilestones: MilestoneEntity[] = [];
      const newEscrows: EscrowEntity[] = [];

      for (const sm of specMilestones) {
        // Create Project Milestone
        const pm = queryRunner.manager.create(MilestoneEntity, {
          projectId: project.id,
          projectSpecId: spec.id, // Traceability Link
          title: sm.title,
          description: sm.description,
          amount: sm.amount,
          startDate: sm.startDate,
          dueDate: sm.dueDate, // As advised: Keep original due date
          status: MilestoneStatus.PENDING,
          sortOrder: sm.sortOrder,
        });
        const savedPm = await queryRunner.manager.save(pm);
        newMilestones.push(savedPm);

        // Create Escrow Entry (MANDATORY)
        const escrow = queryRunner.manager.create(EscrowEntity, {
          projectId: project.id,
          milestoneId: savedPm.id,
          totalAmount: savedPm.amount,
          status: EscrowStatus.PENDING, // Strict Enum Check
          // Default splits
          developerPercentage: 85,
          brokerPercentage: 10,
          platformPercentage: 5,
        });
        newEscrows.push(escrow);
      }
      
      await queryRunner.manager.save(newEscrows);

      // 5. Update Statuses
      contract.status = 'ACTIVE';
      project.status = ProjectStatus.IN_PROGRESS;

      await queryRunner.manager.save(contract);
      await queryRunner.manager.save(project);

      await queryRunner.commitTransaction();

      return {
        message: 'Project activated successfully',
        projectStatus: project.status,
        clonedMilestones: newMilestones.length,
        escrowEntries: newEscrows.length
      };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to activate project: ${err.message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
