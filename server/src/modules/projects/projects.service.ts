import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from '../../database/entities/project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
  ) {}

  async listByUser(userId: string) {
    return this.projectRepository.find({
      where: [{ clientId: userId }, { freelancerId: userId }],
      select: [
        'id',
        'title',
        'description',
        'status',
        'clientId',
        'freelancerId',
        'totalBudget',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });
  }
}
