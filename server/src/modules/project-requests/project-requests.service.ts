import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';

@Injectable()
export class ProjectRequestsService {
  constructor(
    @InjectRepository(ProjectRequestEntity)
    private readonly projectRequestRepository: Repository<ProjectRequestEntity>,
  ) {}

  async assignBroker(requestId: string, brokerId: string): Promise<ProjectRequestEntity> {
    const request = await this.projectRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Project request with ID ${requestId} not found`);
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        `Request cannot be processed. Current status: ${request.status}`,
      );
    }

    if (request.brokerId) {
      throw new BadRequestException(
        `Request is already assigned to a broker (ID: ${request.brokerId})`,
      );
    }

    request.brokerId = brokerId;
    request.status = RequestStatus.PROCESSING;

    return await this.projectRequestRepository.save(request);
  }

  async findAll(status?: RequestStatus): Promise<ProjectRequestEntity[]> {
    const query = this.projectRequestRepository.createQueryBuilder('request');

    if (status) {
      query.where('request.status = :status', { status });
    }

    return await query.orderBy('request.createdAt', 'DESC').getMany();
  }
}
