export {
  RequestStatus,
  type RequestStatus as ProjectRequestStatus,
  type ProjectRequest,
  type ProjectRequestAttachment,
  type RequestPartySummary,
  type BrokerApplicationItem,
  type FreelancerProposalItem,
  type RequestFlowSnapshot,
  type GetRequestsParams,
  type AssignBrokerPayload,
} from "../requests/types";

export interface FreelancerRequestAccessItem {
  id: string;
  requestId: string;
  freelancerId: string;
  status: string;
  createdAt: string;
  request?: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    budgetRange?: string | null;
    intendedTimeline?: string | null;
    client?: {
      id: string;
      fullName?: string | null;
    } | null;
    broker?: {
      id: string;
      fullName?: string | null;
    } | null;
  } | null;
}
