export interface ContractSignature {
  userId: string;
  signatureHash: string;
  contentHash?: string | null;
  signerRole?: string | null;
  signedAt: string;
  userAgent?: string | null;
  user?: {
    id?: string;
    fullName?: string;
    email?: string;
  };
}

export interface ContractCommercialContext {
  sourceSpecId?: string | null;
  sourceSpecUpdatedAt?: string | null;
  requestId?: string | null;
  projectTitle: string;
  clientId: string;
  brokerId: string;
  freelancerId?: string | null;
  totalBudget: number;
  currency: string;
  description?: string | null;
  techStack?: string | null;
  scopeNarrativeRichContent?: Record<string, unknown> | null;
  scopeNarrativePlainText?: string | null;
  features?: Array<{
    title: string;
    description: string;
    complexity: "LOW" | "MEDIUM" | "HIGH";
    acceptanceCriteria: string[];
    inputOutputSpec?: string | null;
  }> | null;
  escrowSplit?: {
    developerPercentage: number;
    brokerPercentage: number;
    platformPercentage: number;
  } | null;
}

export interface ContractSummary {
  id: string;
  projectId: string;
  requestId?: string | null;
  activatedAt?: string | null;
  projectStatus?: string | null;
  projectTitle: string;
  title: string;
  status: "DRAFT" | "SENT" | "SIGNED" | "ACTIVATED" | "ACTIVE" | "ARCHIVED";
  createdAt: string;
  clientName: string;
  freelancerName?: string | null;
}

export interface ContractMilestoneSnapshotItem {
  contractMilestoneKey: string;
  projectMilestoneId?: string | null;
  sourceSpecMilestoneId: string | null;
  title: string;
  description?: string | null;
  amount: number;
  startDate?: string | null;
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
  status: "DRAFT" | "SENT" | "SIGNED" | "ACTIVATED" | "ACTIVE" | "ARCHIVED";
  activatedAt?: string | null;
  contentHash?: string | null;
  documentHash?: string | null;
  commercialContext?: ContractCommercialContext | null;
  milestoneSnapshot?: ContractMilestoneSnapshotItem[] | null;
  requiredSignerCount?: number;
  signedCount?: number;
  createdAt: string;
  project: {
    id: string;
    title: string;
    description: string;
    totalBudget: number;
    currency?: string;
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
          complexity: "LOW" | "MEDIUM" | "HIGH";
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
