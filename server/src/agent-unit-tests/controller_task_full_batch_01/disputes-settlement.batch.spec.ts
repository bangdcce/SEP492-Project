import {
  buildDisputeCaseDefinitions,
  createDisputesGroupRuntime,
  loadDisputesEndpoints,
  runEdgeCase,
  runForbiddenCase,
  runHappyCase,
  runNotFoundCase,
  runUnauthorizedCase,
  runUnexpectedErrorCase,
  runValidationCase,
} from './disputes-batch-runtime';
import { assertCurrentTestHasCaseLog } from './test-log-helpers';

const endpoints = loadDisputesEndpoints('settlement-controller');

describe('Disputes cluster batch - settlement controller', () => {
  jest.setTimeout(300000);
  let runtime: Awaited<ReturnType<typeof createDisputesGroupRuntime>>;

  beforeAll(async () => {
    runtime = await createDisputesGroupRuntime('settlement-controller');
  });

  afterEach(() => {
    assertCurrentTestHasCaseLog();
  });

  for (const endpoint of endpoints) {
    describe(`${endpoint.code} ${endpoint.requestMethod} ${endpoint.path}`, () => {
      const cases = buildDisputeCaseDefinitions(endpoint);

      it(cases[0].title, async () => {
        await runHappyCase(runtime, endpoint);
      });

      it(cases[1].title, async () => {
        await runEdgeCase(runtime, endpoint, 'edge-1');
      });

      it(cases[2].title, async () => {
        await runEdgeCase(runtime, endpoint, 'edge-2');
      });

      it(cases[3].title, async () => {
        await runValidationCase(runtime, endpoint);
      });

      it(cases[4].title, async () => {
        await runNotFoundCase(runtime, endpoint);
      });

      it(cases[5].title, async () => {
        await runUnexpectedErrorCase(runtime, endpoint);
      });

      it(cases[6].title, async () => {
        await runUnauthorizedCase(runtime, endpoint);
      });

      it(cases[7].title, async () => {
        await runForbiddenCase(runtime, endpoint);
      });
    });
  }
});
