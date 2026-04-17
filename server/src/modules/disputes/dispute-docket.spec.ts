import { DisputeStatus, HearingStatus, HearingTier, UserRole } from 'src/database/entities';
import {
  buildHearingDocket,
  resolveDisputeAllowedActions,
  resolveDisputeCaseStage,
} from './dispute-docket';

describe('dispute-docket appeal desk review rules', () => {
  it('archives active appeal-tier hearings while dispute is under appeal review', () => {
    const result = buildHearingDocket(
      [
        {
          id: 'hearing-tier-2',
          status: HearingStatus.SCHEDULED,
          tier: HearingTier.TIER_2,
          hearingNumber: 2,
          scheduledAt: '2026-04-20T10:00:00.000Z',
        },
      ],
      DisputeStatus.APPEALED,
    );

    expect(result.activeHearingId).toBeNull();
    expect(result.latestHearingId).toBe('hearing-tier-2');
    expect(result.items).toEqual([
      expect.objectContaining({
        hearingId: 'hearing-tier-2',
        isActionable: false,
        isArchived: true,
        lifecycle: 'ARCHIVED',
        freezeReason: expect.stringContaining('appeal queue'),
      }),
    ]);
  });

  it('keeps appealed disputes in appeal window stage even if legacy hearings exist', () => {
    expect(
      resolveDisputeCaseStage({
        status: DisputeStatus.APPEALED,
        phase: null,
        hasActionableHearing: true,
        appealState: 'FILED',
      }),
    ).toBe('APPEAL_WINDOW');
  });

  it('does not expose hearing management actions during appeal review', () => {
    const actions = resolveDisputeAllowedActions({
      status: DisputeStatus.APPEALED,
      userId: 'admin-1',
      userRole: UserRole.ADMIN,
      raisedById: 'raiser-1',
      defendantId: 'defendant-1',
      canAppealVerdict: false,
      canAppealRejection: false,
      hasActionableHearing: false,
    });

    expect(actions).toContain('RESOLVE_APPEAL');
    expect(actions).toContain('MANAGE_APPEAL_QUEUE');
    expect(actions).not.toContain('MANAGE_HEARING');
  });
});
