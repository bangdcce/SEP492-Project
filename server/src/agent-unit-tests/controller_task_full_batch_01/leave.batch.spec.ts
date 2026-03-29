import {
  createServiceControllerGroupRuntime,
  loadServiceControllerEndpoints,
  runEdgeCase,
  runForbiddenCase,
  runHappyCase,
  runNotFoundCase,
  runUnauthorizedCase,
  runUnexpectedErrorCase,
  runValidationCase,
} from './service-controller-runtime';
import { assertCurrentTestHasCaseLog } from './test-log-helpers';

const endpoints = loadServiceControllerEndpoints('leave');

describe('Leave controller task batch', () => {
  jest.setTimeout(300000);
  const runtime = createServiceControllerGroupRuntime('leave');

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

      it(`${endpoint.code} UTC04 validation rejects malformed route or DTO input`, async () => {
        await runValidationCase(runtime, endpoint);
      });

      it(`${endpoint.code} UTC05 validation propagates not-found flow`, async () => {
        await runNotFoundCase(runtime, endpoint);
      });

      it(`${endpoint.code} UTC06 validation propagates service failure`, async () => {
        await runUnexpectedErrorCase(runtime, endpoint);
      });

      it(`${endpoint.code} UTC07 security enforces unauthenticated access handling`, async () => {
        await runUnauthorizedCase(runtime, endpoint);
      });

      it(`${endpoint.code} UTC08 security enforces role or public-access posture`, async () => {
        await runForbiddenCase(runtime, endpoint);
      });
    });
  }
});
