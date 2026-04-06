const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Client } = require('pg');
const { v5: uuidv5 } = require('uuid');
const { execFileSync } = require('child_process');

const SEED_KEY = 'codex-client-showcase-v1';
const UUID_NAMESPACE = '7e1b3c3e-9120-49b8-9b20-c0f4c5848f3e';
const PASSWORD = 'password123';
const APP_BASE_URL = 'https://localhost:5173';

const PRIMARY_USERS = {
  staff: {
    email: process.env.SHOWCASE_STAFF_EMAIL || 'showcase.staff@example.com',
    fullName: 'An Nguyen',
    role: 'STAFF',
  },
  client: {
    email: process.env.SHOWCASE_CLIENT_EMAIL || 'client.showcase.demo@example.com',
    fullName: 'Linh Tran',
    role: 'CLIENT',
  },
  broker: {
    email: process.env.SHOWCASE_BROKER_EMAIL || 'broker.showcase.demo@example.com',
    fullName: 'Khanh Pham',
    role: 'BROKER',
  },
  freelancer: {
    email: process.env.SHOWCASE_FREELANCER_EMAIL || 'freelancer.showcase.demo@example.com',
    fullName: 'Bao Le',
    role: 'FREELANCER',
  },
};

const EXTRA_USERS = {
  brokerAlt: {
    email: 'broker.showcase.alt@example.com',
    fullName: 'Minh Vo',
    role: 'BROKER',
  },
  freelancerAlt: {
    email: 'freelancer.showcase.alt@example.com',
    fullName: 'Ha Do',
    role: 'FREELANCER',
  },
};

function sid(name) {
  return uuidv5(`${SEED_KEY}:${name}`, UUID_NAMESPACE);
}

