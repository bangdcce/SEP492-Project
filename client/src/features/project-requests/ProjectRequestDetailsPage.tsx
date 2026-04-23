import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  Mail,
  User,
  Calendar,
  DollarSign,
  Monitor,
  FileText,
  UserPlus,
  FileSignature,
  Check,
  Clock3,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";

import type { ProjectRequest, RequestStatus } from "./types";
import { projectRequestsApi } from "./api";
import { wizardService } from "@/features/wizard/services/wizardService";
import { contractsApi } from "@/features/contracts/api";
import type { ContractSummary } from "@/features/contracts/types";
import type { ProjectSpec } from "@/features/project-specs/types";
import { ProjectSpecStatus, SpecPhase } from "@/features/project-specs/types";
import type { RequestMatchCandidate } from "@/features/requests/types";
import { InviteModal } from "@/features/discovery/InviteModal";
import { CandidateProfileModal } from "@/features/requests/components/CandidateProfileModal";
import { ScoreExplanationModal } from "@/features/requests/components/ScoreExplanationModal";
import { RequestFreelancerMarketPanel } from "@/features/requests/components/RequestFreelancerMarketPanel";
import { RequestAttachmentGallery } from "@/features/requests/components/RequestAttachmentGallery";
import { RequestChatPanel } from "@/features/request-chat/RequestChatPanel";
import { Button } from "@/shared/components/custom/Button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { getApiErrorDetails } from "@/shared/utils/apiError";
import { connectSocket } from "@/shared/realtime/socket";
import { toast } from "sonner";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import {
  formatHumanStatus,
  getSelectedFreelancerProposal,
  isContractActivated,
  pickLatestSpecByPhase,
  resolveRequestFlowSnapshot,
} from "../requests/requestFlow";
import {
  MATCH_PAGE_SIZE,
  mergeMatchCandidates,
} from "../requests/matchDisplay";
import { ProposalModal } from "./components/ProposalModal";
import { buildTrustProfilePath } from "@/features/trust-profile/routes";

type BrokerSpecFlow = {
  clientSpec: ProjectSpec | null;
  fullSpec: ProjectSpec | null;
};

type CurrentUserSummary = {
  id?: string;
  role?: string;
};

