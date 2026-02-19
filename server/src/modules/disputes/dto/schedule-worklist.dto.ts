import { DisputeStatus, UserRole } from 'src/database/entities';

export type SchedulingWorklistActionType =
  | 'PROPOSE_SLOT'
  | 'PROVIDE_INFO'
  | 'CONFIRM_HEARING'
  | 'NONE';

export type SchedulingWorklistPerspective = 'RAISER' | 'DEFENDANT' | 'OTHER';

export type SchedulingWorklistNotEligibleReasonCode =
  | 'TRIAGE_NOT_ACCEPTED'
  | 'HEARING_ALREADY_SCHEDULED'
  | 'DISPUTE_CLOSED'
  | 'NO_PERMISSION'
  | 'NONE';

export interface SchedulingWorklistItemDto {
  disputeId: string;
  displayCode: string;
  projectId?: string | null;
  projectTitle?: string | null;
  category?: string | null;
  status: DisputeStatus;
  perspective: SchedulingWorklistPerspective;
  raiserName?: string | null;
  raiserRole?: UserRole | string | null;
  defendantName?: string | null;
  defendantRole?: UserRole | string | null;
  counterpartyName?: string | null;
  counterpartyRole?: UserRole | string | null;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  assignedStaffEmail?: string | null;
  updatedAt: string;
  isNew: boolean;
  isSeen: boolean;
  requiresAction: boolean;
  actionType: SchedulingWorklistActionType;
  canProposeSlots: boolean;
  canCancel: boolean;
  notEligibleReasonCode: SchedulingWorklistNotEligibleReasonCode;
  notEligibleReasonText: string;
  infoRequestReason?: string | null;
  infoRequestDeadline?: string | null;
}

export interface SchedulingWorklistResponseDto {
  enabled: boolean;
  items: SchedulingWorklistItemDto[];
  generatedAt: string;
  degraded?: boolean;
  reasonCode?: 'MIGRATION_REQUIRED' | 'PARTIAL_DATA' | 'NONE';
  message?: string;
}