function quoteColumn(column) {
  return `"${column}"`;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function phoneDigits(seed) {
  return [...hash(seed).slice(0, 8)]
    .map((char) => `${parseInt(char, 16) % 10}`)
    .join('');
}

function buildPgClient() {
  const host = process.env.DB_HOST;
  return new Client({
    host,
    port: Number(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: host && host.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
  });
}

async function upsertRow(client, table, row, immutable = ['id', 'createdAt']) {
  const columns = Object.keys(row);
  const values = Object.values(row).map((value, index) => {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value;
    if (Array.isArray(value)) {
      return columns[index] === 'skills' ? value : JSON.stringify(value);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  });
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const updates = columns
    .filter((column) => !immutable.includes(column))
    .map((column) => `${quoteColumn(column)} = EXCLUDED.${quoteColumn(column)}`)
    .join(', ');

  const sql = `
    INSERT INTO ${table} (${columns.map(quoteColumn).join(', ')})
    VALUES (${placeholders})
    ON CONFLICT ("id") DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}
  `;

  await client.query(sql, values);
}

function runSeedScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  const env = {
    ...process.env,
    SHOWCASE_STAFF_EMAIL: PRIMARY_USERS.staff.email,
    SHOWCASE_CLIENT_EMAIL: PRIMARY_USERS.client.email,
    SHOWCASE_BROKER_EMAIL: PRIMARY_USERS.broker.email,
    SHOWCASE_FREELANCER_EMAIL: PRIMARY_USERS.freelancer.email,
  };
  const output = execFileSync(process.execPath, [scriptPath], {
    cwd: path.join(__dirname, '..'),
    env,
    encoding: 'utf8',
  });
  const lines = output.split(/\r?\n/);
  const jsonLineIndex = lines.findIndex((line) => line.trim() === '{');
  if (jsonLineIndex === -1) {
    throw new Error(`Seed script ${scriptName} did not return JSON output.`);
  }
  return JSON.parse(lines.slice(jsonLineIndex).join('\n'));
}

async function ensureUser(client, key, definition, now) {
  const existing = await client.query(`select id from users where email = $1 limit 1`, [
    definition.email,
  ]);
  const userId = existing.rows[0]?.id ?? sid(`user:${key}`);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await upsertRow(
    client,
    'users',
    {
      id: userId,
      email: definition.email,
      passwordHash,
      fullName: definition.fullName,
      role: definition.role,
      phoneNumber: `090${phoneDigits(definition.email).slice(0, 7)}`,
      timeZone: 'Asia/Ho_Chi_Minh',
      isVerified: true,
      emailVerifiedAt: now,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      currentTrustScore:
        definition.role === 'CLIENT' ? 4.82 : definition.role === 'BROKER' ? 4.91 : 4.88,
      totalProjectsFinished: definition.role === 'CLIENT' ? 6 : 9,
      totalProjectsCancelled: 0,
      totalDisputesLost: 0,
      totalLateProjects: 0,
      status: 'ACTIVE',
      isBanned: false,
      banReason: null,
      bannedAt: null,
      bannedBy: null,
      deletedAt: null,
      deletedReason: null,
      createdAt: existing.rows[0]?.createdAt || now,
      updatedAt: now,
    },
    ['id', 'createdAt'],
  );

  return {
    id: userId,
    ...definition,
  };
}

async function ensureProfile(client, key, user) {
  const existing = await client.query(`select id from profiles where "userId" = $1 limit 1`, [
    user.id,
  ]);
  const profileId = existing.rows[0]?.id ?? sid(`profile:${key}`);

  const profilePayloads = {
    client: {
      bio: 'Founder preparing polished client-side screenshots for the InterDev project showcase.',
      companyName: 'Northstar Retail Labs',
      skills: ['Product Strategy', 'Stakeholder Management'],
      portfolioLinks: [
        { title: 'Brand Brief', url: 'https://northstar.example.com/brief' },
        { title: 'Roadmap', url: 'https://northstar.example.com/roadmap' },
      ],
      linkedinUrl: 'https://linkedin.com/in/linh-tran-showcase',
      bankInfo: { bank: 'Vietcombank', account: '9704000012345678', branch: 'District 1' },
    },
    broker: {
      bio: 'Broker specializing in product discovery, delivery planning, and stakeholder alignment.',
      companyName: null,
      skills: ['Project Scoping', 'Delivery Planning', 'Vendor Matching'],
      portfolioLinks: [
        { title: 'Case Study', url: 'https://broker.example.com/case-study' },
      ],
      linkedinUrl: 'https://linkedin.com/in/khanh-pham-broker',
      bankInfo: { bank: 'ACB', account: '9704000098765432', branch: 'District 3' },
    },
    freelancer: {
      bio: 'Full-stack product engineer with strong delivery habits and clean handoff documentation.',
      companyName: null,
      skills: ['React', 'NestJS', 'PostgreSQL', 'Product Discovery'],
      portfolioLinks: [
        { title: 'GitHub', url: 'https://github.com/interdev-showcase/bao-le' },
        { title: 'Portfolio', url: 'https://portfolio.example.com/bao-le' },
      ],
      linkedinUrl: 'https://linkedin.com/in/bao-le-freelancer',
      bankInfo: { bank: 'Techcombank', account: '9704000055511111', branch: 'Binh Thanh' },
    },
    freelancerAlt: {
      bio: 'UI-focused freelancer for polished frontend and conversion-driven customer journeys.',
      companyName: null,
      skills: ['Next.js', 'Tailwind CSS', 'Figma Handoff'],
      portfolioLinks: [{ title: 'Portfolio', url: 'https://portfolio.example.com/ha-do' }],
      linkedinUrl: 'https://linkedin.com/in/ha-do-frontend',
      bankInfo: null,
    },
    brokerAlt: {
      bio: 'Broker with a strong discovery background and pragmatic delivery orchestration.',
      companyName: null,
      skills: ['Discovery Workshops', 'Planning', 'Team Coordination'],
      portfolioLinks: [{ title: 'Playbook', url: 'https://broker.example.com/playbook' }],
      linkedinUrl: 'https://linkedin.com/in/minh-vo-broker',
      bankInfo: null,
    },
    staff: {
      bio: 'Internal operations contact for seeded hearing, payout, and moderation workflows.',
      companyName: 'InterDev Operations',
      skills: ['Operations', 'Risk Review'],
      portfolioLinks: null,
      linkedinUrl: null,
      bankInfo: null,
    },
  };

  const payload = profilePayloads[key];

  await upsertRow(
    client,
    'profiles',
    {
      id: profileId,
      userId: user.id,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        user.fullName,
      )}`,
      bio: payload.bio,
      companyName: payload.companyName,
      skills: payload.skills,
      portfolioLinks: payload.portfolioLinks,
      linkedinUrl: payload.linkedinUrl,
      bankInfo: payload.bankInfo,
    },
    ['id'],
  );
}

async function ensureWallet(client, key, userId, now) {
  const existing = await client.query(`select id from wallets where "userId" = $1 limit 1`, [
    userId,
  ]);
  const walletId = existing.rows[0]?.id ?? sid(`wallet:${key}`);

  await upsertRow(
    client,
    'wallets',
    {
      id: walletId,
      userId,
      balance: 0,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    ['id', 'createdAt'],
  );

  return { id: walletId, userId };
}

async function ensureRequestAnswers(client, requestId, answerMap) {
  const codes = Object.keys(answerMap);
  if (codes.length === 0) {
    return;
  }

  const result = await client.query(
    `select id, code from wizard_questions where code = any($1::text[])`,
    [codes],
  );

  const questionsByCode = new Map(result.rows.map((row) => [row.code, row.id]));

  for (const [code, valueText] of Object.entries(answerMap)) {
    const questionId = questionsByCode.get(code);
    if (!questionId) {
      continue;
    }

    await upsertRow(
      client,
      'project_request_answers',
      {
        id: sid(`request-answer:${requestId}:${code}`),
        requestId,
        questionId,
        optionId: null,
        valueText,
      },
      ['id'],
    );
  }
}

async function seedRequestShowcase(client, users, paymentSummary, disputeSummary, now) {
  const requestDraftId = sid('request:draft');
  const requestPendingId = sid('request:pending');
  const requestClientReviewId = sid('request:client-review');
  const requestFinalReviewId = sid('request:final-review');
  const requestLinkedProjectId = sid('request:linked-project');
  const linkedProjectId = sid('project:linked-request');
  const linkedContractId = sid('contract:linked-request');
  const clientReviewSpecId = sid('spec:client-review');
  const fullSpecDraftId = sid('spec:full-spec-review');
  const clientReviewMilestoneA = sid('spec-milestone:client-review:wireframes');
  const clientReviewMilestoneB = sid('spec-milestone:client-review:architecture');
  const fullSpecMilestoneA = sid('spec-milestone:full-review:mvp');
  const fullSpecMilestoneB = sid('spec-milestone:full-review:launch');

  const requests = [
    {
      id: requestDraftId,
      clientId: users.client.id,
      title: 'B2B inventory portal refresh',
      description:
        'Refresh the internal inventory portal with better search, cleaner dashboards, and approval flows for branch managers.',
      budgetRange: '$8,000 - $12,000',
      intendedTimeline: '6 weeks',
      requestedDeadline: addDays(now, 30).toISOString().slice(0, 10),
      techPreferences: 'React, NestJS, PostgreSQL',
      attachments: [
        {
          filename: 'portal-brief.pdf',
          url: '/uploads/showcase/portal-brief.pdf',
          mimetype: 'application/pdf',
          size: 248320,
          category: 'requirements',
        },
      ],
      requestScopeBaseline: {
        requestTitle: 'B2B inventory portal refresh',
        requestDescription:
          'Refresh the internal inventory portal with better search, cleaner dashboards, and approval flows for branch managers.',
        requestedDeadline: addDays(now, 30).toISOString().slice(0, 10),
        productTypeCode: 'B2B_PORTAL',
        productTypeLabel: 'B2B Portal',
        projectGoalSummary:
          'Modernize the internal inventory portal and reduce manual approval work for branch managers.',
      },
      commercialBaseline: null,
      activeCommercialChangeRequest: null,
      wizardProgressStep: 4,
      status: 'DRAFT',
      brokerId: null,
      createdAt: addDays(now, -2),
      updatedAt: addDays(now, -2),
    },
    {
      id: requestPendingId,
      clientId: users.client.id,
      title: 'Customer loyalty mini app',
      description:
        'Launch a loyalty companion mini app so repeat buyers can track points, redeem vouchers, and receive campaign pushes.',
      budgetRange: '$12,000 - $18,000',
      intendedTimeline: '8 weeks',
      requestedDeadline: addDays(now, 45).toISOString().slice(0, 10),
      techPreferences: 'Next.js, Supabase, Tailwind CSS',
      attachments: [
        {
          filename: 'loyalty-requirements.docx',
          url: '/uploads/showcase/loyalty-requirements.docx',
          mimetype:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 112000,
          category: 'requirements',
        },
      ],
      requestScopeBaseline: {
        requestTitle: 'Customer loyalty mini app',
        requestDescription:
          'Launch a loyalty companion mini app so repeat buyers can track points, redeem vouchers, and receive campaign pushes.',
        requestedDeadline: addDays(now, 45).toISOString().slice(0, 10),
        productTypeCode: 'LOYALTY_APP',
        productTypeLabel: 'Loyalty App',
        projectGoalSummary:
          'Increase repeat purchase rate with a lightweight loyalty experience for mobile users.',
      },
      commercialBaseline: null,
      activeCommercialChangeRequest: null,
      wizardProgressStep: 5,
      status: 'PENDING',
      brokerId: null,
      createdAt: addDays(now, -5),
      updatedAt: addDays(now, -4),
    },
    {
      id: requestClientReviewId,
      clientId: users.client.id,
      title: 'Wholesale order management workspace',
      description:
        'Build a client-facing workspace for wholesale teams to track orders, approvals, and account-level service notes.',
      budgetRange: '$18,000 - $24,000',
      intendedTimeline: '10 weeks',
      requestedDeadline: addDays(now, 60).toISOString().slice(0, 10),
      techPreferences: 'React, NestJS, PostgreSQL, Redis',
      attachments: [
        {
          filename: 'workspace-sitemap.png',
          url: '/uploads/showcase/workspace-sitemap.png',
          mimetype: 'image/png',
          size: 86000,
          category: 'attachment',
        },
      ],
      requestScopeBaseline: {
        requestTitle: 'Wholesale order management workspace',
        requestDescription:
          'Build a client-facing workspace for wholesale teams to track orders, approvals, and account-level service notes.',
        requestedDeadline: addDays(now, 60).toISOString().slice(0, 10),
        productTypeCode: 'CLIENT_WORKSPACE',
        productTypeLabel: 'Client Workspace',
        projectGoalSummary:
          'Reduce order coordination friction by moving discussions, approvals, and summaries into one shared workspace.',
      },
      commercialBaseline: {
        source: 'REQUEST',
        budgetRange: '$18,000 - $24,000',
        estimatedBudget: 21000,
        estimatedTimeline: '10 weeks',
        clientFeatures: [
          {
            id: sid('feature:workspace:dashboard'),
            title: 'Order command center',
            description: 'One place to track approvals, comments, and order status changes.',
            priority: 'MUST_HAVE',
          },
          {
            id: sid('feature:workspace:alerts'),
            title: 'Account-level alerts',
            description: 'Flag delayed approvals and missing paperwork before fulfillment cutoffs.',
            priority: 'SHOULD_HAVE',
          },
        ],
      },
      activeCommercialChangeRequest: null,
      wizardProgressStep: 6,
      status: 'BROKER_ASSIGNED',
      brokerId: users.broker.id,
      createdAt: addDays(now, -9),
      updatedAt: addDays(now, -1),
    },
    {
      id: requestFinalReviewId,
      clientId: users.client.id,
      title: 'Membership commerce platform',
      description:
        'Create a premium membership commerce platform with gated perks, campaign landing pages, and renewal reporting.',
      budgetRange: '$30,000 - $42,000',
      intendedTimeline: '12 weeks',
      requestedDeadline: addDays(now, 75).toISOString().slice(0, 10),
      techPreferences: 'Next.js, NestJS, Stripe, PostgreSQL',
      attachments: [
        {
          filename: 'membership-brand-guide.pdf',
          url: '/uploads/showcase/membership-brand-guide.pdf',
          mimetype: 'application/pdf',
          size: 360000,
          category: 'requirements',
        },
      ],
      requestScopeBaseline: {
        requestTitle: 'Membership commerce platform',
        requestDescription:
          'Create a premium membership commerce platform with gated perks, campaign landing pages, and renewal reporting.',
        requestedDeadline: addDays(now, 75).toISOString().slice(0, 10),
        productTypeCode: 'MEMBERSHIP_PLATFORM',
        productTypeLabel: 'Membership Platform',
        projectGoalSummary:
          'Launch a premium membership experience with better retention and campaign visibility.',
      },
      commercialBaseline: {
        source: 'CLIENT_SPEC',
        budgetRange: '$30,000 - $42,000',
        estimatedBudget: 36000,
        estimatedTimeline: '12 weeks',
        agreedBudget: 34800,
        agreedDeliveryDeadline: addDays(now, 78).toISOString().slice(0, 10),
        agreedClientFeatures: [
          {
            id: sid('feature:membership:checkout'),
            title: 'Member onboarding and checkout',
            description: 'A polished acquisition flow with voucher support and team plan toggles.',
            priority: 'MUST_HAVE',
          },
          {
            id: sid('feature:membership:reporting'),
            title: 'Renewal reporting',
            description: 'Track member retention, campaign uplift, and churn risk from one dashboard.',
            priority: 'SHOULD_HAVE',
          },
        ],
        sourceSpecId: clientReviewSpecId,
        approvedAt: addDays(now, -3).toISOString(),
      },
      activeCommercialChangeRequest: {
        id: sid('commercial-change:membership'),
        status: 'APPROVED',
        reason:
          'Broker proposed separating the launch campaign builder into phase two to keep the MVP shipping date realistic.',
        requestedByBrokerId: users.broker.id,
        requestedAt: addDays(now, -4).toISOString(),
        respondedAt: addDays(now, -3).toISOString(),
        respondedByClientId: users.client.id,
        responseNote: 'Approved as long as renewal reporting stays in the initial release.',
        currentBudget: 36000,
        proposedBudget: 34800,
        currentTimeline: '12 weeks',
        proposedTimeline: '11 weeks',
        proposedClientFeatures: [
          {
            id: sid('feature:membership:launch'),
            title: 'Deferred launch campaign builder',
            description: 'Move the campaign builder to post-MVP backlog after onboarding and renewal reporting.',
            priority: 'NICE_TO_HAVE',
          },
        ],
      },
      wizardProgressStep: 6,
      status: 'HIRING',
      brokerId: users.broker.id,
      createdAt: addDays(now, -14),
      updatedAt: addDays(now, -1),
    },
    {
      id: requestLinkedProjectId,
      clientId: users.client.id,
      title: 'CRM rollout phase two',
      description:
        'Continue the CRM rollout with sales pipeline dashboards, lead assignment rules, and field team performance reporting.',
      budgetRange: '$22,000 - $30,000',
      intendedTimeline: '9 weeks',
      requestedDeadline: addDays(now, 40).toISOString().slice(0, 10),
      techPreferences: 'React Admin, NestJS, PostgreSQL',
      attachments: [],
      requestScopeBaseline: {
        requestTitle: 'CRM rollout phase two',
        requestDescription:
          'Continue the CRM rollout with sales pipeline dashboards, lead assignment rules, and field team performance reporting.',
        requestedDeadline: addDays(now, 40).toISOString().slice(0, 10),
        productTypeCode: 'CRM_ROLLOUT',
        productTypeLabel: 'CRM Rollout',
        projectGoalSummary:
          'Deliver the second CRM rollout phase with better sales visibility and lead routing.',
      },
      commercialBaseline: {
        source: 'CLIENT_SPEC',
        budgetRange: '$22,000 - $30,000',
        estimatedBudget: 26000,
        estimatedTimeline: '9 weeks',
        agreedBudget: 25500,
        agreedDeliveryDeadline: addDays(now, 42).toISOString().slice(0, 10),
        agreedClientFeatures: [
          {
            id: sid('feature:crm:pipeline'),
            title: 'Pipeline dashboards',
            description: 'Visualize opportunity stages, conversion rates, and rep-level activity.',
            priority: 'MUST_HAVE',
          },
          {
            id: sid('feature:crm:routing'),
            title: 'Lead routing rules',
            description: 'Auto-assign leads by territory, source, and pipeline stage.',
            priority: 'SHOULD_HAVE',
          },
        ],
        approvedAt: addDays(now, -8).toISOString(),
      },
      activeCommercialChangeRequest: null,
      wizardProgressStep: 6,
      status: 'CONVERTED_TO_PROJECT',
      brokerId: users.broker.id,
      createdAt: addDays(now, -18),
      updatedAt: addDays(now, -7),
    },
  ];

  for (const request of requests) {
    await upsertRow(client, 'project_requests', request, ['id', 'createdAt']);
  }

  await ensureRequestAnswers(client, requestDraftId, {
    PRODUCT_TYPE: 'B2B_PORTAL',
    INDUSTRY: 'RETAIL',
  });
  await ensureRequestAnswers(client, requestPendingId, {
    PRODUCT_TYPE: 'LOYALTY_APP',
    INDUSTRY: 'E_COMMERCE',
  });
  await ensureRequestAnswers(client, requestClientReviewId, {
    PRODUCT_TYPE: 'CLIENT_WORKSPACE',
    INDUSTRY: 'WHOLESALE',
  });
  await ensureRequestAnswers(client, requestFinalReviewId, {
    PRODUCT_TYPE: 'MEMBERSHIP_PLATFORM',
    INDUSTRY: 'RETAIL',
  });
  await ensureRequestAnswers(client, requestLinkedProjectId, {
    PRODUCT_TYPE: 'CRM_SYSTEM',
    INDUSTRY: 'SALES',
  });

  const brokerProposals = [
    {
      id: sid('broker-proposal:pending'),
      requestId: requestPendingId,
      brokerId: users.broker.id,
      coverLetter:
        'I can translate your loyalty brief into a delivery roadmap and shortlist implementation partners within the first week.',
      status: 'PENDING',
      createdAt: addDays(now, -4),
    },
    {
      id: sid('broker-proposal:client-review:accepted'),
      requestId: requestClientReviewId,
      brokerId: users.broker.id,
      coverLetter:
        'I have already structured the workspace flow and turned it into a review-ready client spec.',
      status: 'ACCEPTED',
      createdAt: addDays(now, -8),
    },
    {
      id: sid('broker-proposal:pending:alt'),
      requestId: requestPendingId,
      brokerId: users.brokerAlt.id,
      coverLetter:
        'Happy to support the loyalty mini app with a fast discovery sprint and vendor shortlist.',
      status: 'INVITED',
      createdAt: addDays(now, -3),
    },
  ];

  for (const proposal of brokerProposals) {
    await upsertRow(client, 'broker_proposals', proposal, ['id', 'createdAt']);
  }

  const freelancerProposals = [
    {
      id: sid('freelancer-proposal:accepted'),
      requestId: requestFinalReviewId,
      freelancerId: users.freelancer.id,
      brokerId: users.broker.id,
      proposedBudget: 33200,
      estimatedDuration: '11 weeks',
      coverLetter:
        'I can own the membership MVP end to end, including onboarding, renewal reporting, and production launch handoff.',
      status: 'ACCEPTED',
      createdAt: addDays(now, -6),
    },
    {
      id: sid('freelancer-proposal:alt-pending'),
      requestId: requestFinalReviewId,
      freelancerId: users.freelancerAlt.id,
      brokerId: users.broker.id,
      proposedBudget: 31800,
      estimatedDuration: '10 weeks',
      coverLetter:
        'Strong fit for the frontend-heavy member experience, especially campaign pages and acquisition flow polish.',
      status: 'PENDING_CLIENT_APPROVAL',
      createdAt: addDays(now, -5),
    },
  ];

  for (const proposal of freelancerProposals) {
    await upsertRow(client, 'project_request_proposals', proposal, ['id', 'createdAt']);
  }

  const clientSpec = {
    id: clientReviewSpecId,
    requestId: requestClientReviewId,
    specPhase: 'CLIENT_SPEC',
    parentSpecId: null,
    title: 'Client spec review package',
    description:
      'A broker-prepared client spec focused on the workspace IA, delivery phases, and account-level operational guardrails.',
    totalBudget: 21000,
    features: null,
    clientFeatures: [
      {
        id: sid('client-spec-feature:dashboard'),
        title: 'Order command center',
        description: 'Track pending approvals, open notes, and at-risk orders in one view.',
        priority: 'MUST_HAVE',
      },
      {
        id: sid('client-spec-feature:alerts'),
        title: 'Approval alerts',
        description: 'Warn account owners before fulfillment blockers become operational delays.',
        priority: 'SHOULD_HAVE',
      },
    ],
    techStack: 'React, NestJS, PostgreSQL, Redis',
    referenceLinks: [
      { label: 'IA board', url: 'https://figma.com/file/showcase-client-workspace' },
    ],
    estimatedTimeline: '10 weeks',
    projectCategory: 'Client Workspace',
    richContentJson: {
      sections: [
        {
          title: 'Scope',
          body: 'Dashboard, approval queue, account notes, and operational alerts.',
        },
      ],
    },
    status: 'CLIENT_REVIEW',
    rejectionReason: null,
    clientApprovedAt: null,
    createdAt: addDays(now, -7),
    updatedAt: addDays(now, -1),
  };

  const fullSpec = {
    id: fullSpecDraftId,
    requestId: requestFinalReviewId,
    specPhase: 'FULL_SPEC',
    parentSpecId: null,
    title: 'Final delivery spec for membership platform',
    description:
      'Signed-off delivery plan covering onboarding, renewal reporting, analytics, and launch handoff expectations.',
    totalBudget: 34800,
    features: [
      {
        id: sid('full-spec-feature:onboarding'),
        title: 'Member onboarding and checkout',
        description: 'Responsive acquisition flow with voucher handling and member tier selection.',
        complexity: 'HIGH',
        acceptanceCriteria: [
          'Users can complete checkout on desktop and mobile',
          'Voucher application and validation are tracked in analytics',
        ],
      },
      {
        id: sid('full-spec-feature:reporting'),
        title: 'Renewal reporting dashboard',
        description: 'Operations dashboard for churn risk, cohort retention, and campaign attribution.',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'Dashboard loads cohort and retention metrics',
          'Filters are available by campaign, plan, and billing cycle',
        ],
      },
    ],
    clientFeatures: [
      {
        id: sid('full-spec-client-feature:onboarding'),
        title: 'Acquisition flow',
        description: 'New members can discover plans, redeem vouchers, and complete onboarding quickly.',
        priority: 'MUST_HAVE',
      },
      {
        id: sid('full-spec-client-feature:reporting'),
        title: 'Retention dashboard',
        description: 'Operations can track renewals and churn risk without exporting spreadsheets.',
        priority: 'SHOULD_HAVE',
      },
    ],
    techStack: 'Next.js, NestJS, PostgreSQL, Stripe',
    referenceLinks: [
      { label: 'Delivery board', url: 'https://figma.com/file/showcase-membership-platform' },
      { label: 'Tracking plan', url: 'https://docs.example.com/membership-tracking-plan' },
    ],
    estimatedTimeline: '11 weeks',
    projectCategory: 'Membership Platform',
    richContentJson: {
      sections: [
        {
          title: 'Delivery Notes',
          body: 'Campaign builder moves to phase two after MVP launch.',
        },
      ],
    },
    status: 'FINAL_REVIEW',
    rejectionReason: null,
    clientApprovedAt: addDays(now, -3),
    createdAt: addDays(now, -5),
    updatedAt: addDays(now, -1),
  };

  await upsertRow(client, 'project_specs', clientSpec, ['id', 'createdAt']);
  await upsertRow(client, 'project_specs', fullSpec, ['id', 'createdAt']);

  const specMilestones = [
    {
      id: clientReviewMilestoneA,
      projectId: null,
      projectSpecId: clientReviewSpecId,
      title: 'Discovery and IA sign-off',
      description: 'Lock the dashboard IA, account-level alerts, and approval surfaces.',
      amount: 7000,
      deliverableType: 'DESIGN_PROTOTYPE',
      retentionAmount: 0,
      acceptanceCriteria: [
        'IA approved by the client',
        'Key workflows mapped before implementation starts',
      ],
      approvedClientFeatureIds: [
        sid('client-spec-feature:dashboard'),
        sid('client-spec-feature:alerts'),
      ],
      startDate: addDays(now, -7),
      dueDate: addDays(now, 7),
      status: 'PENDING',
      submittedAt: null,
      proofOfWork: 'https://figma.com/file/showcase-client-workspace/discovery',
      videoDemoUrl: null,
      feedback: null,
      reviewedByStaffId: null,
      staffRecommendation: null,
      staffReviewNote: null,
      sortOrder: 1,
      sourceContractMilestoneKey: null,
      createdAt: addDays(now, -7),
    },
    {
      id: clientReviewMilestoneB,
      projectId: null,
      projectSpecId: clientReviewSpecId,
      title: 'Operational dashboard build',
      description: 'Implement order visibility, alerting, and note-taking surfaces.',
      amount: 14000,
      deliverableType: 'SOURCE_CODE',
      retentionAmount: 0,
      acceptanceCriteria: [
        'Dashboard cards reflect order state transitions',
        'Operational alerts can be filtered by account manager',
      ],
      approvedClientFeatureIds: [sid('client-spec-feature:dashboard')],
      startDate: addDays(now, 8),
      dueDate: addDays(now, 45),
      status: 'PENDING',
      submittedAt: null,
      proofOfWork: null,
      videoDemoUrl: null,
      feedback: null,
      reviewedByStaffId: null,
      staffRecommendation: null,
      staffReviewNote: null,
      sortOrder: 2,
      sourceContractMilestoneKey: null,
      createdAt: addDays(now, -7),
    },
    {
      id: fullSpecMilestoneA,
      projectId: null,
      projectSpecId: fullSpecDraftId,
      title: 'Member onboarding release',
      description: 'Ship plan discovery, checkout, and voucher redemption.',
      amount: 18200,
      deliverableType: 'DEPLOYMENT',
      retentionAmount: 0,
      acceptanceCriteria: [
        'Checkout works on desktop and mobile',
        'Voucher redemption is tracked for campaign attribution',
      ],
      approvedClientFeatureIds: [sid('full-spec-client-feature:onboarding')],
      startDate: addDays(now, -2),
      dueDate: addDays(now, 28),
      status: 'PENDING',
      submittedAt: null,
      proofOfWork: 'https://demo.example.com/membership-onboarding',
      videoDemoUrl: 'https://youtu.be/showcase-membership-onboarding',
      feedback: null,
      reviewedByStaffId: null,
      staffRecommendation: null,
      staffReviewNote: null,
      sortOrder: 1,
      sourceContractMilestoneKey: 'membership-m1',
      createdAt: addDays(now, -5),
    },
    {
      id: fullSpecMilestoneB,
      projectId: null,
      projectSpecId: fullSpecDraftId,
      title: 'Renewal reporting and launch handoff',
      description: 'Ship retention dashboards, reporting filters, and launch documentation.',
      amount: 16600,
      deliverableType: 'SOURCE_CODE',
      retentionAmount: 0,
      acceptanceCriteria: [
        'Retention dashboard loads campaign, plan, and billing-cycle filters',
        'Launch handoff package includes admin guide and support checklist',
      ],
      approvedClientFeatureIds: [sid('full-spec-client-feature:reporting')],
      startDate: addDays(now, 29),
      dueDate: addDays(now, 60),
      status: 'PENDING',
      submittedAt: null,
      proofOfWork: null,
      videoDemoUrl: null,
      feedback: null,
      reviewedByStaffId: null,
      staffRecommendation: null,
      staffReviewNote: null,
      sortOrder: 2,
      sourceContractMilestoneKey: 'membership-m2',
      createdAt: addDays(now, -5),
    },
  ];

  for (const milestone of specMilestones) {
    await upsertRow(client, 'milestones', milestone, ['id', 'createdAt']);
  }

  const linkedProject = {
    id: linkedProjectId,
    requestId: requestLinkedProjectId,
    clientId: users.client.id,
    brokerId: users.broker.id,
    freelancerId: users.freelancer.id,
    staffId: users.staff.id,
    staffInviteStatus: 'ACCEPTED',
    title: 'CRM rollout phase two',
    description:
      'Execution project linked from the request so the client request detail page can jump into the delivery workspace.',
    totalBudget: 25500,
    currency: 'USD',
    pricingModel: 'FIXED_PRICE',
    startDate: addDays(now, -6),
    endDate: addDays(now, 36),
    status: 'PLANNING',
    createdAt: addDays(now, -6),
    updatedAt: now,
  };

  await upsertRow(client, 'projects', linkedProject, ['id', 'createdAt']);

  const linkedContract = {
    id: linkedContractId,
    projectId: linkedProjectId,
    sourceSpecId: null,
    title: 'CRM rollout phase two contract',
    contractUrl: 'https://storage.interdev.local/contracts/showcase-crm-rollout.pdf',
    archiveStoragePath: null,
    archivePersistedAt: null,
    archiveDocumentHash: null,
    termsContent:
      'Showcase contract for the client request handoff flow. This fixture links the converted request into an active delivery workspace.',
    contentHash: hash('crm-rollout-phase-two-contract'),
    status: 'ACTIVATED',
    legalSignatureStatus: 'VERIFIED',
    provider: 'SHOWCASE_SEED',
    verifiedAt: addDays(now, -5),
    certificateSerial: 'SHOWCASE-CRM-2026',
    legalSignatureEvidence: { source: 'seed', signedBy: 'client-and-broker' },
    activatedAt: addDays(now, -5),
    commercialContext: {
      sourceSpecId: null,
      sourceSpecUpdatedAt: null,
      requestId: requestLinkedProjectId,
      projectTitle: linkedProject.title,
      clientId: users.client.id,
      brokerId: users.broker.id,
      freelancerId: users.freelancer.id,
      totalBudget: 25500,
      currency: 'USD',
      description: linkedProject.description,
      techStack: 'React Admin, NestJS, PostgreSQL',
      scopeNarrativePlainText:
        'Continue CRM rollout with dashboards, routing rules, and field-team reporting.',
      features: [
        {
          title: 'Pipeline dashboards',
          description: 'Surface opportunity velocity and stage health for team leads.',
          complexity: 'MEDIUM',
          acceptanceCriteria: ['Dashboard loads live CRM pipeline data'],
        },
      ],
      escrowSplit: { developerPercentage: 85, brokerPercentage: 10, platformPercentage: 5 },
    },
    milestoneSnapshot: [
      {
        contractMilestoneKey: 'crm-rollout-m1',
        sourceSpecMilestoneId: null,
        projectMilestoneId: null,
        title: 'Dashboards and routing',
        description: 'Build sales dashboards and lead-routing automations.',
        amount: 13500,
        startDate: addDays(now, -4).toISOString(),
        dueDate: addDays(now, 16).toISOString(),
        sortOrder: 1,
        deliverableType: 'SOURCE_CODE',
        retentionAmount: 0,
        acceptanceCriteria: ['Lead routing works for at least three territories'],
      },
      {
        contractMilestoneKey: 'crm-rollout-m2',
        sourceSpecMilestoneId: null,
        projectMilestoneId: null,
        title: 'Reporting and handoff',
        description: 'Deliver field-team reporting and launch checklist.',
        amount: 12000,
        startDate: addDays(now, 17).toISOString(),
        dueDate: addDays(now, 36).toISOString(),
        sortOrder: 2,
        deliverableType: 'DEPLOYMENT',
        retentionAmount: 0,
        acceptanceCriteria: ['Launch checklist and admin guide are handed off'],
      },
    ],
    createdBy: users.broker.id,
    createdAt: addDays(now, -6),
  };

  await upsertRow(client, 'contracts', linkedContract, ['id', 'createdAt']);

  return {
    requestIds: {
      draft: requestDraftId,
      pending: requestPendingId,
      clientReview: requestClientReviewId,
      finalReview: requestFinalReviewId,
      linkedProject: requestLinkedProjectId,
    },
    specIds: {
      clientReview: clientReviewSpecId,
      finalReview: fullSpecDraftId,
    },
    linkedProjectId,
    linkedContractId,
    paymentProjectId:
      paymentSummary?.projectIds?.['[DEMO] PayPal Escrow Sandbox Flow'] ||
      Object.values(paymentSummary?.projectIds || {})[0] ||
      null,
    paymentContractId:
      paymentSummary?.contractIds?.['[DEMO] PayPal Escrow Sandbox Flow Contract'] ||
      Object.values(paymentSummary?.contractIds || {})[0] ||
      null,
    disputeId: disputeSummary?.summary?.[0]?.disputeId || null,
  };
}

async function main() {
  const paymentSummary = runSeedScript('seed-payment-demo-fixtures.js');
  const disputeSummary = runSeedScript('seed-dispute-project-fixtures.js');

  const client = buildPgClient();
  await client.connect();
  const now = new Date();

  try {
    await client.query('BEGIN');

    const users = {};
    for (const [key, definition] of Object.entries(PRIMARY_USERS)) {
      users[key] = await ensureUser(client, key, definition, now);
      await ensureProfile(client, key, users[key]);
    }

    for (const [key, definition] of Object.entries(EXTRA_USERS)) {
      users[key] = await ensureUser(client, key, definition, now);
      await ensureProfile(client, key, users[key]);
    }

    await ensureWallet(client, 'brokerAlt', users.brokerAlt.id, now);
    await ensureWallet(client, 'freelancerAlt', users.freelancerAlt.id, now);

    const requestSummary = await seedRequestShowcase(
      client,
      users,
      paymentSummary,
      disputeSummary,
      now,
    );

    await client.query('COMMIT');

    const usefulUrls = {
      dashboard: `${APP_BASE_URL}/client/dashboard`,
      myRequests: `${APP_BASE_URL}/client/my-requests`,
      requestClientReview: `${APP_BASE_URL}/client/requests/${requestSummary.requestIds.clientReview}`,
      requestFinalReview: `${APP_BASE_URL}/client/requests/${requestSummary.requestIds.finalReview}`,
      specClientReview: `${APP_BASE_URL}/client/spec-review/${requestSummary.specIds.clientReview}`,
      specFinalReview: `${APP_BASE_URL}/client/spec-review/${requestSummary.specIds.finalReview}`,
      projects: `${APP_BASE_URL}/client/projects`,
      workspace: requestSummary.paymentProjectId
        ? `${APP_BASE_URL}/client/workspace/${requestSummary.paymentProjectId}`
        : null,
      contracts: `${APP_BASE_URL}/client/contracts`,
      contractDetail: requestSummary.paymentContractId
        ? `${APP_BASE_URL}/client/contracts/${requestSummary.paymentContractId}`
        : `${APP_BASE_URL}/client/contracts/${requestSummary.linkedContractId}`,
      billing: `${APP_BASE_URL}/client/billing`,
      disputes: `${APP_BASE_URL}/client/disputes`,
      disputeDetail: requestSummary.disputeId
        ? `${APP_BASE_URL}/client/disputes/${requestSummary.disputeId}`
        : null,
    };

    console.log(
      JSON.stringify(
        {
          seedKey: SEED_KEY,
          credentials: {
            client: {
              email: PRIMARY_USERS.client.email,
              password: PASSWORD,
            },
            broker: {
              email: PRIMARY_USERS.broker.email,
              password: PASSWORD,
            },
            freelancer: {
              email: PRIMARY_USERS.freelancer.email,
              password: PASSWORD,
            },
            staff: {
              email: PRIMARY_USERS.staff.email,
              password: PASSWORD,
            },
          },
          requestIds: requestSummary.requestIds,
          specIds: requestSummary.specIds,
          projectIds: {
            paymentDemo: requestSummary.paymentProjectId,
            linkedRequestProject: requestSummary.linkedProjectId,
          },
          contractIds: {
            paymentDemo: requestSummary.paymentContractId,
            linkedRequestContract: requestSummary.linkedContractId,
          },
          disputeId: requestSummary.disputeId,
          urls: usefulUrls,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Failed to seed client showcase fixtures');
  console.error(error);
  process.exit(1);
});
