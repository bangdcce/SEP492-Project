import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { HearingVerdictOrchestratorService } from './services/hearing-verdict-orchestrator.service';
import { UserRole } from 'src/database/entities';

describe('DisputesController', () => {
  let controller: DisputesController;
  let hearingVerdictOrchestrator: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputesController],
      providers: [
        {
          provide: DisputesService,
          useValue: {},
        },
        {
          provide: HearingVerdictOrchestratorService,
          useValue: {
            issueHearingVerdict: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DisputesController>(DisputesController);
    hearingVerdictOrchestrator = module.get(HearingVerdictOrchestratorService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates hearing-room verdict issuance to the orchestrator', async () => {
    hearingVerdictOrchestrator.issueHearingVerdict.mockResolvedValue({
      verdict: { id: 'verdict-1' },
    });

    const result = await controller.issueHearingVerdict(
      'hearing-1',
      { verdict: { result: 'WIN_CLIENT' }, closeHearing: {} } as any,
      { id: 'staff-1', role: UserRole.STAFF } as any,
    );

    expect(hearingVerdictOrchestrator.issueHearingVerdict).toHaveBeenCalledWith(
      'hearing-1',
      'staff-1',
      UserRole.STAFF,
      expect.any(Object),
    );
    expect(result).toEqual({
      success: true,
      message: 'Verdict issued and hearing closed',
      data: { verdict: { id: 'verdict-1' } },
    });
  });

  it('blocks the legacy resolve endpoint and directs callers to the hearing-room flow', async () => {
    await expect(
      controller.resolveDispute(
        'dispute-1',
        { verdict: 'WIN_CLIENT' } as any,
        { id: 'staff-1', role: UserRole.STAFF } as any,
      ),
    ).rejects.toEqual(
      new ConflictException({
        code: 'VERDICT_ONLY_IN_HEARING',
        message: 'Verdict can only be issued from Hearing Room.',
        action: 'Use POST /disputes/hearings/:hearingId/verdict.',
      }),
    );
  });
});
