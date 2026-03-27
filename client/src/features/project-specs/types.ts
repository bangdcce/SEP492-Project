// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export enum SpecPhase {
  CLIENT_SPEC = 'CLIENT_SPEC',
  FULL_SPEC = 'FULL_SPEC',
}

export enum ProjectSpecStatus {
  DRAFT = 'DRAFT',

  // Phase 1: Client Spec
  CLIENT_REVIEW = 'CLIENT_REVIEW',
  CLIENT_APPROVED = 'CLIENT_APPROVED',

  // Phase 2: Full Spec
  PENDING_AUDIT = 'PENDING_AUDIT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  FINAL_REVIEW = 'FINAL_REVIEW',
  ALL_SIGNED = 'ALL_SIGNED',

  // Terminal
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DeliverableType {
  DESIGN_PROTOTYPE = 'DESIGN_PROTOTYPE',
  API_DOCS = 'API_DOCS',
  DEPLOYMENT = 'DEPLOYMENT',
  SOURCE_CODE = 'SOURCE_CODE',
  SYS_OPERATION_DOCS = 'SYS_OPERATION_DOCS',
  CREDENTIAL_VAULT = 'CREDENTIAL_VAULT',
  OTHER = 'OTHER',
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT SPEC (Phase 1) — simplified, client-readable
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientFeatureDTO {
  id?: string | null;
  title: string;
  description: string;
  priority: 'MUST_HAVE' | 'SHOULD_HAVE' | 'NICE_TO_HAVE';
}

export interface CreateClientSpecDTO {
  requestId: string;
  title: string;
  description: string;
  estimatedBudget: number;
  estimatedTimeline?: string;
  agreedDeliveryDeadline?: string;
  projectCategory?: string;
  clientFeatures: ClientFeatureDTO[];
  referenceLinks?: ReferenceLinkDTO[];
  richContentJson?: Record<string, unknown>;
  templateCode?: string;
  changeSummary?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL SPEC (Phase 2) — detailed technical spec for freelancer
// ─────────────────────────────────────────────────────────────────────────────

export interface SpecFeatureDTO {
  id?: string;
  title: string;
  description: string;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  acceptanceCriteria: string[];
  inputOutputSpec?: string;
  approvedClientFeatureIds?: string[] | null;
}

export interface ReferenceLinkDTO {
  label: string;
  url: string;
}

export interface CreateMilestoneDTO {
  title: string;
  description: string;
  amount: number;
  duration?: number;
  deliverableType: DeliverableType;
  retentionAmount: number;
  acceptanceCriteria?: string[];
  startDate?: string;
  dueDate?: string;
  sortOrder?: number;
  approvedClientFeatureIds?: string[] | null;
}

export interface CreateProjectSpecDTO {
  requestId: string;
  parentSpecId?: string;
  title: string;
  description: string;
  totalBudget: number;
  milestones: CreateMilestoneDTO[];
  features?: SpecFeatureDTO[];
  techStack?: string;
  referenceLinks?: ReferenceLinkDTO[];
  richContentJson?: Record<string, unknown>;
  templateCode?: string;
  status?: ProjectSpecStatus;
  changeSummary?: string;
}

export interface SpecSubmissionSnapshot {
  phase: SpecPhase;
  title: string;
  description: string;
  totalBudget: number;
  projectCategory?: string | null;
  estimatedTimeline?: string | null;
  clientFeatures?: ClientFeatureDTO[] | null;
  features?: SpecFeatureDTO[] | null;
  techStack?: string | null;
  referenceLinks?: ReferenceLinkDTO[] | null;
  milestones?: Array<{
    title: string;
    description: string;
    amount: number;
    deliverableType: string;
    retentionAmount: number;
    startDate?: string | null;
    dueDate?: string | null;
    sortOrder?: number | null;
    acceptanceCriteria?: string[] | null;
    approvedClientFeatureIds?: string[] | null;
  }> | null;
}

export interface SpecFieldDiffEntry {
  field: string;
  label: string;
  previous: unknown;
  next: unknown;
}

export interface SpecRejectionHistoryEntry {
  phase: SpecPhase;
  reason: string;
  rejectedByUserId?: string | null;
  rejectedAt: string;
}

export interface ProjectSpecRequestContext {
  originalRequest: {
    title?: string | null;
    description?: string | null;
    budgetRange?: string | null;
    requestedDeadline?: string | null;
    productTypeLabel?: string | null;
    projectGoalSummary?: string | null;
  };
  approvedCommercialBaseline: {
    source?: string | null;
    agreedBudget?: number | null;
    agreedDeliveryDeadline?: string | null;
    agreedClientFeatures?: ClientFeatureDTO[] | null;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectSpec {
  id: string;
  requestId: string;
  specPhase: SpecPhase;
  parentSpecId?: string | null;
  request?: {
    id: string;
    title: string;
    description?: string;
    budgetRange?: string | null;
    requestedDeadline?: string | null;
    intendedTimeline?: string | null;
    requestScopeBaseline?: {
      productTypeCode?: string | null;
      productTypeLabel?: string | null;
      projectGoalSummary?: string | null;
      requestedDeadline?: string | null;
      requestTitle?: string | null;
      requestDescription?: string | null;
    } | null;
    commercialBaseline?: {
      source?: string | null;
      agreedBudget?: number | null;
      agreedDeliveryDeadline?: string | null;
      agreedClientFeatures?: ClientFeatureDTO[] | null;
    } | null;
    clientId?: string;
    brokerId?: string;
    freelancerId?: string | null;
    client?: { id: string; fullName: string; email: string };
    broker?: { id: string; fullName: string; email: string };
  };
  parentSpec?: ProjectSpec | null;
  requestContext?: ProjectSpecRequestContext | null;
  title: string;
  description: string;
  totalBudget: number;
  status: ProjectSpecStatus;
  rejectionReason?: string | null;
  lockedByContractId?: string | null;
  lockedAt?: string | null;
  submissionVersion?: number;
  lastSubmittedSnapshot?: SpecSubmissionSnapshot | null;
  lastSubmittedDiff?: SpecFieldDiffEntry[] | null;
  changeSummary?: string | null;
  rejectionHistory?: SpecRejectionHistoryEntry[] | null;
  createdAt: string;
  updatedAt?: string;
  clientApprovedAt?: string | null;
  richContentJson?: Record<string, unknown> | null;
  signatures?: {
    id: string;
    userId: string;
    signerRole: string;
    signedAt: string;
  }[];

  // Phase 1 fields
  clientFeatures?: ClientFeatureDTO[];
  projectCategory?: string | null;
  estimatedTimeline?: string | null;

  // Phase 2 fields
  features?: SpecFeatureDTO[];
  techStack?: string;
  referenceLinks?: ReferenceLinkDTO[];
  milestones?: {
    id: string;
    title: string;
    description: string;
    amount: number;
    status: string;
    deliverableType: DeliverableType;
    retentionAmount: number;
    acceptanceCriteria?: string[];
    sortOrder?: number;
    duration?: number;
    startDate?: string;
    dueDate?: string;
    approvedClientFeatureIds?: string[] | null;
  }[];
}
