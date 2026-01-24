export interface ContractSignature {
  userId: string;
  signatureHash: string;
  signedAt: string;
}

export interface Contract {
  id: string;
  projectId: string;
  title: string;
  termsContent: string;
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'ACTIVE';
  createdAt: string;
  project: {
    id: string;
    title: string;
    description: string;
    totalBudget: number;
    clientId: string;
    brokerId: string;
    client?: { fullName: string; email: string };
    broker?: { fullName: string; email: string };
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
