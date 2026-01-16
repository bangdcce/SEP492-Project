import { useState, useEffect } from "react";
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
import { ArrowLeft, Check, FileText, UserPlus, HelpCircle, Info, ExternalLink, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { ROUTES } from "@/constants";
import { ProjectPhaseStepper } from "./components/ProjectPhaseStepper";
import { CommentsSection } from "./components/CommentsSection";
import { RequestStatus } from "./types";

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

// Mock Data for Spec Link (UI Test)
const mockSpecLink = "http://localhost:5173/storage/folder/1TjCgD-iX0X7pXjQyZzZzZzZzZzZzZzZ";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [request, setRequest] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [specsAccepted, setSpecsAccepted] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // Tabs State
  const [viewMode, setViewMode] = useState("workflow");
  const [activeTab, setActiveTab] = useState("phase1");
  const [showDraftAlert, setShowDraftAlert] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData(id);
    }
  }, [id]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  const fetchData = async (requestId: string) => {
    try {
      setLoading(true);
      const [reqData, matchData] = await Promise.all([
        wizardService.getRequestById(requestId),
        wizardService.getMatches(requestId),
      ]);
      setRequest(reqData);

      // Handle matches only if request found
      if (reqData) {
        setMatches(matchData || []);
        // Auto-select main tab based on phase
        const phase = getPhase(reqData.status);
        if (phase > 0) setActiveTab(`phase${phase}`);
      }

      if (
        reqData &&
        (reqData.status === RequestStatus.HIRING || reqData.status === RequestStatus.IN_PROGRESS || reqData.status === RequestStatus.CONTRACT_PENDING || reqData.status === RequestStatus.SPEC_APPROVED)
      ) {
        setSpecsAccepted(true);
      }
    } catch (error) {
      console.error("Failed to load request details", error);
      toast.error("Error", { description: "Could not load request details." });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: RequestStatus) => {
      try {
          setIsUpdatingStatus(true);
          await wizardService.updateRequest(id!, { status: newStatus });
          setRequest((prev: any) => ({ ...prev, status: newStatus }));
          toast.success("Status Updated", {
              description: `Project is now ${newStatus.replace('_', ' ').toLowerCase()}`
          });
      } catch (error) {
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
      } catch (error) {
          toast.error("Failed to revert to draft");
      }
  };

  const handleAcceptSpecs = async () => {
    try {
        setSpecsAccepted(true);
        // Optimistic update
        setRequest((prev: any) => ({ ...prev, status: RequestStatus.SPEC_APPROVED }));
        
        await wizardService.approveSpecs(id!);
        
        toast.success("Specs Approved", {
          description: "Specifications approved. Moving to Freelancer Recruitment.",
        });
    } catch (error) {
        toast.error("Failed to approve specs");
        setSpecsAccepted(false);
    }
  };

  const handleAcceptBroker = async (brokerId: string) => {
      try {
          await wizardService.acceptBroker(request.id, brokerId);
          toast.success("Broker Hired", { description: "You have assigned a broker to this project." });
          fetchData(request.id);
      } catch (error) {
          toast.error("Failed to hire broker");
      }
  };

  const handleInvite = async (brokerId: string, brokerName: string) => {
    try {
        await wizardService.inviteBroker(request.id, brokerId);
        toast.success("Invitation Sent", {
            description: `Invitation sent to ${brokerName}`,
        });
        setMatches(prev => prev.filter(m => m.broker.id !== brokerId));
    } catch (error: any) {
        toast.error("Invitation Failed", {
             description: error.response?.data?.message || "Could not invite broker."
        });
    }
  };

  // Determine current phase
  const getPhase = (status: string) => {
    if (status === RequestStatus.DRAFT || status === RequestStatus.PUBLIC_DRAFT || status === RequestStatus.PRIVATE_DRAFT) return 1;
    if (status === RequestStatus.BROKER_ASSIGNED || status === RequestStatus.PENDING_SPECS || status === RequestStatus.PENDING) return 2;
    if (status === RequestStatus.SPEC_APPROVED || status === RequestStatus.HIRING) return 3;
    if (status === RequestStatus.CONTRACT_PENDING) return 4;
    if (status === RequestStatus.CONVERTED_TO_PROJECT || status === RequestStatus.IN_PROGRESS || status === RequestStatus.COMPLETED) return 5;
    return 1; // Default
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  if (!request)
    return <div className="p-10 text-center">Request not found</div>;

  const currentPhase = request ? getPhase(request.status) : 0;

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
            {/* Phase 4 Action */}
            {request.status === RequestStatus.CONTRACT_PENDING && (
                 <Button className="bg-green-600 hover:bg-green-700">
                     Review Contract
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
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="phase1" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">1. Hire Broker</TabsTrigger>
              <TabsTrigger value="phase2" disabled={currentPhase < 2} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">2. Finalize Specs</TabsTrigger>
              <TabsTrigger value="phase3" disabled={currentPhase < 3} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">3. Hire Freelancer</TabsTrigger>
              <TabsTrigger value="phase4" disabled={currentPhase < 4} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">4. Contract</TabsTrigger>
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

                            {/* PUBLIC DRAFT: Show Proposals */}
                            {request.status === RequestStatus.PUBLIC_DRAFT && (
                                <div className="space-y-4 mb-8">
                                     <h3 className="font-semibold text-lg flex items-center gap-2">
                                        <FileText className="w-5 h-5" /> Incoming Proposals
                                        <Badge variant="secondary">{request.brokerProposals?.length || 0}</Badge>
                                     </h3>
                                     
                                     {(!request.brokerProposals || request.brokerProposals.length === 0) ? (
                                        <div className="text-center py-8 bg-muted/10 border-2 border-dashed rounded-lg">
                                            <p className="text-muted-foreground">No proposals received yet.</p>
                                        </div>
                                     ) : (
                                        <div className="space-y-4">
                                            {request.brokerProposals.map((proposal: any) => (
                                                <div key={proposal.id} className="border rounded-lg p-4 flex justify-between items-start bg-card hover:bg-muted/10 transition-colors">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-bold text-lg">{proposal.broker?.fullName || 'Unknown Broker'}</h4>
                                                            <Badge variant={proposal.status === 'ACCEPTED' ? 'default' : 'outline'}>{proposal.status}</Badge>
                                                        </div>
                                                        <p className="text-muted-foreground text-sm mb-2">Applied on {safeFormatDate(proposal.createdAt, "MMM d, yyyy")}</p>
                                                        <div className="bg-muted p-3 rounded-md text-sm italic">
                                                            "{proposal.coverLetter || 'No cover letter provided.'}"
                                                        </div>
                                                    </div>
                                                    {proposal.status === 'PENDING' && (
                                                        <Button onClick={() => handleAcceptBroker(proposal.brokerId)}>
                                                            Hire Broker
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                     )}
                                </div>
                            )}

                            {/* Show Find Brokers for BOTH (If Public, users might still want to invite specific people) */}
                            {(request.status === RequestStatus.PUBLIC_DRAFT || request.status === RequestStatus.PRIVATE_DRAFT) && (
                                <div className="space-y-4">
                                        <div className="flex justify-between items-center pb-2 border-b">
                                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                                <UserPlus className="w-5 h-5" /> Find & Invite Brokers
                                            </h3>
                                            <span className="text-xs text-muted-foreground">
                                                {matches?.length || 0} Available
                                            </span>
                                        </div>
                                        {(!matches || matches.length === 0) ? (
                                            <p className="text-muted-foreground text-center py-8">
                                                No brokers found matching your criteria.
                                            </p>
                                        ) : (
                                        matches.map((broker: any) => (
                                            <div key={broker.id} className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                                {broker.fullName?.charAt(0) || "B"}
                                                </div>
                                                <div>
                                                <h4 className="font-semibold text-lg">{broker.fullName || "Unknown Broker"}</h4>
                                                <div className="text-sm text-muted-foreground flex gap-3 mt-1">
                                                    <span className="bg-secondary px-2 py-0.5 rounded text-xs">Score: N/A</span>
                                                    <span>•</span>
                                                    <span>Matching Skills</span>
                                                </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline">Profile</Button>
                                                <Button size="sm" onClick={() => handleInvite(broker.id, broker.fullName)}>
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
                        <h2 className="text-xl font-semibold">Specifications & Negotiation</h2>
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
                           {/* Chat Placeholder */}
                           <div className="border rounded-lg h-64 bg-muted/10 flex items-center justify-center mb-6">
                                <div className="text-center">
                                    <p className="font-semibold text-muted-foreground">InterDev Chat Module</p>
                                    <p className="text-xs text-muted-foreground">Chat with your Broker to finalize specs.</p>
                                </div>
                           </div>

                           {/* Spec Folder Access */}
                           <div className="border rounded-lg p-4 mb-6 flex items-center justify-between bg-blue-50/50 border-blue-100">
                               <div className="flex items-center gap-3">
                                   <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                       <FolderOpen className="w-6 h-6" />
                                   </div>
                                   <div>
                                       <h3 className="font-semibold text-blue-900">Requirement Specification Docs</h3>
                                       <p className="text-sm text-blue-700">Access project storage for full documentation & assets.</p>
                                   </div>
                               </div>
                               <Button 
                                    className="bg-white text-blue-700 border-blue-200 hover:bg-blue-50 border"
                                    onClick={() => window.open(mockSpecLink, '_blank')}
                               >
                                   <ExternalLink className="w-4 h-4 mr-2" /> Open Storage
                               </Button>
                           </div>

                           {/* Docs Section */}
                           <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg">
                                <div>
                                    <h3 className="font-medium">Project Specification (v1.0)</h3>
                                    <p className="text-sm text-muted-foreground">Status: {specsAccepted ? 'Approved' : 'Drafting'}</p>
                                </div>
                                {specsAccepted ? (
                                    <Badge className="bg-green-600"><Check className="w-3 h-3 mr-1"/> Approved</Badge>
                                ) : (
                                    <Button onClick={handleAcceptSpecs}>Approve & Lock Specs</Button>
                                )}
                           </div>
                           
                           {/* Timeline */}
                           <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Estimated Timeline</span>
                                    <span>4 Weeks</span>
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

            {/* PHASE 3: HIRE FREELANCER */}
            <TabsContent value="phase3">
                <Card>
                    <CardHeader>
                        <h2 className="text-xl font-semibold">Freelancer Recruitment</h2>
                    </CardHeader>
                    <CardContent>
                        {currentPhase < 3 ? (
                            <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">Finalize specs to unlock freelancer recruitment.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 text-blue-800">
                                    <div className="font-bold whitespace-nowrap">Broker Suggestion:</div>
                                    <div>
                                        We need <strong>2 Frontend Devs</strong> and <strong>1 Backend Dev</strong> for this scope.
                                    </div>
                                </div>
                                
                                {/* Mock Freelancer List */}
                                <div className="space-y-4">
                                    {[1, 2].map((i) => (
                                        <div key={i} className="flex items-center justify-between p-4 border rounded-lg bg-background">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">F{i}</div>
                                                <div>
                                                    <h4 className="font-semibold">Freelancer Candidate {i}</h4>
                                                    <p className="text-sm text-muted-foreground">Full Stack Developer • 5 Years Exp</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline">View Profile</Button>
                                                <Button size="sm">Invite to Project</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            {/* PHASE 4: CONTRACT */}
            <TabsContent value="phase4">
                <Card>
                    <CardHeader>
                        <h2 className="text-xl font-semibold">Finalize Project & Contract</h2>
                    </CardHeader>
                    <CardContent>
                        {currentPhase < 4 ? (
                            <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">Hire all necessary freelancers to generate contract.</p>
                            </div>
                        ) : (
                             <div className="space-y-6">
                                {/* AI Gen Contract Mock */}
                                <div className="border rounded-xl overflow-hidden">
                                    <div className="bg-muted p-3 border-b flex justify-between items-center">
                                        <span className="font-medium text-sm">Generated Contract (AI Powered)</span>
                                        <Badge variant="outline">Draft v1</Badge>
                                    </div>
                                    <div className="p-6 bg-card text-sm font-mono leading-relaxed text-muted-foreground">
                                        <p>AGREEMENT made this {new Date().toLocaleDateString()} between Client, Broker, and Freelancers...</p>
                                        <p className="mt-4">[...Detailed Specs Included...]</p>
                                        <p className="mt-4">[...Payment Milestones Included...]</p>
                                    </div>
                                </div>

                                {/* Discussion Board Placeholder */}
                                <div className="bg-muted/10 p-4 rounded-lg border">
                                    <h3 className="font-semibold mb-2">3-Way Discussion Board</h3>
                                    <p className="text-sm text-muted-foreground mb-4">Discuss terms with Broker and Freelancers here.</p>
                                    <div className="flex gap-2">
                                        <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Type a message..." />
                                        <Button size="sm">Send</Button>
                                    </div>
                                </div>

                                {/* Signatures */}
                                <div className="flex items-center justify-end gap-4 pt-4 border-t">
                                    <div className="flex gap-2 text-sm text-muted-foreground">
                                        <span className="flex items-center text-green-600"><Check className="w-4 h-4 mr-1"/> Broker Signed</span>
                                        <span className="flex items-center text-green-600"><Check className="w-4 h-4 mr-1"/> Freelancer Signed</span>
                                    </div>
                                    <Button size="lg" className="bg-gradient-to-r from-green-600 to-emerald-600" onClick={() => wizardService.convertToProject(request.id).then(() => { toast.success("Project Started!"); navigate(ROUTES.CLIENT_DASHBOARD); })}>
                                        Sign & Start Project
                                    </Button>
                                </div>
                             </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </>
        )}

        {viewMode === 'details' && (
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
                                            {ans.question?.text || "Requirement"}
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
        )}
        </div>

        {/* Right Sidebar: Comments */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <CommentsSection />
          </div>
        </div>
      </div>
    </div>
  );
}
