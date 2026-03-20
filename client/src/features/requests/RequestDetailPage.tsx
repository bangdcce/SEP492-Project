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
import { ArrowLeft, Check, FileText, UserPlus, HelpCircle, Info, Users, Star, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ROUTES } from "@/constants";
import { ProjectPhaseStepper } from "./components/ProjectPhaseStepper";
import { CommentsSection } from "./components/CommentsSection";
import { RequestStatus } from "./types";
import { InviteModal } from "../discovery/InviteModal";
import { UserRole } from "@/shared/types/user.types";
import { CandidateProfileModal } from "./components/CandidateProfileModal";
import { ScoreExplanationModal } from "./components/ScoreExplanationModal";
import { projectSpecsApi } from "@/features/project-specs/api";
import type { ProjectSpec } from "@/features/project-specs/types";
import { ProjectSpecStatus, SpecPhase } from "@/features/project-specs/types";
import { contractsApi } from "@/features/contracts/api";
import type { ContractSummary } from "@/features/contracts/types";

const pickLatestSpecByPhase = (specs: ProjectSpec[], phase: SpecPhase): ProjectSpec | null =>
  [...specs]
    .filter((spec) => spec.specPhase === phase)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    )[0] ?? null;

// Helper for safe date formatting
const safeFormatDate = (dateStr: any, fmt: string) => {
    try {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "Invalid Date";
        return format(d, fmt);
    } catch (e) {
        return "N/A";
    }
};

