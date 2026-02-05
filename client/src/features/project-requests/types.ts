export const RequestStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  SPEC_SUBMITTED: 'SPEC_SUBMITTED',
  SPEC_APPROVED: 'SPEC_APPROVED',
  PUBLIC_DRAFT: 'PUBLIC_DRAFT',
  PRIVATE_DRAFT: 'PRIVATE_DRAFT',
  BROKER_ASSIGNED: 'BROKER_ASSIGNED',
  CONTRACT_PENDING: 'CONTRACT_PENDING',
  HIRING: 'HIRING',
  CONVERTED_TO_PROJECT: 'CONVERTED_TO_PROJECT',
} as const;

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export interface ProjectRequest {
  id: string;
  clientId: string;
  brokerId: string | null;
  title: string;
  description: string;
  status: RequestStatus;
  budgetRange: string | null;
  intendedTimeline: string | null;
  techPreferences: string | null;
  createdAt: string;
  client?: {
    id: string;
    fullName: string;
    email: string;
    avatar?: string;
  };
  answers?: {
    id: string;
    question: { id: string; label: string };
    option: { id: string; label: string };
    valueText?: string;
  }[];
  spec?: {
    id: string;
    title: string;
    description: string;
    totalBudget: number;
    status: string;
    milestones: {
      id: string;
      title: string;
      amount: number;
      status: string;
    }[];
  };
  brokerProposals?: any[];
}

export interface GetRequestsParams {
  status?: RequestStatus;
}

export interface AssignBrokerPayload {
  brokerId: string;
}
