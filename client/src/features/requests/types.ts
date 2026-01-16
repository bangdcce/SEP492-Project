
export enum RequestStatus {
  PUBLIC_DRAFT = 'PUBLIC_DRAFT',
  PRIVATE_DRAFT = 'PRIVATE_DRAFT',
  BROKER_ASSIGNED = 'BROKER_ASSIGNED',
  SPEC_APPROVED = 'SPEC_APPROVED',
  CONTRACT_PENDING = 'CONTRACT_PENDING',
  PENDING_SPECS = 'PENDING_SPECS',
  HIRING = 'HIRING',
  CONVERTED_TO_PROJECT = 'CONVERTED_TO_PROJECT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  
  // Legacy
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
}

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
};
