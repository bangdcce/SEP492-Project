import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EscrowEntity, EscrowStatus } from '../../database/entities/escrow.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';

export type MilestoneInteractionGateState =
  | 'UNLOCKED'
  | 'LOCKED_PREVIOUS_MILESTONE_NOT_PAID'
  | 'LOCKED_NOT_FUNDED';

export interface MilestoneInteractionGate {
  state: MilestoneInteractionGateState;
  milestone: MilestoneEntity;
  message: string;
  blockingMilestoneId: string | null;
  blockingMilestoneTitle: string | null;
  blockingMilestoneOrder: number | null;
}

@Injectable()
export class MilestoneInteractionPolicyService {
  constructor(
    @InjectRepository(MilestoneEntity)
    private readonly milestoneRepository: Repository<MilestoneEntity>,
    @InjectRepository(EscrowEntity)
    private readonly escrowRepository: Repository<EscrowEntity>,
  ) {}

  async getMilestoneInteractionGate(milestoneId: string): Promise<MilestoneInteractionGate> {
    const milestone = await this.milestoneRepository.findOne({
      where: { id: milestoneId },
      select: ['id', 'projectId', 'title', 'amount', 'status', 'sortOrder', 'startDate', 'createdAt'],
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const gateMap = await this.getProjectMilestoneInteractionGates(milestone.projectId || null);
    return (
      gateMap.get(milestone.id) ?? {
        state: 'UNLOCKED',
        milestone,
        message: '',
        blockingMilestoneId: null,
        blockingMilestoneTitle: null,
        blockingMilestoneOrder: null,
      }
    );
  }

  async assertMilestoneUnlockedForWorkspace(milestoneId: string): Promise<MilestoneInteractionGate> {
    const gate = await this.getMilestoneInteractionGate(milestoneId);

    if (gate.state === 'LOCKED_PREVIOUS_MILESTONE_NOT_PAID') {
      throw new ForbiddenException(gate.message);
    }

    if (gate.state === 'LOCKED_NOT_FUNDED') {
      throw new ConflictException(gate.message);
    }

    return gate;
  }

  async getProjectMilestoneInteractionGates(
    projectId: string | null | undefined,
  ): Promise<Map<string, MilestoneInteractionGate>> {
    const gateMap = new Map<string, MilestoneInteractionGate>();
    if (!projectId) {
      return gateMap;
    }

    const milestones = await this.milestoneRepository.find({
      where: { projectId },
      order: { sortOrder: 'ASC', startDate: 'ASC', createdAt: 'ASC' },
    });

    if (milestones.length === 0) {
      return gateMap;
    }

    const escrows = await this.escrowRepository.find({
      where: { projectId },
      select: ['id', 'milestoneId', 'status', 'fundedAmount', 'totalAmount'],
    });

    const escrowByMilestoneId = new Map<string, EscrowEntity>();
    for (const escrow of escrows) {
      if (escrow.milestoneId) {
        escrowByMilestoneId.set(escrow.milestoneId, escrow);
      }
    }

    const sortedMilestones = [...milestones].sort((left, right) => {
      const leftSortOrder = typeof left.sortOrder === 'number' ? left.sortOrder : Number.MAX_SAFE_INTEGER;
      const rightSortOrder =
        typeof right.sortOrder === 'number' ? right.sortOrder : Number.MAX_SAFE_INTEGER;
      if (leftSortOrder !== rightSortOrder) {
        return leftSortOrder - rightSortOrder;
      }

      const leftStart = left.startDate ? new Date(left.startDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightStart = right.startDate ? new Date(right.startDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }

      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });

    let firstBlockingMilestone: MilestoneEntity | null = null;
    let firstBlockingOrder: number | null = null;

    for (const [index, milestone] of sortedMilestones.entries()) {
      const orderNumber = this.getMilestoneOrderNumber(milestone, index);

      if (firstBlockingMilestone) {
        gateMap.set(milestone.id, {
          state: 'LOCKED_PREVIOUS_MILESTONE_NOT_PAID',
          milestone,
          message: `This milestone is locked until Milestone #${firstBlockingOrder} (${firstBlockingMilestone.title}) is fully approved and PAID.`,
          blockingMilestoneId: firstBlockingMilestone.id,
          blockingMilestoneTitle: firstBlockingMilestone.title,
          blockingMilestoneOrder: firstBlockingOrder,
        });
        continue;
      }

      const escrow = escrowByMilestoneId.get(milestone.id);
      if (!this.isEscrowFullyFunded(escrow, milestone)) {
        gateMap.set(milestone.id, {
          state: 'LOCKED_NOT_FUNDED',
          milestone,
          message: 'This milestone is locked until the client fully funds its escrow.',
          blockingMilestoneId: null,
          blockingMilestoneTitle: null,
          blockingMilestoneOrder: null,
        });
      } else {
        gateMap.set(milestone.id, {
          state: 'UNLOCKED',
          milestone,
          message: '',
          blockingMilestoneId: null,
          blockingMilestoneTitle: null,
          blockingMilestoneOrder: null,
        });
      }

      if (milestone.status !== MilestoneStatus.PAID) {
        firstBlockingMilestone = milestone;
        firstBlockingOrder = orderNumber;
      }
    }

    return gateMap;
  }

  private getMilestoneOrderNumber(milestone: MilestoneEntity, index: number): number {
    return typeof milestone.sortOrder === 'number' ? milestone.sortOrder : index + 1;
  }

  private isEscrowFullyFunded(
    escrow: Pick<EscrowEntity, 'status' | 'fundedAmount' | 'totalAmount'> | null | undefined,
    milestone: Pick<MilestoneEntity, 'amount'>,
  ): boolean {
    if (!escrow || escrow.status !== EscrowStatus.FUNDED) {
      return false;
    }

    const totalAmount = Number(escrow.totalAmount ?? milestone.amount ?? 0);
    const fundedAmount = Number(escrow.fundedAmount ?? 0);
    return fundedAmount >= totalAmount;
  }
}
