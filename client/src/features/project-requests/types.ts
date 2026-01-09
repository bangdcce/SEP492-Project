export const RequestStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  SPEC_SUBMITTED: 'SPEC_SUBMITTED',
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
    question: { id: string; content: string };
    option: { id: string; content: string };
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
}

export interface GetRequestsParams {
  status?: RequestStatus;
}

export interface AssignBrokerPayload {
  brokerId: string;
}
