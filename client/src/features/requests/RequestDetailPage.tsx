
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, Badge, Spinner, Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui";
import { wizardService } from "../wizard/services/wizardService";
import { format } from "date-fns";
import { ArrowLeft, Check, FileText, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ROUTES } from "@/constants";
import { ProjectPhaseStepper } from "./components/ProjectPhaseStepper";
import { CommentsSection } from "./components/CommentsSection";
import { MilestoneDetailView } from "./components/MilestoneDetailView";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [specsAccepted, setSpecsAccepted] = useState(false);
  const [viewMilestoneId, setViewMilestoneId] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      fetchData(id);
    }
  }, [id]);

  const fetchData = async (requestId: string) => {
    try {
      setLoading(true);
      
      // 1. Fetch Request Details (Critical)
      const reqData = await wizardService.getRequestById(requestId);
      console.log("Fetched Request Data:", reqData);
      
      if (!reqData) {
          console.error("Request data is null for ID:", requestId);
          setRequest(null);
          return;
      }
      setRequest(reqData);

      // Mock check if specs accepted
      if (reqData && (reqData.status === 'HIRING' || reqData.status === 'IN_PROGRESS' || reqData.status === 'APPROVED')) {
          setSpecsAccepted(true);
      }

      // 2. Fetch Matches (Non-critical) - logic depends on status
      try {
          const matchData = await wizardService.getMatches(requestId);
          setMatches(matchData || []);
      } catch (matchError) {
          console.error("Failed to load matches:", matchError);
          // Don't crash the page, just show 0 matches or error UI in tab
          setMatches([]); 
      }

    } catch (error) {
      console.error("Failed to load request details", error);
      toast.error("Error", { description: "Could not load request details." });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptSpecs = () => {
    setSpecsAccepted(true);
    // Optimistic update
    setRequest(prev => ({ ...prev, status: 'HIRING' })); 
    toast.success("Specs Accepted", { description: "Version v1.0 has been locked. Moving to Hiring phase." });
  };

  const handleInvite = (brokerName: string) => {
    toast.success("Invitation Sent", { description: `Invitation sent to ${brokerName}` });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!request) return <div className="p-10 text-center">Request not found</div>;

  // Determine current phase
  const getPhase = (status: string) => {
      if (status === 'PENDING' || status === 'PENDING_BROKER') return 1;
      if (status === 'PROCESSING' || status === 'WAITING_FOR_REVIEW' || status === 'SPEC_REVIEW') return 2;
      if (status === 'APPROVED' || status === 'HIRING' || status === 'WAITING_FREELANCER') return 3;
      if (status === 'IN_PROGRESS' || status === 'COMPLETED') return 4;
      return 1; // Default
  };

  const currentPhase = getPhase(request.status);

  if (viewMilestoneId) {
      return (
        <div className="container mx-auto p-4 md:p-6 max-w-7xl">
             <MilestoneDetailView 
                milestoneId={viewMilestoneId} 
                onBack={() => setViewMilestoneId(null)} 
             />
        </div>
      );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent hover:text-primary" onClick={() => navigate(ROUTES.DASHBOARD)}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
        <div>
           <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">{request.title}</h1>
                <Badge variant={request.status === 'DRAFT' ? 'outline' : 'default'} className="uppercase">
                    {request.status.replace('_', ' ')}
                </Badge>
           </div>
           <p className="text-muted-foreground">
                Created on {format(new Date(request.createdAt), 'MMMM d, yyyy')} • ID: #{request.id.slice(0, 8)}
           </p>
        </div>
        {request.status === 'DRAFT' && (
             <Button onClick={() => navigate(`/wizard?draftId=${request.id}`)}>Edit Draft</Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Main Content */}
        <div className="lg:col-span-2 space-y-6">
            
            <Card>
                <CardContent className="pt-6">
                     <ProjectPhaseStepper currentPhase={currentPhase} />
                </CardContent>
            </Card>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="documents">Specs & Milestones</TabsTrigger>
                <TabsTrigger value="recruitment">
                    {currentPhase === 1 ? "Available Brokers" : "Recruitment"}
                </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <Card>
                        <CardHeader><h2 className="text-xl font-semibold">Project Details</h2></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">Budget Range</h3>
                                    <p className="font-semibold text-lg">{request.budgetRange || 'Not specified'}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">Timeline</h3>
                                    <p className="font-semibold text-lg">{request.intendedTimeline || 'Not specified'}</p>
                                </div>
                                <div className="col-span-full">
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        <p className="whitespace-pre-wrap leading-relaxed">{request.description}</p>
                                    </div>
                                </div>
                                <div className="col-span-full">
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Tech Preferences & Features</h3>
                                    <div className="flex gap-2 flex-wrap">
                                        {/* Mocking features from answers if available or using techPrefs */}
                                        {request.techPreferences ? request.techPreferences.split(',').map((t: string) => (
                                            <Badge key={t} variant="secondary" className="px-3 py-1">{t.trim()}</Badge>
                                        )) : <span className="text-sm text-muted-foreground italic">No specific preferences listed</span>}
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
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 px-3 py-1">
                                        <Check className="w-3 h-3 mr-1" /> v1.0 Locked
                                    </Badge>
                                ) : (
                                    <Button size="sm" onClick={handleAcceptSpecs} disabled={currentPhase < 2}>
                                        Accept Specs & Lock v1.0
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {currentPhase < 2 ? (
                                <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-lg">
                                    <p className="text-muted-foreground">Please hire a broker regarding to the <strong>Available Brokers</strong> tab to begin the specification phase.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="border rounded-lg p-4 bg-muted/10 hover:bg-muted/20 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-blue-100 rounded-lg">
                                                <FileText className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg">Detailed Requirement Specification (DRS)</h3>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Official document outlining all functional and non-functional requirements.
                                                </p>
                                                <div className="flex gap-2 mt-4">
                                                    <Button variant="outline" size="sm">View Online</Button>
                                                    <Button variant="outline" size="sm">Download PDF</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-lg mb-4">Project Milestones</h3>
                                        <div className="space-y-3">
                                            {[1, 2, 3].map((m) => (
                                                <div key={m} className="flex items-center justify-between p-4 border rounded-lg bg-background">
                                                    <div>
                                                        <div className="font-medium text-base">Milestone {m}: Phase {m} Delivery</div>
                                                        <div className="text-sm text-muted-foreground mt-1">Estimated duration: 2 weeks</div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Badge variant="outline">Planned</Badge>
                                                        {currentPhase >= 3 && (
                                                            <Button size="sm" variant="outline" onClick={() => setViewMilestoneId(m)}>
                                                                View Detail
                                                            </Button>
                                                        )}
                                                    </div>
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
                            <h2 className="text-xl font-semibold">
                                {currentPhase === 1 ? "Matching Brokers" : "Suggested Freelancers"}
                            </h2>
                        </CardHeader>
                        <CardContent>
                            {/* Logic: If Phase 2, wait. If Phase 1 (Brokers) or Phase 3+ (Freelancers), show list if available. */}
                            {currentPhase === 2 ? (
                                <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-lg">
                                    <p className="text-muted-foreground">Recruitment will be available after Spec Approval.</p>
                                </div>
                            ) : matches.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">
                                    {currentPhase === 1 ? "No matching brokers found yet." : "No specific matches found for this request."}
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {matches.map((item: any, index: number) => {
                                        // item might be { broker, score, matches } 
                                        const broker = item.broker;
                                        return (
                                        <div key={broker?.id || index} className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                                    {broker.fullName?.charAt(0) || 'B'}
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-lg">{broker.fullName}</h4>
                                                    <div className="text-sm text-muted-foreground flex gap-3 mt-1">
                                                        <span className="bg-secondary px-2 py-0.5 rounded text-xs">
                                                            Score: {typeof item.score === 'number' ? item.score.toFixed(1) : Number(item.score || 0).toFixed(1)}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{item.matches || 0} Skill Matches</span>
                                                    </div>
                                                    {/* Skills */}
                                                    {broker.profile?.skills && (
                                                        <div className="flex gap-1 mt-2">
                                                            {broker.profile.skills.slice(0, 3).map((s: string) => (
                                                                <Badge key={s} variant="outline" className="text-[10px] px-1 py-0">{s}</Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Button size="sm" variant="outline" onClick={() => toast.info('CV Preview feature coming soon')}>
                                                    <FileText className="w-3 h-3 mr-1" /> CV
                                                </Button>
                                                <Button size="sm" onClick={() => handleInvite(broker.fullName)}>
                                                    <UserPlus className="w-4 h-4 mr-2" /> Invite
                                                </Button>
                                            </div>
                                        </div>
                                    )})}
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
                
                {/* Additional Info / Status Card could go here */}
                {/* 
                <Card className="mt-4 bg-blue-50 border-blue-100">
                    <CardContent className="p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">Next Steps</h4>
                        <p className="text-sm text-blue-800">
                            {currentPhase === 1 && "Wait for a broker to review your request."}
                            {currentPhase === 2 && "Review the specs and approve them to start hiring."}
                            {currentPhase === 3 && "Invite freelancers to your project."}
                        </p>
                    </CardContent>
                </Card>
                */}
            </div>
        </div>

      </div>
    </div>
  );
}
