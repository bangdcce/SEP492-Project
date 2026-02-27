
export const RequestStatus = {
  PUBLIC_DRAFT: 'PUBLIC_DRAFT',
  PRIVATE_DRAFT: 'PRIVATE_DRAFT',
  BROKER_ASSIGNED: 'BROKER_ASSIGNED',
  SPEC_SUBMITTED: 'SPEC_SUBMITTED',
  SPEC_APPROVED: 'SPEC_APPROVED',
  CONTRACT_PENDING: 'CONTRACT_PENDING',
  PENDING_SPECS: 'PENDING_SPECS',
  HIRING: 'HIRING',
  CONVERTED_TO_PROJECT: 'CONVERTED_TO_PROJECT',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELED: 'CANCELED',
  PROCESSING: 'PROCESSING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  
  // Legacy
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
} as const;

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export type ProjectRequest = {
  id: string;
  title: string;
  description: string;
  status: RequestStatus;
  clientId: string;
  budgetRange?: string;
  intendedTimeline?: string;
  techPreferences?: string;
  answers?: any[];
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    fullName: string;
    email?: string;
  };
  broker?: {
    id: string;
    fullName: string;
    email?: string;
  } | null;
  specs?: any[];
  freelancerProposals?: any[];
  proposals?: any[];
};
