import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FundingGateway } from '../../database/entities';
import { PaymentsController } from './payments.controller';
import { MilestoneFundingService } from './milestone-funding.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;

  const milestoneFundingService = {
    fundMilestone: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: MilestoneFundingService,
          useValue: milestoneFundingService,
        },
      ],
    }).compile();

    controller = module.get(PaymentsController);
  });

  it('requires the Idempotency-Key header', async () => {
    await expect(
      controller.fundMilestone(
        { id: 'client-1' } as never,
        'milestone-1',
        { paymentMethodId: 'method-1', gateway: FundingGateway.INTERNAL_SANDBOX },
        '',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes funding input through when the Idempotency-Key header is present', async () => {
    milestoneFundingService.fundMilestone.mockResolvedValue({
      fundingIntentId: 'intent-1',
      milestoneId: 'milestone-1',
      escrowId: 'escrow-1',
      escrowStatus: 'FUNDED',
      walletSnapshot: {},
      transactions: {
        depositTransactionId: 'tx-deposit',
        holdTransactionId: 'tx-hold',
      },
      nextAction: null,
      gateway: FundingGateway.INTERNAL_SANDBOX,
    });

    const result = await controller.fundMilestone(
      { id: 'client-1' } as never,
      'milestone-1',
      { paymentMethodId: 'method-1', gateway: FundingGateway.INTERNAL_SANDBOX },
      'idem-1',
    );

    expect(milestoneFundingService.fundMilestone).toHaveBeenCalledWith({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.INTERNAL_SANDBOX,
      idempotencyKey: 'idem-1',
    });
    expect(result.success).toBe(true);
  });
});
