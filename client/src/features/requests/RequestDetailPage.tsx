import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Badge,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/shared/components/ui";
import { wizardService } from "../wizard/services/wizardService";
import { format } from "date-fns";
import { ArrowLeft, AlertTriangle, Check, FileText, HelpCircle, Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { ROUTES } from "@/constants";
import { ProjectPhaseStepper } from "./components/ProjectPhaseStepper";
import { RequestDraftAlert } from "./components/RequestDraftAlert";
import { RequestWorkflowBanner } from "./components/RequestWorkflowBanner";
import {
  type BrokerApplicationItem,
  type ProjectRequest,
  type RequestMatchCandidate,
  RequestStatus,
} from "./types";
import { InviteModal } from "../discovery/InviteModal";
import { UserRole } from "@/shared/types/user.types";
import { CandidateProfileModal } from "./components/CandidateProfileModal";
import { ScoreExplanationModal } from "./components/ScoreExplanationModal";
import { RequestBrokerMarketPanel } from "./components/RequestBrokerMarketPanel";
import { RequestFreelancerMarketPanel } from "./components/RequestFreelancerMarketPanel";
import { RequestContractHandoffPanel } from "./components/RequestContractHandoffPanel";
import type { ProjectSpec } from "@/features/project-specs/types";
import { ProjectSpecStatus, SpecPhase } from "@/features/project-specs/types";
import type { ContractSummary } from "@/features/contracts/types";
import { connectSocket } from "@/shared/realtime/socket";
import { getApiErrorDetails } from "@/shared/utils/apiError";
import {
  getSelectedFreelancerProposal,
  isContractActivated,
  pickLatestSpecByPhase,
  resolveRequestFlowSnapshot,
} from "./requestFlow";
import { buildClientNextAction } from "./requestDetailActions";

// Helper for safe date formatting
const safeFormatDate = (dateStr: string | Date | null | undefined, fmt: string) => {
    try {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "Invalid Date";
        return format(d, fmt);
    } catch {
        return "N/A";
    }
};

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [request, setRequest] = useState<ProjectRequest | null>(null);
  const [matches, setMatches] = useState<RequestMatchCandidate[]>([]);
  const [freelancerMatches, setFreelancerMatches] = useState<RequestMatchCandidate[]>([]);
  const [freelancerMatchesLoading, setFreelancerMatchesLoading] = useState(false);
  const [brokerMatchesLoading, setBrokerMatchesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [specFlow, setSpecFlow] = useState<{ clientSpec: ProjectSpec | null; fullSpec: ProjectSpec | null }>({
    clientSpec: null,
    fullSpec: null,
  });
  const [linkedContract, setLinkedContract] = useState<ContractSummary | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<RequestMatchCandidate | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isScoreExplanationOpen, setIsScoreExplanationOpen] = useState(false);
  
  // Tabs State
  const [viewMode, setViewMode] = useState("workflow");
  const [activeTab, setActiveTab] = useState("phase1");
  const [showDraftAlert, setShowDraftAlert] = useState(false);

  // Delete Request State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Hire Broker Warning State
  const [showHireBrokerWarning, setShowHireBrokerWarning] = useState(false);
  const [pendingHireBrokerId, setPendingHireBrokerId] = useState<string | null>(null);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteModalData, setInviteModalData] = useState<{ id: string, name: string, role: "BROKER" | "FREELANCER" } | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  const fetchFreelancerMatches = useCallback(async (requestId: string, useAi: boolean = false) => {
    try {
      setFreelancerMatchesLoading(true);
      const data = useAi
        ? await wizardService.getFreelancerMatches(requestId, { enableAi: true, topN: 10 })
        : await wizardService.getFreelancerMatchesQuick(requestId);
      setFreelancerMatches(data || []);
      if (useAi) toast.success("AI analysis complete");
    } catch (error) {
      console.error('Freelancer matching failed', error);
      setFreelancerMatches([]);
      toast.error("AI analysis failed");
    } finally {
      setFreelancerMatchesLoading(false);
    }
  }, []);

  const fetchBrokerMatches = useCallback(async (requestId: string, useAi: boolean = false) => {
    try {
      setBrokerMatchesLoading(true);
      const data = useAi
        ? await wizardService.getBrokerMatches(requestId, { enableAi: true, topN: 10 })
        : await wizardService.getBrokerMatchesQuick(requestId);
      setMatches(data || []);
      if (useAi) toast.success("AI analysis complete");
    } catch (error) {
      console.error('Broker matching failed', error);
      setMatches([]);
      toast.error("AI analysis failed");
    } finally {
      setBrokerMatchesLoading(false);
    }
  }, []);

  const fetchData = useCallback(async (requestId: string) => {
    try {
      setLoading(true);
      setLoadError(null);
      const reqData = (await wizardService.getRequestById(requestId)) as ProjectRequest;
      setRequest(reqData);
      const requestSpecs = Array.isArray(reqData?.specs) ? reqData.specs : [];
      const nextSpecFlow = {
        clientSpec: pickLatestSpecByPhase(requestSpecs, SpecPhase.CLIENT_SPEC),
        fullSpec: pickLatestSpecByPhase(requestSpecs, SpecPhase.FULL_SPEC),
      };
      setSpecFlow(nextSpecFlow);
      const nextLinkedContract = (reqData?.linkedContractSummary as ContractSummary | null) || null;
      setLinkedContract(nextLinkedContract);

      // Handle matches only if request found
      if (reqData) {
        const canViewBrokerMatches = reqData?.viewerPermissions?.canViewBrokerMatches !== false;
        const applicationItems = reqData?.brokerApplicationSummary?.items || [];
        const matchData = canViewBrokerMatches
          ? await wizardService.getBrokerMatchesQuick(requestId).catch((error) => {
              console.warn("Failed to load broker matches for request detail page", error);
              return [] as BrokerApplicationItem[];
            })
          : [];
        setMatches(applicationItems.length > 0 ? applicationItems : matchData || []);
        const phase = resolveRequestFlowSnapshot(reqData, nextSpecFlow, nextLinkedContract).phaseNumber;
        if (phase > 0) setActiveTab(`phase${phase}`);

        // Auto-fetch freelancer matches for Phase 3+
        if (phase >= 3) {
          fetchFreelancerMatches(requestId, false);
        }
      }
    } catch (error) {
      console.error("Failed to load request details", error);
      const details = getApiErrorDetails(error, "Could not load request details.");
      setLoadError(details.message);
      toast.error("Error", { description: details.message });
    } finally {
      setLoading(false);
    }
  }, [fetchFreelancerMatches]);

  useEffect(() => {
    if (id) {
      void fetchData(id);
    }
  }, [id, fetchData]);

  useEffect(() => {
    if (!id) return;
    const socket = connectSocket();
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
      const linkedProjectId = request?.linkedProjectSummary?.id;
      const linkedContractId = request?.linkedContractSummary?.id;

      const isRelevant =
        (relatedType === "ProjectRequest" && relatedId === id) ||
        (relatedType === "Project" && Boolean(linkedProjectId) && relatedId === linkedProjectId) ||
        (relatedType === "Contract" && Boolean(linkedContractId) && relatedId === linkedContractId) ||
        (relatedType === "ProjectSpec" && id === request?.id);

      if (isRelevant) {
        void fetchData(id);
      }
    };

    socket.on("NOTIFICATION_CREATED", handleNotificationCreated);
    return () => {
      socket.off("NOTIFICATION_CREATED", handleNotificationCreated);
    };
  }, [fetchData, id, request?.id, request?.linkedContractSummary?.id, request?.linkedProjectSummary?.id]);

  const handleStatusChange = async (newStatus: RequestStatus) => {
      try {
          setIsUpdatingStatus(true);
          const updatedRequest = newStatus === RequestStatus.PUBLIC_DRAFT
            ? await wizardService.publishRequest(id!)
            : await wizardService.updateRequest(id!, { status: newStatus });
          setRequest((prev: any) => ({ ...prev, ...(updatedRequest || {}), status: updatedRequest?.status || newStatus }));
          toast.success("Status Updated", {
              description: `Project is now ${(updatedRequest?.status || newStatus).replace('_', ' ').toLowerCase()}`
          });
      } catch {
          toast.error("Failed to update status");
      } finally {
          setIsUpdatingStatus(false);
      }
  };
  const handleRevertToDraft = async () => {
      try {
          // explicitly set to PUBLIC_DRAFT
          await wizardService.updateRequest(id!, { status: RequestStatus.PUBLIC_DRAFT });
          toast.success("Reverted to Draft", {
              description: "Redirecting to wizard for editing...",
          });
          navigate(`/client/wizard?draftId=${id}`);
      } catch {
          toast.error("Failed to revert to draft");
      }
  };

  const handleAcceptBroker = async (brokerId: string) => {
      if (!request) return;
      try {
          await wizardService.acceptBroker(request.id, brokerId);
          toast.success("Broker Hired", { description: "You have assigned a broker to this project." });
          void fetchData(request.id);
      } catch {
          toast.error("Failed to hire broker");
      }
  };

  const handleHireBrokerClick = (brokerId: string) => {
      setPendingHireBrokerId(brokerId);
      setShowHireBrokerWarning(true);
  };

  const handleConfirmHireBroker = () => {
      if (pendingHireBrokerId) {
          handleAcceptBroker(pendingHireBrokerId);
      }
      setShowHireBrokerWarning(false);
      setPendingHireBrokerId(null);
  };

  const handleDeleteRequest = async () => {
      try {
          setIsDeleting(true);
          await wizardService.deleteRequest(id!);
          toast.success("Request Deleted", { description: "Your project request has been permanently deleted." });
          navigate(ROUTES.CLIENT_DASHBOARD);
      } catch (error: any) {
          const message = error?.response?.data?.message || "Failed to delete request";
          toast.error("Delete Failed", { description: message });
      } finally {
          setIsDeleting(false);
          setShowDeleteConfirm(false);
      }
  };

  const handleReleaseBrokerSlot = async (proposalId: string) => {
      if (!request) return;
      try {
          await wizardService.releaseBrokerSlot(request.id, proposalId);
          toast.success("Broker slot released.");
          void fetchData(request.id);
      } catch (error) {
          toast.error(getApiErrorDetails(error, "Failed to release broker slot.").message);
      }
  };

  const handleOpenInviteModal = (partnerId: string, partnerName: string, role: "BROKER" | "FREELANCER") => {
      setInviteModalData({
        id: partnerId,
        name: partnerName,
        role: role
      });
      setIsInviteModalOpen(true);
  };

  const handleInvite = async (brokerId: string, brokerName: string) => {
    handleOpenInviteModal(brokerId, brokerName, "BROKER");
  };

  const handleOpenCandidateProfile = (candidate: RequestMatchCandidate) => {
    setSelectedCandidate(candidate);
    setIsProfileModalOpen(true);
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  if (loadError) {
    return <div className="p-10 text-center text-sm text-slate-600">{loadError}</div>;
  }
  if (!request)
    return <div className="p-10 text-center">Request not found</div>;

  const flowSnapshot = resolveRequestFlowSnapshot(request, specFlow, linkedContract);
  const currentPhase = flowSnapshot.phaseNumber;
  const clientSpec = specFlow.clientSpec;
  const fullSpec = specFlow.fullSpec;
  const selectedFreelancerProposal = getSelectedFreelancerProposal(request);
  const hasAcceptedFreelancer = Boolean(selectedFreelancerProposal);
  const brokerApplications =
    request?.brokerSelectionSummary?.items || request?.brokerApplicationSummary?.items || request?.brokerProposals || [];
  const pendingBrokerApplications = brokerApplications.filter(
    (proposal) => String(proposal?.status || '').toUpperCase() === 'PENDING',
  );
  const nonPendingBrokerApplications = brokerApplications.filter(
    (proposal) => String(proposal?.status || '').toUpperCase() !== 'PENDING',
  );
  const brokerSlotSummary = request?.brokerApplicationSummary?.slots || null;
  const formatSpecStatus = (status: string) => status.replace(/_/g, " ");
  const getSpecStatusColor = (status: string) => {
    switch (status) {
      case ProjectSpecStatus.CLIENT_REVIEW:
      case ProjectSpecStatus.FINAL_REVIEW:
        return "bg-amber-100 text-amber-800";
      case ProjectSpecStatus.CLIENT_APPROVED:
      case ProjectSpecStatus.ALL_SIGNED:
      case ProjectSpecStatus.APPROVED:
        return "bg-green-100 text-green-800";
      case ProjectSpecStatus.REJECTED:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  const clientSpecActionLabel =
    clientSpec?.status === ProjectSpecStatus.CLIENT_REVIEW ? "Review Client Spec" : "View Client Spec";
  const fullSpecActionLabel =
    fullSpec?.status === ProjectSpecStatus.FINAL_REVIEW ? "Review & Sign Final Spec" : "View Final Spec";
  const canDeleteRequest = !request.brokerId && [
    RequestStatus.DRAFT,
    RequestStatus.PUBLIC_DRAFT,
    RequestStatus.PRIVATE_DRAFT,
  ].includes(request.status as any);
  const canOpenContract = Boolean(linkedContract?.id);
  const contractActivated = isContractActivated(linkedContract);
  const canOpenWorkspace = Boolean(linkedContract?.projectId && contractActivated);
  const assignedBrokerProfileId = request.broker?.id ?? null;
  const clientNextAction = buildClientNextAction({
    currentPhase,
    clientSpec,
    fullSpec,
    hasAcceptedFreelancer,
    linkedContract,
    canOpenContract,
    canOpenWorkspace,
    onRefresh: () => {
      if (id) {
        void fetchData(id);
      }
    },
    onSetPhase: (phase) => setActiveTab(`phase${phase}`),
    onOpenClientSpec: (specId) => navigate(`/client/spec-review/${specId}`),
    onOpenFullSpec: (specId) => navigate(`/client/spec-review/${specId}`),
    onOpenContract: (contractId) => navigate(`/client/contracts/${contractId}`),
    onOpenWorkspace: (projectId) => navigate(`/client/workspace/${projectId}`),
  });

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl relative">
      {showDraftAlert && (
        <RequestDraftAlert
          onCancel={() => setShowDraftAlert(false)}
          onConfirm={handleRevertToDraft}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 shadow-2xl border-2 border-red-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-red-900">Delete This Request?</h3>
            </div>
            <p className="text-muted-foreground mb-2 text-sm">
              This action is <strong className="text-red-600">permanent and cannot be undone</strong>.
            </p>
            <p className="text-muted-foreground mb-4 text-sm">
              The request, all associated answers, and any pending broker proposals will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteRequest} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete Permanently
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Hire Broker Warning Dialog */}
      {showHireBrokerWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 shadow-2xl border-2 border-amber-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-amber-900">Important: Read Before Hiring</h3>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-900 leading-relaxed">
                Once you hire a broker, you will <strong>no longer be able to delete</strong> this request.
                If you need to cancel later, you must use the <strong>Dispute</strong> or <strong>Report</strong> system.
              </p>
            </div>
            <p className="text-muted-foreground mb-4 text-xs">
              This safeguard exists to protect brokers from having their work discarded without proper resolution.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowHireBrokerWarning(false); setPendingHireBrokerId(null); }}>Cancel</Button>
              <Button onClick={handleConfirmHireBroker}>
                I Understand, Hire Broker
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <Button
          variant="ghost"
          className="pl-0 hover:bg-transparent hover:text-primary"
          onClick={() => navigate(ROUTES.CLIENT_DASHBOARD)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
              <Dialog>
                 <DialogTrigger asChild>
                    <Button 
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transform transition hover:scale-105"
                    >
                        <HelpCircle className="w-5 h-5 mr-2" /> HELP GUIDE
                    </Button>
                 </DialogTrigger>
                 <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Project Workflow Guide</DialogTitle>
                        <DialogDescription>Follow these steps to successfully hire and manage your project.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                         <div className="flex gap-3">
                             <div className="bg-primary/10 p-2 rounded-full h-fit"><UserPlus className="w-4 h-4 text-primary"/></div>
                             <div>
                                 <h4 className="font-semibold">1. Hire Broker</h4>
                                 <p className="text-sm text-muted-foreground">Set visibility to Public or Private. Invite brokers or accept applications.</p>
                             </div>
                         </div>
                         <div className="flex gap-3">
                             <div className="bg-primary/10 p-2 rounded-full h-fit"><FileText className="w-4 h-4 text-primary"/></div>
                             <div>
                                 <h4 className="font-semibold">2. Approve Client Spec</h4>
                                 <p className="text-sm text-muted-foreground">Review the client-readable scope and approve/reject it.</p>
                             </div>
                         </div>
                         <div className="flex gap-3">
                             <div className="bg-primary/10 p-2 rounded-full h-fit"><Check className="w-4 h-4 text-primary"/></div>
                             <div>
                                 <h4 className="font-semibold">3. Hire Freelancer</h4>
                                 <p className="text-sm text-muted-foreground">Invite freelancer and accept one signer for the project.</p>
                             </div>
                         </div>
                         <div className="flex gap-3">
                             <div className="bg-primary/10 p-2 rounded-full h-fit"><Check className="w-4 h-4 text-primary"/></div>
                             <div>
                                 <h4 className="font-semibold">4. Sign Final Spec</h4>
                                 <p className="text-sm text-muted-foreground">Client + broker + freelancer sign Final Spec together.</p>
                             </div>
                         </div>
                         <div className="flex gap-3">
                             <div className="bg-primary/10 p-2 rounded-full h-fit"><Check className="w-4 h-4 text-primary"/></div>
                             <div>
                                 <h4 className="font-semibold">5. Sign Contract</h4>
                                 <p className="text-sm text-muted-foreground">Contract is created from Final Spec. All parties sign to start workspace.</p>
                             </div>
                         </div>
                    </div>
                 </DialogContent>
              </Dialog>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {request.title}
            </h1>
            <div className="flex items-center gap-2">
                <Badge
                  variant={request.status.includes("DRAFT") ? "outline" : "default"}
                  className="uppercase"
                >
                  {request.status.replace(/_/g, " ")}
                </Badge>
                
                 {/* Draft Visibility Toggle REMOVED from Header */}
            </div>
          </div>
          <p className="text-muted-foreground">
            Created on {safeFormatDate(request.createdAt, "MMMM d, yyyy")} •
            ID: #{request.id.slice(0, 8)}
          </p>
        </div>
        
        <div className="flex gap-2">
            {canDeleteRequest && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Request
              </Button>
            )}
            {canOpenContract && (
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => navigate(`/client/contracts/${linkedContract!.id}`)}
              >
                Review Contract
              </Button>
            )}
            {canOpenWorkspace && (
              <Button
                variant="outline"
                onClick={() => navigate(`/client/workspace/${linkedContract!.projectId}`)}
              >
                Open Workspace
              </Button>
            )}
            {!request.brokerId && (
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleDeleteRequest}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Request"}
              </Button>
            )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-6">
            {/* Top Level Navigation Layer */}
            <div className="flex gap-4 border-b pb-2 mb-4">
                 <button 
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${viewMode === 'workflow' ? 'text-primary' : 'text-muted-foreground hover:text-primary/80'}`}
                    onClick={() => setViewMode('workflow')}
                 >
                    Workflow Management
                    {viewMode === 'workflow' && <div className="absolute bottom-[-9px] left-0 w-full h-0.5 bg-primary" />}
                 </button>
                 <button 
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${viewMode === 'details' ? 'text-primary' : 'text-muted-foreground hover:text-primary/80'}`}
                    onClick={() => setViewMode('details')}
                 >
                    Project Details
                    {viewMode === 'details' && <div className="absolute bottom-[-9px] left-0 w-full h-0.5 bg-primary" />}
                 </button>
            </div>

       {viewMode === 'workflow' && (
        <>
          <Card>
            <CardContent className="pt-6">
              <ProjectPhaseStepper currentPhase={currentPhase} />
            </CardContent>
          </Card>

          <RequestWorkflowBanner
            action={clientNextAction}
            currentPhase={currentPhase}
            requestStatus={request.status}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="phase1" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">1. Hire Broker</TabsTrigger>
              <TabsTrigger value="phase2" disabled={currentPhase < 2} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">2. Client Spec Approval</TabsTrigger>
              <TabsTrigger value="phase3" disabled={currentPhase < 3} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">3. Freelancer</TabsTrigger>
              <TabsTrigger value="phase4" disabled={currentPhase < 4} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">4. Final Spec</TabsTrigger>
              <TabsTrigger value="phase5" disabled={currentPhase < 5} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">5. Contract</TabsTrigger>
            </TabsList>

            <TabsContent value="phase1">
              <RequestBrokerMarketPanel
                request={request}
                currentPhase={currentPhase}
                isUpdatingStatus={isUpdatingStatus}
                brokerSlotSummary={brokerSlotSummary}
                pendingBrokerApplications={pendingBrokerApplications}
                nonPendingBrokerApplications={nonPendingBrokerApplications}
                matches={matches}
                brokerMatchesLoading={brokerMatchesLoading}
                onChangeVisibility={handleStatusChange}
                onAcceptBroker={handleHireBrokerClick}
                onReleaseBrokerSlot={handleReleaseBrokerSlot}
                onInviteBroker={handleInvite}
                onOpenProfile={handleOpenCandidateProfile}
                onPhaseAdvance={() => setActiveTab("phase2")}
                onOpenAssignedBrokerProfile={
                  assignedBrokerProfileId
                    ? () => navigate(`/client/discovery/profile/${assignedBrokerProfileId}`)
                    : null
                }
                onOpenScoreExplanation={() => setIsScoreExplanationOpen(true)}
                onSearchMarketplace={() => navigate(`/client/discovery?role=${UserRole.BROKER}`)}
                onGetAiSuggestions={() => id && fetchBrokerMatches(id, true)}
                formatDate={safeFormatDate}
              />
            </TabsContent>

            {/* PHASE 2: FINALIZING SPECS */}
            <TabsContent value="phase2">
              <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Client Spec Review</h2>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            toast.info("Report sent to Admin.", {
                              description: "The moderation team has been notified for follow-up.",
                            })
                          }
                        >
                          Report Broker
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {currentPhase < 2 ? (
                        <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-lg">
                            <p className="text-muted-foreground">Please hire a broker first to begin this phase.</p>
                        </div>
                    ) : (
                        <>
                           {/* Phase 2 focuses on Client Spec only. Full Spec is handled in Phase 4. */}
                           <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                                <div className="mb-3">
                                    <h3 className="font-semibold text-blue-900">Phase 2 Goal: Approve Client Spec</h3>
                                    <p className="text-sm text-blue-700">
                                      Review the client-readable scope (Client Spec) before moving to freelancer selection. The detailed Full Spec sign-off happens in Phase 4.
                                    </p>
                                </div>
                                <div className="grid gap-4 md:grid-cols-1">
                                    <div className="rounded-lg border bg-background p-4">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <h4 className="font-medium">Client Spec (Client Review)</h4>
                                            {clientSpec ? (
                                              <Badge className={`${getSpecStatusColor(clientSpec.status)} border-0`}>
                                                {formatSpecStatus(clientSpec.status)}
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline">Waiting broker draft</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-3">
                                          {clientSpec
                                            ? "Review this simplified spec to approve or request changes before freelancer hiring."
                                            : "Broker has not submitted the client-readable spec yet."}
                                        </p>
                                        {clientSpec && (
                                          <Button
                                            size="sm"
                                            className="w-full"
                                            onClick={() => navigate(`/client/spec-review/${clientSpec.id}`)}
                                          >
                                            {clientSpecActionLabel}
                                          </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 rounded-md border bg-white p-3 text-sm text-blue-800">
                                  Next phase after Client Spec approval: select a freelancer, then proceed to Phase 4 for full-spec three-party sign-off.
                                </div>
                           </div>

                           {/* Timeline (prefer spec-derived when available) */}
                           <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Estimated Timeline</span>
                                    <span>{clientSpec?.estimatedTimeline || "Pending broker input"}</span>
                                </div>
                                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                    <div className="bg-primary h-full w-1/4"></div>
                                </div>
                           </div>
                        </>
                    )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* PHASE 3: HIRE FREELANCER  EAI Matching Engine */}
            <TabsContent value="phase3">
              <RequestFreelancerMarketPanel
                currentPhase={currentPhase}
                hasAcceptedFreelancer={hasAcceptedFreelancer}
                selectedFreelancerProposal={selectedFreelancerProposal}
                freelancerMatchesLoading={freelancerMatchesLoading}
                freelancerMatches={freelancerMatches}
                onPhaseAdvance={() => setActiveTab("phase4")}
                onQuickMatch={() => id && fetchFreelancerMatches(id, false)}
                onAiMatch={() => id && fetchFreelancerMatches(id, true)}
                onOpenScoreExplanation={() => setIsScoreExplanationOpen(true)}
                onSearchMarketplace={() => navigate(`/client/discovery?role=${UserRole.FREELANCER}`)}
                onOpenProfile={handleOpenCandidateProfile}
                onInviteFreelancer={(freelancerId, freelancerName) =>
                  handleOpenInviteModal(freelancerId, freelancerName, "FREELANCER")
                }
              />
            </TabsContent>

            {/* PHASE 4: FINAL SPEC SIGN-OFF */}
            <TabsContent value="phase4">
                <Card>
                    <CardHeader>
                        <h2 className="text-xl font-semibold">Final Spec Sign-off (3-party)</h2>
                    </CardHeader>
                    <CardContent>
                        {currentPhase < 4 ? (
                            <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">
                                    Select a freelancer first to start final spec drafting and sign-off.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <h3 className="font-semibold text-blue-900">Phase 4 goal</h3>
                                            <p className="text-sm text-blue-700">
                                                Broker prepares Final Spec, then Client + Broker + Freelancer review and sign it.
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="bg-white">
                                            3-party sign required
                                        </Badge>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-lg border bg-background p-4">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <h4 className="font-medium">Client Spec (reference)</h4>
                                            {clientSpec ? (
                                              <Badge className={`${getSpecStatusColor(clientSpec.status)} border-0`}>
                                                {formatSpecStatus(clientSpec.status)}
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline">Missing</Badge>
                                            )}
                                        </div>
                                        <p className="mb-3 text-sm text-muted-foreground">
                                          Approved Client Spec is the baseline before final spec sign-off.
                                        </p>
                                        {clientSpec && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => navigate(`/client/spec-review/${clientSpec.id}`)}
                                          >
                                            View Client Spec
                                          </Button>
                                        )}
                                    </div>

                                    <div className="rounded-lg border bg-background p-4">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <h4 className="font-medium">Final Spec (3-party sign)</h4>
                                            {fullSpec ? (
                                              <Badge className={`${getSpecStatusColor(fullSpec.status)} border-0`}>
                                                {formatSpecStatus(fullSpec.status)}
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline">Draft pending</Badge>
                                            )}
                                        </div>
                                        <p className="mb-3 text-sm text-muted-foreground">
                                          {fullSpec
                                            ? "Review/sign final technical scope, milestones, and deliverables."
                                            : "Broker has not created the final spec yet."}
                                        </p>
                                        {fullSpec ? (
                                          <div className="space-y-3">
                                            <div className="rounded-md border p-2 text-xs text-muted-foreground">
                                              Signatures: {fullSpec.signatures?.length || 0} / 3
                                            </div>
                                            <Button
                                              size="sm"
                                              variant={fullSpec.status === ProjectSpecStatus.FINAL_REVIEW ? "default" : "outline"}
                                              className="w-full"
                                              onClick={() => navigate(`/client/spec-review/${fullSpec.id}`)}
                                            >
                                              {fullSpecActionLabel}
                                            </Button>
                                          </div>
                                        ) : null}
                                    </div>
                                </div>

                                {fullSpec?.status === ProjectSpecStatus.ALL_SIGNED && (
                                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <h4 className="font-semibold text-green-900">Final Spec fully signed</h4>
                                        <p className="text-sm text-green-700">
                                          Contract generation is unlocked. Continue to the contract phase.
                                        </p>
                                      </div>
                                      <Button size="sm" onClick={() => setActiveTab('phase5')}>
                                        Go to Contract
                                      </Button>
                                    </div>
                                  </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            {/* PHASE 5: CONTRACT */}
            <TabsContent value="phase5">
              <RequestContractHandoffPanel
                currentPhase={currentPhase}
                linkedContract={linkedContract}
                canOpenContract={canOpenContract}
                contractActivated={contractActivated}
                canOpenWorkspace={canOpenWorkspace}
                onOpenContract={() => navigate(`/client/contracts/${linkedContract!.id}`)}
                onOpenWorkspace={() => navigate(`/client/workspace/${linkedContract!.projectId}`)}
                onRefreshStatus={() => void fetchData(request.id)}
                formatDate={safeFormatDate}
              />
            </TabsContent>
          </Tabs>
        </>
        )}

        {viewMode === 'details' && (
            <>
                <Card className="mb-6 border-indigo-100 bg-indigo-50/30">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-600" /> Project Team
                            </h2>
                            <Button variant="outline" size="sm" onClick={() => navigate(`/client/discovery?role=${UserRole.FREELANCER}`)}>
                                <UserPlus className="w-4 h-4 mr-2" /> Add Member
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Broker Section */}
                        <div className="flex items-start justify-between p-4 bg-white rounded-lg border border-indigo-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border-2 border-indigo-200">
                                    {request.broker ? (request.broker.fullName || "B").charAt(0) : "B"}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-lg">{request.broker?.fullName || "No Broker Assigned"}</h3>
                                        {request.broker && <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">Broker</Badge>}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{request.broker?.email || "Assign a broker to lead this project."}</p>
                                </div>
                            </div>
                            {request.broker ? (
                                <Button variant="ghost" size="sm">View Profile</Button>
                            ) : (
                                <Button size="sm" onClick={() => setActiveTab('phase1')}>Find Broker</Button>
                            )}
                        </div>

                        {/* Freelancer/Team Members Section */}
                        {/* Logic: Show freelancers who have ACCEPTED invitations or are formally hired (future logic) */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Freelancers & Candidates</h4>
                            {(!request.brokerProposals && !request.freelancerProposals) || 
                             (request.brokerProposals?.filter((p:any) => p.status === 'ACCEPTED').length === 0) ? (
                                <div className="text-center py-4 text-muted-foreground text-sm italic">
                                    No team members yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {/* Show ACCEPTED candidates */}
                                     {request.brokerProposals?.filter((p:any) => p.status === 'ACCEPTED' && p.brokerId !== request.brokerId).map((p:any) => (
                                         <div key={p.id} className="flex items-center gap-3 p-3 bg-white rounded border">
                                             <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                                                 {p.broker?.fullName.charAt(0)}
                                             </div>
                                             <div className="overflow-hidden">
                                                 <p className="font-medium truncate">{p.broker?.fullName}</p>
                                                 <Badge variant="outline" className="text-[10px] h-5">Candidate (Accepted)</Badge>
                                             </div>
                                         </div>
                                     ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">Project Details</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Budget Range
                      </h3>
                      <p className="font-semibold text-lg">
                        {request.budgetRange || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Timeline
                      </h3>
                      <p className="font-semibold text-lg">
                        {request.intendedTimeline || "Not specified"}
                      </p>
                    </div>
                    <div className="col-span-full">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Description
                      </h3>
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {request.description}
                        </p>
                      </div>
                    </div>
                    <div className="col-span-full">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Tech Preferences & Features
                      </h3>
                      <div className="flex gap-2 flex-wrap">
                        {request.techPreferences ? (
                          request.techPreferences
                            .split(",")
                            .map((t: string) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                className="px-3 py-1"
                              >
                                {t.trim()}
                              </Badge>
                            ))
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            No specific preferences listed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-full border-t pt-6 mt-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Initial Client Brief</h3>
                                <p className="text-sm text-muted-foreground">
                                    Preliminary requirements and scope as defined by the client.
                                </p>
                            </div>
                        </div>
                        
                        <div className="bg-muted/30 rounded-xl p-6 border space-y-6">
                            {request.answers?.map((ans: any) => (
                                <div key={ans.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                    <div className="md:col-span-4 lg:col-span-3">
                                        <h4 className="text-sm font-medium text-muted-foreground">
                                            {ans.question?.label || ans.question?.text || "Requirement"}
                                        </h4>
                                    </div>
                                    <div className="md:col-span-8 lg:col-span-9">
                                        <p className="font-medium text-base text-foreground leading-relaxed">
                                            {ans.option?.label || ans.valueText || "N/A"}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {(!request.answers || request.answers.length === 0) && (
                                <div className="text-center py-8 text-muted-foreground italic">
                                    No initial specification data provided in the wizard.
                                </div>
                            )}
                        </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
        )}
        </div>

      </div>

      {inviteModalData && (
        <InviteModal 
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            partnerId={inviteModalData.id}
            partnerName={inviteModalData.name}
            partnerRole={inviteModalData.role}
            defaultRequestId={request?.id}
            onInviteSuccess={() => id && fetchData(id)}
        />
      )}

      <CandidateProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        candidate={selectedCandidate}
      />
      <ScoreExplanationModal
        isOpen={isScoreExplanationOpen}
        onClose={() => setIsScoreExplanationOpen(false)}
      />
    </div>
  );
}
