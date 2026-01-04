import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { DataSource } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ConflictException } from '@nestjs/common';
import { UserEntity, UserRole } from '../../database/entities/user.entity';

@Injectable()
export class ProjectRequestsService {
  constructor(
    @InjectRepository(ProjectRequestEntity)
    private readonly projectRequestRepository: Repository<ProjectRequestEntity>,
    private readonly dataSource: DataSource,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async assignBroker(requestId: string, brokerId: string, req: any): Promise<ProjectRequestEntity> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock the row to prevent race conditions (Pessimistic Write)
      // This ensures that if two brokers assign simultaneously, one waits for the other.
      const request = await queryRunner.manager.findOne(ProjectRequestEntity, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException(`Project request with ID ${requestId} not found`);
      }

      // 2. Validate Status and BrokerId
      if (request.status !== RequestStatus.PENDING) {
        throw new ConflictException(
          `Request cannot be processed. Current status: ${request.status}`,
        );
      }

      if (request.brokerId) {
        throw new ConflictException(
          `Request is already assigned to a broker (ID: ${request.brokerId})`,
        );
      }

      // 3. Update the request
      request.brokerId = brokerId;
      request.status = RequestStatus.PROCESSING;

      const savedRequest = await queryRunner.manager.save(request);

      // 4. Log the action
      await this.auditLogsService.logCustom(
        'ASSIGN_BROKER',
        'ProjectRequest',
        requestId,
        { brokerId, status: RequestStatus.PROCESSING },
        req, // Pass the request object here
        brokerId, // Actor ID
      );

      await queryRunner.commitTransaction();
      return savedRequest;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(status?: RequestStatus): Promise<ProjectRequestEntity[]> {
    const query = this.projectRequestRepository.createQueryBuilder('request');

    if (status) {
      query.where('request.status = :status', { status });
    }

    return await query.orderBy('request.createdAt', 'DESC').getMany();
  }

  async findOne(id: string, user: UserEntity): Promise<ProjectRequestEntity> {
    const request = await this.projectRequestRepository.findOne({
      where: { id },
      relations: [
        'client',
        'answers',
        'answers.question',
        'answers.option',
      ],
    });

    if (!request) {
      throw new NotFoundException(`Project request with ID ${id} not found`);
    }

    // Access Control Logic
    const isAdmin = user.role === UserRole.ADMIN;
    const isOwner = request.clientId === user.id;
    const isAssignedBroker = request.brokerId === user.id;
    const isPending = request.status === RequestStatus.PENDING;
    const isBroker = user.role === UserRole.BROKER;

    // 1. Admin: Allow all
    if (isAdmin) {
      return request;
    }

    // 2. Client: Must be owner
    if (user.role === UserRole.CLIENT && !isOwner) {
      throw new ForbiddenException('You do not have permission to view this request.');
    }

    // 3. Broker: Must be assigned OR request must be PENDING
    if (isBroker) {
      if (!isAssignedBroker && !isPending) {
        throw new ForbiddenException('You do not have permission to view this request.');
      }

      // Data Masking for Unassigned Brokers (PENDING requests)
      if (isPending && !isAssignedBroker) {
        if (request.client) {
          // Mask sensitive fields
          request.client.email = '********' as any;
          request.client.phoneNumber = '********' as any;
        }
      }
    }

    return request;
  }
}
