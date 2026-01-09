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
} from "@/shared/components/ui";
import { wizardService } from "../wizard/services/wizardService";
import { format } from "date-fns";
import { ArrowLeft, Check, FileText, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ROUTES } from "@/constants";
import { ProjectPhaseStepper } from "./components/ProjectPhaseStepper";
import { CommentsSection } from "./components/CommentsSection";
import { RequestStatus } from "./types";

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
  const [activeTab, setActiveTab] = useState("overview");
  const [recruitmentSubTab, setRecruitmentSubTab] = useState("proposals");
  const [showDraftAlert, setShowDraftAlert] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData(id);
    }
  }, [id]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const actionParam = searchParams.get('action');
    if (tabParam) setActiveTab(tabParam);
    if (actionParam === 'find') setRecruitmentSubTab('find');
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
        setMatches(matchData);
      }

      if (
        reqData &&
        (reqData.status === RequestStatus.HIRING || reqData.status === RequestStatus.IN_PROGRESS)
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
        setRequest((prev: any) => ({ ...prev, status: RequestStatus.HIRING }));
        
        await wizardService.updateRequest(id!, { status: RequestStatus.HIRING });
        
        toast.success("Specs Accepted", {
          description: "Version v1.0 has been locked. Moving to Hiring phase.",
        });
    } catch (error) {
        toast.error("Failed to accept specs");
        setSpecsAccepted(false);
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
    if (status === RequestStatus.DRAFT || status === RequestStatus.PUBLIC_DRAFT || status === RequestStatus.PRIVATE_DRAFT) return 0;
    if (status === RequestStatus.PENDING || status === RequestStatus.PENDING_SPECS) return 1;
    // status 'SPEC_REVIEW' not yet in enum, but logic remains if added
    if (status === "WAITING_FOR_REVIEW" || status === "SPEC_REVIEW") return 2; 
    if (status === RequestStatus.HIRING) return 3;
    if (status === RequestStatus.IN_PROGRESS) return 4;
    return 0; // Default
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

      <Button
        variant="ghost"
        className="mb-4 pl-0 hover:bg-transparent hover:text-primary"
        onClick={() => navigate(ROUTES.CLIENT_DASHBOARD)}
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </Button>

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
                
                {/* Draft Visibility Toggle */}
                {(request.status === RequestStatus.PUBLIC_DRAFT || request.status === RequestStatus.PRIVATE_DRAFT) && (
                    <div className="flex items-center bg-muted/50 rounded-lg p-1 text-xs border">
                        <button
                            className={`px-2 py-1 rounded-md transition-all ${request.status === RequestStatus.PUBLIC_DRAFT ? 'bg-background shadow-sm font-medium' : 'hover:bg-background/50 text-muted-foreground'}`}
                            onClick={() => handleStatusChange(RequestStatus.PUBLIC_DRAFT)}
                            disabled={isUpdatingStatus}
                        >
                            Public
                        </button>
                        <button
                            className={`px-2 py-1 rounded-md transition-all ${request.status === RequestStatus.PRIVATE_DRAFT ? 'bg-background shadow-sm font-medium' : 'hover:bg-background/50 text-muted-foreground'}`}
                            onClick={() => handleStatusChange(RequestStatus.PRIVATE_DRAFT)}
                             disabled={isUpdatingStatus}
                        >
                            Private
                        </button>
                    </div>
                )}
            </div>
          </div>
          <p className="text-muted-foreground">
            Created on {format(new Date(request.createdAt), "MMMM d, yyyy")} •
            ID: #{request.id.slice(0, 8)}
          </p>
        </div>
        
        <div className="flex gap-2">
             {/* Edit Draft Button */}
            {(request.status === RequestStatus.DRAFT || request.status === RequestStatus.PUBLIC_DRAFT || request.status === RequestStatus.PRIVATE_DRAFT) && (
            <Button onClick={() => navigate(`/client/wizard?draftId=${request.id}`)}>
                Edit Draft
            </Button>
            )}
            
            {/* NEW: Revert to Draft button for Pending projects */}
            {(request.status === RequestStatus.PENDING || request.status === RequestStatus.PENDING_SPECS) && (
                 <Button variant="outline" onClick={() => setShowDraftAlert(true)}>
                     Edit Request (Revert to Draft)
                 </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <ProjectPhaseStepper currentPhase={currentPhase} />
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="documents">Specs & Milestones</TabsTrigger>
              <TabsTrigger value="recruitment">Recruitment</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
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
                            {request.answers?.map((ans: any, index: number) => (
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
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Specifications</h2>
                    {specsAccepted ? (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 hover:bg-green-100 px-3 py-1"
                      >
                        <Check className="w-3 h-3 mr-1" /> v1.0 Locked
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={handleAcceptSpecs}
                        disabled={currentPhase < 2}
                      >
                        Accept Specs & Lock v1.0
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {currentPhase < 2 ? (
                    <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-lg">
                      <p className="text-muted-foreground">
                        Broker is currently preparing the specifications.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="border rounded-lg p-4 bg-muted/10 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-blue-100 rounded-lg">
                            <FileText className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">
                              Detailed Requirement Specification (DRS)
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Official document outlining all functional and
                              non-functional requirements.
                            </p>
                            <div className="flex gap-2 mt-4">
                              <Button variant="outline" size="sm">
                                View Online
                              </Button>
                              <Button variant="outline" size="sm">
                                Download PDF
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-lg mb-4">
                          Project Milestones
                        </h3>
                        <div className="space-y-3">
                          {[1, 2, 3].map((m) => (
                            <div
                              key={m}
                              className="flex items-center justify-between p-4 border rounded-lg bg-background"
                            >
                              <div>
                                <div className="font-medium text-base">
                                  Milestone {m}: Phase {m} Delivery
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  Estimated duration: 2 weeks
                                </div>
                              </div>
                              <Badge variant="outline">Planned</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recruitment">
              <Card>
                <CardHeader>
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <h2 className="text-xl font-semibold">
                            {currentPhase >= 3 ? "Freelancer Recruitment" : "Broker Recruitment"}
                        </h2>
                        <div className="flex gap-2 bg-muted/50 p-1 rounded-lg">
                            <Button 
                                variant={recruitmentSubTab === 'proposals' ? 'secondary' : 'ghost'}
                                onClick={() => setRecruitmentSubTab('proposals')}
                                size="sm"
                                className="text-sm"
                            >
                                Incoming Proposals
                            </Button>
                            <Button 
                                variant={recruitmentSubTab === 'find' ? 'secondary' : 'ghost'}
                                onClick={() => setRecruitmentSubTab('find')}
                                size="sm"
                                className="text-sm"
                            >
                                Find & Invite Match
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Phase 1: Broker Recruitment | Phase 3: Freelancer Recruitment */}
                    
                    {recruitmentSubTab === 'proposals' && (
                        <div className="space-y-6">
                            {/* Placeholder for Proposals List */}
                             <div className="text-center py-10 bg-muted/10 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground mb-4">
                                    {request.status.includes('PENDING') 
                                        ? "Your project is live in the marketplace. Waiting for brokers to apply." 
                                        : "No incoming proposals yet."}
                                </p>
                                {/* Force refresh button or check connection */}
                            </div>
                        </div>
                    )}

                    {recruitmentSubTab === 'find' && (
                        <div className="space-y-4">
                          {currentPhase < 3 && currentPhase > 1 ? (
                             <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">
                                    Broker has been hired. Recruitment closed.
                                </p>
                             </div>
                          ) : matches.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">
                              No specific matches found for this request.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {matches.map((match: any) => (
                                <div
                                  key={match.broker.id}
                                  className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                      {match.broker.fullName?.charAt(0) || "B"}
                                    </div>
                                    <div>
                                      <h4 className="font-semibold text-lg">
                                        {match.broker.fullName}
                                      </h4>
                                      <div className="text-sm text-muted-foreground flex gap-3 mt-1">
                                        <span className="bg-secondary px-2 py-0.5 rounded text-xs">
                                          Score: {match.score}
                                        </span>
                                        <span>•</span>
                                        <span>{match.matches} Skill Matches</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline">
                                      Profile
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleInvite(match.broker.id, match.broker.fullName)
                                      }
                                    >
                                      <UserPlus className="w-4 h-4 mr-2" /> Invite
                                    </Button>
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
          </Tabs>
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
