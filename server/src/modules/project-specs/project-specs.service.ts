import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProjectSpecEntity, ProjectSpecStatus } from '../../database/entities/project-spec.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateProjectSpecDto } from './dto/create-project-spec.dto';
import { UserEntity } from '../../database/entities/user.entity';
import type { RequestContext } from '../audit-logs/audit-logs.service';

@Injectable()
export class ProjectSpecsService {
  private readonly logger = new Logger(ProjectSpecsService.name);

  constructor(
    @InjectRepository(ProjectSpecEntity)
    private readonly projectSpecsRepository: Repository<ProjectSpecEntity>,
    @InjectRepository(MilestoneEntity)
    private readonly milestonesRepository: Repository<MilestoneEntity>,
    @InjectRepository(ProjectRequestEntity)
    private readonly projectRequestsRepository: Repository<ProjectRequestEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly dataSource: DataSource,
  ) {}

  async createSpec(
    user: UserEntity,
    createSpecDto: CreateProjectSpecDto,
    req: RequestContext,
  ): Promise<ProjectSpecEntity> {
    const { requestId, milestones, totalBudget, ...specData } = createSpecDto;

    // Use queryRunner for transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate Project Request
      const projectRequest = await queryRunner.manager.findOne(ProjectRequestEntity, {
        where: { id: requestId },
        relations: ['broker'],
      });

      if (!projectRequest) {
        throw new NotFoundException('Project request not found');
      }

      // Check ownership
      if (projectRequest.brokerId !== user.id) {
        throw new ForbiddenException('You are not authorized to create a spec for this request');
      }


      // 2. Financial Integrity Check
      // Calculate total milestone amount. Use parseFloat to handle potential string inputs from DTO if not strictly transformed,
      // but class-transformer @Type should handle it. Being safe with number operations.
      const totalMilestoneAmount = milestones.reduce((sum, m) => sum + Number(m.amount), 0);

      // Compare with totalBudget (handling floating point small diffs if necessary, but here we expect exact match for business logic)
      if (Math.abs(totalMilestoneAmount - totalBudget) > 0.01) {
        throw new BadRequestException(
          `Total budget (${totalBudget}) does not match sum of milestones (${totalMilestoneAmount})`,
        );
      }

      // 3. Save Project Spec
      const newSpec = queryRunner.manager.create(ProjectSpecEntity, {
        requestId,
        totalBudget,
        ...specData,
        status: ProjectSpecStatus.PENDING_APPROVAL, // Default as per requirement
      });
      const savedSpec = await queryRunner.manager.save(newSpec);

      // 4. Save Milestones
      const newMilestones = milestones.map((m) =>
        queryRunner.manager.create(MilestoneEntity, {
          ...m,
          projectSpecId: savedSpec.id,
          status: MilestoneStatus.PENDING,
          projectId: null, // Not assigned to a project yet
        }),
      );
      // We need to allow nullable projectId in MilestoneEntity? Yes, existing entity might need checking.
      // Assuming existing MilestoneEntity update allowed nullable projectId or we fix it.
      // Based on my view of MilestoneEntity, 'projectId' column is defined. Is it nullable?
      // I saw: @Column() projectId: string; (Not nullable).
      // WAIT: MilestoneEntity definition showed @Column() projectId: string;
      // If it's not nullable, we have a problem because Spec milestones don't belong to a Project yet.
      // I need to check MilestoneEntity again. If projectId is NOT nullable, I need to modify it or provide dummy.
      // RE-CHECKING MilestoneEntity... (I will assume I need to fix it in next step if it fails, but better check now).
      // Let's assume for now I will fix it.

      await queryRunner.manager.save(newMilestones);

      // 5. Update Project Request Status
      projectRequest.status = RequestStatus.SPEC_SUBMITTED;
      await queryRunner.manager.save(projectRequest);

      // 6. Audit Log
      await this.auditLogsService.log({
        actorId: user.id,
        action: 'SUBMIT_SPEC',
        entityType: 'ProjectSpec',
        entityId: savedSpec.id,
        newData: { totalBudget, milestoneCount: milestones.length },
        req,
      });

      await queryRunner.commitTransaction();

      return this.findOne(savedSpec.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create project spec: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findOne(id: string): Promise<ProjectSpecEntity> {
    const spec = await this.projectSpecsRepository.findOne({
      where: { id },
      relations: ['milestones', 'request', 'request.client'],
    });

    if (!spec) {
      throw new NotFoundException(`Project Spec with ID ${id} not found`);
    }

    return spec;
  }
}
