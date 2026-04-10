import type { ProjectSpec } from "@/features/project-specs/types";

export const RequestStatus = {
  PUBLIC_DRAFT: "PUBLIC_DRAFT",
  PRIVATE_DRAFT: "PRIVATE_DRAFT",
  BROKER_ASSIGNED: "BROKER_ASSIGNED",
  SPEC_SUBMITTED: "SPEC_SUBMITTED",
  SPEC_APPROVED: "SPEC_APPROVED",
  CONTRACT_PENDING: "CONTRACT_PENDING",
  PENDING_SPECS: "PENDING_SPECS",
  HIRING: "HIRING",
  CONVERTED_TO_PROJECT: "CONVERTED_TO_PROJECT",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  CANCELLED: "CANCELLED",
  PROCESSING: "PROCESSING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  DRAFT: "DRAFT",
  PENDING: "PENDING",
} as const;

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export interface ProjectRequestAttachment {
  filename: string;
  url: string;
  storagePath?: string | null;
  mimetype?: string | null;
  size?: number | null;
  category?: "requirements" | "attachment";
}

export interface ProjectRequestCommercialFeature {
  id?: string | null;
  title: string;
  description: string;
  priority?: "MUST_HAVE" | "SHOULD_HAVE" | "NICE_TO_HAVE" | null;
}

export interface ProjectRequestScopeBaseline {
  productTypeCode?: string | null;
  productTypeLabel?: string | null;
  projectGoalSummary?: string | null;
  requestedDeadline?: string | null;
  requestTitle: string;
  requestDescription: string;
}

export interface ProjectRequestCommercialBaseline {
  source: "REQUEST" | "CLIENT_SPEC" | "COMMERCIAL_CHANGE";
  budgetRange?: string | null;
  estimatedBudget?: number | null;
  estimatedTimeline?: string | null;
  clientFeatures?: ProjectRequestCommercialFeature[] | null;
  agreedBudget?: number | null;
  agreedDeliveryDeadline?: string | null;
  agreedClientFeatures?: ProjectRequestCommercialFeature[] | null;
  sourceSpecId?: string | null;
  sourceChangeRequestId?: string | null;
  approvedAt?: string | null;
}

export interface ProjectRequestCommercialChangeRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  requestedByBrokerId: string;
  requestedAt: string;
  respondedAt?: string | null;
  respondedByClientId?: string | null;
  responseNote?: string | null;
  currentBudget?: number | null;
  proposedBudget?: number | null;
  currentTimeline?: string | null;
  proposedTimeline?: string | null;
  currentClientFeatures?: ProjectRequestCommercialFeature[] | null;
  proposedClientFeatures?: ProjectRequestCommercialFeature[] | null;
  parentSpecId?: string | null;
  requestBudgetRange?: string | null;
  proposedBudgetOutsideRequestRange?: boolean;
  proposedBudgetRangeWarning?: string | null;
  clientAcknowledgedBudgetRangeWarning?: boolean;
  clientAcknowledgedBudgetRangeWarningAt?: string | null;
}

export interface RequestPartySummary {
  id: string;
  fullName?: string | null;
  email?: string | null;
  handle?: string | null;
  currentTrustScore?: number | string | null;
  totalProjectsFinished?: number | null;
  totalDisputesLost?: number | null;
  recentProjects?: Array<{
    id: string;
    title?: string | null;
    status?: string | null;
    updatedAt?: string | null;
  }>;
}

export interface RequestSlotSummary {
  cap: number;
  windowHours: number;
  activeApplications: number;
  remainingSlots: number;
  hasCapacity: boolean;
  windowStartedAt?: string;
  windowEndsAt?: string;
}

export interface RequestCandidateProfileSummary {
  bio?: string | null;
  companyName?: string | null;
}

export interface RequestMatchCandidate {
  id?: string;
  candidateId?: string;
  userId?: string;
  fullName?: string | null;
  classificationLabel?: string | null;
  matchScore?: number | null;
  aiRelevanceScore?: number | null;
  tagOverlapScore?: number | null;
  trustScore?: number | string | null;
  normalizedTrust?: number | string | null;
  matchedSkills?: string[];
  reasoning?: string | null;
  candidateProfile?: RequestCandidateProfileSummary | null;
}

export interface BrokerApplicationItem {
  id: string;
  status: string;
  brokerId?: string;
  coverLetter?: string | null;
  createdAt?: string | null;
  broker?: RequestPartySummary | null;
}

export interface FreelancerProposalItem {
  id: string;
  freelancerId?: string;
  brokerId?: string | null;
  status: string;
  coverLetter?: string | null;
  createdAt?: string | null;
  freelancer?: RequestPartySummary | null;
  broker?: RequestPartySummary | null;
}

export interface RequestFlowSnapshot {
  phase:
    | "REQUEST_INTAKE"
    | "SPEC_WORKFLOW"
    | "FREELANCER_SELECTION"
    | "FINAL_SPEC_REVIEW"
    | "CONTRACT"
    | "PROJECT_CREATED";
  phaseNumber: number;
  status: string;
  brokerAssigned: boolean;
  freelancerSelected: boolean;
  clientSpecStatus?: string | null;
  fullSpecStatus?: string | null;
  linkedContractId?: string | null;
  linkedProjectId?: string | null;
  contractActivated?: boolean;
  readOnly: boolean;
  nextAction?: string | null;
}

