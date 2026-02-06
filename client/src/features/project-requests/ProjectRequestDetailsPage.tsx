import { useEffect, useState } from "react";
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
  CheckCircle2
} from "lucide-react";
import { UserRole } from "@/shared/types/user.types";

import type { ProjectRequest, RequestStatus } from "./types";
import { projectRequestsApi } from "./api";
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

export default function ProjectRequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<ProjectRequest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userJson = localStorage.getItem("user");
    if (userJson) {
      setUser(JSON.parse(userJson));
    }
  }, []);

  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"; // Assuming standard Shadcn tabs
import { Check, Clock, FileSignature, CheckCircle2, AlertCircle } from "lucide-react";

// Helper to determine active phase for Broker (mirrors Client logic but simpler)
const getBrokerPhase = (status: string) => {
    if (status === 'SPEC_APPROVED') return 'phase3'; // Hiring
    if (status === 'CONTRACT_PENDING') return 'phase4'; // Contract
    if (status === 'PROCESSING') return 'phase2'; // Specs
    return 'phase1'; // Default
};

  const handleBack = () => {
    if (isAdmin) {
      navigate("/admin/specs"); 
    } else if (user?.role === "BROKER") {
      navigate("/project-requests");
    } else {
      navigate("/client/my-requests");
    }
  };

  const fetchRequest = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const response = await projectRequestsApi.getById(id);
      setRequest(response);
    } catch (err: unknown) {
      console.error("Failed to fetch request:", err);
      setError("Failed to load project request details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequest();
  }, [id]);

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

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "PROCESSING":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "COMPLETED":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "CANCELLED":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleAssign = async () => {
    if (!request || !request.id) return;
    if (!confirm("Are you sure you want to assign this request to yourself?"))
      return;

    try {
      // Optimistically update UI or show loading
      await projectRequestsApi.assignBroker(request.id);

      // Refresh data from server to get correct brokerId and status
      await fetchRequest();
      alert("Request assigned successfully!");
      // Navigate back or refresh? For now just stay.
    } catch (err: unknown) {
      console.error("Failed to assign request:", err);
      alert("Failed to assign request");
    }
  };



  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Request Details</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
           
           <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-4 w-full justify-start">
               <TabsTrigger value="overview">Overview & Status</TabsTrigger>
               <TabsTrigger value="phases">Workflow Phases</TabsTrigger>
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
                     <CardTitle className="text-lg">Additional Information</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="space-y-4">
                       {request.answers.map((answer) => (
                         <div key={answer.id} className="p-4 bg-muted/50 rounded-lg space-y-2">
                           <p className="text-sm font-medium">{answer.question?.label || "Unknown Question"}</p>
                           <p className="text-sm text-muted-foreground">{answer.option?.label || answer.valueText || "No Answer"}</p>
                         </div>
                       ))}
                     </div>
                   </CardContent>
                 </Card>
                )}
            </TabsContent>

            <TabsContent value="phases" className="space-y-6">
                {/* Phase 2: Specs */}
                <Card className={request.status === 'PROCESSING' || request.status === 'PENDING_SPECS' ? "border-2 border-primary" : ""}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                             <div className="bg-blue-100 p-2 rounded-full"><FileText className="w-5 h-5 text-blue-600"/></div>
                             Phase 2: Requirement Specifications
                             {request.spec && <Badge variant="outline" className="ml-2">Submitted</Badge>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(!request.spec && (request.status === 'PROCESSING' || request.status === 'BROKER_ASSIGNED')) ? (
                            <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-medium text-blue-900">Action Required</p>
                                    <p className="text-sm text-blue-700">Create and submit detailed specs for client approval.</p>
                                </div>
                                <Button onClick={() => navigate(`/project-requests/${request.id}/create-spec`)}>Create Spec</Button>
                            </div>
                        ) : request.spec ? (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Spec Status:</span>
                                    <Badge>{request.spec.status}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">Waiting for Client Approval.</p>
                            </div>
                        ) : (
                             <p className="text-sm text-muted-foreground">Pending prerequisite phases.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Phase 3: Hiring */}
                <Card className={request.status === 'SPEC_APPROVED' ? "border-2 border-primary" : ""}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                             <div className="bg-orange-100 p-2 rounded-full"><UserPlus className="w-5 h-5 text-orange-600"/></div>
                             Phase 3: Freelancer Recruitment
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {request.status === 'SPEC_APPROVED' ? (
                             <div className="bg-orange-50 p-4 rounded-lg">
                                  <p className="mb-4 text-sm text-orange-800">Specs Approved! Now you must recruit freelancers.</p>
                                  <div className="flex gap-2">
                                      <Button variant="outline" onClick={() => navigate(`/client/discovery?role=${UserRole.FREELANCER}`)}>Search Market</Button>
                                      <Button onClick={() => alert("Shortcut to Freelancer Suggestion Tool (Coming Soon)")}>Suggest Team</Button>
                                  </div>
                             </div>
                        ) : (
                             <p className="text-sm text-muted-foreground">Locked until Specs are Approved.</p>
                        )}
                    </CardContent>
                </Card>

                 {/* Phase 4: Contract */}
                <Card className={request.status === 'CONTRACT_PENDING' ? "border-2 border-primary" : ""}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                             <div className="bg-green-100 p-2 rounded-full"><FileSignature className="w-5 h-5 text-green-600"/></div>
                             Phase 4: Contract
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                         {request.status === 'SPEC_APPROVED' || request.status === 'HIRING' ? (
                             <Button 
                                className="w-full" 
                                onClick={async () => {
                                    if(!confirm("Ready to draft contract?")) return;
                                     // Logic to trigger contract draft
                                     alert("Drafting contract...");
                                }}
                             >
                                Draft Contract
                             </Button>
                         ) : (
                            <p className="text-sm text-muted-foreground">Locked until Team is assembled.</p>
                         )}
                    </CardContent>
                </Card>
            </TabsContent>
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
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {request.client.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {request.client.fullName}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{request.client.email}</span>
                    </div>
                  </div>
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
               <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Current Status</CardTitle></CardHeader>
               <CardContent>
                   <div className="flex items-center gap-2 mb-4">
                       <CheckCircle2 className="w-6 h-6 text-green-600" />
                       <span className="font-bold text-lg">{request.status}</span>
                   </div>
                   {request.status === 'PENDING' && (
                       <Button className="w-full" onClick={handleAssign}>Assign to Me</Button>
                   )}
               </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
