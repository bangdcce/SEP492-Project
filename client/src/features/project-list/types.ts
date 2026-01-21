export type Project = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  clientId: string;
  brokerId?: string;
  freelancerId?: string;
  totalBudget: number;
  createdAt: string;
};
