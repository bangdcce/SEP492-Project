import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  DisputeEntity,
  DisputeStatus,
  EscrowEntity,
  UserEntity,
} from 'src/database/entities';
import {
  DisputeSettlementEntity,
  SettlementStatus,
} from 'src/database/entities/dispute-settlement.entity';
import { SettlementService } from './settlement.service';
import { recordEvidence } from '../../../../test/fe16-fe18/evidence-recorder';

describe('SettlementService', () => {
  let service: SettlementService;
  let settlementRepository: any;
  let disputeRepository: any;

  const repoMock = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: getRepositoryToken(DisputeSettlementEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeEntity), useValue: repoMock() },
        { provide: getRepositoryToken(EscrowEntity), useValue: repoMock() },
        { provide: getRepositoryToken(UserEntity), useValue: repoMock() },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(SettlementService);
    settlementRepository = module.get(getRepositoryToken(DisputeSettlementEntity));
    disputeRepository = module.get(getRepositoryToken(DisputeEntity));
  });

  it('validates exact settlement distribution and computes the fee breakdown', () => {
    const result = service.validateMoneyLogic(95, 25, 120);

    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        breakdown: expect.objectContaining({
          amountToFreelancer: 95,
          amountToClient: 25,
          freelancerFee: 4.75,
          clientFee: 0,
          totalPlatformFee: 4.75,
          freelancerNetAmount: 90.25,
          clientNetAmount: 25,
        }),
      }),
    );
    recordEvidence({
      id: 'FE17-SET-01',
      evidenceRef: 'settlement.service.spec.ts::validateMoneyLogic',
      actualResults:
        'SettlementService.validateMoneyLogic accepted a 95/25 split over a 120 funded balance and returned a precise fee breakdown with freelancerFee=4.75, totalPlatformFee=4.75, and freelancerNetAmount=90.25.',
    });
  });

  it('blocks settlement eligibility when a pending offer already exists', async () => {
    disputeRepository.findOne.mockResolvedValue({
      id: 'dispute-1',
      status: DisputeStatus.OPEN,
      raisedById: 'client-1',
      defendantId: 'freelancer-1',
    });
    settlementRepository.findOne.mockResolvedValue({
      id: 'settlement-1',
      disputeId: 'dispute-1',
      status: SettlementStatus.PENDING,
    });

    const result = await service.checkSettlementEligibility('dispute-1', 'client-1');

    expect(result).toEqual(
      expect.objectContaining({
        eligible: false,
        reason: 'A pending settlement offer already exists',
      }),
    );
    recordEvidence({
      id: 'FE17-SET-02',
      evidenceRef: 'settlement.service.spec.ts::checkSettlementEligibility pending offer',
      actualResults:
        'SettlementService.checkSettlementEligibility returned eligible=false with reason=\"A pending settlement offer already exists\" when the dispute already had a pending settlement row.',
    });
  });
});
