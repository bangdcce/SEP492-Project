export const RequestStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
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
}

export interface GetRequestsParams {
  status?: RequestStatus;
}

export interface AssignBrokerPayload {
  brokerId: string;
}
