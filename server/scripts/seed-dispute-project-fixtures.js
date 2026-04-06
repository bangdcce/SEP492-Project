require('dotenv').config();
const { Client } = require('pg');
const { v5: uuidv5 } = require('uuid');
const { resolveDatabaseRuntimeConfig } = require('../dist/config/database-runtime.config');
const crypto = require('crypto');

const SEED_KEY = 'codex-dispute-project-fixtures-v1';
const UUID_NAMESPACE = '4ca389c4-fd3d-4cdd-b525-7048ac391f7a';
const EMAILS = {
  staff: process.env.SHOWCASE_STAFF_EMAIL || 'staff.test.new@example.com',
  client: process.env.SHOWCASE_CLIENT_EMAIL || 'client.test.new@example.com',
  freelancer:
    process.env.SHOWCASE_FREELANCER_EMAIL || 'freelancer.test.new@example.com',
  broker: process.env.SHOWCASE_BROKER_EMAIL || 'broker.test.new@example.com',
};

const runtime = resolveDatabaseRuntimeConfig(process.env);

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

function roundUpToFiveMinutes(date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const stepMs = 5 * 60_000;
  return new Date(Math.ceil(rounded.getTime() / stepMs) * stepMs);
}

function money(value) {
  return Number(value.toFixed(2));
}