export interface ProjectRequest {
  id: string;
  title: string;
  description: string;
  status: RequestStatus;
  clientId: string;
  brokerId?: string | null;
  budgetRange?: string | null;
  requestedDeadline?: string | null;
  intendedTimeline?: string | null;
  techPreferences?: string | null;
  attachments?: ProjectRequestAttachment[] | null;
  originalRequestContext?: {
    title: string;
    description: string;
    budgetRange?: string | null;
    requestedDeadline?: string | null;
    intendedTimeline?: string | null;
    techPreferences?: string | null;
    attachments?: ProjectRequestAttachment[] | null;
  };
  requestScopeBaseline?: ProjectRequestScopeBaseline | null;
  commercialBaseline?: ProjectRequestCommercialBaseline | null;
  activeCommercialChangeRequest?: ProjectRequestCommercialChangeRequest | null;
  wizardProgressStep?: number | null;
  answers?: Array<{
    id?: string;
    valueText?: string | null;
    question?: { id?: string; code?: string | null; label?: string | null } | null;
    option?: { id?: string; label?: string | null } | null;
  }>;
  createdAt: string;
  updatedAt?: string;
  client?: RequestPartySummary | null;
  broker?: RequestPartySummary | null;
  specs?: ProjectSpec[];
  brokerProposals?: BrokerApplicationItem[];
  freelancerProposals?: FreelancerProposalItem[];
  proposals?: FreelancerProposalItem[];
  specSummary?: {
    clientSpec?: {
      id: string;
      title?: string | null;
      status: string;
      specPhase: string;
    } | null;
    fullSpec?: {
      id: string;
      title?: string | null;
      status: string;
      specPhase: string;
    } | null;
  };
  linkedProjectSummary?: {
    id: string;
    title?: string | null;
    status?: string | null;
    client?: RequestPartySummary | null;
    broker?: RequestPartySummary | null;
    freelancer?: RequestPartySummary | null;
  } | null;
  linkedContractSummary?: {
    id: string;
    status?: string | null;
    activatedAt?: string | null;
    contractUrl?: string | null;
    title?: string | null;
    projectId?: string | null;
    projectStatus?: string | null;
  } | null;
  brokerApplicationSummary?: {
    total: number;
    invited: number;
    pending: number;
    accepted: number;
    rejected: number;
    assignedBrokerId?: string | null;
    items: BrokerApplicationItem[];
    slots?: RequestSlotSummary;
  };
  brokerSelectionSummary?: {
    assignedBrokerId?: string | null;
    assignedBroker?: RequestPartySummary | null;
    totalApplications: number;
    activeApplications: number;
    items: BrokerApplicationItem[];
    slots?: RequestSlotSummary;
  };
  freelancerSelectionSummary?: {
    total: number;
    invited: number;
    pendingClientApproval?: number;
    pending: number;
    accepted: number;
    rejected: number;
    selectedFreelancerId?: string | null;
    selectedFreelancer?: FreelancerProposalItem | null;
    items: FreelancerProposalItem[];
  };
  brokerDraftSpecSummary?: {
    clientSpec?: {
      id: string;
      title?: string | null;
      status: string;
      specPhase: string;
    } | null;
    fullSpec?: {
      id: string;
      title?: string | null;
      status: string;
      specPhase: string;
    } | null;
    clientApproved: boolean;
    fullSpecReadyForContract: boolean;
    fullSpecNeedsReview: boolean;
  };
  marketVisibility?: {
    brokerMarket: "OPEN" | "CLOSED" | "DIRECT_INVITE_ONLY";
    freelancerMarket: "OPEN" | "CLOSED" | "LOCKED";
    brokerSlotCapReached: boolean;
    brokerSlots?: RequestSlotSummary;
  };
  flowSnapshot?: RequestFlowSnapshot;
  requestProgress?: {
    phase: string;
    status: string;
    brokerAssigned: boolean;
    freelancerSelected: boolean;
    clientSpecStatus?: string | null;
    fullSpecStatus?: string | null;
    linkedContractId?: string | null;
    linkedProjectId?: string | null;
    contractActivated?: boolean;
  };
  viewerPermissions?: {
    canViewRequest: boolean;
    canViewSpecs: boolean;
    canViewBrokerMatches: boolean;
    canInviteBroker: boolean;
    canAcceptBroker: boolean;
    canReleaseBrokerSlot?: boolean;
    canApplyAsBroker: boolean;
    canViewContract: boolean;
    canOpenLinkedProject: boolean;
    canInviteFreelancer?: boolean;
    canApproveFreelancerInvite?: boolean;
    canRespondAsFreelancer?: boolean;
    canInitializeContract?: boolean;
  };
}

export interface GetRequestsParams {
  status?: RequestStatus;
}

export interface AssignBrokerPayload {
  brokerId: string;
}
