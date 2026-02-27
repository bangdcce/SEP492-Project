import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractEntity } from '../../database/entities/contract.entity';

export type MilestoneStructureMutationContext = 'DEFAULT' | 'AMENDMENT';

@Injectable()
export class MilestoneLockPolicyService {
  constructor(
    @InjectRepository(ContractEntity)
    private readonly contractRepository: Repository<ContractEntity>,
  ) {}

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
    const contract = await this.findLatestActivatedContract(projectId);
    return Array.isArray(contract?.milestoneSnapshot) && contract.milestoneSnapshot.length > 0;
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
        'Milestones are locked after contract activation. Use amendment flow to change milestone scope.',
      );
    }
  }
}
