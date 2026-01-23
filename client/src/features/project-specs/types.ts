export enum ProjectSpecStatus {
  DRAFT = 'DRAFT',
  PENDING_AUDIT = 'PENDING_AUDIT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
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

export interface SpecFeatureDTO {
  title: string;
  description: string;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  acceptanceCriteria: string[];
  inputOutputSpec?: string;
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
}

export interface CreateProjectSpecDTO {
  requestId: string;
  title: string;
  description: string;
  totalBudget: number;
  milestones: CreateMilestoneDTO[];
  features?: SpecFeatureDTO[];
  techStack?: string;
  referenceLinks?: ReferenceLinkDTO[];
  status?: ProjectSpecStatus; // Allow specifying initial status
}

export interface ProjectSpec {
  id: string;
  requestId: string;
  request?: {
    id: string;
    title: string;
    client?: { fullName: string; email: string };
    broker?: { fullName: string; email: string };
  };
  title: string;
  description: string;
  totalBudget: number;
  status: ProjectSpecStatus;
  createdAt: string;
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
  }[];
}