function disputeCode(id) {
  return `DSP-${id.slice(0, 8).toUpperCase()}`;
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function meetingLink(key, hearingNumber) {
  return `https://meet.google.com/interdev-${key}-${hearingNumber}`;
}

function quoteColumn(column) {
  return `"${column}"`;
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

async function getUsers(client) {
  const result = await client.query(
    `select id, email, role, "fullName" from users where email = any($1::text[])`,
    [Object.values(EMAILS)],
  );
  const byEmail = new Map(result.rows.map((row) => [row.email, row]));
  const users = {
    staff: byEmail.get(EMAILS.staff),
    client: byEmail.get(EMAILS.client),
    freelancer: byEmail.get(EMAILS.freelancer),
    broker: byEmail.get(EMAILS.broker),
  };

  for (const [key, value] of Object.entries(users)) {
    if (!value) {
      throw new Error(`Missing required account for ${key}`);
    }
  }

  return users;
}

async function getWallets(client, users) {
  const result = await client.query(
    `select * from wallets where "userId" = any($1::uuid[])`,
    [[users.client.id, users.freelancer.id, users.broker.id]],
  );
  const byUserId = new Map(result.rows.map((row) => [row.userId, row]));

  const defaults = [
    ['client', users.client.id],
    ['freelancer', users.freelancer.id],
    ['broker', users.broker.id],
  ];

  for (const [key, userId] of defaults) {
    if (!byUserId.has(userId)) {
      const wallet = {
        id: sid(`wallet:${key}`),
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
      };
      await upsertRow(client, 'wallets', wallet, ['id', 'createdAt']);
      byUserId.set(userId, wallet);
    }
  }

  return {
    client: byUserId.get(users.client.id),
    freelancer: byUserId.get(users.freelancer.id),
    broker: byUserId.get(users.broker.id),
  };
}

function buildScenarios(baseStart) {
  return [
    {
      key: 'erp-quality',
      title: '[SEED] ERP Inventory Reconciliation Rollout',
      description: 'Warehouse ERP rollout with reconciliation dashboard, approval logs, and nightly stock sync across regional branches.',
      projectStatus: 'DISPUTED',
      totalBudget: 1800,
      projectStartOffsetDays: -18,
      projectEndOffsetDays: 22,
      disputedMilestoneKey: 'sync-engine',
      milestones: [
        {
          key: 'discovery',
          title: 'Discovery and acceptance baselines',
          description: 'Align warehouse logic, variance thresholds, and reconciliation edge cases.',
          amount: 700,
          status: 'COMPLETED',
          deliverableType: 'API_DOCS',
          startOffsetDays: -18,
          dueOffsetDays: -12,
          acceptanceCriteria: ['Variance rules approved', 'Warehouse event matrix approved', 'API contract delivered'],
          proofOfWork: 'https://github.com/interdev-seed/erp-quality/discovery-docs',
          videoDemoUrl: 'https://youtu.be/interdev-erp-discovery',
        },
        {
          key: 'sync-engine',
          title: 'Reconciliation engine and approval screen',
          description: 'Deliver nightly reconciliation, discrepancy alerts, and approval workflow for warehouse supervisors.',
          amount: 1100,
          status: 'IN_PROGRESS',
          deliverableType: 'SOURCE_CODE',
          startOffsetDays: -11,
          dueOffsetDays: 7,
          retentionAmount: 110,
          acceptanceCriteria: ['Nightly sync matches warehouse totals', 'Discrepancy list supports drilldown', 'Supervisor approvals persist audit trail'],
        },
      ],
      dispute: {
        raisedBy: 'client',
        raiserRole: 'CLIENT',
        defendant: 'freelancer',
        defendantRole: 'FREELANCER',
        type: 'CLIENT_VS_FREELANCER',
        category: 'QUALITY',
        priority: 'HIGH',
        amount: 1100,
        reason: 'Client reports that the delivered reconciliation engine diverges from the accepted warehouse transfer logic.',
        summaryMessage: 'Mismatch between delivered reconciliation output and approved warehouse logic.',
        status: 'IN_MEDIATION',
        result: 'PENDING',
        phase: 'EVIDENCE_SUBMISSION',
        createdOffsetHours: -36,
        responseDeadlineHours: 48,
        resolutionDeadlineHours: 168,
        defendantResponse: 'Freelancer states the latest transfer rules changed after delivery and were not reflected in the accepted checklist.',
        defendantRespondedOffsetHours: -24,
        observer: 'broker',
        evidences: [
          { key: 'client-variance', uploader: 'client', uploaderRole: 'CLIENT', fileName: 'branch-variance-report.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', description: 'Variance report showing mismatched branch totals.' },
          { key: 'freelancer-commit', uploader: 'freelancer', uploaderRole: 'FREELANCER', fileName: 'sync-engine-release-notes.pdf', mimeType: 'application/pdf', description: 'Release note explaining the implemented ruleset.' },
        ],
        chat: [
          { key: 'client-opening', sender: 'client', senderRole: 'CLIENT', type: 'TEXT', content: 'The delivered totals do not match the acceptance spreadsheet we approved.', offsetHours: -35 },
          { key: 'freelancer-response', sender: 'freelancer', senderRole: 'FREELANCER', type: 'TEXT', content: 'I implemented the rules from the broker handoff package.', offsetHours: -24 },
          { key: 'staff-assigned', sender: 'staff', senderRole: 'STAFF', type: 'SYSTEM_LOG', content: 'Staff moderator assigned hearing preparation and evidence intake.', offsetHours: -20 },
        ],
      },
      hearings: [
        {
          number: 1,
          status: 'SCHEDULED',
          tier: 'TIER_1',
          eventStatus: 'SCHEDULED',
          scheduledAt: baseStart,
          agenda: 'Review branch variance evidence and confirm the accepted reconciliation logic.',
          estimatedDurationMinutes: 90,
          externalMeetingLink: meetingLink('erp-quality', 1),
          moderatorConfirmed: true,
          raiserConfirmed: false,
          defendantConfirmed: false,
          observerConfirmed: true,
        },
      ],
    },
    {
      key: 'payment-release',
      title: '[SEED] Escrow Release API Hardening',
      description: 'Backend project to harden escrow release APIs, payout ledger events, and milestone acceptance callbacks.',
      projectStatus: 'DISPUTED',
      totalBudget: 2200,
      projectStartOffsetDays: -14,
      projectEndOffsetDays: 18,
      disputedMilestoneKey: 'release-flow',
      milestones: [
        {
          key: 'spec-alignment',
          title: 'Escrow state map and endpoint contract',
          description: 'Finalize escrow state machine and webhook acceptance contract.',
          amount: 900,
          status: 'COMPLETED',
          deliverableType: 'API_DOCS',
          startOffsetDays: -14,
          dueOffsetDays: -10,
          acceptanceCriteria: ['Escrow status diagram approved', 'Webhook retry contract documented', 'Release approval states mapped to UI'],
          proofOfWork: 'https://github.com/interdev-seed/payment-release/api-contracts',
        },
        {
          key: 'release-flow',
          title: 'Milestone submission and payout release flow',
          description: 'Implement payout release APIs, idempotency handling, and settlement fallback messaging.',
          amount: 1300,
          status: 'SUBMITTED',
          deliverableType: 'SOURCE_CODE',
          startOffsetDays: -9,
          dueOffsetDays: 3,
          retentionAmount: 130,
          acceptanceCriteria: ['Release endpoint supports idempotent retries', 'Escrow ledger rows are auditable', 'Client approval UI reflects payout state changes in real time'],
          proofOfWork: 'https://github.com/interdev-seed/payment-release/release-service',
          videoDemoUrl: 'https://youtu.be/interdev-payment-release',
          submittedAtOffsetHours: -14,
        },
      ],
      dispute: {
        raisedBy: 'freelancer',
        raiserRole: 'FREELANCER',
        defendant: 'client',
        defendantRole: 'CLIENT',
        type: 'FREELANCER_VS_CLIENT',
        category: 'PAYMENT',
        priority: 'HIGH',
        amount: 1300,
        reason: 'Freelancer claims the client is withholding approval despite the agreed payout release flow being delivered.',
        summaryMessage: 'Milestone submitted but escrow release is blocked by client approval dispute.',
        status: 'IN_MEDIATION',
        result: 'PENDING',
        phase: 'CROSS_EXAMINATION',
        createdOffsetHours: -30,
        responseDeadlineHours: 36,
        resolutionDeadlineHours: 144,
        defendantResponse: 'Client claims the real-time payout history screen still misses broker commission rows in one scenario.',
        defendantRespondedOffsetHours: -10,
        observer: 'broker',
        evidences: [
          { key: 'submission-video', uploader: 'freelancer', uploaderRole: 'FREELANCER', fileName: 'release-flow-demo.mp4', mimeType: 'video/mp4', description: 'Walkthrough of milestone submission and payout release flow.' },
          { key: 'client-bug-note', uploader: 'client', uploaderRole: 'CLIENT', fileName: 'missing-broker-commission.png', mimeType: 'image/png', description: 'Screenshot showing missing broker commission line item.' },
        ],
        chat: [
          { key: 'freelancer-open', sender: 'freelancer', senderRole: 'FREELANCER', type: 'TEXT', content: 'The payout workflow passes all agreed acceptance criteria and the client has had the build without approval.', offsetHours: -28 },
          { key: 'client-reply', sender: 'client', senderRole: 'CLIENT', type: 'TEXT', content: 'The commission ledger still misses one broker share case on my review screen.', offsetHours: -9 },
        ],
      },
      hearings: [
        {
          number: 1,
          status: 'SCHEDULED',
          tier: 'TIER_1',
          eventStatus: 'PENDING_CONFIRMATION',
          scheduledAt: addMinutes(baseStart, 15),
          agenda: 'Validate submitted payout deliverables and isolate whether the missing broker line item is a blocker or only a reporting defect.',
          estimatedDurationMinutes: 75,
          externalMeetingLink: meetingLink('payment-release', 1),
          moderatorConfirmed: true,
          raiserConfirmed: true,
          defendantConfirmed: false,
          observerConfirmed: true,
        },
      ],
    },
    {
      key: 'broker-handoff',
      title: '[SEED] Multi-tenant CRM Handoff Coordination',
      description: 'CRM dashboard expansion with broker-led scoping, workflow mapping, and stakeholder handoff management.',
      projectStatus: 'DISPUTED',
      totalBudget: 1600,
      projectStartOffsetDays: -16,
      projectEndOffsetDays: 28,
      disputedMilestoneKey: 'handoff-package',
      milestones: [
        {
          key: 'discovery',
          title: 'Sales workflow mapping',
          description: 'Map sales pipeline, handoff states, and reporting filters for the CRM dashboard.',
          amount: 600,
          status: 'COMPLETED',
          deliverableType: 'DESIGN_PROTOTYPE',
          startOffsetDays: -16,
          dueOffsetDays: -11,
          acceptanceCriteria: ['Pipeline states documented', 'Role matrix approved', 'Dashboard prototype delivered'],
          proofOfWork: 'https://figma.com/interdev-seed/crm-handoff-prototype',
        },
        {
          key: 'handoff-package',
          title: 'Broker handoff and execution package',
          description: 'Broker assembles the signed-off execution package, change log, and acceptance baseline.',
          amount: 1000,
          status: 'IN_PROGRESS',
          deliverableType: 'SYS_OPERATION_DOCS',
          startOffsetDays: -10,
          dueOffsetDays: 10,
          acceptanceCriteria: ['Change log signed by client', 'Execution package versioned', 'Freelancer receives final priorities'],
        },
      ],
      dispute: {
        raisedBy: 'client',
        raiserRole: 'CLIENT',
        defendant: 'broker',
        defendantRole: 'BROKER',
        type: 'CLIENT_VS_BROKER',
        category: 'CONTRACT',
        priority: 'MEDIUM',
        amount: 1000,
        reason: 'Client claims the broker changed scope priorities without written approval and caused downstream execution risk.',
        summaryMessage: 'Client disputes the broker handoff package and scope authorization chain.',
        status: 'IN_MEDIATION',
        result: 'PENDING',
        phase: 'PRESENTATION',
        createdOffsetHours: -22,
        responseDeadlineHours: 36,
        resolutionDeadlineHours: 120,
        defendantResponse: 'Broker states the priority changes were communicated in workshop notes and reflected in the latest execution pack.',
        defendantRespondedOffsetHours: -12,
        observer: 'freelancer',
        evidences: [
          { key: 'client-scope-mail', uploader: 'client', uploaderRole: 'CLIENT', fileName: 'scope-approval-thread.pdf', mimeType: 'application/pdf', description: 'Email thread showing the last formally approved scope version.' },
          { key: 'broker-handoff-pack', uploader: 'broker', uploaderRole: 'BROKER', fileName: 'handoff-package-v3.pdf', mimeType: 'application/pdf', description: 'Broker handoff package cited as the active execution baseline.' },
        ],
        chat: [
          { key: 'client-filed', sender: 'client', senderRole: 'CLIENT', type: 'TEXT', content: 'The broker moved lead qualification changes into scope without the written approval chain we agreed in contract.', offsetHours: -21 },
          { key: 'broker-reply', sender: 'broker', senderRole: 'BROKER', type: 'TEXT', content: 'Those changes were discussed in the workshop and reflected in the handoff package shared to both client and freelancer.', offsetHours: -11 },
        ],
      },
      hearings: [
        {
          number: 1,
          status: 'SCHEDULED',
          tier: 'TIER_1',
          eventStatus: 'SCHEDULED',
          scheduledAt: addMinutes(baseStart, 30),
          agenda: 'Compare formal scope approvals against the broker handoff package and determine whether authorization was exceeded.',
          estimatedDurationMinutes: 60,
          externalMeetingLink: meetingLink('broker-handoff', 1),
          moderatorConfirmed: true,
          raiserConfirmed: true,
          defendantConfirmed: true,
          observerConfirmed: true,
        },
      ],
    },
    {
      key: 'resolved-deadline',
      title: '[SEED] Marketing Landing Page Delivery Audit',
      description: 'Landing page project with copywriting, analytics events, and responsive QA delivered on a fixed deadline.',
      projectStatus: 'COMPLETED',
      totalBudget: 1400,
      projectStartOffsetDays: -25,
      projectEndOffsetDays: -2,
      disputedMilestoneKey: 'delivery',
      milestones: [
        {
          key: 'design',
          title: 'Creative direction and wireframes',
          description: 'Create responsive landing page wireframes and analytics event map.',
          amount: 500,
          status: 'COMPLETED',
          deliverableType: 'DESIGN_PROTOTYPE',
          startOffsetDays: -25,
          dueOffsetDays: -18,
          acceptanceCriteria: ['Hero and CTA variants approved', 'Tracking event matrix documented', 'Responsive layouts approved'],
          proofOfWork: 'https://figma.com/interdev-seed/landing-audit-design',
        },
        {
          key: 'delivery',
          title: 'Implementation and analytics delivery',
          description: 'Build the landing page, wire tracking events, and hand over deployment assets.',
          amount: 900,
          status: 'COMPLETED',
          deliverableType: 'DEPLOYMENT',
          startOffsetDays: -17,
          dueOffsetDays: -5,
          acceptanceCriteria: ['Tracking events validated', 'Responsive QA completed', 'Deployment package delivered before freeze'],
          proofOfWork: 'https://demo.interdev.local/landing-audit',
          videoDemoUrl: 'https://youtu.be/interdev-landing-audit',
          submittedAtOffsetHours: -120,
          feedback: 'Launch delay caused by the late analytics patch.',
        },
      ],
      dispute: {
        raisedBy: 'client',
        raiserRole: 'CLIENT',
        defendant: 'freelancer',
        defendantRole: 'FREELANCER',
        type: 'CLIENT_VS_FREELANCER',
        category: 'DEADLINE',
        priority: 'MEDIUM',
        amount: 900,
        reason: 'Client alleges the final analytics patch missed the agreed launch freeze and caused campaign reporting issues.',
        summaryMessage: 'Closed dispute with staff verdict and active appeal window for user testing.',
        status: 'RESOLVED',
        result: 'WIN_CLIENT',
        phase: 'DELIBERATION',
        createdOffsetHours: -84,
        responseDeadlineHours: -36,
        resolutionDeadlineHours: -6,
        defendantResponse: 'Freelancer states the analytics credential handoff from the client arrived late and impacted deployment timing.',
        defendantRespondedOffsetHours: -72,
        adminComment: 'Evidence shows the agreed launch-freeze date was missed and the analytics patch was not fully validated before handover.',
        resolvedOffsetHours: -10,
        appealDeadlineHours: 48,
        observer: 'broker',
        evidences: [
          { key: 'launch-calendar', uploader: 'client', uploaderRole: 'CLIENT', fileName: 'campaign-launch-calendar.pdf', mimeType: 'application/pdf', description: 'Approved launch calendar showing the tracking freeze deadline.' },
          { key: 'handoff-log', uploader: 'freelancer', uploaderRole: 'FREELANCER', fileName: 'analytics-handoff-log.txt', mimeType: 'text/plain', description: 'Freelancer handoff log for analytics credentials and deployment patch.' },
        ],
        chat: [
          { key: 'client-complaint', sender: 'client', senderRole: 'CLIENT', type: 'TEXT', content: 'The marketing campaign launched before the analytics patch was validated, which broke reporting on day one.', offsetHours: -83 },
          { key: 'freelancer-context', sender: 'freelancer', senderRole: 'FREELANCER', type: 'TEXT', content: 'Credentials for the analytics property arrived late, so the patch had to be finalized closer to launch than planned.', offsetHours: -72 },
          { key: 'staff-decision-log', sender: 'staff', senderRole: 'STAFF', type: 'ADMIN_ANNOUNCEMENT', content: 'Staff decision recorded. Case is read-only except for the appeal path while the appeal window remains open.', offsetHours: -10 },
        ],
        verdict: {
          adjudicator: 'staff',
          adjudicatorRole: 'STAFF',
          faultType: 'DEADLINE_MISSED',
          faultyParty: 'defendant',
          amountToFreelancer: 180,
          amountToClient: 720,
          platformFee: 0,
          trustScorePenalty: 8,
          warningMessage: 'Future launch-sensitive deliverables must include explicit blocker escalation before the freeze date.',
          issuedOffsetHours: -10,
          reasoning: {
            violatedPolicies: ['delivery.deadline_commitment', 'evidence.timely_handoff_notice'],
            policyReferences: ['InterDev Rulebook 4.2 Delivery against agreed milestone dates', 'InterDev Rulebook 7.1 Duty to escalate blocker dependencies promptly'],
            legalReferences: ['Vietnam Law on Electronic Transactions 2023, Articles 8-11', 'Vietnam Civil Procedure Code 2015, Articles 93-95'],
            contractReferences: ['Contract Section 3.2 Launch freeze and validation deadline', 'Contract Section 5.4 Dependency escalation obligations'],
            evidenceReferences: ['campaign-launch-calendar.pdf', 'analytics-handoff-log.txt'],
            factualFindings: 'The agreed launch-freeze date passed before the final analytics patch was fully validated, and no timely dependency escalation was recorded.',
            legalAnalysis: 'The record supports platform-level accountability for missing the agreed delivery window and failing to preserve a contemporaneous escalation trail.',
            analysis: 'Although the client contributed late credentials, the freelancer still accepted the freeze date without generating an adequate escalation record.',
            conclusion: 'Client prevails on the missed launch-freeze issue. A reduced payment to freelancer is preserved to reflect partial delivery value.',
            remedyRationale: 'The client receives the majority of the disputed escrow because the missed deadline undermined the launch objective, while the freelancer retains a partial amount for completed work.',
            trustPenaltyRationale: 'A modest trust penalty applies because the delivery failure was significant but not fraudulent.',
          },
        },
      },
      hearings: [
        {
          number: 1,
          status: 'COMPLETED',
          tier: 'TIER_1',
          eventStatus: 'COMPLETED',
          scheduledAt: addHours(baseStart, -28),
          startedAt: addHours(baseStart, -27.9),
          endedAt: addHours(baseStart, -27),
          agenda: 'Review launch-freeze date, analytics credential handoff timing, and whether missed delivery materially impacted campaign readiness.',
          summary: 'Hearing closed with documented launch-freeze breach and insufficient dependency escalation trail.',
          findings: 'Client demonstrated the freeze date and broken reporting impact. Freelancer established partial completion but not a timely escalation trail.',
          estimatedDurationMinutes: 65,
          externalMeetingLink: meetingLink('resolved-deadline', 1),
          moderatorConfirmed: true,
          raiserConfirmed: true,
          defendantConfirmed: true,
          observerConfirmed: true,
        },
      ],
    },
    {
      key: 'continued-hearing',
      title: '[SEED] Warehouse QR Rollout Continuation',
      description: 'Warehouse QR rollout covering scanner workflow, item exception handling, and broker-mediated rollout sequencing.',
      projectStatus: 'DISPUTED',
      totalBudget: 2100,
      projectStartOffsetDays: -20,
      projectEndOffsetDays: 30,
      disputedMilestoneKey: 'pilot-rollout',
      milestones: [
        {
          key: 'scanner-design',
          title: 'Scanner workflow specification',
          description: 'Define QR scanning flows, offline sync strategy, and exception handling for damaged stock.',
          amount: 800,
          status: 'COMPLETED',
          deliverableType: 'API_DOCS',
          startOffsetDays: -20,
          dueOffsetDays: -14,
          acceptanceCriteria: ['Offline sync rules approved', 'Exception state matrix documented', 'Warehouse supervisor acceptance list signed'],
          proofOfWork: 'https://github.com/interdev-seed/qr-rollout/specs',
        },
        {
          key: 'pilot-rollout',
          title: 'Pilot rollout and warehouse validation',
          description: 'Deploy pilot scanner workflow, validate warehouse runbooks, and capture operational defects.',
          amount: 1300,
          status: 'IN_PROGRESS',
          deliverableType: 'DEPLOYMENT',
          startOffsetDays: -13,
          dueOffsetDays: 12,
          retentionAmount: 130,
          acceptanceCriteria: ['Pilot branch scanners sync exceptions correctly', 'Supervisor can approve damaged-item handling', 'Runbook covers offline fallback behavior'],
        },
      ],
      dispute: {
        raisedBy: 'client',
        raiserRole: 'CLIENT',
        defendant: 'freelancer',
        defendantRole: 'FREELANCER',
        type: 'CLIENT_VS_FREELANCER',
        category: 'QUALITY',
        priority: 'HIGH',
        amount: 1300,
        reason: 'The warehouse pilot exposed conflicting scanner behavior for damaged-item exceptions, and the parties require a continuation hearing.',
        summaryMessage: 'Multi-hearing docket with hearing #1 archived and hearing #2 scheduled soon.',
        status: 'IN_MEDIATION',
        result: 'PENDING',
        phase: 'INTERROGATION',
        createdOffsetHours: -60,
        responseDeadlineHours: 24,
        resolutionDeadlineHours: 96,
        defendantResponse: 'Freelancer argues the damaged-item exception path was outside the signed pilot checklist and surfaced only during onsite testing.',
        defendantRespondedOffsetHours: -48,
        observer: 'broker',
        evidences: [
          { key: 'pilot-log', uploader: 'client', uploaderRole: 'CLIENT', fileName: 'pilot-exception-log.csv', mimeType: 'text/csv', description: 'CSV export of damaged-item exception runs recorded during pilot.' },
          { key: 'freelancer-runbook', uploader: 'freelancer', uploaderRole: 'FREELANCER', fileName: 'scanner-runbook.pdf', mimeType: 'application/pdf', description: 'Runbook delivered by freelancer for pilot warehouse operators.' },
        ],
        chat: [
          { key: 'client-open', sender: 'client', senderRole: 'CLIENT', type: 'TEXT', content: 'The damaged-item path triggered inconsistent scanner prompts during the pilot.', offsetHours: -58 },
          { key: 'freelancer-open', sender: 'freelancer', senderRole: 'FREELANCER', type: 'TEXT', content: 'The pilot checklist I received did not include the damaged-item branch as a required acceptance path.', offsetHours: -47 },
          { key: 'staff-continuation', sender: 'staff', senderRole: 'STAFF', type: 'SYSTEM_LOG', content: 'Hearing #1 closed with continuation instructions. Hearing #2 scheduled for focused interrogation.', offsetHours: -20 },
        ],
      },
      hearings: [
        {
          number: 1,
          status: 'COMPLETED',
          tier: 'TIER_1',
          eventStatus: 'COMPLETED',
          scheduledAt: addHours(baseStart, -24),
          startedAt: addHours(baseStart, -23.95),
          endedAt: addHours(baseStart, -23),
          agenda: 'Initial fact gathering on scanner exception behavior and the signed pilot acceptance checklist.',
          summary: 'Initial hearing confirmed that both parties rely on different versions of the damaged-item requirements.',
          findings: 'Further clarification is required from broker handoff records and warehouse acceptance notes before verdict.',
          pendingActions: ['Broker must provide the dated rollout handoff version.', 'Client must upload the signed damaged-item exception checklist, if any.'],
          estimatedDurationMinutes: 70,
          externalMeetingLink: meetingLink('continued-hearing', 1),
          moderatorConfirmed: true,
          raiserConfirmed: true,
          defendantConfirmed: true,
          observerConfirmed: true,
        },
        {
          number: 2,
          previousNumber: 1,
          status: 'SCHEDULED',
          tier: 'TIER_1',
          eventStatus: 'SCHEDULED',
          scheduledAt: addMinutes(baseStart, 60),
          agenda: 'Continuation hearing focused on broker handoff records, damaged-item requirements, and whether the pilot checklist was complete.',
          estimatedDurationMinutes: 90,
          externalMeetingLink: meetingLink('continued-hearing', 2),
          moderatorConfirmed: true,
          raiserConfirmed: false,
          defendantConfirmed: true,
          observerConfirmed: true,
        },
      ],
    },
  ];
}

function buildContract(projectTitle) {
  const terms = [
    `Seed pack: ${SEED_KEY}`,
    `Project: ${projectTitle}`,
    'This contract fixture is for dispute and hearing workflow verification.',
    'Milestone acceptance and escrow distribution follow the immutable snapshot below.',
  ].join('\n');

  return { terms, hash: hash(terms) };
}

function makeMilestoneRows(scenario, projectId, baseStart) {
  return scenario.milestones.map((item, index) => ({
    id: sid(`${scenario.key}:milestone:${item.key}`),
    projectId,
    title: item.title,
    description: item.description,
    amount: money(item.amount),
    deliverableType: item.deliverableType,
    retentionAmount: money(item.retentionAmount || 0),
    acceptanceCriteria: item.acceptanceCriteria,
    startDate: addDays(baseStart, item.startOffsetDays),
    dueDate: addDays(baseStart, item.dueOffsetDays),
    status: item.status,
    sortOrder: index + 1,
    proofOfWork: item.proofOfWork || null,
    videoDemoUrl: item.videoDemoUrl || null,
    submittedAt: typeof item.submittedAtOffsetHours === 'number' ? addHours(baseStart, item.submittedAtOffsetHours) : null,
    feedback: item.feedback || null,
  }));
}

async function seedScenario(client, scenario, users, wallets, baseStart) {
  const projectId = sid(`${scenario.key}:project`);
  const contractId = sid(`${scenario.key}:contract`);
  const disputeId = sid(`${scenario.key}:dispute`);
  const code = disputeCode(disputeId);
  const createdAt = addHours(baseStart, scenario.dispute.createdOffsetHours);
  const updatedAt =
    typeof scenario.dispute.resolvedOffsetHours === 'number'
      ? addHours(baseStart, scenario.dispute.resolvedOffsetHours)
      : addMinutes(baseStart, 5);
  const milestoneRows = makeMilestoneRows(scenario, projectId, baseStart);
  const disputedMilestone = milestoneRows.find((row) => row.id === sid(`${scenario.key}:milestone:${scenario.disputedMilestoneKey}`));
  if (!disputedMilestone) throw new Error(`Missing disputed milestone for ${scenario.key}`);

  const project = {
    id: projectId,
    requestId: null,
    clientId: users.client.id,
    brokerId: users.broker.id,
    freelancerId: users.freelancer.id,
    title: scenario.title,
    description: scenario.description,
    totalBudget: money(scenario.totalBudget),
    currency: 'USD',
    pricingModel: 'FIXED_PRICE',
    startDate: addDays(baseStart, scenario.projectStartOffsetDays),
    endDate: addDays(baseStart, scenario.projectEndOffsetDays),
    status: scenario.projectStatus,
    createdAt,
    updatedAt,
  };
  await upsertRow(client, 'projects', project, ['id']);

  for (const milestone of milestoneRows) {
    await upsertRow(client, 'milestones', milestone, ['id', 'createdAt']);
  }

  const contract = buildContract(scenario.title);
  await upsertRow(client, 'contracts', {
    id: contractId,
    projectId,
    sourceSpecId: null,
    title: `${scenario.title} - Dispute Test Contract`,
    contractUrl: `https://storage.interdev.local/contracts/${contractId}.pdf`,
    termsContent: contract.terms,
    contentHash: contract.hash,
    status: 'ACTIVATED',
    activatedAt: addHours(createdAt, 2),
    commercialContext: {
      sourceSpecId: null,
      sourceSpecUpdatedAt: null,
      requestId: null,
      projectTitle: scenario.title,
      clientId: users.client.id,
      brokerId: users.broker.id,
      freelancerId: users.freelancer.id,
      totalBudget: money(scenario.totalBudget),
      currency: 'USD',
      description: scenario.description,
      techStack: scenario.key === 'payment-release' ? 'NestJS, TypeScript, PostgreSQL, Redis' : 'React, Node.js, PostgreSQL',
      scopeNarrativePlainText: 'Fixture contract used to validate dispute lifecycle, hearing scheduling, and contract-linked dossier views.',
      features: milestoneRows.map((milestone, index) => ({
        title: `Feature ${index + 1}: ${milestone.title}`,
        description: milestone.description,
        complexity: index === milestoneRows.length - 1 ? 'HIGH' : 'MEDIUM',
        acceptanceCriteria: milestone.acceptanceCriteria,
      })),
      escrowSplit: { developerPercentage: 85, brokerPercentage: 10, platformPercentage: 5 },
    },
    milestoneSnapshot: milestoneRows.map((milestone, index) => ({
      contractMilestoneKey: `${scenario.key}-m${index + 1}`,
      sourceSpecMilestoneId: null,
      projectMilestoneId: milestone.id,
      title: milestone.title,
      description: milestone.description,
      amount: money(milestone.amount),
      startDate: milestone.startDate.toISOString(),
      dueDate: milestone.dueDate.toISOString(),
      sortOrder: milestone.sortOrder,
      deliverableType: milestone.deliverableType,
      retentionAmount: milestone.retentionAmount,
      acceptanceCriteria: milestone.acceptanceCriteria,
    })),
    createdBy: users.broker.id,
    createdAt,
  }, ['id']);

  await upsertRow(client, 'disputes', {
    id: disputeId,
    projectId,
    milestoneId: disputedMilestone.id,
    raisedById: users[scenario.dispute.raisedBy].id,
    raiserRole: scenario.dispute.raiserRole,
    defendantId: users[scenario.dispute.defendant].id,
    defendantRole: scenario.dispute.defendantRole,
    disputeType: scenario.dispute.type,
    category: scenario.dispute.category,
    priority: scenario.dispute.priority,
    disputedAmount: money(scenario.dispute.amount),
    reason: scenario.dispute.reason,
    messages: scenario.dispute.summaryMessage,
    evidence: scenario.dispute.evidences.map((item) => item.fileName),
    defendantResponse: scenario.dispute.defendantResponse || null,
    defendantEvidence: scenario.dispute.evidences.filter((item) => item.uploader === scenario.dispute.defendant).map((item) => item.fileName),
    defendantRespondedAt: typeof scenario.dispute.defendantRespondedOffsetHours === 'number' ? addHours(baseStart, scenario.dispute.defendantRespondedOffsetHours) : null,
    responseDeadline: addHours(baseStart, scenario.dispute.responseDeadlineHours),
    resolutionDeadline: addHours(baseStart, scenario.dispute.resolutionDeadlineHours),
    isOverdue: false,
    phase: scenario.dispute.phase,
    status: scenario.dispute.status,
    result: scenario.dispute.result,
    adminComment: scenario.dispute.adminComment || null,
    resolvedById: scenario.dispute.status === 'RESOLVED' ? users.staff.id : null,
    resolvedAt: typeof scenario.dispute.resolvedOffsetHours === 'number' ? addHours(baseStart, scenario.dispute.resolvedOffsetHours) : null,
    rejectionAppealReason: null,
    rejectionAppealedAt: null,
    rejectionAppealResolvedById: null,
    rejectionAppealResolution: null,
    rejectionAppealResolvedAt: null,
    parentDisputeId: null,
    groupId: null,
    assignedStaffId: users.staff.id,
    assignedAt: addHours(createdAt, 1),
    currentTier: 1,
    escalatedToAdminId: null,
    escalatedAt: null,
    escalationReason: null,
    acceptedSettlementId: null,
    isAutoResolved: false,
    settlementAttempts: 0,
    isAppealed: false,
    appealReason: null,
    appealedAt: null,
    appealDeadline: typeof scenario.dispute.appealDeadlineHours === 'number' ? addHours(addHours(baseStart, scenario.dispute.resolvedOffsetHours), scenario.dispute.appealDeadlineHours) : null,
    appealResolvedById: null,
    appealResolution: null,
    appealResolvedAt: null,
    createdAt,
    updatedAt,
  }, ['id']);

  await upsertRow(client, 'escrows', {
    id: sid(`${scenario.key}:escrow`),
    projectId,
    milestoneId: disputedMilestone.id,
    totalAmount: money(scenario.dispute.amount),
    fundedAmount: money(scenario.dispute.amount),
    releasedAmount: scenario.dispute.verdict ? money(scenario.dispute.verdict.amountToFreelancer) : 0,
    developerShare: money(scenario.dispute.amount * 0.85),
    brokerShare: money(scenario.dispute.amount * 0.10),
    platformFee: money(scenario.dispute.amount * 0.05),
    developerPercentage: 85,
    brokerPercentage: 10,
    platformPercentage: 5,
    currency: 'USD',
    status: scenario.dispute.status === 'RESOLVED' ? 'REFUNDED' : 'DISPUTED',
    fundedAt: addHours(createdAt, -24),
    releasedAt: null,
    refundedAt: scenario.dispute.status === 'RESOLVED' ? addHours(baseStart, scenario.dispute.resolvedOffsetHours) : null,
    clientApproved: false,
    clientApprovedAt: null,
    clientWalletId: wallets.client.id,
    developerWalletId: wallets.freelancer.id,
    brokerWalletId: wallets.broker.id,
    holdTransactionId: null,
    releaseTransactionIds: null,
    refundTransactionId: null,
    disputeId,
    notes: `Seeded by ${SEED_KEY} for dispute workflow testing.`,
  }, ['id', 'createdAt']);

  const activities = [
    { id: sid(`${scenario.key}:activity:created`), action: 'CREATED', actorId: users[scenario.dispute.raisedBy].id, actorRole: scenario.dispute.raiserRole, description: 'Dispute filed from seeded project pack.', metadata: { seedKey: SEED_KEY, scenario: scenario.key, disputeCode: code }, isInternal: false, timestamp: createdAt },
    { id: sid(`${scenario.key}:activity:assigned`), action: 'ASSIGNED', actorId: users.staff.id, actorRole: 'STAFF', description: 'Staff moderator assigned to seeded dispute.', metadata: { assignedStaffId: users.staff.id, seedKey: SEED_KEY }, isInternal: true, timestamp: addHours(createdAt, 1) },
    scenario.dispute.status === 'RESOLVED'
      ? { id: sid(`${scenario.key}:activity:resolved`), action: 'RESOLVED', actorId: users.staff.id, actorRole: 'STAFF', description: 'Seeded verdict issued and case closed for read-only testing.', metadata: { result: scenario.dispute.result, seedKey: SEED_KEY }, isInternal: false, timestamp: addHours(baseStart, scenario.dispute.resolvedOffsetHours) }
      : { id: sid(`${scenario.key}:activity:review-accepted`), action: 'REVIEW_ACCEPTED', actorId: users.staff.id, actorRole: 'STAFF', description: 'Seeded case accepted into hearing workflow.', metadata: { phase: scenario.dispute.phase, seedKey: SEED_KEY }, isInternal: false, timestamp: addHours(createdAt, 6) },
  ];
  for (const activity of activities) {
    await upsertRow(client, 'dispute_activities', { disputeId, ...activity }, ['id', 'timestamp']);
  }

  for (const evidence of scenario.dispute.evidences) {
    await upsertRow(client, 'dispute_evidences', {
      id: sid(`${scenario.key}:evidence:${evidence.key}`),
      disputeId,
      uploaderId: users[evidence.uploader].id,
      uploaderRole: evidence.uploaderRole,
      storagePath: `seed/${SEED_KEY}/${scenario.key}/${evidence.fileName}`,
      fileName: evidence.fileName,
      fileSize: 256000,
      mimeType: evidence.mimeType,
      description: evidence.description,
      fileHash: hash(`${scenario.key}:${evidence.fileName}`),
      isFlagged: false,
      flagReason: null,
      flaggedById: null,
      flaggedAt: null,
      uploadedAt: addHours(createdAt, 2),
    }, ['id', 'uploadedAt']);
  }

  for (const message of scenario.dispute.chat) {
    await upsertRow(client, 'dispute_messages', {
      id: sid(`${scenario.key}:message:${message.key}`),
      disputeId,
      senderId: message.sender === 'SYSTEM' ? null : users[message.sender].id,
      senderRole: message.senderRole,
      type: message.type,
      content: message.content,
      replyToMessageId: null,
      relatedEvidenceId: null,
      attached_evidence_ids: null,
      hearingId: null,
      metadata: { seedKey: SEED_KEY, scenario: scenario.key },
      isHidden: false,
      hiddenReason: null,
      hiddenById: null,
      hiddenAt: null,
      createdAt: addHours(baseStart, message.offsetHours),
    }, ['id', 'createdAt']);
  }

  const hearingIds = new Map();
  for (const hearing of scenario.hearings) {
    const hearingId = sid(`${scenario.key}:hearing:${hearing.number}`);
    hearingIds.set(hearing.number, hearingId);
  }

  for (const hearing of scenario.hearings) {
    const hearingId = hearingIds.get(hearing.number);
    const observerKey = scenario.dispute.observer || null;
    const observerUser = observerKey ? users[observerKey] : null;

    await upsertRow(client, 'dispute_hearings', {
      id: hearingId,
      disputeId,
      status: hearing.status,
      scheduledAt: hearing.scheduledAt,
      startedAt: hearing.startedAt || null,
      endedAt: hearing.endedAt || null,
      agenda: hearing.agenda,
      externalMeetingLink: hearing.externalMeetingLink || meetingLink(scenario.key, hearing.number),
      requiredDocuments: ['Signed contract snapshot', 'Latest milestone acceptance criteria', 'Dispute evidence package'],
      moderatorId: users.staff.id,
      currentSpeakerRole: 'MUTED_ALL',
      tier: hearing.tier,
      isChatRoomActive: hearing.status === 'IN_PROGRESS',
      isEvidenceIntakeOpen: hearing.status !== 'COMPLETED',
      pausedAt: null,
      pausedById: null,
      pauseReason: null,
      accumulatedPauseSeconds: 0,
      speakerRoleBeforePause: null,
      evidenceIntakeOpenedAt: null,
      evidenceIntakeClosedAt: null,
      evidenceIntakeOpenedBy: null,
      evidenceIntakeReason: null,
      estimatedDurationMinutes: hearing.estimatedDurationMinutes,
      rescheduleCount: hearing.previousNumber ? 1 : 0,
      previousHearingId: hearing.previousNumber ? hearingIds.get(hearing.previousNumber) : null,
      lastRescheduledAt: hearing.previousNumber ? addHours(hearing.scheduledAt, -6) : null,
      summary: hearing.summary || null,
      findings: hearing.findings || null,
      pendingActions: hearing.pendingActions || null,
      noShowNote: hearing.noShowNote || null,
      hearingNumber: hearing.number,
      createdAt: addHours(createdAt, hearing.number),
      updatedAt,
    }, ['id']);

    const hearingParticipants = [
      { key: 'moderator', userId: users.staff.id, role: 'MODERATOR', confirmed: hearing.moderatorConfirmed !== false, required: true },
      { key: 'raiser', userId: users[scenario.dispute.raisedBy].id, role: 'RAISER', confirmed: hearing.raiserConfirmed === true, required: true },
      { key: 'defendant', userId: users[scenario.dispute.defendant].id, role: 'DEFENDANT', confirmed: hearing.defendantConfirmed === true, required: true },
    ];
    if (observerUser) hearingParticipants.push({ key: 'observer', userId: observerUser.id, role: 'OBSERVER', confirmed: hearing.observerConfirmed !== false, required: false });

    for (const participant of hearingParticipants) {
      await upsertRow(client, 'hearing_participants', {
        id: sid(`${scenario.key}:hearing:${hearing.number}:participant:${participant.key}`),
        hearingId,
        userId: participant.userId,
        role: participant.role,
        invitedAt: addHours(hearing.scheduledAt, -24),
        confirmedAt: participant.confirmed ? addHours(hearing.scheduledAt, -4) : null,
        joinedAt: hearing.startedAt || null,
        leftAt: hearing.endedAt || null,
        isOnline: false,
        lastOnlineAt: hearing.endedAt || hearing.startedAt || null,
        totalOnlineMinutes: hearing.status === 'COMPLETED' ? Math.max(hearing.estimatedDurationMinutes - 5, 0) : 0,
        hasSubmittedStatement: false,
        isRequired: participant.required,
        responseDeadline: addHours(hearing.scheduledAt, -2),
        declineReason: null,
      }, ['id', 'createdAt']);
    }

    const eventId = sid(`${scenario.key}:event:${hearing.number}`);
    await upsertRow(client, 'calendar_events', {
      id: eventId,
      type: 'DISPUTE_HEARING',
      title: `${code} - Hearing #${hearing.number}`,
      description: scenario.dispute.reason,
      priority: scenario.dispute.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
      status: hearing.eventStatus,
      startTime: hearing.scheduledAt,
      endTime: addMinutes(hearing.scheduledAt, hearing.estimatedDurationMinutes),
      durationMinutes: hearing.estimatedDurationMinutes,
      organizerId: users.staff.id,
      referenceType: 'DisputeHearing',
      referenceId: hearingId,
      isAutoScheduled: true,
      autoScheduleRuleId: sid(`${scenario.key}:auto-rule`),
      rescheduleCount: hearing.previousNumber ? 1 : 0,
      previousEventId: hearing.previousNumber ? sid(`${scenario.key}:event:${hearing.previousNumber}`) : null,
      lastRescheduledAt: hearing.previousNumber ? addHours(hearing.scheduledAt, -6) : null,
      location: 'InterDev Hearing Room',
      externalMeetingLink: hearing.externalMeetingLink || meetingLink(scenario.key, hearing.number),
      reminderMinutes: [30, 10],
      notes: `Seeded by ${SEED_KEY}`,
      metadata: {
        seedKey: SEED_KEY,
        disputeId,
        hearingId,
        displayCode: code,
        displayTitle: scenario.title,
        projectTitle: scenario.title,
        reasonExcerpt: scenario.dispute.reason.slice(0, 160),
        hearingNumber: hearing.number,
        tier: hearing.tier,
        nextAction: scenario.dispute.status === 'RESOLVED' ? 'Read-only verdict review' : 'Review evidence and confirm attendance',
        appealState: scenario.dispute.status === 'RESOLVED' ? 'ELIGIBLE' : 'NONE',
      },
      createdAt: addHours(createdAt, hearing.number),
      updatedAt,
    }, ['id']);

    const eventParticipants = [
      { key: 'moderator', userId: users.staff.id, role: 'MODERATOR', status: 'ACCEPTED' },
      { key: 'raiser', userId: users[scenario.dispute.raisedBy].id, role: 'REQUIRED', status: hearing.raiserConfirmed === true ? 'ACCEPTED' : 'PENDING' },
      { key: 'defendant', userId: users[scenario.dispute.defendant].id, role: 'REQUIRED', status: hearing.defendantConfirmed === true ? 'ACCEPTED' : 'PENDING' },
    ];
    if (observerUser) eventParticipants.push({ key: 'observer', userId: observerUser.id, role: 'OBSERVER', status: hearing.observerConfirmed === false ? 'PENDING' : 'ACCEPTED' });

    for (const participant of eventParticipants) {
      await upsertRow(client, 'event_participants', {
        id: sid(`${scenario.key}:event:${hearing.number}:participant:${participant.key}`),
        eventId,
        userId: participant.userId,
        role: participant.role,
        status: participant.status,
        responseDeadline: addHours(hearing.scheduledAt, -2),
        respondedAt: participant.status === 'ACCEPTED' ? addHours(hearing.scheduledAt, -5) : null,
        responseNote: null,
        attendanceStatus: hearing.status === 'COMPLETED' ? 'ON_TIME' : 'NOT_STARTED',
        joinedAt: hearing.startedAt || null,
        leftAt: hearing.endedAt || null,
        isOnline: false,
        lateMinutes: null,
        excuseReason: null,
        excuseApproved: false,
      }, ['id', 'createdAt']);
    }
  }

  if (scenario.dispute.verdict) {
    await upsertRow(client, 'dispute_verdicts', {
      id: sid(`${scenario.key}:verdict`),
      disputeId,
      adjudicatorId: users[scenario.dispute.verdict.adjudicator].id,
      adjudicatorRole: scenario.dispute.verdict.adjudicatorRole,
      faultType: scenario.dispute.verdict.faultType,
      faultyParty: scenario.dispute.verdict.faultyParty,
      reasoning: scenario.dispute.verdict.reasoning,
      amountToFreelancer: money(scenario.dispute.verdict.amountToFreelancer),
      amountToClient: money(scenario.dispute.verdict.amountToClient),
      platformFee: money(scenario.dispute.verdict.platformFee),
      trustScorePenalty: scenario.dispute.verdict.trustScorePenalty,
      isBanTriggered: false,
      banDurationDays: 0,
      warningMessage: scenario.dispute.verdict.warningMessage || null,
      tier: 1,
      isAppealVerdict: false,
      overridesVerdictId: null,
      issuedAt: addHours(baseStart, scenario.dispute.verdict.issuedOffsetHours),
    }, ['id', 'issuedAt']);
  }

  return {
    projectTitle: scenario.title,
    disputeId,
    disputeCode: code,
    status: scenario.dispute.status,
    result: scenario.dispute.result,
    hearings: scenario.hearings.filter((item) => item.status === 'SCHEDULED' || item.status === 'IN_PROGRESS').map((item) => ({ hearingNumber: item.number, scheduledAt: item.scheduledAt.toISOString(), eventStatus: item.eventStatus })),
  };
}

async function main() {
  const client = new Client({
    host: runtime.host,
    port: runtime.port,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: runtime.poolConnTimeoutMs || 5000,
  });

  await client.connect();
  try {
    const users = await getUsers(client);
    const wallets = await getWallets(client, users);
    const baseStart = addMinutes(roundUpToFiveMinutes(new Date()), 30);
    const scenarios = buildScenarios(baseStart);
    const summary = [];

    await client.query('BEGIN');
    for (const scenario of scenarios) {
      summary.push(await seedScenario(client, scenario, users, wallets, baseStart));
    }
    await client.query('COMMIT');

    console.log(JSON.stringify({ seedKey: SEED_KEY, baseStart: baseStart.toISOString(), summary }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
