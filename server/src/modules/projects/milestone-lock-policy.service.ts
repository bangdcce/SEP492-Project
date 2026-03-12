import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractEntity, ContractStatus } from '../../database/entities/contract.entity';

export type MilestoneStructureMutationContext = 'DEFAULT' | 'AMENDMENT';

@Injectable()
export class MilestoneLockPolicyService {
  constructor(
    @InjectRepository(ContractEntity)
    private readonly contractRepository: Repository<ContractEntity>,
  ) {}

  async findLatestLiveContract(projectId: string): Promise<ContractEntity | null> {
    return this.contractRepository
      .createQueryBuilder('contract')
      .where('contract.projectId = :projectId', { projectId })
      .andWhere('contract.status <> :archivedStatus', {
        archivedStatus: ContractStatus.ARCHIVED,
      })
      .orderBy('contract.activatedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('contract.createdAt', 'DESC')
      .getOne();
  }

  async findLatestActivatedContract(projectId: string): Promise<ContractEntity | null> {
    return this.contractRepository
      .createQueryBuilder('contract')
      .where('contract.projectId = :projectId', { projectId })
      .andWhere('contract.activatedAt IS NOT NULL')
      .orderBy('contract.activatedAt', 'DESC')
      .addOrderBy('contract.createdAt', 'DESC')
      .getOne();
  }

  async isMilestoneStructureLocked(projectId: string): Promise<boolean> {
    const liveContract = await this.findLatestLiveContract(projectId);
    return Boolean(liveContract);
  }

  async assertCanMutateMilestoneStructure(
    projectId: string,
    context: MilestoneStructureMutationContext = 'DEFAULT',
  ): Promise<void> {
    if (context === 'AMENDMENT') {
      return;
    }

    const isLocked = await this.isMilestoneStructureLocked(projectId);
    if (isLocked) {
      throw new BadRequestException(
        'Milestone structure is locked while a live contract exists for this project. Review the frozen contract before activation; amendment support is not available yet.',
      );
    }
  }
}