const isContractActivated = (contract?: ContractSummary | null) => {
  if (!contract) return false;
  const normalizedProjectStatus = String(contract.projectStatus || "").toUpperCase();
  return (
    Boolean(contract.activatedAt) ||
    ["IN_PROGRESS", "TESTING", "COMPLETED", "PAID", "DISPUTED"].includes(normalizedProjectStatus)
  );
};

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [request, setRequest] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [freelancerMatches, setFreelancerMatches] = useState<any[]>([]);
  const [freelancerMatchesLoading, setFreelancerMatchesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [specFlow, setSpecFlow] = useState<{ clientSpec: ProjectSpec | null; fullSpec: ProjectSpec | null }>({
    clientSpec: null,
    fullSpec: null,
  });
  const [linkedContract, setLinkedContract] = useState<ContractSummary | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isScoreExplanationOpen, setIsScoreExplanationOpen] = useState(false);
  
  // Tabs State
  const [viewMode, setViewMode] = useState("workflow");
  const [activeTab, setActiveTab] = useState("phase1");
  const [showDraftAlert, setShowDraftAlert] = useState(false);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteModalData, setInviteModalData] = useState<{ id: string, name: string, role: "BROKER" | "FREELANCER" } | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  // Legacy status-only phase mapping (fallback)
  const getPhase = useCallback((status: string) => {
    if (status === RequestStatus.DRAFT || status === RequestStatus.PUBLIC_DRAFT || status === RequestStatus.PRIVATE_DRAFT) return 1;
    if (
      status === RequestStatus.BROKER_ASSIGNED ||
      status === RequestStatus.PENDING_SPECS ||
      status === RequestStatus.PENDING ||
      status === RequestStatus.SPEC_SUBMITTED
    ) return 2;
    if (status === RequestStatus.SPEC_APPROVED || status === RequestStatus.HIRING) return 3;
    if (status === RequestStatus.CONTRACT_PENDING) return 5;
    if (status === RequestStatus.CONVERTED_TO_PROJECT || status === RequestStatus.IN_PROGRESS || status === RequestStatus.COMPLETED) return 5;
    return 1; // Default
  }, []);

  const getWorkflowPhase = useCallback((
    reqData: any,
    flow: { clientSpec: ProjectSpec | null; fullSpec: ProjectSpec | null },
    linkedContractData?: ContractSummary | null,
  ) => {
    if (!reqData?.status) return 1;

    if (isContractActivated(linkedContractData)) {
      return 5;
    }

    const status = reqData.status as string;
    if (
      status === RequestStatus.CONTRACT_PENDING ||
      status === RequestStatus.CONVERTED_TO_PROJECT ||
      status === RequestStatus.IN_PROGRESS ||
      status === RequestStatus.COMPLETED
    ) {
      return 5;
    }

    const proposals = reqData.freelancerProposals || reqData.proposals || [];
    const acceptedFreelancerCount = proposals.filter(
      (proposal: any) => String(proposal?.status || '').toUpperCase() === 'ACCEPTED',
    ).length;
    const legacyPendingFreelancerCount = proposals.filter(
      (proposal: any) => String(proposal?.status || '').toUpperCase() === 'PENDING',
    ).length;
    const hasSelectedFreelancer =
      acceptedFreelancerCount > 0 ||
      (acceptedFreelancerCount === 0 && legacyPendingFreelancerCount === 1);

    const clientSpecApproved =
      flow.clientSpec?.status === ProjectSpecStatus.CLIENT_APPROVED ||
      Boolean(
        status === RequestStatus.SPEC_APPROVED ||
        status === RequestStatus.HIRING,
      );

    const brokerAssigned =
      Boolean(reqData.brokerId) ||
      [
        RequestStatus.BROKER_ASSIGNED,
        RequestStatus.PENDING_SPECS,
        RequestStatus.SPEC_SUBMITTED,
        RequestStatus.SPEC_APPROVED,
        RequestStatus.HIRING,
      ].includes(status as any);

    if (!brokerAssigned) {
      return getPhase(status);
    }
    if (!clientSpecApproved) {
      return 2;
    }
    if (!hasSelectedFreelancer) {
      return 3;
    }

    if (flow.fullSpec?.status === ProjectSpecStatus.ALL_SIGNED) {
      return 5;
    }

    return 4;
  }, [getPhase]);

  const fetchFreelancerMatches = useCallback(async (requestId: string, useAi: boolean = false) => {
    try {
      setFreelancerMatchesLoading(true);
      const data = useAi
        ? await wizardService.getFreelancerMatches(requestId, { enableAi: true, topN: 10 })
        : await wizardService.getFreelancerMatchesQuick(requestId);
      setFreelancerMatches(data || []);
    } catch (error) {
      console.error('Freelancer matching failed', error);
      setFreelancerMatches([]);
    } finally {
      setFreelancerMatchesLoading(false);
    }
  }, []);

  const fetchData = useCallback(async (requestId: string) => {
    try {
      setLoading(true);
      const [reqData, matchData, specsData, contractList] = await Promise.all([
        wizardService.getRequestById(requestId),
        wizardService.getBrokerMatchesQuick(requestId),
        projectSpecsApi.getSpecsByRequest(requestId).catch((error) => {
          console.warn("Failed to load project specs for request detail page", error);
          return [] as ProjectSpec[];
        }),
        contractsApi.listContracts().catch((error) => {
          console.warn("Failed to load contracts for request detail page", error);
          return [] as ContractSummary[];
        }),
      ]);
      setRequest(reqData);
      const nextSpecFlow = {
        clientSpec: pickLatestSpecByPhase(specsData, SpecPhase.CLIENT_SPEC),
        fullSpec: pickLatestSpecByPhase(specsData, SpecPhase.FULL_SPEC),
      };
      setSpecFlow(nextSpecFlow);
      const nextLinkedContract = contractList.find((contract) => contract.requestId === requestId) || null;
      setLinkedContract(nextLinkedContract);

      // Handle matches only if request found
      if (reqData) {
        setMatches(matchData || []);
        // Auto-select main tab based on phase
        const phase = getWorkflowPhase(reqData, nextSpecFlow, nextLinkedContract);
        if (phase > 0) setActiveTab(`phase${phase}`);

        // Auto-fetch freelancer matches for Phase 3+
        if (phase >= 3) {
          fetchFreelancerMatches(requestId, false);
        }
      }
    } catch (error) {
      console.error("Failed to load request details", error);
      toast.error("Error", { description: "Could not load request details." });
    } finally {
      setLoading(false);
    }
  }, [getWorkflowPhase, fetchFreelancerMatches]);

  useEffect(() => {
    if (id) {
      void fetchData(id);
    }
  }, [id, fetchData]);

  const handleStatusChange = async (newStatus: RequestStatus) => {
      try {
          setIsUpdatingStatus(true);
          await wizardService.updateRequest(id!, { status: newStatus });
          setRequest((prev: any) => ({ ...prev, status: newStatus }));
          toast.success("Status Updated", {
              description: `Project is now ${newStatus.replace('_', ' ').toLowerCase()}`
          });
      } catch (_error) {
          toast.error("Failed to update status");
      } finally {
          setIsUpdatingStatus(false);
      }
  };

  const handleRevertToDraft = async () => {
      try {
          // explicitly set to PUBLIC_DRAFT
          await wizardService.updateRequest(id!, { status: RequestStatus.PUBLIC_DRAFT, isDraft: true });
          toast.success("Reverted to Draft", {
              description: "Redirecting to wizard for editing...",
          });
          navigate(`/client/wizard?draftId=${id}`);
      } catch (_error) {
          toast.error("Failed to revert to draft");
      }
  };

  const handleAcceptBroker = async (brokerId: string) => {
      try {
          await wizardService.acceptBroker(request.id, brokerId);
          toast.success("Broker Hired", { description: "You have assigned a broker to this project." });
          fetchData(request.id);
      } catch (_error) {
          toast.error("Failed to hire broker");
      }
  };

  const handleDeleteRequest = async () => {
      if (!request?.id || request?.brokerId) return;

      const confirmed = window.confirm(
        "Delete this request? This can only be done before any broker is assigned.",
      );
      if (!confirmed) return;

      try {
          setIsDeletingRequest(true);
          await wizardService.deleteRequest(request.id);
          toast.success("Request deleted", {
              description: "Your project request has been removed.",
          });
          navigate(ROUTES.CLIENT_DASHBOARD);
      } catch (error: any) {
          console.error("Failed to delete request", error);
          toast.error("Delete failed", {
              description: error?.response?.data?.message || "Could not delete this request.",
          });
      } finally {
          setIsDeletingRequest(false);
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

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  if (!request)
    return <div className="p-10 text-center">Request not found</div>;

  const currentPhase = request ? getWorkflowPhase(request, specFlow, linkedContract) : 0;
  const clientSpec = specFlow.clientSpec;
  const fullSpec = specFlow.fullSpec;
  const freelancerProposalList = request?.freelancerProposals || request?.proposals || [];
  const acceptedFreelancerProposal = freelancerProposalList.find(
    (proposal: any) => String(proposal?.status || '').toUpperCase() === 'ACCEPTED',
  );
  const legacyPendingFreelancerProposal = freelancerProposalList.find(
    (proposal: any) => String(proposal?.status || '').toUpperCase() === 'PENDING',
  );
  const selectedFreelancerProposal = acceptedFreelancerProposal || legacyPendingFreelancerProposal;
  const hasAcceptedFreelancer = Boolean(selectedFreelancerProposal);
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
  const canOpenContract = Boolean(linkedContract?.id);
  const contractActivated = isContractActivated(linkedContract);
  const canOpenWorkspace = Boolean(linkedContract?.projectId && contractActivated);

  // Custom Alert Dialog Component
  const DraftAlertDialog = () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 shadow-2xl border-2 border-primary/20">
              <h3 className="text-lg font-bold mb-2">Switch back to Draft?</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                  <strong className="text-orange-600 block mb-1">Warning:</strong> 
                  Switching to draft will hide your project from the marketplace. 
                  Brokers cannot see it, and you cannot send new invitations until you post it again.
              </p>
              <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowDraftAlert(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleRevertToDraft}>Confirm & Edit</Button>
              </div>
          </Card>
      </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl relative">
      {showDraftAlert && <DraftAlertDialog />}

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
                                 <h4 className="font-semibold">2. Finalize Specs</h4>
                                 <p className="text-sm text-muted-foreground">Chat with your broker to lock in the Detailed Requirement Specs (DRS).</p>
                             </div>
                         </div>
                         <div className="flex gap-3">
                             <div className="bg-primary/10 p-2 rounded-full h-fit"><Check className="w-4 h-4 text-primary"/></div>
                             <div>
                                 <h4 className="font-semibold">3. Hire Freelancer</h4>
                                 <p className="text-sm text-muted-foreground">Your Broker will suggest freelancers. Approve them to build the team.</p>
                             </div>
                         </div>
                         <div className="flex gap-3">
                             <div className="bg-primary/10 p-2 rounded-full h-fit"><Check className="w-4 h-4 text-primary"/></div>
                             <div>
                                 <h4 className="font-semibold">4. Sign Contract</h4>
                                 <p className="text-sm text-muted-foreground">Review the generated contract and sign to officially start the project.</p>
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
                disabled={isDeletingRequest}
              >
                {isDeletingRequest ? "Deleting..." : "Delete Request"}
              </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Main Content */}
        <div className="lg:col-span-2 space-y-6">
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="phase1" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">1. Hire Broker</TabsTrigger>
              <TabsTrigger value="phase2" disabled={currentPhase < 2} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">2. Client Spec Approval</TabsTrigger>
              <TabsTrigger value="phase3" disabled={currentPhase < 3} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">3. Freelancer</TabsTrigger>
              <TabsTrigger value="phase4" disabled={currentPhase < 4} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">4. Final Spec</TabsTrigger>
              <TabsTrigger value="phase5" disabled={currentPhase < 5} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">5. Contract</TabsTrigger>
            </TabsList>

            {/* PHASE 1: HIRE BROKER */}
            {/* PHASE 1: HIRE BROKER */}
            <TabsContent value="phase1">
               <Card>
                <CardHeader>
                     <h2 className="text-xl font-semibold">Broker Recruitment</h2>
                </CardHeader>
                <CardContent>
                    {/* Project Brief Summary for Context */}
                    <div className="mb-6 p-4 bg-muted/20 rounded-lg border">
                        <h3 className="font-semibold mb-2">Project Brief</h3>
                        <p className="text-sm text-muted-foreground line-clamp-3">{request.description}</p>
                    </div>

                    {currentPhase >= 2 ? (
                        <div className="bg-green-50 border-green-200 border rounded-lg p-8 text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold text-green-800 mb-2">Broker Hired</h3>
                            <p className="text-green-700 mb-6 max-w-md mx-auto">
                                You have successfully hired <strong>{request.broker?.fullName || 'a Broker'}</strong> for this project. 
                                Proceed to the next phase to finalize specifications.
                            </p>
                            <div className="flex justify-center gap-4">
                                <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-100 bg-white">
                                    View Broker Profile
                                </Button>
                                <Button onClick={() => setActiveTab('phase2')}>
                                    Go to Finalize Specs
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Visibility Control Section */}
                            {(request.status === RequestStatus.PUBLIC_DRAFT || request.status === RequestStatus.PRIVATE_DRAFT) && (
                            <div className="bg-background border rounded-lg p-4 mb-6 shadow-sm">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Current Visibility</div>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${request.status === RequestStatus.PUBLIC_DRAFT ? 'bg-green-500' : 'bg-amber-500'}`} />
                                                <span className="font-bold text-lg">{request.status === RequestStatus.PUBLIC_DRAFT ? 'Public (Open to All)' : 'Private (Invite Only)'}</span>
                                            </div>
                                        </div>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary"><Info className="w-5 h-5"/></Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Public vs. Private Requests</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4 pt-2">
                                                    <div className="border-l-4 border-green-500 pl-4 py-1">
                                                        <h4 className="font-bold text-green-700">Public Request</h4>
                                                        <p className="text-sm text-muted-foreground">Visible to ALL brokers on the marketplace. Any broker can submit a proposal. Good for getting competitive offers.</p>
                                                    </div>
                                                    <div className="border-l-4 border-amber-500 pl-4 py-1">
                                                        <h4 className="font-bold text-amber-700">Private Request</h4>
                                                        <p className="text-sm text-muted-foreground">Hidden from the marketplace. Only brokers you explicitly invite can see and apply. Good for confidentiality or when you have specific brokers in mind.</p>
                                                    </div>
                                                    <div className="bg-muted p-3 rounded text-xs">
                                                        <strong>Note:</strong> Switching from Public to Private will automatically REJECT all pending proposals to ensure confidentiality.
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                    
                                    <Button 
                                        variant={request.status === RequestStatus.PUBLIC_DRAFT ? "outline" : "default"}
                                        onClick={() => handleStatusChange(request.status === RequestStatus.PUBLIC_DRAFT ? RequestStatus.PRIVATE_DRAFT : RequestStatus.PUBLIC_DRAFT)}
                                        disabled={isUpdatingStatus}
                                    >
                                        {request.status === RequestStatus.PUBLIC_DRAFT ? "Make Project Private" : "Make Project Public"}
                                    </Button>
                                </div>
                            </div>
                            )}

                            {/* PUBLIC DRAFT: Show Proposals & Invitations */}
                            {request.status === RequestStatus.PUBLIC_DRAFT && (
                                <div className="space-y-8 mb-8">
                                     {/* 1. Incoming Applications (PENDING) */}
                                     <div>
                                         <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                                            <FileText className="w-5 h-5" /> Incoming Applications
                                            <Badge variant="secondary">
                                                {request.brokerProposals?.filter((p: any) => p.status === 'PENDING').length || 0}
                                            </Badge>
                                         </h3>
                                         
                                         {(!request.brokerProposals || request.brokerProposals.filter((p: any) => p.status === 'PENDING').length === 0) ? (
                                            <div className="text-center py-6 bg-muted/10 border-2 border-dashed rounded-lg">
                                                <p className="text-muted-foreground">No applications received yet.</p>
                                            </div>
                                         ) : (
                                            <div className="space-y-4">
                                                {request.brokerProposals.filter((p: any) => p.status === 'PENDING').map((proposal: any) => (
                                                    <div key={proposal.id} className="border rounded-lg p-4 flex justify-between items-start bg-card hover:bg-muted/10 transition-colors">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="font-bold text-lg">{proposal.broker?.fullName || 'Unknown Broker'}</h4>
                                                                <Badge>{proposal.status}</Badge>
                                                            </div>
                                                            <p className="text-muted-foreground text-sm mb-2">Applied on {safeFormatDate(proposal.createdAt, "MMM d, yyyy")}</p>
                                                            <div className="bg-muted p-3 rounded-md text-sm italic">
                                                                "{proposal.coverLetter || 'No cover letter provided.'}"
                                                            </div>
                                                        </div>
                                                        <Button onClick={() => handleAcceptBroker(proposal.brokerId)}>
                                                            Hire Broker
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                         )}
                                     </div>

                                     {/* 2. Sent Invitations (INVITED / REJECTED / ACCEPTED) */}
                                     <div>
                                         <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                                            <UserPlus className="w-5 h-5" /> Sent Invitations
                                            <Badge variant="secondary">
                                                {request.brokerProposals?.filter((p: any) => p.status !== 'PENDING').length || 0}
                                            </Badge>
                                         </h3>
                                         
                                         {(!request.brokerProposals || request.brokerProposals.filter((p: any) => p.status !== 'PENDING').length === 0) ? (
                                            <div className="text-center py-6 bg-muted/10 border-2 border-dashed rounded-lg">
                                                <p className="text-muted-foreground">No invitations sent yet.</p>
                                            </div>
                                         ) : (
                                            <div className="space-y-4">
                                                {request.brokerProposals.filter((p: any) => p.status !== 'PENDING').map((proposal: any) => (
                                                    <div key={proposal.id} className="border rounded-lg p-4 flex justify-between items-center bg-card">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="font-semibold">{proposal.broker?.fullName || 'Unknown Broker'}</h4>
                                                                <Badge variant="outline">{proposal.status}</Badge>
                                                            </div>
                                                            <p className="text-muted-foreground text-sm">Invited on {safeFormatDate(proposal.createdAt, "MMM d, yyyy")}</p>
                                                        </div>
                                                        {proposal.status === 'ACCEPTED' && (
                                                            <Button onClick={() => handleAcceptBroker(proposal.brokerId)} size="sm">
                                                                Hire Candidate
                                                            </Button>
                                                        )}
                                                         {proposal.status === 'INVITED' && (
                                                            <span className="text-sm text-muted-foreground italic">Waiting for response...</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                         )}
                                     </div>
                                </div>
                            )}

                            {/* Show Find Brokers for BOTH (If Public, users might still want to invite specific people) */}
                            {(request.status === RequestStatus.PUBLIC_DRAFT || request.status === RequestStatus.PRIVATE_DRAFT) && (
                                <div className="space-y-4">
                                        <div className="flex justify-between items-center pb-2 border-b">
                                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                                <UserPlus className="w-5 h-5" /> Find & Invite Brokers
                                            </h3>
                                            <div className="flex gap-2 items-center">
                                                <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
                                                    {matches?.length || 0} Top Matches
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={() => setIsScoreExplanationOpen(true)}>
                                                        <HelpCircle className="w-5 h-5 text-muted-foreground" />
                                                    </Button>
                                                </span>
                                                <Button size="sm" variant="outline" onClick={() => navigate(`/client/discovery?role=${UserRole.BROKER}`)}>
                                                    Search Marketplace
                                                </Button>
                                            </div>
                                        </div>
                                        {(!matches || matches.length === 0) ? (
                                            <p className="text-muted-foreground text-center py-8">
                                                No brokers found matching your criteria.
                                            </p>
                                        ) : (
                                        matches.map((broker: any) => (
                                            <div key={broker.candidateId || broker.id} className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${
                                                        broker.classificationLabel === 'PERFECT_MATCH' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        broker.classificationLabel === 'POTENTIAL' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        broker.classificationLabel === 'HIGH_RISK' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        'bg-gray-50 text-gray-700 border-gray-200'
                                                    }`}>
                                                    {broker.fullName?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                <h4 className="font-semibold text-lg">{broker.fullName || "Unknown Broker"}</h4>
                                                
                                                {/* AI Score Rendering */}
                                                <div className="flex items-center gap-2 mt-1 mb-1">
                                                    {broker.classificationLabel && (
                                                        <Badge variant={broker.classificationLabel === 'PERFECT_MATCH' ? 'default' : 'outline'}
                                                            className={`text-[10px] ${
                                                                broker.classificationLabel === 'PERFECT_MATCH' ? 'bg-emerald-600' :
                                                                broker.classificationLabel === 'POTENTIAL' ? 'border-amber-400 text-amber-700' :
                                                                broker.classificationLabel === 'HIGH_RISK' ? 'border-red-400 text-red-700' : ''
                                                            }`}
                                                        >
                                                            {broker.classificationLabel?.replace('_', ' ')}
                                                        </Badge>
                                                    )}
                                                    
                                                    {broker.matchScore !== undefined && (
                                                        <div className="flex gap-3 text-sm text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <Star className="w-3 h-3" /> Score: {broker.matchScore}
                                                            </span>
                                                            {broker.aiRelevanceScore !== null && broker.aiRelevanceScore !== undefined && (
                                                                <span className="flex items-center gap-1">
                                                                    <Sparkles className="w-3 h-3 text-indigo-500" /> AI: {broker.aiRelevanceScore}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Matched Skills */}
                                                {broker.matchedSkills && broker.matchedSkills.length > 0 && (
                                                    <div className="flex gap-1 flex-wrap mb-1">
                                                        {broker.matchedSkills.map((skill: string) => (
                                                            <Badge key={skill} variant="secondary" className="text-[10px] px-2 py-0.5">{skill}</Badge>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Reasoning */}
                                                {broker.reasoning && (
                                                    <p className="text-xs text-muted-foreground italic line-clamp-2 mt-1">{broker.reasoning}</p>
                                                )}
                                                 </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => { setSelectedCandidate(broker); setIsProfileModalOpen(true); }}>Profile</Button>
                                                <Button size="sm" onClick={() => handleInvite(broker.id || broker.candidateId, broker.fullName)}>
                                                <UserPlus className="w-4 h-4 mr-2" /> Invite
                                                </Button>
                                            </div>
                                            </div>
                                        ))
                                        )}
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
               </Card>
            </TabsContent>

            {/* PHASE 2: FINALIZING SPECS */}
            <TabsContent value="phase2">
              <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Client Spec Review</h2>
                        <Button variant="destructive" size="sm" onClick={() => window.alert('Report sent to Admin.')}>Report Broker</Button>
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
                                  Next phase after Client Spec approval: select freelancer, then proceed to Phase 4 for Full Spec 3-party sign-off.
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

            {/* PHASE 3: HIRE FREELANCER — AI Matching Engine */}
            <TabsContent value="phase3">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-indigo-500" /> Freelancer Recruitment
                            </h2>
                            {currentPhase >= 3 && (
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => id && fetchFreelancerMatches(id, false)}
                                        disabled={freelancerMatchesLoading}
                                    >
                                        {freelancerMatchesLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                        Quick Match
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                                        onClick={() => id && fetchFreelancerMatches(id, true)}
                                        disabled={freelancerMatchesLoading}
                                    >
                                        {freelancerMatchesLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                                        AI Match
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {currentPhase < 3 ? (
                            <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">Finalize specs to unlock freelancer recruitment.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {hasAcceptedFreelancer && (
                                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <h4 className="font-semibold text-green-900">Freelancer selected</h4>
                                                <p className="text-sm text-green-700">
                                                    Next step: broker prepares `full_spec` for 3-party review and sign-off.
                                                </p>
                                            </div>
                                            <Button size="sm" onClick={() => setActiveTab('phase4')}>
                                                Go to Final Spec Step
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Search marketplace link */}
                                <div className="flex justify-between items-center bg-muted/20 p-4 rounded-lg">
                                    <div>
                                        <h4 className="font-semibold flex items-center gap-2">
                                            Find Freelancers
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={() => setIsScoreExplanationOpen(true)}>
                                                <HelpCircle className="w-5 h-5 text-muted-foreground" />
                                            </Button>
                                        </h4>
                                        <p className="text-sm text-muted-foreground">AI-matched candidates or search the marketplace.</p>
                                    </div>
                                    <Button variant="outline" onClick={() => navigate(`/client/discovery?role=${UserRole.FREELANCER}`)}>
                                        Search Marketplace
                                    </Button>
                                </div>

                                {/* Results */}
                                {freelancerMatchesLoading ? (
                                    <div className="text-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
                                        <p className="text-muted-foreground">Running matching pipeline...</p>
                                    </div>
                                ) : freelancerMatches.length === 0 ? (
                                    <div className="text-center py-8 bg-muted/10 border-2 border-dashed rounded-lg">
                                        <p className="text-muted-foreground">No freelancer matches found. Click "Quick Match" or "AI Match" above.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">{freelancerMatches.length} candidates ranked</p>
                                        {freelancerMatches.map((match: any) => (
                                            <div key={match.userId} className="border rounded-xl p-4 bg-background hover:bg-muted/10 transition-all shadow-sm">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${
                                                            match.classificationLabel === 'PERFECT_MATCH' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                            match.classificationLabel === 'POTENTIAL' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                            match.classificationLabel === 'HIGH_RISK' ? 'bg-red-50 text-red-700 border-red-200' :
                                                            'bg-gray-50 text-gray-700 border-gray-200'
                                                        }`}>
                                                            {match.fullName?.charAt(0) || '?'}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="font-semibold text-lg">{match.fullName}</h4>
                                                                <Badge variant={match.classificationLabel === 'PERFECT_MATCH' ? 'default' : 'outline'}
                                                                    className={`text-[10px] ${
                                                                        match.classificationLabel === 'PERFECT_MATCH' ? 'bg-emerald-600' :
                                                                        match.classificationLabel === 'POTENTIAL' ? 'border-amber-400 text-amber-700' :
                                                                        match.classificationLabel === 'HIGH_RISK' ? 'border-red-400 text-red-700' : ''
                                                                    }`}
                                                                >
                                                                    {match.classificationLabel === 'PERFECT_MATCH' && '🟢 '}
                                                                    {match.classificationLabel === 'POTENTIAL' && '🟡 '}
                                                                    {match.classificationLabel === 'HIGH_RISK' && '🔴 '}
                                                                    {match.classificationLabel?.replace('_', ' ')}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex gap-3 text-sm text-muted-foreground mb-2">
                                                                <span className="flex items-center gap-1">
                                                                    <Star className="w-3 h-3" /> Score: {match.matchScore}
                                                                </span>
                                                                {match.aiRelevanceScore !== null && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Sparkles className="w-3 h-3 text-indigo-500" /> AI: {match.aiRelevanceScore}
                                                                    </span>
                                                                )}
                                                                <span>Tag: {match.tagOverlapScore}</span>
                                                                <span>Trust: {match.normalizedTrust}</span>
                                                            </div>
                                                            {match.matchedSkills?.length > 0 && (
                                                                <div className="flex gap-1 flex-wrap mb-2">
                                                                    {match.matchedSkills.map((skill: string) => (
                                                                        <Badge key={skill} variant="secondary" className="text-[10px] px-2 py-0.5">{skill}</Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {match.reasoning && (
                                                                <p className="text-xs text-muted-foreground italic line-clamp-2">{match.reasoning}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        <Button size="sm" variant="outline" onClick={() => { setSelectedCandidate(match); setIsProfileModalOpen(true); }}>Profile</Button>
                                                        <Button size="sm" onClick={() => handleOpenInviteModal(match.userId, match.fullName, 'FREELANCER')}>
                                                            <UserPlus className="w-4 h-4 mr-1" /> Invite
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
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
                                                Broker prepares `full_spec`, then Client + Broker + Freelancer review and sign it.
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
                                            <h4 className="font-medium">full_spec (3-party sign)</h4>
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
                                        <h4 className="font-semibold text-green-900">Final spec fully signed</h4>
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
                <Card>
                    <CardHeader>
                        <h2 className="text-xl font-semibold">Finalize Project & Contract</h2>
                    </CardHeader>
                    <CardContent>
                        {currentPhase < 5 ? (
                            <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">Complete final spec 3-party sign-off to generate contract.</p>
                            </div>
                        ) : (
                             <div className="space-y-6">
                                <div className="rounded-lg border bg-muted/20 p-4">
                                  <p className="text-sm text-muted-foreground">
                                    Phase 5 uses the actual contract record generated from the fully signed `full_spec`.
                                  </p>
                                </div>

                                {canOpenContract ? (
                                  <div className="rounded-lg border bg-background p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <h3 className="font-semibold">{linkedContract?.title}</h3>
                                        <p className="text-sm text-muted-foreground">
                                          Created {safeFormatDate(linkedContract?.createdAt, "PPP")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {contractActivated
                                            ? "Project activated. Continue execution in workspace."
                                            : "Signatures/activation are in progress."}
                                        </p>
                                      </div>
                                      <Badge variant={linkedContract?.status === "SIGNED" ? "default" : "outline"}>
                                        {linkedContract?.status || "DRAFT"}
                                      </Badge>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <Button
                                        onClick={() => navigate(`/client/contracts/${linkedContract!.id}`)}
                                      >
                                        Open Contract
                                      </Button>
                                      {canOpenWorkspace && (
                                        <Button
                                          variant="default"
                                          onClick={() => navigate(`/client/workspace/${linkedContract!.projectId}`)}
                                        >
                                          Open Workspace
                                        </Button>
                                      )}
                                      <Button
                                        variant="outline"
                                        onClick={() => void fetchData(request.id)}
                                      >
                                        Refresh Status
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                    <h3 className="font-semibold text-amber-900">
                                      Contract not initialized yet
                                    </h3>
                                    <p className="mt-1 text-sm text-amber-800">
                                      Broker must click <strong>Create Contract</strong> after `full_spec` reaches
                                      `ALL_SIGNED`.
                                    </p>
                                  </div>
                                )}
                             </div>
                        )}
                    </CardContent>
                </Card>
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
                                    {request.broker ? request.broker.fullName.charAt(0) : "B"}
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

        {/* Right Sidebar: Comments */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <CommentsSection />
          </div>
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
