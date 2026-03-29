import {
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
      it(`${endpoint.code} UTC01 happy path returns ${endpoint.name} payload`, async () => {
        await runHappyCase(runtime, endpoint);
      });

      it(`${endpoint.code} UTC02 edge case accepts valid variant one`, async () => {
        await runEdgeCase(runtime, endpoint, 'edge-1');
      });

      it(`${endpoint.code} UTC03 edge case accepts valid variant two`, async () => {
        await runEdgeCase(runtime, endpoint, 'edge-2');
      });

      it(`${endpoint.code} UTC04 validation handles malformed input`, async () => {
        await runValidationCase(runtime, endpoint);
      });

      it(`${endpoint.code} UTC05 validation propagates not-found flow`, async () => {
        await runNotFoundCase(runtime, endpoint);
      });

      it(`${endpoint.code} UTC06 validation propagates unexpected service failures`, async () => {
        await runUnexpectedErrorCase(runtime, endpoint);
      });

      it(`${endpoint.code} UTC07 security returns 401 for unauthenticated access`, async () => {
        await runUnauthorizedCase(runtime, endpoint);
      });

      it(`${endpoint.code} UTC08 security returns 403 for forbidden access`, async () => {
        await runForbiddenCase(runtime, endpoint);
      });
    });
  }
});
