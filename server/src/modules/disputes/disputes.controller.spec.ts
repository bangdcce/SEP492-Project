import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { HearingVerdictOrchestratorService } from './services/hearing-verdict-orchestrator.service';
import { UserRole } from 'src/database/entities';

describe('DisputesController', () => {
  let controller: DisputesController;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBypassFlag = process.env.DISPUTE_USER_GUIDE_BYPASS;
  const disputesServiceMock = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (!(property in _target)) {
          (_target as Record<string, unknown>)[property as string] = jest.fn();
        }
        return (_target as Record<string, unknown>)[property as string];
      },
    },
  );
  const hearingVerdictOrchestratorMock = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (!(property in _target)) {
          (_target as Record<string, unknown>)[property as string] = jest.fn();
        }
        return (_target as Record<string, unknown>)[property as string];
      },
    },
  );

  beforeEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DISPUTE_USER_GUIDE_BYPASS = originalBypassFlag;

    Object.values(disputesServiceMock as Record<string, unknown>).forEach((member) => {
      if (typeof member === 'function' && 'mockReset' in member) {
        (member as jest.Mock).mockReset();
      }
    });

    controller = new DisputesController(
      disputesServiceMock as unknown as DisputesService,
      hearingVerdictOrchestratorMock as unknown as HearingVerdictOrchestratorService,
    );
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DISPUTE_USER_GUIDE_BYPASS = originalBypassFlag;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('UUID validation', () => {
    const idParam = {
      type: 'param' as const,
      metatype: String,
      data: 'id',
    };

    it('rejects malformed dispute ids for submitAppeal', async () => {
      await expect(new ParseUUIDPipe().transform('bad-id', idParam)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects malformed dispute ids for resolveAppeal', async () => {
      await expect(new ParseUUIDPipe().transform('not-a-uuid', idParam)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects malformed dispute ids for assignAppealOwner', async () => {
      await expect(new ParseUUIDPipe().transform('appeal-owner-id', idParam)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('staff scope bypass guard', () => {
    it('keeps staff queue scoped in production even if bypass flag is enabled', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DISPUTE_USER_GUIDE_BYPASS = 'true';

      (disputesServiceMock.getQueueDisputes as jest.Mock).mockResolvedValue([]);

      await controller.getQueueDisputes(
        { id: 'staff-1', role: UserRole.STAFF } as any,
        {} as any,
      );

      expect(disputesServiceMock.getQueueDisputes).toHaveBeenCalledWith(
        expect.objectContaining({ assignedStaffId: 'staff-1' }),
      );
    });

    it('allows bypass in non-production when explicitly enabled', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DISPUTE_USER_GUIDE_BYPASS = 'true';

      (disputesServiceMock.getQueueDisputes as jest.Mock).mockResolvedValue([]);

      await controller.getQueueDisputes(
        { id: 'staff-1', role: UserRole.STAFF } as any,
        {} as any,
      );

      expect(disputesServiceMock.getQueueDisputes).toHaveBeenCalledWith(
        expect.not.objectContaining({ assignedStaffId: 'staff-1' }),
      );
    });
  });
});
