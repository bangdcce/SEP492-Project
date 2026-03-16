const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PASSWORD = 'password123';

const USERS = [
  {
    id: '9f111111-1111-4111-8111-111111111111',
    email: 'admin.queue.one@example.com',
    fullName: 'Admin Queue One',
    role: 'ADMIN',
  },
  {
    id: '9f222222-2222-4222-8222-222222222222',
    email: 'admin.queue.two@example.com',
    fullName: 'Admin Queue Two',
    role: 'ADMIN',
  },
  {
    id: '9f333333-3333-4333-8333-333333333333',
    email: 'client.review.smoke@example.com',
    fullName: 'Client Review Smoke',
    role: 'CLIENT',
  },
  {
    id: '9f444444-4444-4444-8444-444444444444',
    email: 'broker.review.smoke@example.com',
    fullName: 'Broker Review Smoke',
    role: 'BROKER',
  },
  {
    id: '9f555555-5555-4555-8555-555555555555',
    email: 'freelancer.review.smoke@example.com',
    fullName: 'Freelancer Review Smoke',
    role: 'FREELANCER',
  },
];

const PROJECT = {
  id: '9faa1111-1111-4111-8111-111111111111',
  clientId: '9f333333-3333-4333-8333-333333333333',
  brokerId: '9f444444-4444-4444-8444-444444444444',
  freelancerId: '9f555555-5555-4555-8555-555555555555',
  title: '[SMOKE] Review Moderation Queue Project',
  description: 'Fixture project used for moderation queue conflict smoke tests.',
  totalBudget: 2500,
};

const REVIEW = {
  id: '9fbb1111-1111-4111-8111-111111111111',
  projectId: PROJECT.id,
  reviewerId: PROJECT.clientId,
  targetUserId: PROJECT.freelancerId,
  rating: 2,
  comment: '[SMOKE] Review used to validate moderation queue optimistic concurrency.',
  weight: 1.5,
};

const REPORT = {
  id: '9fcc1111-1111-4111-8111-111111111111',
  reporterId: PROJECT.brokerId,
  reviewId: REVIEW.id,
  reason: 'FAKE_REVIEW',
  description: '[SMOKE] Pending moderation report fixture.',
};

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

async function ensureReviewModerationSmokeFixtures() {
  const client = buildPgClient();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await client.connect();
  await client.query('BEGIN');

  try {
    for (const user of USERS) {
      await client.query(
        `
          INSERT INTO users (
            id,
            email,
            "passwordHash",
            "fullName",
            role,
            "timeZone",
            "isVerified",
            "emailVerifiedAt",
            "currentTrustScore",
            status,
            "createdAt",
            "updatedAt",
            "isBanned"
          )
          VALUES ($1, $2, $3, $4, $5, 'Asia/Saigon', true, NOW(), 5.0, 'ACTIVE', NOW(), NOW(), false)
          ON CONFLICT (email)
          DO UPDATE SET
            "passwordHash" = EXCLUDED."passwordHash",
            "fullName" = EXCLUDED."fullName",
            role = EXCLUDED.role,
            "timeZone" = EXCLUDED."timeZone",
            "isVerified" = true,
            "emailVerifiedAt" = COALESCE(users."emailVerifiedAt", NOW()),
            status = 'ACTIVE',
            "updatedAt" = NOW(),
            "isBanned" = false,
            "banReason" = NULL,
            "bannedAt" = NULL,
            "bannedBy" = NULL,
            "deletedAt" = NULL,
            "deletedReason" = NULL
        `,
        [user.id, user.email, passwordHash, user.fullName, user.role],
      );
    }

    await client.query(
      `
        INSERT INTO projects (
          id,
          "clientId",
          "brokerId",
          "freelancerId",
          title,
          description,
          "totalBudget",
          currency,
          status,
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'USD', 'COMPLETED', NOW() - INTERVAL '10 days', NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          "clientId" = EXCLUDED."clientId",
          "brokerId" = EXCLUDED."brokerId",
          "freelancerId" = EXCLUDED."freelancerId",
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          "totalBudget" = EXCLUDED."totalBudget",
          currency = EXCLUDED.currency,
          status = EXCLUDED.status,
          "updatedAt" = NOW()
      `,
      [
        PROJECT.id,
        PROJECT.clientId,
        PROJECT.brokerId,
        PROJECT.freelancerId,
        PROJECT.title,
        PROJECT.description,
        PROJECT.totalBudget,
      ],
    );

    await client.query(
      `
        INSERT INTO reviews (
          id,
          "projectId",
          "reviewerId",
          "targetUserId",
          rating,
          comment,
          weight,
          "createdAt",
          "updatedAt",
          "deleted_at",
          "deleted_by",
          "delete_reason",
          "opened_by_id",
          "current_assignee_id",
          "last_assigned_by_id",
          "last_assigned_at",
          "assignment_version"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0)
        ON CONFLICT (id)
        DO UPDATE SET
          "projectId" = EXCLUDED."projectId",
          "reviewerId" = EXCLUDED."reviewerId",
          "targetUserId" = EXCLUDED."targetUserId",
          rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          weight = EXCLUDED.weight,
          "updatedAt" = NOW(),
          "deleted_at" = NULL,
          "deleted_by" = NULL,
          "delete_reason" = NULL,
          "opened_by_id" = NULL,
          "current_assignee_id" = NULL,
          "last_assigned_by_id" = NULL,
          "last_assigned_at" = NULL,
          "assignment_version" = 0
      `,
      [
        REVIEW.id,
        REVIEW.projectId,
        REVIEW.reviewerId,
        REVIEW.targetUserId,
        REVIEW.rating,
        REVIEW.comment,
        REVIEW.weight,
      ],
    );

    await client.query(
      `
        INSERT INTO reports (
          id,
          "reporter_id",
          "review_id",
          reason,
          description,
          status,
          "created_at",
          "resolved_by",
          "admin_note",
          "resolved_at"
        )
        VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW() - INTERVAL '1 day', NULL, NULL, NULL)
        ON CONFLICT (id)
        DO UPDATE SET
          "reporter_id" = EXCLUDED."reporter_id",
          "review_id" = EXCLUDED."review_id",
          reason = EXCLUDED.reason,
          description = EXCLUDED.description,
          status = 'PENDING',
          "resolved_by" = NULL,
          "admin_note" = NULL,
          "resolved_at" = NULL
      `,
      [REPORT.id, REPORT.reporterId, REPORT.reviewId, REPORT.reason, REPORT.description],
    );

    await client.query('COMMIT');

    return {
      admins: USERS.filter((user) => user.role === 'ADMIN').map((user) => ({
        email: user.email,
        password: PASSWORD,
      })),
      reviewId: REVIEW.id,
      reportId: REPORT.id,
      reviewTargetUserId: REVIEW.targetUserId,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  ensureReviewModerationSmokeFixtures()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { ensureReviewModerationSmokeFixtures };
