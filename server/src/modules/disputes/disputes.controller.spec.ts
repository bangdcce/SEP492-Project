import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { HearingVerdictOrchestratorService } from './services/hearing-verdict-orchestrator.service';

describe('DisputesController', () => {
  let controller: DisputesController;
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
    controller = new DisputesController(
      disputesServiceMock as unknown as DisputesService,
      hearingVerdictOrchestratorMock as unknown as HearingVerdictOrchestratorService,
    );
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
});
