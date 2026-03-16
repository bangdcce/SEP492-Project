const path = require('path');
const https = require('https');
const dotenv = require('dotenv');
const axios = require('axios');
const { ensureReviewModerationSmokeFixtures } = require('./ensure-review-moderation-smoke-fixtures');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const baseURL = `https://localhost:${process.env.APP_PORT || '3000'}`;

function mergeCookies(current, setCookies) {
  const jar = new Map();
  const seeds = [];
  if (current) seeds.push(...current.split('; '));
  if (Array.isArray(setCookies)) {
    seeds.push(
      ...setCookies.map((cookie) => cookie.split(';')[0]).filter(Boolean),
    );
  }

  for (const item of seeds) {
    const [key, ...rest] = item.split('=');
    if (!key) continue;
    jar.set(key, rest.join('='));
  }

  return Array.from(jar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function unwrapData(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data !== undefined) {
    return payload.data;
  }
  return payload;
}

function pickCollection(payload) {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

async function request(method, url, options = {}) {
  const response = await axios({
    method,
    url,
    baseURL,
    data: options.body,
    params: options.params,
    headers: {
      'Content-Type': 'application/json',
      'X-Timezone': 'Asia/Saigon',
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    httpsAgent,
    validateStatus: () => true,
  });

  return response;
}

async function login(email, password) {
  const response = await request('post', '/auth/login', {
    body: { email, password },
  });

  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.data)}`);
  }

  return mergeCookies('', response.headers['set-cookie']);
}

function assertOk(response, label, expectedStatuses = [200]) {
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(response.data)}`);
  }
}

