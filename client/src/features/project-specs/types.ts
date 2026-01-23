export enum ProjectSpecStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface CreateMilestoneDTO {
  title: string;
  description: string;
  amount: number;
  duration?: number;
}

export interface CreateProjectSpecDTO {
  requestId: string;
  title: string;
  description: string;
  totalBudget: number;
  milestones: CreateMilestoneDTO[];
}

export interface ProjectSpec {
  id: string;
  requestId: string;
  title: string;
  description: string;
  totalBudget: number;
  status: ProjectSpecStatus;
  createdAt: string;
  milestones?: {
    id: string;
    title: string;
    description: string;
    amount: number;
    status: string;
  }[];
}
