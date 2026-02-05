export type Project = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  clientId: string;
  brokerId?: string;
  freelancerId?: string;
  totalBudget: number;
  currency?: string;
  createdAt: string;
  // Dispute-related fields (enriched by backend)
  hasActiveDispute?: boolean;
  activeDisputeCount?: number;
};
