import {
  buildServiceControllerCaseDefinitions,
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

const endpoints = loadServiceControllerEndpoints('users-admin');

describe('Users admin controller task batch', () => {
  jest.setTimeout(300000);
  const runtime = createServiceControllerGroupRuntime('users-admin');

  afterEach(() => {
    assertCurrentTestHasCaseLog();
  });

  for (const endpoint of endpoints) {
    describe(`${endpoint.code} ${endpoint.requestMethod} ${endpoint.path}`, () => {
      const cases = buildServiceControllerCaseDefinitions(endpoint);

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
