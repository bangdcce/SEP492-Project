export interface ContractSignature {
  userId: string;
  signatureHash: string;
  signedAt: string;
  user?: {
    id?: string;
    fullName?: string;
    email?: string;
  };
}

export interface ContractSummary {
  id: string;
  projectId: string;
  requestId?: string | null;
  activatedAt?: string | null;
  projectStatus?: string | null;
  projectTitle: string;
  title: string;
  status: "DRAFT" | "SENT" | "SIGNED" | "ACTIVE";
  createdAt: string;
  clientName: string;
  freelancerName?: string | null;
}

export interface ContractMilestoneSnapshotItem {
  projectMilestoneId: string;
  sourceSpecMilestoneId: string | null;
  title: string;
  description?: string | null;
  amount: number;
  dueDate?: string | null;
  sortOrder?: number | null;
  deliverableType?: string | null;
  retentionAmount?: number | null;
  acceptanceCriteria?: string[] | null;
}

export interface Contract {
  id: string;
  projectId: string;
  sourceSpecId?: string | null;
  title: string;
  termsContent: string;
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'ACTIVE';
  activatedAt?: string | null;
  documentHash?: string | null;
  milestoneSnapshot?: ContractMilestoneSnapshotItem[] | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
    description: string;
    totalBudget: number;
    clientId: string;
    brokerId: string;
    freelancerId?: string | null;
    client?: { fullName: string; email: string };
    broker?: { fullName: string; email: string };
    freelancer?: { fullName: string; email: string };
    request?: {
      spec?: {
        title: string;
        description: string;
        totalBudget: number;
        techStack?: string;
        referenceLinks?: Array<{
          label: string;
          url: string;
        }>;
        features?: Array<{
          id: string;
          title: string;
          description: string;
          complexity: 'LOW' | 'MEDIUM' | 'HIGH';
          acceptanceCriteria: string[];
          inputOutputSpec?: string;
        }>;
        milestones?: Array<{
          id: string;
          title: string;
          description?: string;
          amount: number;
          deliverableType: string;
          retentionAmount?: number;
          acceptanceCriteria?: string[];
          sortOrder?: number;
          dueDate?: string;
        }>;
      };
    };
  };
  signatures?: ContractSignature[];
}
