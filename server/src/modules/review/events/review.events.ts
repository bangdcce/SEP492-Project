export const REVIEW_EVENTS = {
  MUTATED: 'review.mutated',
} as const;

export type ReviewMutationTrigger = 'created' | 'updated' | 'soft_deleted' | 'restored';

export interface ReviewMutationCommittedEvent {
  reviewId: string;
  targetUserId: string;
  trigger: ReviewMutationTrigger;
  triggeredBy: string;
}
