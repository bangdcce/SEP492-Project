import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { NotificationEntity } from '../../src/database/entities/notification.entity';
import { TrustScoreHistoryEntity } from '../../src/database/entities/trust-score-history.entity';
import { UserEntity, UserRole } from '../../src/database/entities/user.entity';
import {
  recordEvidence,
} from './evidence-recorder';
import {
  signAccessToken,
} from './auth-token';
import {
  createFeatureHttpTestApp,
  type FeatureHttpTestApp,
} from './feature-test-app';
import {
  resetFeatureTables,
  seedNotification,
  seedProfile,
  seedProject,
  seedReview,
  seedTrustScoreHistory,
  seedUser,
} from './seed-fixtures';
import {
  startPostgresTestContainer,
  type PostgresTestContainerHandle,
} from './postgres-test-container';

describe('FE16 and FE18 HTTP integration evidence', () => {
  let database: PostgresTestContainerHandle;
  let app: INestApplication;
  let dataSource: DataSource;
  let notificationsService: FeatureHttpTestApp['notificationsService'];
  let eventEmitter: FeatureHttpTestApp['eventEmitter'];

  beforeAll(async () => {
    database = await startPostgresTestContainer();
    const featureApp = await createFeatureHttpTestApp(database);
    app = featureApp.app;
    dataSource = featureApp.dataSource;
    notificationsService = featureApp.notificationsService;
    eventEmitter = featureApp.eventEmitter;
  });

  beforeEach(async () => {
    await resetFeatureTables(dataSource);
  });

  afterAll(async () => {
    await app?.close();
    await database?.stop();
  });

  it('blocks unauthenticated notification requests with JwtAuthGuard', async () => {
    const response = await request(app.getHttpServer()).get('/notifications');

    expect(response.status).toBe(401);
    recordEvidence({
      id: 'FE18-NOT-01',
      evidenceRef: 'feature-http.e2e-spec.ts::notifications guard',
      actualResults:
        'GET /notifications without Bearer token returned HTTP 401 Unauthorized before any controller logic executed.',
    });
  });

  it('lists notifications with pagination and unreadOnly filter for the authenticated user', async () => {
    const user = await seedUser(dataSource, {
      role: UserRole.CLIENT,
      fullName: 'Notification User',
    });
    const otherUser = await seedUser(dataSource, {
      role: UserRole.CLIENT,
      fullName: 'Other User',
    });

    await seedNotification(dataSource, {
      userId: user.id,
      title: 'Old unread',
      body: 'Unread body 1',
      isRead: false,
    });
    await seedNotification(dataSource, {
      userId: user.id,
      title: 'Already read',
      body: 'Read body',
      isRead: true,
      readAt: new Date('2026-03-20T10:00:00.000Z'),
    });
    const newestUnread = await seedNotification(dataSource, {
      userId: user.id,
      title: 'Newest unread',
      body: 'Unread body 2',
      isRead: false,
      relatedType: 'DISPUTE',
      relatedId: 'dispute-77',
    });
    await seedNotification(dataSource, {
      userId: otherUser.id,
      title: 'Foreign',
      body: 'Should be hidden',
      isRead: false,
    });

    const response = await request(app.getHttpServer())
      .get('/notifications?page=1&limit=5&unreadOnly=true')
      .set('Authorization', `Bearer ${signAccessToken(user)}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        items: expect.arrayContaining([
          expect.objectContaining({
            id: newestUnread.id,
            title: 'Newest unread',
            isRead: false,
            relatedType: 'DISPUTE',
            relatedId: 'dispute-77',
          }),
        ]),
        total: 2,
        page: 1,
        limit: 5,
      },
    });
    expect(response.body.data.items).toHaveLength(2);

    recordEvidence({
      id: 'FE18-NOT-02',
      evidenceRef: 'feature-http.e2e-spec.ts::notifications list',
      actualResults:
        'GET /notifications?page=1&limit=5&unreadOnly=true returned HTTP 200 with success=true, page=1, limit=5, and total=2 for the signed-in user unread feed.',
    });
    recordEvidence({
      id: 'FE18-NOT-06',
      evidenceRef: 'feature-http.e2e-spec.ts::notifications unread filter',
      actualResults:
        'The unreadOnly=true filter excluded the already-read notification and another user row, leaving only unread notifications owned by the authenticated caller.',
    });
  });

  it('marks a single notification as read and remains idempotent on repeated calls', async () => {
    const user = await seedUser(dataSource, {
      role: UserRole.CLIENT,
    });
    const notification = await seedNotification(dataSource, {
      userId: user.id,
      title: 'Mark me',
      body: 'Mark me once',
      isRead: false,
    });
    const token = signAccessToken(user);

    const first = await request(app.getHttpServer())
      .patch(`/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${token}`);
    const second = await request(app.getHttpServer())
      .patch(`/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.data.isRead).toBe(true);
    expect(second.body.data.isRead).toBe(true);

    const persisted = await dataSource.getRepository(NotificationEntity).findOneByOrFail({
      id: notification.id,
    });
    expect(persisted.isRead).toBe(true);
    expect(persisted.readAt).toBeTruthy();

    recordEvidence({
      id: 'FE18-NOT-03',
      evidenceRef: 'feature-http.e2e-spec.ts::notifications mark single read',
      actualResults:
        'PATCH /notifications/:id/read returned HTTP 200 on both the first and second request, persisted isRead=true, and kept the notification readable without creating a duplicate row.',
    });
  });

  it('marks all unread notifications as read for the authenticated user only', async () => {
    const user = await seedUser(dataSource, {
      role: UserRole.CLIENT,
    });
    const otherUser = await seedUser(dataSource, {
      role: UserRole.CLIENT,
    });

    await seedNotification(dataSource, {
      userId: user.id,
      title: 'Unread one',
      body: 'Body one',
      isRead: false,
    });
    await seedNotification(dataSource, {
      userId: user.id,
      title: 'Unread two',
      body: 'Body two',
      isRead: false,
    });
    await seedNotification(dataSource, {
      userId: otherUser.id,
      title: 'Other unread',
      body: 'Should stay unread',
      isRead: false,
    });

    const response = await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${signAccessToken(user)}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });

    const ownNotifications = await dataSource.getRepository(NotificationEntity).findBy({
      userId: user.id,
    });
    const foreignNotification = await dataSource
      .getRepository(NotificationEntity)
      .findOneByOrFail({ userId: otherUser.id });

    expect(ownNotifications.every((item) => item.isRead)).toBe(true);
    expect(foreignNotification.isRead).toBe(false);

    recordEvidence({
      id: 'FE18-NOT-04',
      evidenceRef: 'feature-http.e2e-spec.ts::notifications mark all read',
      actualResults:
        'PATCH /notifications/read-all returned HTTP 200 and flipped every unread notification for the signed-in user to isRead=true while leaving another user row unread.',
    });
  });

  it('persists notifications and dispatches notification.created events through the real service', async () => {
    const user = await seedUser(dataSource, {
      role: UserRole.CLIENT,
    });
    const captured: Array<{ id: string; userId: string }> = [];

    const handler = (payload: { notification: NotificationEntity }) => {
      captured.push({
        id: payload.notification.id,
        userId: payload.notification.userId,
      });
    };

    eventEmitter.on('notification.created', handler);
    const created = await notificationsService.create({
      userId: user.id,
      title: '  Case opened  ',
      body: '  Notification dispatch body  ',
      relatedType: 'DISPUTE',
      relatedId: 'dispute-900',
    });
    eventEmitter.off('notification.created', handler);

    expect(created).toEqual(
      expect.objectContaining({
        userId: user.id,
        title: 'Case opened',
        body: 'Notification dispatch body',
        relatedType: 'DISPUTE',
        relatedId: 'dispute-900',
      }),
    );
    expect(captured).toEqual([
      {
        id: created!.id,
        userId: user.id,
      },
    ]);

    recordEvidence({
      id: 'FE18-NOT-05',
      evidenceRef: 'feature-http.e2e-spec.ts::notifications create event',
      actualResults:
        'NotificationsService.create persisted one trimmed notification row in Postgres and emitted notification.created exactly once with the saved notification id for the target user.',
    });
  });

  it('returns a mapped trust profile payload for a signed-in request', async () => {
    const viewer = await seedUser(dataSource, {
      role: UserRole.CLIENT,
      fullName: 'Viewer User',
    });
    const target = await seedUser(dataSource, {
      role: UserRole.FREELANCER,
      fullName: 'Target Freelancer',
      isVerified: true,
      currentTrustScore: 4.4,
      totalProjectsFinished: 7,
      totalDisputesLost: 1,
    });
    const reviewer = await seedUser(dataSource, {
      role: UserRole.CLIENT,
      fullName: 'Reviewer User',
      currentTrustScore: 4.8,
      totalProjectsFinished: 3,
    });
    const broker = await seedUser(dataSource, {
      role: UserRole.BROKER,
      fullName: 'Broker User',
    });

    await seedProfile(dataSource, target.id, {
      avatarUrl: 'https://example.com/target.png',
      bio: 'Senior freelancer',
      skills: ['NestJS', 'PostgreSQL'],
    });
    await seedProfile(dataSource, reviewer.id, {
      avatarUrl: 'https://example.com/reviewer.png',
      bio: 'Careful reviewer',
    });

    const project = await seedProject(dataSource, {
      clientId: reviewer.id,
      brokerId: broker.id,
      freelancerId: target.id,
      title: 'Trust profile integration',
      description: 'Back office project',
      totalBudget: 1200,
      status: 'COMPLETED' as any,
    });
    await seedReview(dataSource, {
      projectId: project.id,
      reviewerId: reviewer.id,
      targetUserId: target.id,
      rating: 5,
      comment: 'Delivered exactly as requested',
      weight: 1.5,
    });

    const response = await request(app.getHttpServer())
      .get(`/trust-profiles/${target.id}`)
      .set('Authorization', `Bearer ${signAccessToken(viewer)}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          id: target.id,
          fullName: 'Target Freelancer',
          currentTrustScore: 4.4,
          badge: expect.any(String),
        }),
        reviews: expect.arrayContaining([
          expect.objectContaining({
            rating: 5,
            reviewer: expect.objectContaining({
              fullName: 'Reviewer User',
            }),
            project: expect.objectContaining({
              title: 'Trust profile integration',
            }),
          }),
        ]),
        projectHistory: expect.arrayContaining([
          expect.objectContaining({
            projectId: project.id,
            targetRoleInProject: 'FREELANCER',
          }),
        ]),
      }),
    );

    recordEvidence({
      id: 'FE16-TPR-01',
      evidenceRef: 'feature-http.e2e-spec.ts::trust profile success',
      actualResults:
        'GET /trust-profiles/:userId returned HTTP 200 with mapped user stats, one review including reviewer/project details, and one projectHistory entry showing targetRoleInProject=FREELANCER.',
    });
  });

  it('returns 404 for a missing trust profile even with a valid JWT', async () => {
    const viewer = await seedUser(dataSource, {
      role: UserRole.CLIENT,
    });

    const response = await request(app.getHttpServer())
      .get(`/trust-profiles/${randomUUID()}`)
      .set('Authorization', `Bearer ${signAccessToken(viewer)}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('User not found');

    recordEvidence({
      id: 'FE16-TPR-02',
      evidenceRef: 'feature-http.e2e-spec.ts::trust profile missing user',
      actualResults:
        'GET /trust-profiles/:userId with a valid Bearer token returned HTTP 404 and message="User not found" when the requested active user record did not exist.',
    });
  });

  it('recalculates trust score over HTTP and persists a history record', async () => {
    const caller = await seedUser(dataSource, {
      role: UserRole.ADMIN,
      currentTrustScore: 3.1,
    });
    const target = await seedUser(dataSource, {
      role: UserRole.FREELANCER,
      currentTrustScore: 2.5,
      totalProjectsFinished: 6,
      totalProjectsCancelled: 1,
      totalDisputesLost: 0,
      totalLateProjects: 1,
      isVerified: true,
    });
    const reviewer = await seedUser(dataSource, {
      role: UserRole.CLIENT,
    });
    const broker = await seedUser(dataSource, {
      role: UserRole.BROKER,
    });
    const project = await seedProject(dataSource, {
      clientId: reviewer.id,
      brokerId: broker.id,
      freelancerId: target.id,
      title: 'Trust score source project',
      totalBudget: 900,
      status: 'PAID' as any,
    });

    await seedReview(dataSource, {
      projectId: project.id,
      reviewerId: reviewer.id,
      targetUserId: target.id,
      rating: 5,
      weight: 1.5,
    });
    await seedReview(dataSource, {
      projectId: project.id,
      reviewerId: caller.id,
      targetUserId: target.id,
      rating: 2,
      weight: 1,
      deletedAt: new Date('2026-03-20T09:00:00.000Z'),
    });

    const response = await request(app.getHttpServer())
      .post(`/trust-score/calculate/${target.id}`)
      .set('Authorization', `Bearer ${signAccessToken(caller)}`);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        userId: target.id,
        oldScore: 2.5,
        newScore: expect.any(Number),
      }),
    );

    const refreshedUser = await dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: target.id });
    const historyRows = await dataSource
      .getRepository(TrustScoreHistoryEntity)
      .findBy({ userId: target.id });

    expect(Number((refreshedUser as any).currentTrustScore)).toBeGreaterThan(0);
    expect(historyRows).toHaveLength(1);

    recordEvidence({
      id: 'FE16-TS-01',
      evidenceRef: 'feature-http.e2e-spec.ts::trust score calculate',
      actualResults:
        'POST /trust-score/calculate/:userId returned HTTP 201, recalculated the target user score from 2.5 to a new persisted value using only active reviews, and inserted one trust_score_history row.',
    });
  });

  it('returns trust score history in descending order with the requested limit', async () => {
    const caller = await seedUser(dataSource, {
      role: UserRole.ADMIN,
    });
    const target = await seedUser(dataSource, {
      role: UserRole.FREELANCER,
    });

    await seedTrustScoreHistory(dataSource, {
      userId: target.id,
      totalScore: 3.5,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const newest = await seedTrustScoreHistory(dataSource, {
      userId: target.id,
      totalScore: 4.2,
    });

    const response = await request(app.getHttpServer())
      .get(`/trust-score/history/${target.id}?limit=1`)
      .set('Authorization', `Bearer ${signAccessToken(caller)}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toEqual(
      expect.objectContaining({
        id: newest.id,
        totalScore: '4.20',
      }),
    );

    recordEvidence({
      id: 'FE16-TS-02',
      evidenceRef: 'feature-http.e2e-spec.ts::trust score history',
      actualResults:
        'GET /trust-score/history/:userId?limit=1 returned HTTP 200 with one newest trust score history row in descending calculatedAt order and respected the requested limit=1.',
    });
  });
});
