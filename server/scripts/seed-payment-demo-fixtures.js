const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Client } = require('pg');
const { v5: uuidv5 } = require('uuid');

const SEED_KEY = 'codex-payment-demo-v1';
const UUID_NAMESPACE = '8d73e3b1-873a-4ab7-8a3a-1d1f8f7ef7f2';
const PASSWORD = 'password123';
const APP_BASE_URL = 'https://localhost:5173';

const EMAILS = {
  staff: 'payment.staff.demo@example.com',
  client: 'payment.client.demo@example.com',
  freelancer: 'payment.freelancer.demo@example.com',
  broker: 'payment.broker.demo@example.com',
};

function sid(name) {
  return uuidv5(`${SEED_KEY}:${name}`, UUID_NAMESPACE);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3_600_000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

function money(value) {
  return Number(Number(value).toFixed(2));
}

function quoteColumn(column) {
  return `"${column}"`;
}

function hashContent(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function upsertRow(client, table, row, immutable = ['id', 'createdAt']) {
  const columns = Object.keys(row);
  const values = Object.values(row).map((value) => {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value;
    if (Array.isArray(value)) return JSON.stringify(value);
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

async function ensureUser(client, key, role, fullName, now) {
  const existing = await client.query(
    `select id from users where email = $1 limit 1`,
    [EMAILS[key]],
  );
  const userId = existing.rows[0]?.id ?? sid(`user:${key}`);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await upsertRow(
    client,
    'users',
    {
      id: userId,
      email: EMAILS[key],
      passwordHash,
      fullName,
      role,
      phoneNumber: `0900${String(Math.abs(hashContent(key).charCodeAt(0))).padStart(6, '0').slice(0, 6)}`,
      timeZone: 'Asia/Ho_Chi_Minh',
      isVerified: true,
      currentTrustScore: role === 'CLIENT' ? 4.6 : 4.9,
      emailVerifiedAt: now,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    ['id', 'createdAt'],
  );

  return {
    id: userId,
    email: EMAILS[key],
    role,
    fullName,
  };
}

async function ensureProfile(client, key, user, now) {
  const existing = await client.query(
    `select id from profiles where "userId" = $1 limit 1`,
    [user.id],
  );
  const profileId = existing.rows[0]?.id ?? sid(`profile:${key}`);

  const bankInfo =
    key === 'freelancer'
      ? { bank: 'Vietcombank', account: '970100000111', branch: 'District 1' }
      : key === 'broker'
        ? { bank: 'ACB', account: '970200000222', branch: 'District 3' }
        : null;

  await upsertRow(
    client,
    'profiles',
    {
      id: profileId,
      userId: user.id,
      bio:
        key === 'client'
          ? 'Dedicated payment demo client account for PayPal Sandbox escrow flows.'
          : key === 'broker'
            ? 'Dedicated broker demo account for commission payout verification.'
            : key === 'freelancer'
              ? 'Dedicated freelancer demo account for earnings release verification.'
              : 'Dedicated staff demo account for payout release moderation.',
      companyName: key === 'client' ? 'InterDev Demo Labs' : null,
      skills: null,
      portfolioLinks:
        key === 'freelancer'
          ? [{ title: 'GitHub', url: 'https://github.com/interdev-demo/payment-flow' }]
          : null,
      bankInfo,
    },
    ['id'],
  );
}

async function ensureWallet(client, key, userId, now) {
  const existing = await client.query(
    `select id from wallets where "userId" = $1 limit 1`,
    [userId],
  );
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

  return {
    id: walletId,
    userId,
  };
}

async function ensureKycApproved(client, key, user, reviewerId, now) {
  const kycId = sid(`kyc:${key}`);
  const identitySeed = `${key}-${user.email}`;

  await upsertRow(
    client,
    'kyc_verifications',
    {
      id: kycId,
      userId: user.id,
      fullNameOnDocument: user.fullName.toUpperCase(),
      documentNumber: hashContent(identitySeed).slice(0, 20),
      documentType: 'CCCD',
      dateOfBirth: new Date('1995-01-15'),
      documentExpiryDate: new Date('2035-01-15'),
      documentFrontUrl: `kyc/${key}/front-approved.png`,
      documentBackUrl: `kyc/${key}/back-approved.png`,
      selfieUrl: `kyc/${key}/selfie-approved.png`,
      status: 'APPROVED',
      rejectionReason: null,
      reviewedBy: reviewerId,
      reviewedAt: addDays(now, -2),
      createdAt: addDays(now, -3),
      updatedAt: now,
    },
    ['id', 'createdAt'],
  );
}

function buildContractTerms() {
  const content = [
    'InterDev Payment Demo Contract',
    '',
    'This fixture exists only to demonstrate PayPal Sandbox funding and escrow release.',
    'Client starts with a saved PayPal funding method so checkout and vault can be tested quickly.',
    'Practice milestones begin unfunded so every escrow lock comes from a real sandbox checkout.',
    'Escrow split: Freelancer 85%, Broker 10%, Platform 5%.',
  ].join('\n');

  return {
    terms: content,
    hash: hashContent(content),
  };
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

async function resetDemoData(client, demo) {
  const walletIds = Object.values(demo.wallets).map((wallet) => wallet.id);
  const taskIds = demo.tasks.map((task) => task.id);
  const milestoneIds = demo.milestones.map((milestone) => milestone.id);
  const projectIds = demo.projects.map((project) => project.id);
  const paymentUserIds = [
    demo.users.client.id,
    demo.users.broker.id,
    demo.users.freelancer.id,
  ];

  await client.query(`delete from task_comments where "taskId" = any($1::uuid[])`, [taskIds]);
  await client.query(`delete from task_history where "taskId" = any($1::uuid[])`, [taskIds]);
  await client.query(`delete from tasks where "projectId" = any($1::uuid[])`, [projectIds]);
  await client.query(`delete from funding_intents where "milestoneId" = any($1::uuid[])`, [milestoneIds]);
  await client.query(
    `delete from payout_requests where "walletId" = any($1::uuid[])`,
    [walletIds],
  );
  await client.query(`delete from transactions where "walletId" = any($1::uuid[])`, [walletIds]);
  await client.query(
    `delete from payment_methods where "userId" = any($1::uuid[])`,
    [paymentUserIds],
  );
  await client.query(
    `delete from payout_methods where "userId" = any($1::uuid[])`,
    [paymentUserIds],
  );
  await client.query(
    `delete from kyc_verifications where "userId" = any($1::uuid[])`,
    [paymentUserIds],
  );
  await client.query(`delete from escrows where "projectId" = any($1::uuid[])`, [projectIds]);
  await client.query(`delete from milestones where "projectId" = any($1::uuid[])`, [projectIds]);
  await client.query(`delete from contracts where "projectId" = any($1::uuid[])`, [projectIds]);
  await client.query(`delete from projects where "id" = any($1::uuid[])`, [projectIds]);
}

function buildDemoFixture(users, wallets, now) {
  const projectId = sid('project');
  const contractId = sid('contract');
  const pendingMilestoneId = sid('milestone:paypal-funding');
  const approvalMilestoneId = sid('milestone:approval-ready');
  const pendingEscrowId = sid('escrow:paypal-funding');
  const approvalEscrowId = sid('escrow:approval-ready');
  const clientApprovalProjectId = sid('project:client-approval');
  const clientApprovalContractId = sid('contract:client-approval');
  const clientApprovalMilestoneId = sid('milestone:client-approval-ready');
  const clientApprovalEscrowId = sid('escrow:client-approval-ready');
  const fullFlowCProjectId = sid('project:full-flow-c');
  const fullFlowCContractId = sid('contract:full-flow-c');
  const fullFlowCMilestoneId = sid('milestone:full-flow-c');
  const fullFlowCEscrowId = sid('escrow:full-flow-c');
  const fullFlowDProjectId = sid('project:full-flow-d');
  const fullFlowDContractId = sid('contract:full-flow-d');
  const fullFlowDMilestoneId = sid('milestone:full-flow-d');
  const fullFlowDEscrowId = sid('escrow:full-flow-d');
  const cancelProjectId = sid('project:cancel-refund');
  const cancelContractId = sid('contract:cancel-refund');
  const cancelMilestoneId = sid('milestone:cancel-funded');
  const cancelEscrowId = sid('escrow:cancel-funded');
  const cancelBackupProjectId = sid('project:cancel-refund-b');
  const cancelBackupContractId = sid('contract:cancel-refund-b');
  const cancelBackupMilestoneId = sid('milestone:cancel-funded-b');
  const cancelBackupEscrowId = sid('escrow:cancel-funded-b');
  const clientPaypalMethodId = sid('payment-method:client:paypal:primary');
  const freelancerPaypalPayoutMethodId = sid('payout-method:freelancer:paypal');
  const freelancerBankBackupPayoutMethodId = sid('payout-method:freelancer:bank:backup');
  const brokerPaypalPayoutMethodId = sid('payout-method:broker:paypal');
  const brokerBankBackupPayoutMethodId = sid('payout-method:broker:bank:backup');
  const freelancerFailedPayoutRequestId = sid('payout-request:failed:freelancer');
  const brokerFailedPayoutRequestId = sid('payout-request:failed:broker');

  const contract = buildContractTerms();
  const activatedAt = addHours(now, -6);
  const pendingStart = addDays(now, -1);
  const pendingDue = addDays(now, 4);
  const approvalStart = addDays(now, -3);
  const approvalDue = addDays(now, 1);
  const clientApprovalStart = addDays(now, -2);
  const clientApprovalDue = addDays(now, 2);
  const fullFlowCStart = addDays(now, -2);
  const fullFlowCDue = addDays(now, 3);
  const fullFlowDStart = addDays(now, -1);
  const fullFlowDDue = addDays(now, 4);
  const cancelStart = addDays(now, -1);
  const cancelDue = addDays(now, 5);
  const cancelBackupStart = addDays(now, -1);
  const cancelBackupDue = addDays(now, 6);

  const buildContractRow = ({
    id,
    project,
    milestones: contractMilestones,
    title,
    createdAt,
    narrative,
  }) => ({
    id,
    projectId: project.id,
    sourceSpecId: null,
    title,
    contractUrl: `https://storage.interdev.local/contracts/${id}.pdf`,
    archiveStoragePath: null,
    archivePersistedAt: null,
    archiveDocumentHash: null,
    termsContent: contract.terms,
    contentHash: hashContent(`${contract.hash}:${id}`),
    status: 'ACTIVATED',
    activatedAt,
    commercialContext: {
      sourceSpecId: null,
      sourceSpecUpdatedAt: null,
      requestId: null,
      projectTitle: project.title,
      clientId: users.client.id,
      brokerId: users.broker.id,
      freelancerId: users.freelancer.id,
      totalBudget: money(project.totalBudget),
      currency: 'USD',
      description: project.description,
      techStack: 'React, NestJS, PostgreSQL, PayPal Sandbox',
      scopeNarrativePlainText: narrative,
      features: contractMilestones.map((milestone, index) => ({
        title: `Feature ${index + 1}: ${milestone.title}`,
        description: milestone.description,
        complexity: index === 0 ? 'MEDIUM' : 'HIGH',
        acceptanceCriteria: milestone.acceptanceCriteria,
      })),
      escrowSplit: { developerPercentage: 85, brokerPercentage: 10, platformPercentage: 5 },
    },
    milestoneSnapshot: contractMilestones.map((milestone, index) => ({
      contractMilestoneKey: milestone.sourceContractMilestoneKey,
      sourceSpecMilestoneId: null,
      projectMilestoneId: milestone.id,
      title: milestone.title,
      description: milestone.description,
      amount: money(milestone.amount),
      startDate: milestone.startDate.toISOString(),
      dueDate: milestone.dueDate.toISOString(),
      sortOrder: index + 1,
      deliverableType: milestone.deliverableType,
      retentionAmount: money(milestone.retentionAmount),
      acceptanceCriteria: milestone.acceptanceCriteria,
    })),
    createdBy: users.broker.id,
    createdAt,
  });

  const milestones = [
    {
      id: pendingMilestoneId,
      projectId,
      title: 'PayPal Sandbox funding demo',
      description: 'Use PayPal Sandbox checkout to deposit the exact escrow amount.',
      amount: money(700),
      deliverableType: 'SOURCE_CODE',
      retentionAmount: money(50),
      acceptanceCriteria: [
        'PayPal Sandbox checkout opens in the browser',
        'Escrow becomes FUNDED after capture',
        'Deposit and hold ledger rows appear in the client wallet',
      ],
      startDate: pendingStart,
      dueDate: pendingDue,
      status: 'PENDING',
      submittedAt: null,
      proofOfWork: null,
      videoDemoUrl: null,
      feedback: null,
      sortOrder: 1,
      sourceContractMilestoneKey: 'payment-demo-m1',
      createdAt: addDays(now, -2),
    },
    {
      id: approvalMilestoneId,
      projectId,
      title: 'Full flow practice A',
      description: 'Fund this milestone, have the freelancer request review, then walk it through broker review and final client approval.',
      amount: money(500),
      deliverableType: 'DEPLOYMENT',
      retentionAmount: money(0),
      acceptanceCriteria: [
        'Client funds the full milestone amount with PayPal Sandbox',
        'Freelancer requests broker review after funding',
        'Client approval releases the escrow immediately',
        'Freelancer and broker wallets update with their shares',
      ],
      startDate: approvalStart,
      dueDate: approvalDue,
      status: 'IN_PROGRESS',
      submittedAt: null,
      proofOfWork: 'https://demo.interdev.local/payment-full-flow-a',
      videoDemoUrl: 'https://youtu.be/interdev-payment-full-flow-a',
      feedback: null,
      sortOrder: 2,
      sourceContractMilestoneKey: 'payment-demo-m2',
      createdAt: addDays(now, -3),
    },
  ];

  const project = {
    id: projectId,
    requestId: null,
    clientId: users.client.id,
    brokerId: users.broker.id,
    freelancerId: users.freelancer.id,
    staffId: users.staff.id,
    staffInviteStatus: 'ACCEPTED',
    title: '[DEMO] PayPal Escrow Sandbox Flow',
    description:
      'Demo project for funding escrow with PayPal Sandbox and approving a funded milestone to release payouts.',
    totalBudget: money(1200),
    currency: 'USD',
    pricingModel: 'FIXED_PRICE',
    startDate: addDays(now, -3),
    endDate: addDays(now, 14),
    status: 'IN_PROGRESS',
    createdAt: addDays(now, -3),
    updatedAt: now,
  };

  const clientApprovalMilestone = {
    id: clientApprovalMilestoneId,
    projectId: clientApprovalProjectId,
    title: 'Full flow practice B',
    description:
      'A second end-to-end rehearsal milestone so you can repeat funding, review, and approval without reseeding immediately.',
    amount: money(400),
    deliverableType: 'DEPLOYMENT',
    retentionAmount: money(0),
    acceptanceCriteria: [
      'Client funds the full milestone amount with PayPal Sandbox',
      'Freelancer requests broker review after funding',
      'Client approval releases the escrow immediately',
      'Freelancer and broker wallets update with their shares',
    ],
    startDate: clientApprovalStart,
    dueDate: clientApprovalDue,
    status: 'IN_PROGRESS',
    submittedAt: null,
    proofOfWork: 'https://demo.interdev.local/payment-full-flow-b',
    videoDemoUrl: 'https://youtu.be/interdev-payment-full-flow-b',
    feedback: null,
    sortOrder: 1,
    sourceContractMilestoneKey: 'payment-demo-client-approval-m1',
    createdAt: addDays(now, -2),
  };

  const fullFlowCMilestone = {
    id: fullFlowCMilestoneId,
    projectId: fullFlowCProjectId,
    title: 'Full flow practice C',
    description:
      'A third clean end-to-end rehearsal milestone for funding, broker review, client approval, and release.',
    amount: money(450),
    deliverableType: 'SOURCE_CODE',
    retentionAmount: money(0),
    acceptanceCriteria: [
      'Client funds the full milestone amount with PayPal Sandbox',
      'Freelancer requests broker review after funding',
      'Client approval releases the escrow immediately',
      'Wallets reflect the 85 / 10 / 5 split',
    ],
    startDate: fullFlowCStart,
    dueDate: fullFlowCDue,
    status: 'IN_PROGRESS',
    submittedAt: null,
    proofOfWork: 'https://demo.interdev.local/payment-full-flow-c',
    videoDemoUrl: 'https://youtu.be/interdev-payment-full-flow-c',
    feedback: null,
    sortOrder: 1,
    sourceContractMilestoneKey: 'payment-demo-full-flow-c-m1',
    createdAt: addDays(now, -2),
  };

  const fullFlowDMilestone = {
    id: fullFlowDMilestoneId,
    projectId: fullFlowDProjectId,
    title: 'Full flow practice D',
    description:
      'A fourth rehearsal milestone so you can repeat the full payment flow again for the lecturer without reseeding immediately.',
    amount: money(350),
    deliverableType: 'DEPLOYMENT',
    retentionAmount: money(0),
    acceptanceCriteria: [
      'Client funds the full milestone amount with PayPal Sandbox',
      'Freelancer requests broker review after funding',
      'Client approval releases the escrow immediately',
      'Wallets reflect the 85 / 10 / 5 split',
    ],
    startDate: fullFlowDStart,
    dueDate: fullFlowDDue,
    status: 'IN_PROGRESS',
    submittedAt: null,
    proofOfWork: 'https://demo.interdev.local/payment-full-flow-d',
    videoDemoUrl: 'https://youtu.be/interdev-payment-full-flow-d',
    feedback: null,
    sortOrder: 1,
    sourceContractMilestoneKey: 'payment-demo-full-flow-d-m1',
    createdAt: addDays(now, -1),
  };

  const cancelMilestone = {
    id: cancelMilestoneId,
    projectId: cancelProjectId,
    title: 'Cancel and refund demo',
    description:
      'Fund this milestone first, then cancel the project before any payout release to rehearse the refund flow.',
    amount: money(250),
    deliverableType: 'SOURCE_CODE',
    retentionAmount: money(0),
    acceptanceCriteria: [
      'Project can be cancelled before any release happens',
      'Funded escrow is refunded back to the PayPal funding source when available',
      'Milestone and tasks are locked after cancellation',
    ],
    startDate: cancelStart,
    dueDate: cancelDue,
    status: 'IN_PROGRESS',
    submittedAt: null,
    proofOfWork: null,
    videoDemoUrl: null,
    feedback: null,
    sortOrder: 1,
    sourceContractMilestoneKey: 'payment-demo-cancel-m1',
    createdAt: addDays(now, -1),
  };

  const cancelBackupMilestone = {
    id: cancelBackupMilestoneId,
    projectId: cancelBackupProjectId,
    title: 'Cancel and refund demo B',
    description:
      'A backup cancel-and-refund rehearsal so you can practice refund behavior more than once without reseeding.',
    amount: money(300),
    deliverableType: 'SOURCE_CODE',
    retentionAmount: money(0),
    acceptanceCriteria: [
      'Project can be cancelled before any release happens',
      'Funded escrow is refunded back to the PayPal funding source when available',
      'Milestone and tasks are locked after cancellation',
    ],
    startDate: cancelBackupStart,
    dueDate: cancelBackupDue,
    status: 'IN_PROGRESS',
    submittedAt: null,
    proofOfWork: null,
    videoDemoUrl: null,
    feedback: null,
    sortOrder: 1,
    sourceContractMilestoneKey: 'payment-demo-cancel-m2',
    createdAt: addDays(now, -1),
  };

  milestones.push(
    clientApprovalMilestone,
    fullFlowCMilestone,
    fullFlowDMilestone,
    cancelMilestone,
    cancelBackupMilestone,
  );

  const clientApprovalProject = {
    id: clientApprovalProjectId,
    requestId: null,
    clientId: users.client.id,
    brokerId: users.broker.id,
    freelancerId: users.freelancer.id,
    staffId: users.staff.id,
    staffInviteStatus: 'ACCEPTED',
    title: '[DEMO] Full Flow Practice B',
    description:
      'Demo project for a second full end-to-end payment rehearsal without relying on pre-funded escrow state.',
    totalBudget: money(400),
    currency: 'USD',
    pricingModel: 'FIXED_PRICE',
    startDate: addDays(now, -2),
    endDate: addDays(now, 10),
    status: 'IN_PROGRESS',
    createdAt: addDays(now, -2),
    updatedAt: now,
  };

  const cancelProject = {
    id: cancelProjectId,
    requestId: null,
    clientId: users.client.id,
    brokerId: users.broker.id,
    freelancerId: users.freelancer.id,
    staffId: users.staff.id,
    staffInviteStatus: 'ACCEPTED',
    title: '[DEMO] Cancel & Refund Before Release',
    description:
      'Demo project for cancelling an active contract before any escrow is released and refunding the original funding source cleanly.',
    totalBudget: money(250),
    currency: 'USD',
    pricingModel: 'FIXED_PRICE',
    startDate: addDays(now, -1),
    endDate: addDays(now, 12),
    status: 'IN_PROGRESS',
    createdAt: addDays(now, -1),
    updatedAt: now,
  };

  const fullFlowCProject = {
    id: fullFlowCProjectId,
    requestId: null,
    clientId: users.client.id,
    brokerId: users.broker.id,
    freelancerId: users.freelancer.id,
    staffId: users.staff.id,
    staffInviteStatus: 'ACCEPTED',
    title: '[DEMO] Full Flow Practice C',
    description:
      'Demo project for a third end-to-end rehearsal with real PayPal funding before review and release.',
    totalBudget: money(450),
    currency: 'USD',
    pricingModel: 'FIXED_PRICE',
    startDate: addDays(now, -2),
    endDate: addDays(now, 11),
    status: 'IN_PROGRESS',
    createdAt: addDays(now, -2),
    updatedAt: now,
  };

  const fullFlowDProject = {
    id: fullFlowDProjectId,
    requestId: null,
    clientId: users.client.id,
    brokerId: users.broker.id,
    freelancerId: users.freelancer.id,
    staffId: users.staff.id,
    staffInviteStatus: 'ACCEPTED',
    title: '[DEMO] Full Flow Practice D',
    description:
      'Demo project for a fourth full-flow rehearsal so the lecturer can see the same flow twice without reseeding.',
    totalBudget: money(350),
    currency: 'USD',
    pricingModel: 'FIXED_PRICE',
    startDate: addDays(now, -1),
    endDate: addDays(now, 12),
    status: 'IN_PROGRESS',
    createdAt: addDays(now, -1),
    updatedAt: now,
  };

  const cancelBackupProject = {
    id: cancelBackupProjectId,
    requestId: null,
    clientId: users.client.id,
    brokerId: users.broker.id,
    freelancerId: users.freelancer.id,
    staffId: users.staff.id,
    staffInviteStatus: 'ACCEPTED',
    title: '[DEMO] Cancel & Refund Before Release B',
    description:
      'Backup cancel-and-refund demo project for a second live refund rehearsal before any payout release.',
    totalBudget: money(300),
    currency: 'USD',
    pricingModel: 'FIXED_PRICE',
    startDate: addDays(now, -1),
    endDate: addDays(now, 13),
    status: 'IN_PROGRESS',
    createdAt: addDays(now, -1),
    updatedAt: now,
  };

  const taskReporterId = users.broker.id;
  const tasks = [
    {
      id: sid('task:approval:qa-signoff'),
      milestoneId: approvalMilestoneId,
      projectId,
      parentTaskId: null,
      title: 'Verify payout release copy',
      description: 'Confirm the approval screen reflects the release state and payout summary after the milestone is funded.',
      status: 'DONE',
      assignedTo: users.freelancer.id,
      dueDate: addHours(now, -3),
      sortOrder: 1,
      submission_note: null,
      proof_link: 'https://demo.interdev.local/payment-release/checklist',
      submitted_at: addHours(now, -2),
      reporterId: taskReporterId,
      priority: 'MEDIUM',
      storyPoints: 3,
      startDate: addHours(now, -10),
      labels: null,
      createdAt: addHours(now, -12),
    },
    {
      id: sid('task:approval:wallet-ledger'),
      milestoneId: approvalMilestoneId,
      projectId,
      parentTaskId: null,
      title: 'Check wallet ledger entries',
      description: 'Ensure release entries land in the correct wallets after approval once escrow has been funded.',
      status: 'DONE',
      assignedTo: users.freelancer.id,
      dueDate: addHours(now, -2),
      sortOrder: 2,
      submission_note: null,
      proof_link: 'https://demo.interdev.local/payment-release/ledger',
      submitted_at: addHours(now, -2),
      reporterId: taskReporterId,
      priority: 'MEDIUM',
      storyPoints: 2,
      startDate: addHours(now, -9),
      labels: null,
      createdAt: addHours(now, -12),
    },
    {
      id: sid('task:funding:paypal-capture'),
      milestoneId: pendingMilestoneId,
      projectId,
      parentTaskId: null,
      title: 'Capture PayPal Sandbox payment',
      description: 'Fund the milestone in the browser using the saved PayPal method.',
      status: 'TODO',
      assignedTo: users.client.id,
      dueDate: addDays(now, 1),
      sortOrder: 1,
      submission_note: null,
      proof_link: null,
      submitted_at: null,
      reporterId: taskReporterId,
      priority: 'HIGH',
      storyPoints: 2,
      startDate: now,
      labels: null,
      createdAt: addHours(now, -1),
    },
    {
      id: sid('task:client-approval:release-summary'),
      milestoneId: clientApprovalMilestoneId,
      projectId: clientApprovalProjectId,
      parentTaskId: null,
      title: 'Verify release split preview',
      description: 'Confirm the approval modal shows the freelancer, broker, and platform split after funding and broker review.',
      status: 'DONE',
      assignedTo: users.freelancer.id,
      dueDate: addHours(now, -4),
      sortOrder: 1,
      submission_note: null,
      proof_link: 'https://demo.interdev.local/payment-client-approval/split',
      submitted_at: addHours(now, -3),
      reporterId: taskReporterId,
      priority: 'MEDIUM',
      storyPoints: 2,
      startDate: addHours(now, -8),
      labels: null,
      createdAt: addHours(now, -9),
    },
    {
      id: sid('task:client-approval:wallet-reconciliation'),
      milestoneId: clientApprovalMilestoneId,
      projectId: clientApprovalProjectId,
      parentTaskId: null,
      title: 'Check wallet reconciliation',
      description: 'Ensure the release updates the client, freelancer, broker, and platform ledgers after the full review flow.',
      status: 'DONE',
      assignedTo: users.freelancer.id,
      dueDate: addHours(now, -4),
      sortOrder: 2,
      submission_note: null,
      proof_link: 'https://demo.interdev.local/payment-client-approval/ledger',
      submitted_at: addHours(now, -3),
      reporterId: taskReporterId,
      priority: 'MEDIUM',
      storyPoints: 2,
      startDate: addHours(now, -7),
      labels: null,
      createdAt: addHours(now, -9),
    },
    {
      id: sid('task:cancel:prepare-refund'),
      milestoneId: cancelMilestoneId,
      projectId: cancelProjectId,
      parentTaskId: null,
      title: 'Prepare cancellation walkthrough',
      description: 'Use this project to rehearse cancel and refund before any payout release happens.',
      status: 'IN_PROGRESS',
      assignedTo: users.broker.id,
      dueDate: addDays(now, 1),
      sortOrder: 1,
      submission_note: null,
      proof_link: null,
      submitted_at: null,
      reporterId: taskReporterId,
      priority: 'HIGH',
      storyPoints: 2,
      startDate: addHours(now, -4),
      labels: null,
      createdAt: addHours(now, -6),
    },
    {
      id: sid('task:full-flow-c:split-check'),
      milestoneId: fullFlowCMilestoneId,
      projectId: fullFlowCProjectId,
      parentTaskId: null,
      title: 'Verify split summary for practice C',
      description: 'Check that the release modal shows the full 85 / 10 / 5 split after funding and broker review.',
      status: 'DONE',
      assignedTo: users.freelancer.id,
      dueDate: addHours(now, -3),
      sortOrder: 1,
      submission_note: null,
      proof_link: 'https://demo.interdev.local/payment-full-flow-c/split',
      submitted_at: addHours(now, -2),
      reporterId: taskReporterId,
      priority: 'MEDIUM',
      storyPoints: 2,
      startDate: addHours(now, -8),
      labels: null,
      createdAt: addHours(now, -9),
    },
    {
      id: sid('task:full-flow-c:ledger-check'),
      milestoneId: fullFlowCMilestoneId,
      projectId: fullFlowCProjectId,
      parentTaskId: null,
      title: 'Check ledger for practice C',
      description: 'Ensure the client, freelancer, broker, and platform ledgers reconcile after release.',
      status: 'DONE',
      assignedTo: users.freelancer.id,
      dueDate: addHours(now, -3),
      sortOrder: 2,
      submission_note: null,
      proof_link: 'https://demo.interdev.local/payment-full-flow-c/ledger',
      submitted_at: addHours(now, -2),
      reporterId: taskReporterId,
      priority: 'MEDIUM',
      storyPoints: 2,
      startDate: addHours(now, -7),
      labels: null,
      createdAt: addHours(now, -9),
    },
    {
      id: sid('task:full-flow-d:split-check'),
      milestoneId: fullFlowDMilestoneId,
      projectId: fullFlowDProjectId,
      parentTaskId: null,
      title: 'Verify split summary for practice D',
      description: 'Check that the release modal shows the full 85 / 10 / 5 split after funding and broker review.',
      status: 'DONE',
      assignedTo: users.freelancer.id,
      dueDate: addHours(now, -2),
      sortOrder: 1,
      submission_note: null,
      proof_link: 'https://demo.interdev.local/payment-full-flow-d/split',
      submitted_at: addHours(now, -1),
      reporterId: taskReporterId,
      priority: 'MEDIUM',
      storyPoints: 2,
      startDate: addHours(now, -6),
      labels: null,
      createdAt: addHours(now, -7),
    },
    {
      id: sid('task:full-flow-d:ledger-check'),
      milestoneId: fullFlowDMilestoneId,
      projectId: fullFlowDProjectId,
      parentTaskId: null,
      title: 'Check ledger for practice D',
      description: 'Ensure the client, freelancer, broker, and platform ledgers reconcile after release.',
      status: 'DONE',
      assignedTo: users.freelancer.id,
      dueDate: addHours(now, -2),
      sortOrder: 2,
      submission_note: null,
      proof_link: 'https://demo.interdev.local/payment-full-flow-d/ledger',
      submitted_at: addHours(now, -1),
      reporterId: taskReporterId,
      priority: 'MEDIUM',
      storyPoints: 2,
      startDate: addHours(now, -5),
      labels: null,
      createdAt: addHours(now, -7),
    },
    {
      id: sid('task:cancel-b:prepare-refund'),
      milestoneId: cancelBackupMilestoneId,
      projectId: cancelBackupProjectId,
      parentTaskId: null,
      title: 'Prepare second cancellation walkthrough',
      description: 'Use this project to rehearse cancel and refund one more time before any payout release happens.',
      status: 'IN_PROGRESS',
      assignedTo: users.broker.id,
      dueDate: addDays(now, 1),
      sortOrder: 1,
      submission_note: null,
      proof_link: null,
      submitted_at: null,
      reporterId: taskReporterId,
      priority: 'HIGH',
      storyPoints: 2,
      startDate: addHours(now, -3),
      labels: null,
      createdAt: addHours(now, -5),
    },
  ];

  const contractRow = buildContractRow({
    id: contractId,
    project,
    milestones: milestones.filter((milestone) => milestone.projectId === projectId),
    title: 'PayPal Escrow Sandbox Flow - Demo Contract',
    createdAt: addDays(now, -3),
    narrative:
      'Demo contract for illustrating one incoming PayPal funding flow and one outgoing payout release flow.',
  });

  const clientApprovalContractRow = buildContractRow({
    id: clientApprovalContractId,
    project: clientApprovalProject,
    milestones: [clientApprovalMilestone],
    title: 'Full Flow Practice B - Demo Contract',
    createdAt: addDays(now, -2),
    narrative:
      'Demo contract for a second clean end-to-end practice run without relying on seeded funded escrow.',
  });

  const cancelContractRow = buildContractRow({
    id: cancelContractId,
    project: cancelProject,
    milestones: [cancelMilestone],
    title: 'Cancel & Refund Before Release - Demo Contract',
    createdAt: addDays(now, -1),
    narrative:
      'Demo contract for cancelling an active project before any escrow release and refunding the original funding source cleanly.',
  });

  const fullFlowCContractRow = buildContractRow({
    id: fullFlowCContractId,
    project: fullFlowCProject,
    milestones: [fullFlowCMilestone],
    title: 'Full Flow Practice C - Demo Contract',
    createdAt: addDays(now, -2),
    narrative:
      'Demo contract for a third clean end-to-end rehearsal with real PayPal funding before approval and release.',
  });

  const fullFlowDContractRow = buildContractRow({
    id: fullFlowDContractId,
    project: fullFlowDProject,
    milestones: [fullFlowDMilestone],
    title: 'Full Flow Practice D - Demo Contract',
    createdAt: addDays(now, -1),
    narrative:
      'Demo contract for a fourth clean end-to-end rehearsal so the same payment story can be repeated during the lecturer demo.',
  });

  const cancelBackupContractRow = buildContractRow({
    id: cancelBackupContractId,
    project: cancelBackupProject,
    milestones: [cancelBackupMilestone],
    title: 'Cancel & Refund Before Release B - Demo Contract',
    createdAt: addDays(now, -1),
    narrative:
      'Backup demo contract for cancelling an active project before any escrow release and refunding the original funding source cleanly.',
  });

  const escrows = [
    {
      id: pendingEscrowId,
      projectId,
      milestoneId: pendingMilestoneId,
      totalAmount: money(700),
      fundedAmount: money(0),
      releasedAmount: money(0),
      developerShare: money(595),
      brokerShare: money(70),
      platformFee: money(35),
      developerPercentage: money(85),
      brokerPercentage: money(10),
      platformPercentage: money(5),
      currency: 'USD',
      status: 'PENDING',
      fundedAt: null,
      releasedAt: null,
      refundedAt: null,
      clientApproved: false,
      clientApprovedAt: null,
      clientWalletId: null,
      developerWalletId: null,
      brokerWalletId: null,
      holdTransactionId: null,
      releaseTransactionIds: null,
      refundTransactionId: null,
      disputeId: null,
      notes: 'Pending PayPal Sandbox funding demo.',
      createdAt: addDays(now, -2),
      updatedAt: now,
    },
    {
      id: approvalEscrowId,
      projectId,
      milestoneId: approvalMilestoneId,
      totalAmount: money(500),
      fundedAmount: money(0),
      releasedAmount: money(0),
      developerShare: money(425),
      brokerShare: money(50),
      platformFee: money(25),
      developerPercentage: money(85),
      brokerPercentage: money(10),
      platformPercentage: money(5),
      currency: 'USD',
      status: 'PENDING',
      fundedAt: null,
      releasedAt: null,
      refundedAt: null,
      clientApproved: false,
      clientApprovedAt: null,
      clientWalletId: null,
      developerWalletId: null,
      brokerWalletId: null,
      holdTransactionId: null,
      releaseTransactionIds: null,
      refundTransactionId: null,
      disputeId: null,
      notes: 'Pending funding for full flow practice A.',
      createdAt: addDays(now, -3),
      updatedAt: now,
    },
    {
      id: clientApprovalEscrowId,
      projectId: clientApprovalProjectId,
      milestoneId: clientApprovalMilestoneId,
      totalAmount: money(400),
      fundedAmount: money(0),
      releasedAmount: money(0),
      developerShare: money(340),
      brokerShare: money(40),
      platformFee: money(20),
      developerPercentage: money(85),
      brokerPercentage: money(10),
      platformPercentage: money(5),
      currency: 'USD',
      status: 'PENDING',
      fundedAt: null,
      releasedAt: null,
      refundedAt: null,
      clientApproved: false,
      clientApprovedAt: null,
      clientWalletId: null,
      developerWalletId: null,
      brokerWalletId: null,
      holdTransactionId: null,
      releaseTransactionIds: null,
      refundTransactionId: null,
      disputeId: null,
      notes: 'Pending funding for full flow practice B.',
      createdAt: addDays(now, -2),
      updatedAt: now,
    },
    {
      id: fullFlowCEscrowId,
      projectId: fullFlowCProjectId,
      milestoneId: fullFlowCMilestoneId,
      totalAmount: money(450),
      fundedAmount: money(0),
      releasedAmount: money(0),
      developerShare: money(382.5),
      brokerShare: money(45),
      platformFee: money(22.5),
      developerPercentage: money(85),
      brokerPercentage: money(10),
      platformPercentage: money(5),
      currency: 'USD',
      status: 'PENDING',
      fundedAt: null,
      releasedAt: null,
      refundedAt: null,
      clientApproved: false,
      clientApprovedAt: null,
      clientWalletId: null,
      developerWalletId: null,
      brokerWalletId: null,
      holdTransactionId: null,
      releaseTransactionIds: null,
      refundTransactionId: null,
      disputeId: null,
      notes: 'Pending funding for full flow practice C.',
      createdAt: addDays(now, -2),
      updatedAt: now,
    },
    {
      id: fullFlowDEscrowId,
      projectId: fullFlowDProjectId,
      milestoneId: fullFlowDMilestoneId,
      totalAmount: money(350),
      fundedAmount: money(0),
      releasedAmount: money(0),
      developerShare: money(297.5),
      brokerShare: money(35),
      platformFee: money(17.5),
      developerPercentage: money(85),
      brokerPercentage: money(10),
      platformPercentage: money(5),
      currency: 'USD',
      status: 'PENDING',
      fundedAt: null,
      releasedAt: null,
      refundedAt: null,
      clientApproved: false,
      clientApprovedAt: null,
      clientWalletId: null,
      developerWalletId: null,
      brokerWalletId: null,
      holdTransactionId: null,
      releaseTransactionIds: null,
      refundTransactionId: null,
      disputeId: null,
      notes: 'Pending funding for full flow practice D.',
      createdAt: addDays(now, -1),
      updatedAt: now,
    },
    {
      id: cancelEscrowId,
      projectId: cancelProjectId,
      milestoneId: cancelMilestoneId,
      totalAmount: money(250),
      fundedAmount: money(0),
      releasedAmount: money(0),
      developerShare: money(212.5),
      brokerShare: money(25),
      platformFee: money(12.5),
      developerPercentage: money(85),
      brokerPercentage: money(10),
      platformPercentage: money(5),
      currency: 'USD',
      status: 'PENDING',
      fundedAt: null,
      releasedAt: null,
      refundedAt: null,
      clientApproved: false,
      clientApprovedAt: null,
      clientWalletId: null,
      developerWalletId: null,
      brokerWalletId: null,
      holdTransactionId: null,
      releaseTransactionIds: null,
      refundTransactionId: null,
      disputeId: null,
      notes: 'Pending funding for cancel and refund practice.',
      createdAt: addDays(now, -1),
      updatedAt: now,
    },
    {
      id: cancelBackupEscrowId,
      projectId: cancelBackupProjectId,
      milestoneId: cancelBackupMilestoneId,
      totalAmount: money(300),
      fundedAmount: money(0),
      releasedAmount: money(0),
      developerShare: money(255),
      brokerShare: money(30),
      platformFee: money(15),
      developerPercentage: money(85),
      brokerPercentage: money(10),
      platformPercentage: money(5),
      currency: 'USD',
      status: 'PENDING',
      fundedAt: null,
      releasedAt: null,
      refundedAt: null,
      clientApproved: false,
      clientApprovedAt: null,
      clientWalletId: null,
      developerWalletId: null,
      brokerWalletId: null,
      holdTransactionId: null,
      releaseTransactionIds: null,
      refundTransactionId: null,
      disputeId: null,
      notes: 'Pending funding for cancel and refund practice B.',
      createdAt: addDays(now, -1),
      updatedAt: now,
    },
  ];

  const paymentMethods = [
    {
      id: clientPaypalMethodId,
      userId: users.client.id,
      type: 'PAYPAL_ACCOUNT',
      displayName: 'Primary PayPal',
      paypalEmail: 'sb-host@personal.example.com',
      cardBrand: null,
      cardLast4: null,
      cardholderName: null,
      cardExpiryMonth: null,
      cardExpiryYear: null,
      bankName: null,
      bankCode: null,
      accountNumber: null,
      accountHolderName: null,
      branchName: null,
      isDefault: true,
      isVerified: true,
      verifiedAt: now,
      metadata: { seedKey: SEED_KEY, purpose: 'funding', mode: 'sandbox' },
      createdAt: addDays(now, -2),
      updatedAt: now,
    },
  ];

  const payoutMethods = [
    {
      id: freelancerPaypalPayoutMethodId,
      userId: users.freelancer.id,
      type: 'PAYPAL_EMAIL',
      displayName: 'Freelancer cashout PayPal',
      paypalEmail: 'sb-freelancer@personal.example.com',
      bankName: null,
      bankCode: null,
      accountNumber: null,
      accountHolderName: null,
      branchName: null,
      isDefault: true,
      isVerified: true,
      verifiedAt: now,
      createdAt: addDays(now, -1),
      updatedAt: now,
    },
    {
      id: freelancerBankBackupPayoutMethodId,
      userId: users.freelancer.id,
      type: 'BANK_ACCOUNT',
      displayName: 'Freelancer bank backup',
      paypalEmail: null,
      bankName: 'Techcombank',
      bankCode: 'TCB',
      accountNumber: '190300000333',
      accountHolderName: 'PAYMENT DEMO FREELANCER',
      branchName: 'District 7',
      isDefault: false,
      isVerified: true,
      verifiedAt: now,
      createdAt: addDays(now, -1),
      updatedAt: now,
    },
    {
      id: brokerPaypalPayoutMethodId,
      userId: users.broker.id,
      type: 'PAYPAL_EMAIL',
      displayName: 'Broker cashout PayPal',
      paypalEmail: 'sb-broker@personal.example.com',
      bankName: null,
      bankCode: null,
      accountNumber: null,
      accountHolderName: null,
      branchName: null,
      isDefault: true,
      isVerified: true,
      verifiedAt: now,
      createdAt: addDays(now, -1),
      updatedAt: now,
    },
    {
      id: brokerBankBackupPayoutMethodId,
      userId: users.broker.id,
      type: 'BANK_ACCOUNT',
      displayName: 'Broker bank backup',
      paypalEmail: null,
      bankName: 'VPBank',
      bankCode: 'VPB',
      accountNumber: '970400000444',
      accountHolderName: 'PAYMENT DEMO BROKER',
      branchName: 'Phu Nhuan',
      isDefault: false,
      isVerified: true,
      verifiedAt: now,
      createdAt: addDays(now, -1),
      updatedAt: now,
    },
  ];

  const transactions = [
    {
      id: sid('transaction:freelancer:release:history'),
      walletId: wallets.freelancer.id,
      amount: money(860),
      fee: money(0),
      netAmount: money(860),
      currency: 'USD',
      type: 'ESCROW_RELEASE',
      status: 'COMPLETED',
      referenceType: 'Escrow',
      referenceId: sid('escrow:history:freelancer'),
      paymentMethod: 'INTERNAL_WALLET',
      externalTransactionId: 'SEED-FREELANCER-RELEASE-1',
      metadata: {
        seedKey: SEED_KEY,
        source: 'history',
        role: 'freelancer',
      },
      description: 'Historical milestone payout',
      failureReason: null,
      balanceAfter: money(860),
      initiatedBy: 'system',
      ipAddress: null,
      relatedTransactionId: null,
      completedAt: addDays(now, -5),
      createdAt: addDays(now, -5),
    },
    {
      id: sid('transaction:freelancer:withdrawal:history'),
      walletId: wallets.freelancer.id,
      amount: money(120),
      fee: money(0),
      netAmount: money(120),
      currency: 'USD',
      type: 'WITHDRAWAL',
      status: 'COMPLETED',
      referenceType: 'PayoutRequest',
      referenceId: sid('payout-request:history:freelancer'),
      paymentMethod: 'PAYPAL_EMAIL',
      externalTransactionId: 'SEED-FREELANCER-PAYOUT-1',
      metadata: {
        seedKey: SEED_KEY,
        source: 'history',
        role: 'freelancer',
      },
      description: 'Historical cashout to freelancer PayPal',
      failureReason: null,
      balanceAfter: money(740),
      initiatedBy: 'user',
      ipAddress: null,
      relatedTransactionId: null,
      completedAt: addDays(now, -4),
      createdAt: addDays(now, -4),
    },
    {
      id: sid('transaction:broker:release:history'),
      walletId: wallets.broker.id,
      amount: money(120),
      fee: money(0),
      netAmount: money(120),
      currency: 'USD',
      type: 'ESCROW_RELEASE',
      status: 'COMPLETED',
      referenceType: 'Escrow',
      referenceId: sid('escrow:history:broker'),
      paymentMethod: 'INTERNAL_WALLET',
      externalTransactionId: 'SEED-BROKER-RELEASE-1',
      metadata: {
        seedKey: SEED_KEY,
        source: 'history',
        role: 'broker',
      },
      description: 'Historical broker commission release',
      failureReason: null,
      balanceAfter: money(120),
      initiatedBy: 'system',
      ipAddress: null,
      relatedTransactionId: null,
      completedAt: addDays(now, -5),
      createdAt: addDays(now, -5),
    },
    {
      id: sid('transaction:broker:withdrawal:history'),
      walletId: wallets.broker.id,
      amount: money(40),
      fee: money(0),
      netAmount: money(40),
      currency: 'USD',
      type: 'WITHDRAWAL',
      status: 'COMPLETED',
      referenceType: 'PayoutRequest',
      referenceId: sid('payout-request:history:broker'),
      paymentMethod: 'PAYPAL_EMAIL',
      externalTransactionId: 'SEED-BROKER-PAYOUT-1',
      metadata: {
        seedKey: SEED_KEY,
        source: 'history',
        role: 'broker',
      },
      description: 'Historical cashout to broker PayPal',
      failureReason: null,
      balanceAfter: money(80),
      initiatedBy: 'user',
      ipAddress: null,
      relatedTransactionId: null,
      completedAt: addDays(now, -4),
      createdAt: addDays(now, -4),
    },
  ];

  const payoutRequests = [
    {
      id: sid('payout-request:history:freelancer'),
      walletId: wallets.freelancer.id,
      payoutMethodId: freelancerPaypalPayoutMethodId,
      amount: money(120),
      fee: money(0),
      netAmount: money(120),
      currency: 'USD',
      status: 'COMPLETED',
      approvedAt: addDays(now, -4),
      approvedBy: users.staff.id,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
      processedAt: addDays(now, -4),
      processedBy: 'system',
      externalReference: 'SEED-FREELANCER-PAYOUT-1',
      errorCode: null,
      failureReason: null,
      transactionId: sid('transaction:freelancer:withdrawal:history'),
      note: 'Historical freelancer cashout',
      adminNote: null,
      requestedAt: addDays(now, -4),
      updatedAt: addDays(now, -4),
    },
    {
      id: freelancerFailedPayoutRequestId,
      walletId: wallets.freelancer.id,
      payoutMethodId: freelancerPaypalPayoutMethodId,
      amount: money(55),
      fee: money(0),
      netAmount: money(55),
      currency: 'USD',
      status: 'FAILED',
      approvedAt: addDays(now, -2),
      approvedBy: users.staff.id,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
      processedAt: addDays(now, -2),
      processedBy: 'system',
      externalReference: null,
      errorCode: 'PAYPAL_PAYOUT_FAILED',
      failureReason: 'Sandbox receiver did not accept the payout in time.',
      transactionId: null,
      note: 'Historical failed freelancer cashout for practice',
      adminNote: 'Seeded failed payout request to rehearse failure states.',
      requestedAt: addDays(now, -2),
      updatedAt: addDays(now, -2),
    },
    {
      id: sid('payout-request:history:broker'),
      walletId: wallets.broker.id,
      payoutMethodId: brokerPaypalPayoutMethodId,
      amount: money(40),
      fee: money(0),
      netAmount: money(40),
      currency: 'USD',
      status: 'COMPLETED',
      approvedAt: addDays(now, -4),
      approvedBy: users.staff.id,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
      processedAt: addDays(now, -4),
      processedBy: 'system',
      externalReference: 'SEED-BROKER-PAYOUT-1',
      errorCode: null,
      failureReason: null,
      transactionId: sid('transaction:broker:withdrawal:history'),
      note: 'Historical broker cashout',
      adminNote: null,
      requestedAt: addDays(now, -4),
      updatedAt: addDays(now, -4),
    },
    {
      id: brokerFailedPayoutRequestId,
      walletId: wallets.broker.id,
      payoutMethodId: brokerPaypalPayoutMethodId,
      amount: money(30),
      fee: money(0),
      netAmount: money(30),
      currency: 'USD',
      status: 'FAILED',
      approvedAt: addDays(now, -1),
      approvedBy: users.staff.id,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
      processedAt: addDays(now, -1),
      processedBy: 'system',
      externalReference: null,
      errorCode: 'PAYPAL_PAYOUT_FAILED',
      failureReason: 'Sandbox payout was declined by the receiver profile.',
      transactionId: null,
      note: 'Historical failed broker cashout for practice',
      adminNote: 'Seeded failed payout request to rehearse retry messaging.',
      requestedAt: addDays(now, -1),
      updatedAt: addDays(now, -1),
    },
  ];

  const fundingIntents = [];

  const walletSnapshots = {
    client: {
      ...wallets.client,
      balance: money(0),
      pendingBalance: money(0),
      heldBalance: money(0),
      totalDeposited: money(0),
      totalWithdrawn: money(0),
      totalEarned: money(0),
      totalSpent: money(0),
      currency: 'USD',
      status: 'ACTIVE',
      updatedAt: now,
    },
    freelancer: {
      ...wallets.freelancer,
      balance: money(740),
      pendingBalance: money(0),
      heldBalance: money(0),
      totalDeposited: money(0),
      totalWithdrawn: money(120),
      totalEarned: money(860),
      totalSpent: money(0),
      currency: 'USD',
      status: 'ACTIVE',
      updatedAt: now,
    },
    broker: {
      ...wallets.broker,
      balance: money(80),
      pendingBalance: money(0),
      heldBalance: money(0),
      totalDeposited: money(0),
      totalWithdrawn: money(40),
      totalEarned: money(120),
      totalSpent: money(0),
      currency: 'USD',
      status: 'ACTIVE',
      updatedAt: now,
    },
    staff: {
      ...wallets.staff,
      balance: money(0),
      pendingBalance: money(0),
      heldBalance: money(0),
      totalDeposited: money(0),
      totalWithdrawn: money(0),
      totalEarned: money(0),
      totalSpent: money(0),
      currency: 'USD',
      status: 'ACTIVE',
      updatedAt: now,
    },
  };

  return {
    projects: [project, clientApprovalProject, fullFlowCProject, fullFlowDProject, cancelProject, cancelBackupProject],
    contracts: [
      contractRow,
      clientApprovalContractRow,
      fullFlowCContractRow,
      fullFlowDContractRow,
      cancelContractRow,
      cancelBackupContractRow,
    ],
    milestones,
    escrows,
    tasks,
    paymentMethods,
    payoutMethods,
    payoutRequests,
    fundingIntents,
    transactions,
    walletSnapshots,
    users,
    wallets,
    urls: {
      clientBilling: `${APP_BASE_URL}/client/billing`,
      brokerBilling: `${APP_BASE_URL}/broker/billing`,
      freelancerBilling: `${APP_BASE_URL}/freelancer/billing`,
      scenarios: {
        funding: {
          label: 'Client funds a milestone with PayPal',
          clientWorkspace: `${APP_BASE_URL}/client/workspace/${projectId}?view=board&milestone=${pendingMilestoneId}`,
          contract: `${APP_BASE_URL}/client/contracts/${contractId}`,
        },
        fullFlowA: {
          label: 'Full flow practice A',
          clientWorkspace: `${APP_BASE_URL}/client/workspace/${projectId}?view=board&milestone=${approvalMilestoneId}`,
          freelancerWorkspace: `${APP_BASE_URL}/freelancer/workspace/${projectId}?view=board&milestone=${approvalMilestoneId}`,
          brokerWorkspace: `${APP_BASE_URL}/broker/workspace/${projectId}?view=board&milestone=${approvalMilestoneId}`,
          contract: `${APP_BASE_URL}/client/contracts/${contractId}`,
        },
        fullFlowB: {
          label: 'Full flow practice B',
          clientWorkspace: `${APP_BASE_URL}/client/workspace/${clientApprovalProjectId}?view=board&milestone=${clientApprovalMilestoneId}`,
          freelancerWorkspace: `${APP_BASE_URL}/freelancer/workspace/${clientApprovalProjectId}?view=board&milestone=${clientApprovalMilestoneId}`,
          brokerWorkspace: `${APP_BASE_URL}/broker/workspace/${clientApprovalProjectId}?view=board&milestone=${clientApprovalMilestoneId}`,
          contract: `${APP_BASE_URL}/client/contracts/${clientApprovalContractId}`,
        },
        fullFlowC: {
          label: 'Full flow practice C',
          clientWorkspace: `${APP_BASE_URL}/client/workspace/${fullFlowCProjectId}?view=board&milestone=${fullFlowCMilestoneId}`,
          freelancerWorkspace: `${APP_BASE_URL}/freelancer/workspace/${fullFlowCProjectId}?view=board&milestone=${fullFlowCMilestoneId}`,
          brokerWorkspace: `${APP_BASE_URL}/broker/workspace/${fullFlowCProjectId}?view=board&milestone=${fullFlowCMilestoneId}`,
          contract: `${APP_BASE_URL}/client/contracts/${fullFlowCContractId}`,
        },
        fullFlowD: {
          label: 'Full flow practice D',
          clientWorkspace: `${APP_BASE_URL}/client/workspace/${fullFlowDProjectId}?view=board&milestone=${fullFlowDMilestoneId}`,
          freelancerWorkspace: `${APP_BASE_URL}/freelancer/workspace/${fullFlowDProjectId}?view=board&milestone=${fullFlowDMilestoneId}`,
          brokerWorkspace: `${APP_BASE_URL}/broker/workspace/${fullFlowDProjectId}?view=board&milestone=${fullFlowDMilestoneId}`,
          contract: `${APP_BASE_URL}/client/contracts/${fullFlowDContractId}`,
        },
        cancelRefund: {
          label: 'Cancel practice after real funding',
          clientWorkspace: `${APP_BASE_URL}/client/workspace/${cancelProjectId}?view=board&milestone=${cancelMilestoneId}`,
          contract: `${APP_BASE_URL}/client/contracts/${cancelContractId}`,
        },
        cancelRefundB: {
          label: 'Cancel practice after real funding B',
          clientWorkspace: `${APP_BASE_URL}/client/workspace/${cancelBackupProjectId}?view=board&milestone=${cancelBackupMilestoneId}`,
          contract: `${APP_BASE_URL}/client/contracts/${cancelBackupContractId}`,
        },
        brokerCashout: {
          label: 'Broker cashout practice with completed and failed history',
          billing: `${APP_BASE_URL}/broker/billing`,
        },
        freelancerCashout: {
          label: 'Freelancer cashout practice with completed and failed history',
          billing: `${APP_BASE_URL}/freelancer/billing`,
        },
      },
      practiceOrder: [
        {
          step: 1,
          actor: 'Client',
          action: 'Open billing and confirm PayPal checkout is ready',
          url: `${APP_BASE_URL}/client/billing`,
        },
        {
          step: 2,
          actor: 'Client',
          action: 'Fund Full flow practice A with PayPal Sandbox',
          url: `${APP_BASE_URL}/client/workspace/${projectId}?view=board&milestone=${approvalMilestoneId}`,
        },
        {
          step: 3,
          actor: 'Freelancer',
          action: 'Request broker review after funding is locked',
          url: `${APP_BASE_URL}/freelancer/workspace/${projectId}?view=board&milestone=${approvalMilestoneId}`,
        },
        {
          step: 4,
          actor: 'Broker',
          action: 'Review a funded milestone and forward it to the client',
          url: `${APP_BASE_URL}/broker/workspace/${projectId}?view=board&milestone=${approvalMilestoneId}`,
        },
        {
          step: 5,
          actor: 'Client',
          action: 'Approve the broker-cleared milestone and release escrow',
          url: `${APP_BASE_URL}/client/workspace/${projectId}?view=board&milestone=${approvalMilestoneId}`,
        },
        {
          step: 6,
          actor: 'Client',
          action: 'Use Full flow practice B as a clean backup run without reseeding',
          url: `${APP_BASE_URL}/client/workspace/${clientApprovalProjectId}?view=board&milestone=${clientApprovalMilestoneId}`,
        },
        {
          step: 7,
          actor: 'Client',
          action: 'Use Full flow practice C as a third clean rehearsal',
          url: `${APP_BASE_URL}/client/workspace/${fullFlowCProjectId}?view=board&milestone=${fullFlowCMilestoneId}`,
        },
        {
          step: 8,
          actor: 'Client',
          action: 'Use Full flow practice D as a fourth clean rehearsal',
          url: `${APP_BASE_URL}/client/workspace/${fullFlowDProjectId}?view=board&milestone=${fullFlowDMilestoneId}`,
        },
        {
          step: 9,
          actor: 'Broker',
          action: 'Practice cashout history and request flow',
          url: `${APP_BASE_URL}/broker/billing`,
        },
        {
          step: 10,
          actor: 'Client',
          action: 'Fund the cancel practice milestone, then cancel and refund it from the contract page',
          url: `${APP_BASE_URL}/client/contracts/${cancelContractId}`,
        },
        {
          step: 11,
          actor: 'Client',
          action: 'Repeat the cancel-and-refund rehearsal with the backup contract',
          url: `${APP_BASE_URL}/client/contracts/${cancelBackupContractId}`,
        },
      ],
    },
  };
}

async function seedPaymentDemo() {
  const client = buildPgClient();
  await client.connect();
  const now = new Date();

  try {
    await client.query('BEGIN');

    const users = {
      staff: await ensureUser(client, 'staff', 'STAFF', 'Payment Demo Staff', now),
      client: await ensureUser(client, 'client', 'CLIENT', 'Payment Demo Client', now),
      freelancer: await ensureUser(client, 'freelancer', 'FREELANCER', 'Payment Demo Freelancer', now),
      broker: await ensureUser(client, 'broker', 'BROKER', 'Payment Demo Broker', now),
    };

    await ensureProfile(client, 'staff', users.staff, now);
    await ensureProfile(client, 'client', users.client, now);
    await ensureProfile(client, 'freelancer', users.freelancer, now);
    await ensureProfile(client, 'broker', users.broker, now);

    const wallets = {
      staff: await ensureWallet(client, 'staff', users.staff.id, now),
      client: await ensureWallet(client, 'client', users.client.id, now),
      freelancer: await ensureWallet(client, 'freelancer', users.freelancer.id, now),
      broker: await ensureWallet(client, 'broker', users.broker.id, now),
    };

    const demo = buildDemoFixture(users, wallets, now);
    await resetDemoData(client, demo);
    await ensureKycApproved(client, 'client', users.client, users.staff.id, now);
    await ensureKycApproved(client, 'broker', users.broker, users.staff.id, now);
    await ensureKycApproved(client, 'freelancer', users.freelancer, users.staff.id, now);

    for (const project of demo.projects) {
      await upsertRow(client, 'projects', project, ['id', 'createdAt']);
    }
    for (const milestone of demo.milestones) {
      await upsertRow(client, 'milestones', milestone, ['id', 'createdAt']);
    }
    for (const task of demo.tasks) {
      await upsertRow(client, 'tasks', task, ['id', 'createdAt']);
    }
    for (const contract of demo.contracts) {
      await upsertRow(client, 'contracts', contract, ['id', 'createdAt']);
    }
    for (const escrow of demo.escrows) {
      await upsertRow(client, 'escrows', escrow, ['id', 'createdAt']);
    }
    for (const method of demo.paymentMethods) {
      await upsertRow(client, 'payment_methods', method, ['id', 'createdAt']);
    }
    for (const payoutMethod of demo.payoutMethods) {
      await upsertRow(client, 'payout_methods', payoutMethod, ['id', 'createdAt']);
    }
    for (const fundingIntent of demo.fundingIntents) {
      await upsertRow(client, 'funding_intents', fundingIntent, ['id', 'createdAt']);
    }
    for (const transaction of demo.transactions) {
      await upsertRow(client, 'transactions', transaction, ['id', 'createdAt']);
    }
    for (const payoutRequest of demo.payoutRequests) {
      await upsertRow(client, 'payout_requests', payoutRequest, ['id', 'requestedAt']);
    }
    await upsertRow(client, 'wallets', demo.walletSnapshots.client, ['id', 'createdAt']);
    await upsertRow(client, 'wallets', demo.walletSnapshots.freelancer, ['id', 'createdAt']);
    await upsertRow(client, 'wallets', demo.walletSnapshots.broker, ['id', 'createdAt']);
    await upsertRow(client, 'wallets', demo.walletSnapshots.staff, ['id', 'createdAt']);

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          seedKey: SEED_KEY,
          projectIds: Object.fromEntries(
            demo.projects.map((project) => [project.title, project.id]),
          ),
          contractIds: Object.fromEntries(
            demo.contracts.map((contract) => [contract.title, contract.id]),
          ),
          milestoneIds: {
            paypalFunding: demo.milestones[0].id,
            approvalReady: demo.milestones[1].id,
            clientApprovalReady: demo.milestones.find((milestone) => milestone.id === sid('milestone:client-approval-ready'))?.id,
            cancelRefundReady: demo.milestones.find((milestone) => milestone.id === sid('milestone:cancel-funded'))?.id,
          },
          credentials: {
            client: { email: EMAILS.client, password: PASSWORD },
            broker: { email: EMAILS.broker, password: PASSWORD },
            freelancer: { email: EMAILS.freelancer, password: PASSWORD },
            staff: { email: EMAILS.staff, password: PASSWORD },
          },
          urls: demo.urls,
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

seedPaymentDemo().catch((error) => {
  console.error('Failed to seed payment demo fixtures');
  console.error(error);
  process.exit(1);
});
