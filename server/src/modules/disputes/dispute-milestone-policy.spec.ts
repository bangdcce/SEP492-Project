import { DisputeCategory, EscrowStatus, MilestoneStatus } from 'src/database/entities';
import {
  DISPUTE_WARRANTY_WINDOW_DAYS,
  resolveMilestoneDisputePolicy,
} from './dispute-milestone-policy';

describe('resolveMilestoneDisputePolicy', () => {
  it('allows review-stage quality disputes', () => {
    const result = resolveMilestoneDisputePolicy({
      milestoneStatus: MilestoneStatus.REVISIONS_REQUIRED,
      escrowStatus: EscrowStatus.FUNDED,
      dueDate: '2026-04-01T00:00:00.000Z',
      now: new Date('2026-04-16T00:00:00.000Z'),
    });

    expect(result.canRaise).toBe(true);
    expect(result.phase).toBe('REVIEW');
    expect(result.allowedCategories).toEqual(
      expect.arrayContaining([
        DisputeCategory.QUALITY,
        DisputeCategory.DEADLINE,
        DisputeCategory.COMMUNICATION,
        DisputeCategory.PAYMENT,
      ]),
    );
  });

  it('blocks deadline category before the milestone becomes overdue', () => {
    const result = resolveMilestoneDisputePolicy({
      milestoneStatus: MilestoneStatus.IN_PROGRESS,
      escrowStatus: EscrowStatus.FUNDED,
      dueDate: '2026-04-20T00:00:00.000Z',
      now: new Date('2026-04-16T00:00:00.000Z'),
    });

    expect(result.canRaise).toBe(true);
    expect(result.allowedCategories).toEqual(
      expect.arrayContaining([DisputeCategory.COMMUNICATION, DisputeCategory.PAYMENT]),
    );
    expect(result.allowedCategories).not.toContain(DisputeCategory.DEADLINE);
    expect(result.blockedCategories[DisputeCategory.DEADLINE]).toContain('due date');
  });

  it('allows paid milestones during the warranty window', () => {
    const releasedAt = new Date('2026-04-01T00:00:00.000Z');
    const result = resolveMilestoneDisputePolicy({
      milestoneStatus: MilestoneStatus.PAID,
      escrowStatus: EscrowStatus.RELEASED,
      releasedAt,
      now: new Date('2026-04-16T00:00:00.000Z'),
    });

    expect(result.canRaise).toBe(true);
    expect(result.phase).toBe('POST_DELIVERY');
    expect(result.allowedCategories).toEqual([DisputeCategory.QUALITY, DisputeCategory.PAYMENT]);
    expect(result.warrantyEndsAt?.toISOString()).toBe(
      new Date(
        releasedAt.getTime() + DISPUTE_WARRANTY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
    );
  });

  it('allows paid milestones with funded escrow during the warranty window', () => {
    const releasedAt = new Date('2026-04-01T00:00:00.000Z');
    const result = resolveMilestoneDisputePolicy({
      milestoneStatus: MilestoneStatus.PAID,
      escrowStatus: EscrowStatus.FUNDED,
      releasedAt,
      now: new Date('2026-04-16T00:00:00.000Z'),
    });

    expect(result.canRaise).toBe(true);
    expect(result.phase).toBe('POST_DELIVERY');
    expect(result.allowedCategories).toEqual([DisputeCategory.QUALITY, DisputeCategory.PAYMENT]);
  });

  it('blocks paid milestones after the warranty window expires', () => {
    const result = resolveMilestoneDisputePolicy({
      milestoneStatus: MilestoneStatus.PAID,
      escrowStatus: EscrowStatus.RELEASED,
      releasedAt: '2026-03-01T00:00:00.000Z',
      now: new Date('2026-04-16T00:00:00.000Z'),
    });

    expect(result.canRaise).toBe(false);
    expect(result.reason).toContain('30 days');
  });

  it('blocks disputes before work starts', () => {
    const result = resolveMilestoneDisputePolicy({
      milestoneStatus: MilestoneStatus.PENDING,
      escrowStatus: EscrowStatus.PENDING,
      now: new Date('2026-04-16T00:00:00.000Z'),
    });

    expect(result.canRaise).toBe(false);
    expect(result.phase).toBe('CLOSED');
    expect(result.reason).toContain('after work starts');
  });

  it('allows overdue pending milestones to open deadline disputes once escrow is funded', () => {
    const result = resolveMilestoneDisputePolicy({
      milestoneStatus: MilestoneStatus.PENDING,
      escrowStatus: EscrowStatus.FUNDED,
      dueDate: '2026-04-22T00:00:00.000Z',
      now: new Date('2026-04-23T00:00:00.000Z'),
    });

    expect(result.canRaise).toBe(true);
    expect(result.phase).toBe('PRE_DELIVERY');
    expect(result.allowedCategories).toEqual([DisputeCategory.DEADLINE]);
    expect(result.reason).toBeNull();
  });
});