async function main() {
  const fixture = await ensureReviewModerationSmokeFixtures();
  const results = [];

  const clientCookie = await login('client.test.new@example.com', 'password123');
  const staffCookie = await login('staff.test.new@example.com', 'password123');
  const adminOneCookie = await login(fixture.admins[0].email, fixture.admins[0].password);
  const adminTwoCookie = await login(fixture.admins[1].email, fixture.admins[1].password);

  const ready = await request('get', '/health/ready/dispute-workspace');
  assertOk(ready, 'health readiness');
  results.push({ module: 'health', status: ready.status, detail: ready.data.status });

  const drafts = await request('get', '/project-requests/drafts/mine', { cookie: clientCookie });
  assertOk(drafts, 'request drafts');
  results.push({ module: 'wizard-drafts', status: drafts.status, count: pickCollection(drafts.data).length });

  const requestList = await request('get', '/project-requests', { cookie: clientCookie });
  assertOk(requestList, 'project requests list');
  const requestItems = pickCollection(requestList.data);
  if (requestItems.length === 0) {
    throw new Error('No project requests available for client smoke test.');
  }
  const requestDetail = await request('get', `/project-requests/${requestItems[0].id}`, { cookie: clientCookie });
  assertOk(requestDetail, 'project request detail');
  const requestPayload = unwrapData(requestDetail.data);
  for (const field of [
    'flowSnapshot',
    'brokerSelectionSummary',
    'freelancerSelectionSummary',
    'brokerDraftSpecSummary',
    'viewerPermissions',
  ]) {
    if (!(field in requestPayload)) {
      throw new Error(`project request detail missing ${field}`);
    }
  }
  results.push({ module: 'request-detail', status: requestDetail.status, requestId: requestPayload.id });

  const disputeList = await request('get', '/disputes/my', { cookie: clientCookie });
  assertOk(disputeList, 'my disputes');
  const disputes = pickCollection(disputeList.data);
  if (disputes.length === 0) {
    throw new Error('No disputes available for client smoke test.');
  }
  const disputeId = disputes[0].id;
  const disputeDetail = await request('get', `/disputes/${disputeId}`, { cookie: clientCookie });
  assertOk(disputeDetail, 'dispute detail');
  const disputeMessages = await request('get', `/disputes/${disputeId}/messages`, { cookie: clientCookie });
  assertOk(disputeMessages, 'dispute messages');
  results.push({ module: 'disputes', status: disputeDetail.status, disputeId });

  const hearings = await request('get', '/disputes/hearings/mine', { cookie: staffCookie });
  assertOk(hearings, 'my hearings');
  const hearingItems = pickCollection(hearings.data);
  if (hearingItems.length === 0) {
    throw new Error('No staff hearings available for hearing workspace smoke test.');
  }
  const hearingTarget =
    hearingItems.find((item) => item && item.isActionable && item.isArchived !== true) ||
    hearingItems.find(
      (item) =>
        item &&
        !['COMPLETED', 'CANCELED', 'RESCHEDULED'].includes(`${item.status || ''}`),
    ) ||
    hearingItems[0];
  const hearingId = hearingTarget.id;
  const hearingWorkspace = await request('get', `/disputes/hearings/${hearingId}/workspace`, {
    cookie: staffCookie,
  });
  assertOk(hearingWorkspace, 'hearing workspace');
  results.push({ module: 'hearing-workspace', status: hearingWorkspace.status, hearingId });

  const now = new Date();
  const startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const calendar = await request('get', '/calendar/events', {
    cookie: clientCookie,
    params: { startDate, endDate, page: 1, limit: 50 },
  });
  assertOk(calendar, 'calendar events');
  results.push({ module: 'calendar', status: calendar.status, count: pickCollection(calendar.data).length });

  const staffDashboard = await request('get', '/staff/dashboard/overview', {
    cookie: staffCookie,
    params: { range: '30d' },
  });
  assertOk(staffDashboard, 'staff dashboard overview');
  results.push({ module: 'staff-dashboard', status: staffDashboard.status });

  const auditLogs = await request('get', '/audit-logs', {
    cookie: adminOneCookie,
    params: { limit: 5 },
  });
  assertOk(auditLogs, 'audit logs');
  results.push({ module: 'audit-logs', status: auditLogs.status });

  const moderationList = await request('get', '/reviews/admin/moderation', {
    cookie: adminOneCookie,
    params: { limit: 20 },
  });
  assertOk(moderationList, 'review moderation list');
  const moderationItems = pickCollection(moderationList.data);
  const moderationTarget = moderationItems.find((item) => item.id === fixture.reviewId) || moderationItems[0];
  if (!moderationTarget) {
    throw new Error('No moderation review available for anti-race smoke test.');
  }

  const openResponse = await request('post', `/reviews/admin/moderation/${moderationTarget.id}/open`, {
    cookie: adminOneCookie,
    body: { assignmentVersion: moderationTarget.assignmentVersion ?? 0 },
  });
  assertOk(openResponse, 'review moderation open', [200, 201]);
  const opened = unwrapData(openResponse.data);

  const [takeOne, takeTwo] = await Promise.all([
    request('post', `/reviews/admin/moderation/${moderationTarget.id}/take`, {
      cookie: adminOneCookie,
      body: { assignmentVersion: opened.assignmentVersion ?? 0 },
    }),
    request('post', `/reviews/admin/moderation/${moderationTarget.id}/take`, {
      cookie: adminTwoCookie,
      body: { assignmentVersion: opened.assignmentVersion ?? 0 },
    }),
  ]);

  const successfulTakeStatuses = new Set([200, 201]);
  const takeStatuses = [takeOne.status, takeTwo.status].sort((a, b) => a - b);
  const hasSingleSuccess =
    [takeOne.status, takeTwo.status].filter((status) => successfulTakeStatuses.has(status)).length ===
    1;
  if (!hasSingleSuccess || takeStatuses[1] !== 409) {
    throw new Error(
      `review moderation anti-race expected [2xx,409], got ${JSON.stringify([
        { admin: fixture.admins[0].email, status: takeOne.status, body: takeOne.data },
        { admin: fixture.admins[1].email, status: takeTwo.status, body: takeTwo.data },
      ])}`,
    );
  }

  const takeOneSucceeded = successfulTakeStatuses.has(takeOne.status);
  const winningResponse = takeOneSucceeded ? takeOne : takeTwo;
  const winningCookie = takeOneSucceeded ? adminOneCookie : adminTwoCookie;
  const taken = unwrapData(winningResponse.data);
  const releaseResponse = await request(
    'post',
    `/reviews/admin/moderation/${moderationTarget.id}/release`,
    {
      cookie: winningCookie,
      body: { assignmentVersion: taken.assignmentVersion ?? 0 },
    },
  );
  assertOk(releaseResponse, 'review moderation release', [200, 201]);
  results.push({
    module: 'review-moderation-anti-race',
    status: 'ok',
    winningStatus: winningResponse.status,
    staleStatus: takeOne.status === 409 ? takeOne.status : takeTwo.status,
    reviewId: moderationTarget.id,
  });

  const reviews = await request('get', '/reviews', {
    cookie: clientCookie,
    params: { targetUserId: fixture.reviewTargetUserId },
  });
  assertOk(reviews, 'reviews list');
  results.push({ module: 'reviews', status: reviews.status });

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
