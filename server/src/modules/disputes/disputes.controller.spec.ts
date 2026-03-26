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
});