export default function ProjectRequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<ProjectRequest | null>(null);
  const [specFlow, setSpecFlow] = useState<BrokerSpecFlow>({
    clientSpec: null,
    fullSpec: null,
  });
  const [linkedContract, setLinkedContract] = useState<ContractSummary | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const user = useCurrentUser<CurrentUserSummary>();
  const [freelancerMatches, setFreelancerMatches] = useState<
    RequestMatchCandidate[]
  >([]);
  const [freelancerMatchesLoading, setFreelancerMatchesLoading] =
    useState(false);
  const [freelancerMatchesLoadingMore, setFreelancerMatchesLoadingMore] =
    useState(false);
  const [freelancerMatchMode, setFreelancerMatchMode] = useState<
    "quick" | "ai"
  >("quick");
  const [freelancerMatchPage, setFreelancerMatchPage] = useState(1);
  const [freelancerHasMoreMatches, setFreelancerHasMoreMatches] =
    useState(false);
  const [selectedCandidate, setSelectedCandidate] =
    useState<RequestMatchCandidate | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isScoreExplanationOpen, setIsScoreExplanationOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteModalData, setInviteModalData] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const isAdmin = user?.role === "ADMIN";

  const fetchFreelancerMatches = useCallback(
    async (
      requestId: string,
      options?: {
        useAi?: boolean;
        page?: number;
        append?: boolean;
        showToast?: boolean;
      },
    ) => {
      const useAi = options?.useAi ?? false;
      const page = options?.page ?? 1;
      const append = options?.append ?? false;
      const showToast = options?.showToast ?? useAi;

      try {
        if (append) {
          setFreelancerMatchesLoadingMore(true);
        } else {
          setFreelancerMatchesLoading(true);
        }

        const data = useAi
          ? await wizardService.getFreelancerMatches(requestId, {
              enableAi: true,
              topN: MATCH_PAGE_SIZE,
              page,
            })
          : await wizardService.getFreelancerMatchesQuick(requestId, {
              topN: MATCH_PAGE_SIZE,
              page,
            });
        const nextMatches = Array.isArray(data) ? data : [];

        setFreelancerMatches((previous) =>
          append ? mergeMatchCandidates(previous, nextMatches) : nextMatches,
        );
        setFreelancerMatchMode(useAi ? "ai" : "quick");
        setFreelancerMatchPage(page);
        setFreelancerHasMoreMatches(nextMatches.length === MATCH_PAGE_SIZE);

        if (showToast && useAi && page === 1) {
          toast.success("AI analysis complete");
        }
      } catch (err) {
        console.error("Failed to load freelancer matches:", err);
        if (!append) {
          setFreelancerMatches([]);
        }
        setFreelancerHasMoreMatches(false);
        toast.error("Failed to load freelancer matches.");
      } finally {
        if (append) {
          setFreelancerMatchesLoadingMore(false);
        } else {
          setFreelancerMatchesLoading(false);
        }
      }
    },
    [],
  );

  // Helper moved to top level

  const handleBack = () => {
    if (isAdmin) {
      navigate("/admin/dashboard");
    } else if (user?.role === "BROKER") {
      // If assigned to me, go to My Requests, otherwise Marketplace
      if (request?.brokerId === user?.id) {
        navigate("/broker/my-requests");
      } else {
        navigate("/broker/marketplace");
      }
    } else {
      navigate("/client/my-requests");
    }
  };

  const fetchRequest = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const requestResponse = await projectRequestsApi.getById(id);
      setRequest(requestResponse);
      const requestSpecs = Array.isArray(requestResponse?.specs)
        ? requestResponse.specs
        : [];
      const nextSpecFlow = {
        clientSpec: pickLatestSpecByPhase(requestSpecs, SpecPhase.CLIENT_SPEC),
        fullSpec: pickLatestSpecByPhase(requestSpecs, SpecPhase.FULL_SPEC),
      };
      setSpecFlow(nextSpecFlow);
      const nextLinkedContract =
        (requestResponse?.linkedContractSummary as ContractSummary | null) ||
        null;
      setLinkedContract(nextLinkedContract);

      const nextFlowSnapshot = resolveRequestFlowSnapshot(
        requestResponse,
        nextSpecFlow,
        nextLinkedContract,
      );
      if (
        nextFlowSnapshot.phaseNumber >= 3 &&
        requestResponse?.viewerPermissions?.canInviteFreelancer
      ) {
        await fetchFreelancerMatches(requestResponse.id, {
          useAi: false,
          page: 1,
          showToast: false,
        });
      } else {
        setFreelancerMatches([]);
        setFreelancerHasMoreMatches(false);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch request:", err);
      setError(
        getApiErrorDetails(err, "Failed to load project request details.")
          .message,
      );
    } finally {
      setIsLoading(false);
    }
  }, [fetchFreelancerMatches, id]);

  useEffect(() => {
    void fetchRequest();
  }, [fetchRequest]);

  useEffect(() => {
    if (!id) return;
    const socket = connectSocket();
    const refetchIfRelevant = (payload: {
      requestId?: string | null;
      specId?: string | null;
      contractId?: string | null;
      projectId?: string | null;
    }) => {
      const knownSpecIds = new Set(
        [specFlow.clientSpec?.id, specFlow.fullSpec?.id]
          .concat((request?.specs || []).map((spec) => spec.id))
          .filter((value): value is string => Boolean(value)),
      );

      const isRelevant =
        (payload?.requestId && payload.requestId === id) ||
        (payload?.contractId &&
          payload.contractId ===
            (request?.linkedContractSummary?.id || linkedContract?.id)) ||
        (payload?.projectId &&
          payload.projectId === request?.linkedProjectSummary?.id) ||
        (payload?.specId && knownSpecIds.has(payload.specId));

      if (isRelevant) {
        void fetchRequest();
      }
    };

    const handleNotificationCreated = (payload: {
      notification?: {
        relatedType?: string | null;
        relatedId?: string | null;
      };
      relatedType?: string | null;
      relatedId?: string | null;
    }) => {
      const notification = payload?.notification ?? payload;
      const relatedType = String(notification?.relatedType || "");
      const relatedId = String(notification?.relatedId || "");
      const knownSpecIds = new Set(
        [specFlow.clientSpec?.id, specFlow.fullSpec?.id]
          .concat((request?.specs || []).map((spec) => spec.id))
          .filter((value): value is string => Boolean(value)),
      );

      const isRelevant =
        (relatedType === "ProjectRequest" && relatedId === id) ||
        (relatedType === "Project" &&
          Boolean(request?.linkedProjectSummary?.id) &&
          relatedId === request?.linkedProjectSummary?.id) ||
        (relatedType === "Contract" &&
          Boolean(request?.linkedContractSummary?.id) &&
          relatedId === request?.linkedContractSummary?.id) ||
        (relatedType === "ProjectSpec" && knownSpecIds.has(relatedId));

      if (isRelevant) {
        void fetchRequest();
      }
    };

    socket.on("NOTIFICATION_CREATED", handleNotificationCreated);
    socket.on("REQUEST_UPDATED", refetchIfRelevant);
    socket.on("SPEC_UPDATED", refetchIfRelevant);
    socket.on("CONTRACT_UPDATED", refetchIfRelevant);
    return () => {
      socket.off("NOTIFICATION_CREATED", handleNotificationCreated);
      socket.off("REQUEST_UPDATED", refetchIfRelevant);
      socket.off("SPEC_UPDATED", refetchIfRelevant);
      socket.off("CONTRACT_UPDATED", refetchIfRelevant);
    };
  }, [
    fetchRequest,
    id,
    linkedContract?.id,
    request?.linkedContractSummary?.id,
    request?.linkedProjectSummary?.id,
    request?.specs,
    specFlow.clientSpec?.id,
    specFlow.fullSpec?.id,
  ]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] col-span-2" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Error Loading Request
            </h3>
            <p className="text-gray-600 mb-4">
              {error || "Could not load the project request details."}
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/project-requests")}
            >
              Back to List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clientSpec = specFlow.clientSpec;
  const fullSpec = specFlow.fullSpec;
  const selectedFreelancerProposal = getSelectedFreelancerProposal(request);
  const hasSelectedFreelancer = Boolean(selectedFreelancerProposal);
  const flowSnapshot = resolveRequestFlowSnapshot(
    request,
    specFlow,
    linkedContract,
  );
  const brokerWorkflowPhase = flowSnapshot.phaseNumber;

  const canBrokerReviewFinalSpec =
    !!fullSpec &&
    (fullSpec.status === ProjectSpecStatus.FINAL_REVIEW ||
      fullSpec.status === ProjectSpecStatus.ALL_SIGNED);
  const canInitializeContract =
    fullSpec?.status === ProjectSpecStatus.ALL_SIGNED;
  const contractActivated = isContractActivated(linkedContract);
  const canOpenWorkspace = Boolean(
    linkedContract?.projectId && contractActivated,
  );
  const brokerSlotSummary = request?.brokerApplicationSummary?.slots || null;
  const ownBrokerApplication =
    request?.brokerApplicationSummary?.items?.find(
      (proposal) =>
        proposal.brokerId === user?.id || proposal.broker?.id === user?.id,
    ) || null;
  const hasAppliedToRequest = Boolean(ownBrokerApplication);
  const canManageBrokerWorkflow =
    user?.role === "BROKER" &&
    request.brokerId === user?.id &&
    Boolean(request.viewerPermissions?.canViewSpecs);
  const canApplyAsBroker =
    user?.role === "BROKER" &&
    Boolean(request.viewerPermissions?.canApplyAsBroker);
  const showWorkflowPhases = canManageBrokerWorkflow;
  const canViewRequestChat = Boolean(
    request.id && (canManageBrokerWorkflow || isAdmin),
  );
  const requestChatReadOnly = Boolean(isAdmin && !canManageBrokerWorkflow);
  const sidebarStatusLabel = canManageBrokerWorkflow
    ? `Workflow phase ${brokerWorkflowPhase}/5`
    : hasAppliedToRequest
      ? "Application submitted"
      : "Marketplace request";

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "PROCESSING":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "COMPLETED":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "CANCELED":
      case "CANCELLED":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleApplyToRequest = async (coverLetter: string) => {
    if (!request || !request.id) return;

    try {
      setIsApplying(true);
      await projectRequestsApi.applyToRequest(request.id, coverLetter);
      await fetchRequest();
      toast.success("Application submitted successfully.");
    } catch (err: unknown) {
      console.error("Failed to apply to request:", err);
      toast.error("Failed to submit application.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleInitializeContract = async () => {
    if (!fullSpec?.id) return;

    try {
      setIsCreatingContract(true);
      const contract = await contractsApi.initializeContract(fullSpec.id);
      navigate(`/broker/contracts/${contract.id}`);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        "Failed to create contract from final spec.";
      if (String(message).toLowerCase().includes("already initialized")) {
        toast.info(message, { description: "Opening contracts list." });
        navigate("/broker/contracts");
        return;
      }
      toast.error(String(message));
    } finally {
      setIsCreatingContract(false);
    }
  };

  const handleOpenCandidateProfile = (candidate: RequestMatchCandidate) => {
    setSelectedCandidate(candidate);
    setIsProfileModalOpen(true);
  };

  const handleOpenFreelancerInvite = (
    freelancerId: string,
    freelancerName: string,
  ) => {
    setInviteModalData({
      id: freelancerId,
      name: freelancerName,
    });
    setIsInviteModalOpen(true);
  };

  const handleLoadMoreFreelancers = () => {
    if (
      !id ||
      freelancerMatchesLoading ||
      freelancerMatchesLoadingMore ||
      !freelancerHasMoreMatches
    ) {
      return;
    }

    void fetchFreelancerMatches(id, {
      useAi: freelancerMatchMode === "ai",
      page: freelancerMatchPage + 1,
      append: true,
      showToast: false,
    });
  };

  const nextAction = (() => {
    if (user?.role !== "BROKER") {
      return {
        title: "Read-only mode",
        description: "This panel shows the broker execution flow only.",
        ctaLabel: "Go Back",
        onClick: handleBack,
        ctaVariant: "outline" as const,
      };
    }

    if (!canManageBrokerWorkflow) {
      if (hasAppliedToRequest) {
        return {
          title: "Application submitted",
          description:
            "Your broker application is in the queue. The client needs to choose you before any workflow actions unlock.",
          ctaLabel: "Open Marketplace",
          onClick: () => navigate("/broker/marketplace"),
          ctaVariant: "outline" as const,
        };
      }

      if (canApplyAsBroker) {
        return {
          title: "Review and apply",
          description:
            "You can read the project detail and submit a broker application. Spec, freelancer, and contract actions stay locked until the client selects you.",
          ctaLabel: isApplying ? "Submitting..." : "Apply to This Request",
          onClick: () => setIsProposalModalOpen(true),
          disabled: isApplying,
          ctaVariant: "primary" as const,
        };
      }

      return {
        title: "Waiting for assigned broker",
        description:
          "Only the broker chosen by the client can continue the spec and contract workflow for this request.",
        ctaLabel: "Open Marketplace",
        onClick: () => navigate("/broker/marketplace"),
        ctaVariant: "outline" as const,
      };
    }

    if (!clientSpec) {
      return {
        title: "Draft Client Spec",
        description:
          "Start with a client-readable spec so the client can approve scope.",
        ctaLabel: "Create Client Spec",
        onClick: () =>
          navigate(`/broker/project-requests/${request.id}/create-client-spec`),
        ctaVariant: "primary" as const,
      };
    }

    if (clientSpec.status === ProjectSpecStatus.REJECTED) {
      return {
        title: "Client Spec was rejected",
        description: clientSpec.rejectionReason
          ? `Revise the Client Spec based on the client's feedback: ${clientSpec.rejectionReason}`
          : "Revise the Client Spec and submit it again for client review.",
        ctaLabel: "Revise Client Spec",
        onClick: () =>
          navigate(`/broker/project-requests/${request.id}/create-client-spec`),
        ctaVariant: "primary" as const,
      };
    }

    if (clientSpec.status === ProjectSpecStatus.DRAFT) {
      return {
        title: "Finish Client Spec draft",
        description:
          "Continue editing the client-readable scope, then submit it for client review.",
        ctaLabel: "Edit Client Spec",
        onClick: () =>
          navigate(`/broker/project-requests/${request.id}/create-client-spec`),
        ctaVariant: "primary" as const,
      };
    }

    if (clientSpec.status === ProjectSpecStatus.CLIENT_REVIEW) {
      return {
        title: "Complete Client Spec approval",
        description:
          "Client must approve Client Spec before freelancer selection and Final Spec sign-off.",
        ctaLabel: "Open Client Review",
        onClick: () => navigate(`/broker/specs/${clientSpec.id}`),
        ctaVariant: "outline" as const,
      };
    }

    if (!hasSelectedFreelancer) {
      return {
        title: "Wait for freelancer acceptance",
        description:
          "Client needs to invite freelancer and get one accepted signer before final review.",
        ctaLabel: "Refresh",
        onClick: () => void fetchRequest(),
        ctaVariant: "outline" as const,
      };
    }

    if (!fullSpec) {
      return {
        title: "Draft Final Spec",
        description:
          "Create the technical Final Spec to prepare for 3-party sign-off.",
        ctaLabel: "Create Final Spec",
        onClick: () =>
          navigate(`/broker/project-requests/${request.id}/create-spec`),
        ctaVariant: "primary" as const,
      };
    }

    if (
      fullSpec.status === ProjectSpecStatus.DRAFT ||
      fullSpec.status === ProjectSpecStatus.REJECTED
    ) {
      return {
        title: "Submit Final Spec for sign-off",
        description:
          "Finalize milestones and submit Final Spec for client/broker/freelancer signing.",
        ctaLabel: "Open Final Spec",
        onClick: () =>
          navigate(`/broker/project-requests/${request.id}/create-spec`),
        ctaVariant: "primary" as const,
      };
    }

    if (fullSpec.status === ProjectSpecStatus.FINAL_REVIEW) {
      return {
        title: "3-party Final Spec signing in progress",
        description: "Open Final Spec review and complete all signatures.",
        ctaLabel: "Review & Sign Final Spec",
        onClick: () => navigate(`/broker/specs/${fullSpec.id}`),
        ctaVariant: "primary" as const,
      };
    }

    if (fullSpec.status === ProjectSpecStatus.ALL_SIGNED && !linkedContract) {
      return {
        title: "Initialize Contract",
        description: "Final Spec is fully signed. Generate the contract now.",
        ctaLabel: isCreatingContract
          ? "Creating Contract..."
          : "Create Contract",
        onClick: handleInitializeContract,
        ctaVariant: "primary" as const,
        disabled: isCreatingContract,
      };
    }

    if (linkedContract && !contractActivated) {
      return {
        title: "Contract signing",
        description:
          "Contract exists. Keep collecting signatures until project is activated.",
        ctaLabel: "Open Contract",
        onClick: () => navigate(`/broker/contracts/${linkedContract.id}`),
        ctaVariant: "primary" as const,
      };
    }

    if (linkedContract && canOpenWorkspace) {
      return {
        title: "Project activated",
        description:
          "All contract steps are complete. Continue execution in workspace.",
        ctaLabel: "Open Workspace",
        onClick: () =>
          navigate(`/broker/workspace/${linkedContract.projectId}`),
        ctaVariant: "primary" as const,
      };
    }

    return {
      title: "Review workflow",
      description: "Refresh this page to sync latest spec/contract state.",
      ctaLabel: "Refresh",
      onClick: () => void fetchRequest(),
      ctaVariant: "outline" as const,
    };
  })();

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Request Details</h1>
      </div>

      {(request.attachments?.length || brokerSlotSummary) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Request Attachments</CardTitle>
              <CardDescription>
                Shared intake documents that stay attached to the request draft.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {request.attachments?.length ? (
                <RequestAttachmentGallery attachments={request.attachments} />
              ) : (
                <p className="text-sm text-slate-500">
                  No attachment uploaded.
                </p>
              )}
            </CardContent>
          </Card>

          {brokerSlotSummary && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Broker Application Window
                </CardTitle>
                <CardDescription>
                  Active broker slots are capped to keep the request review
                  queue manageable.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Active
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {brokerSlotSummary.activeApplications}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Remaining
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {brokerSlotSummary.remainingSlots}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Window
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {brokerSlotSummary.windowHours}h
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {canManageBrokerWorkflow && (
            <Card className="overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_38%),linear-gradient(135deg,_#f8fffe_0%,_#f8fafc_52%,_#eefbf8_100%)] shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Broker Spec Actions</CardTitle>
                <CardDescription>
                  Keep the request moving from approved client scope to selected
                  freelancer, final spec, and contract.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Client Spec
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {clientSpec
                        ? formatHumanStatus(clientSpec.status)
                        : "Not started"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Freelancer signer
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {hasSelectedFreelancer ? "Selected" : "Still needed"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Final Spec
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {fullSpec
                        ? formatHumanStatus(fullSpec.status)
                        : "Not started"}
                    </p>
                  </div>
                </div>

                {!hasSelectedFreelancer && fullSpec && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                    Final Spec drafting can happen early, but the request is
                    still operationally in freelancer-selection until one signer
                    is accepted.
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() =>
                      navigate(
                        `/broker/project-requests/${request.id}/create-client-spec`,
                      )
                    }
                  >
                    {clientSpec ? "Open Client Spec" : "Create Client Spec"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(
                        `/broker/project-requests/${request.id}/create-spec`,
                      )
                    }
                  >
                    {fullSpec ? "Open Final Spec" : "Create Final Spec"}
                  </Button>
                  {canBrokerReviewFinalSpec && fullSpec && (
                    <Button
                      variant={
                        fullSpec.status === ProjectSpecStatus.FINAL_REVIEW
                          ? "primary"
                          : "outline"
                      }
                      onClick={() => navigate(`/broker/specs/${fullSpec.id}`)}
                    >
                      {fullSpec.status === ProjectSpecStatus.FINAL_REVIEW
                        ? "Review & Sign Final Spec"
                        : "View Final Spec"}
                    </Button>
                  )}
                  {canInitializeContract && (
                    <Button
                      onClick={handleInitializeContract}
                      disabled={isCreatingContract}
                    >
                      {isCreatingContract
                        ? "Creating Contract..."
                        : "Create Contract"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {canManageBrokerWorkflow && (
            <RequestFreelancerMarketPanel
              currentPhase={brokerWorkflowPhase}
              hasAcceptedFreelancer={hasSelectedFreelancer}
              selectedFreelancerProposal={selectedFreelancerProposal}
              recommendedFreelancers={
                request.freelancerSelectionSummary?.items || []
              }
              freelancerMatchesLoading={freelancerMatchesLoading}
              freelancerMatches={freelancerMatches}
              onPhaseAdvance={() =>
                navigate(
                  fullSpec
                    ? `/broker/specs/${fullSpec.id}`
                    : `/broker/project-requests/${request.id}/create-spec`,
                )
              }
              onQuickMatch={() =>
                void fetchFreelancerMatches(request.id, {
                  useAi: false,
                  page: 1,
                  showToast: false,
                })
              }
              onAiMatch={() =>
                void fetchFreelancerMatches(request.id, {
                  useAi: true,
                  page: 1,
                  showToast: true,
                })
              }
              onOpenScoreExplanation={() => setIsScoreExplanationOpen(true)}
              onSearchMarketplace={() =>
                void fetchFreelancerMatches(request.id, {
                  useAi: false,
                  page: 1,
                  showToast: false,
                })
              }
              onOpenProfile={handleOpenCandidateProfile}
              onInviteFreelancer={handleOpenFreelancerInvite}
              onLoadMore={handleLoadMoreFreelancers}
              canLoadMore={freelancerHasMoreMatches}
              isLoadingMore={freelancerMatchesLoadingMore}
            />
          )}

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-4 w-full justify-start">
              <TabsTrigger value="overview">Overview & Status</TabsTrigger>
              {showWorkflowPhases ? (
                <TabsTrigger value="phases">Workflow Phases</TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{request.title}</CardTitle>
                      <CardDescription>
                        Created on {format(new Date(request.createdAt), "PPP")}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Description
                    </h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {request.description}
                    </p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span>Budget Range</span>
                      </div>
                      <p className="font-medium text-sm">
                        {request.budgetRange || "Not specified"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Intended Timeline</span>
                      </div>
                      <p className="font-medium text-sm">
                        {request.intendedTimeline || "Not specified"}
                      </p>
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Monitor className="h-4 w-4" />
                        <span>Tech Preferences</span>
                      </div>
                      <p className="font-medium text-sm">
                        {request.techPreferences || "None specified"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {request.answers && request.answers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Additional Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {request.answers.map((answer) => (
                        <div
                          key={answer.id}
                          className="p-4 bg-muted/50 rounded-lg space-y-2"
                        >
                          <p className="text-sm font-medium">
                            {answer.question?.label || "Unknown Question"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {answer.option?.label ||
                              answer.valueText ||
                              "No Answer"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {showWorkflowPhases ? (
              <TabsContent value="phases" className="space-y-4">
                <Card
                  className={
                    brokerWorkflowPhase === 1 ? "border-2 border-primary" : ""
                  }
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="bg-slate-100 p-2 rounded-full">
                        <Check className="w-5 h-5 text-slate-600" />
                      </div>
                      Phase 1: Broker Assignment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Request must be assigned to a broker before spec drafting
                      starts.
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={request.brokerId ? "default" : "outline"}>
                        {request.brokerId ? "Assigned" : "Unassigned"}
                      </Badge>
                      {request.brokerId && (
                        <span className="text-sm text-muted-foreground">
                          {request.broker?.fullName || "Assigned broker"}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={
                    brokerWorkflowPhase === 2 ? "border-2 border-primary" : ""
                  }
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      Phase 2: Client Spec (Client Approval)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={clientSpec ? "default" : "outline"}>
                        {clientSpec?.status?.replace(/_/g, " ") ||
                          "NOT CREATED"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Broker drafts client-readable spec, then client
                      approves/rejects it.
                    </p>
                    {clientSpec?.status === ProjectSpecStatus.REJECTED &&
                      clientSpec.rejectionReason && (
                        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                          Client feedback: {clientSpec.rejectionReason}
                        </div>
                      )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={clientSpec ? "outline" : "primary"}
                        onClick={() =>
                          navigate(
                            `/broker/project-requests/${request.id}/create-client-spec`,
                          )
                        }
                      >
                        {clientSpec ? "Open Client Spec" : "Create Client Spec"}
                      </Button>
                      {clientSpec && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            navigate(`/broker/specs/${clientSpec.id}`)
                          }
                        >
                          View Client Spec
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={
                    brokerWorkflowPhase === 3 ? "border-2 border-primary" : ""
                  }
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="bg-orange-100 p-2 rounded-full">
                        <UserPlus className="w-5 h-5 text-orange-600" />
                      </div>
                      Phase 3: Freelancer Selection
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={hasSelectedFreelancer ? "default" : "outline"}
                      >
                        {hasSelectedFreelancer
                          ? "Freelancer Selected"
                          : "Waiting selection"}
                      </Badge>
                      {selectedFreelancerProposal && (
                        <span className="text-sm text-muted-foreground">
                          Proposal status:{" "}
                          {String(
                            selectedFreelancerProposal.status || "",
                          ).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      After Client Spec is approved, broker recommends
                      freelancers and the client approves which invite goes
                      live.
                    </p>
                    {fullSpec &&
                      [
                        ProjectSpecStatus.DRAFT,
                        ProjectSpecStatus.REJECTED,
                      ].includes(fullSpec.status) &&
                      !hasSelectedFreelancer && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          Final Spec draft already exists, but workflow stays in
                          Phase 3 until a freelancer is selected. Drafting early
                          is allowed; sign-off is not.
                        </div>
                      )}
                  </CardContent>
                </Card>

                <Card
                  className={
                    brokerWorkflowPhase === 4 ? "border-2 border-primary" : ""
                  }
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="bg-violet-100 p-2 rounded-full">
                        <FileText className="w-5 h-5 text-violet-600" />
                      </div>
                      Phase 4: Final Spec (3-Party Sign-off)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={fullSpec ? "default" : "outline"}>
                        {fullSpec?.status?.replace(/_/g, " ") || "NOT CREATED"}
                      </Badge>
                      {fullSpec && (
                        <span className="text-sm text-muted-foreground">
                          {fullSpec.milestones?.length || 0} milestones
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Broker drafts Final Spec, submits final review, then
                      Client + Broker + Freelancer sign.
                    </p>
                    {!hasSelectedFreelancer && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        You can draft the Final Spec early, but Phase 4 only
                        becomes active after freelancer selection in Phase 3.
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={fullSpec ? "outline" : "primary"}
                        onClick={() =>
                          navigate(
                            `/broker/project-requests/${request.id}/create-spec`,
                          )
                        }
                      >
                        {fullSpec ? "Open Final Spec" : "Create Final Spec"}
                      </Button>
                      {canBrokerReviewFinalSpec && fullSpec && (
                        <Button
                          onClick={() =>
                            navigate(`/broker/specs/${fullSpec.id}`)
                          }
                          variant={
                            fullSpec.status === ProjectSpecStatus.FINAL_REVIEW
                              ? "primary"
                              : "outline"
                          }
                        >
                          {fullSpec.status === ProjectSpecStatus.FINAL_REVIEW
                            ? "Review & Sign Final Spec"
                            : "View Final Spec"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={
                    brokerWorkflowPhase === 5 ? "border-2 border-primary" : ""
                  }
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="bg-green-100 p-2 rounded-full">
                        <FileSignature className="w-5 h-5 text-green-600" />
                      </div>
                      Phase 5: Contract
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Badge variant="outline">
                      {String(request.status || "").replace(/_/g, " ")}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Contract starts after Final Spec is all-signed. Contract
                      signing and project activation happen in the contract
                      flow.
                    </p>
                    {linkedContract ? (
                      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                        <p className="text-sm font-medium">
                          {linkedContract.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Status:{" "}
                          {String(linkedContract.status || "DRAFT").replace(
                            /_/g,
                            " ",
                          )}
                          {contractActivated ? " · Project activated" : ""}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            onClick={() =>
                              navigate(`/broker/contracts/${linkedContract.id}`)
                            }
                          >
                            Open Contract
                          </Button>
                          {canOpenWorkspace && (
                            <Button
                              variant="primary"
                              onClick={() =>
                                navigate(
                                  `/broker/workspace/${linkedContract.projectId}`,
                                )
                              }
                            >
                              Open Workspace
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={() => void fetchRequest()}
                          >
                            Refresh
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {canInitializeContract && (
                          <Button
                            onClick={handleInitializeContract}
                            disabled={isCreatingContract}
                          >
                            {isCreatingContract
                              ? "Creating Contract..."
                              : "Create Contract"}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => navigate("/broker/contracts")}
                        >
                          Open Contracts
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}
          </Tabs>
        </div>

        {/* Right Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {request.client ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {(request.client.fullName || "C").charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {request.client.fullName || "Unknown Client"}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span>{request.client.email}</span>
                      </div>
                    </div>
                  </div>
                  {user?.role === "BROKER" && request.client.id && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        navigate(
                          buildTrustProfilePath(request.client!.id, {
                            role: user.role,
                          }),
                        )
                      }
                    >
                      View Trust Profile
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Client information unavailable
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Action / Status Card */}
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                Next Action (Broker)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-2 mb-4">
                <Clock3 className="mt-0.5 h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">{nextAction.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {nextAction.description}
                  </p>
                </div>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline">{sidebarStatusLabel}</Badge>
                <Badge variant="secondary">
                  {formatHumanStatus(request.status)}
                </Badge>
              </div>
              <Button
                className="w-full"
                variant={nextAction.ctaVariant}
                onClick={nextAction.onClick}
                disabled={Boolean(nextAction.disabled)}
              >
                {nextAction.ctaLabel}
              </Button>
            </CardContent>
          </Card>

          {canViewRequestChat ? (
            <RequestChatPanel
              requestId={request.id}
              readOnly={requestChatReadOnly}
            />
          ) : null}
        </div>
      </div>

      {request && inviteModalData ? (
        <InviteModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          partnerId={inviteModalData.id}
          partnerName={inviteModalData.name}
          partnerRole="FREELANCER"
          defaultRequestId={request.id}
          onInviteSuccess={() => void fetchRequest()}
        />
      ) : null}

      <CandidateProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        candidate={selectedCandidate}
        profileBasePath={null}
      />

      <ScoreExplanationModal
        isOpen={isScoreExplanationOpen}
        onClose={() => setIsScoreExplanationOpen(false)}
      />

      <ProposalModal
        isOpen={isProposalModalOpen}
        onClose={() => setIsProposalModalOpen(false)}
        onSubmit={(coverLetter) => {
          void handleApplyToRequest(coverLetter);
        }}
      />
    </div>
  );
}
