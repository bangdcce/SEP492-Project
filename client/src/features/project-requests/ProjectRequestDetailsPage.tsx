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
  Check,
  Clock3,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { STORAGE_KEYS } from "@/constants";

import type { ProjectRequest, RequestStatus } from "./types";
import { projectRequestsApi } from "./api";
import { contractsApi } from "@/features/contracts/api";
import type { ContractSummary } from "@/features/contracts/types";
import { projectSpecsApi } from "@/features/project-specs/api";
import type { ProjectSpec } from "@/features/project-specs/types";
import { ProjectSpecStatus, SpecPhase } from "@/features/project-specs/types";
import { Button } from "@/shared/components/custom/Button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/Card";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { getStoredJson } from "@/shared/utils/storage";

type BrokerSpecFlow = {
  clientSpec: ProjectSpec | null;
  fullSpec: ProjectSpec | null;
};

const pickLatestSpecByPhase = (specs: ProjectSpec[], phase: SpecPhase): ProjectSpec | null =>
  [...specs]
    .filter((spec) => spec.specPhase === phase)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    )[0] ?? null;

const isContractActivated = (contract?: ContractSummary | null) => {
  if (!contract) return false;
  const normalizedProjectStatus = String(contract.projectStatus || "").toUpperCase();
  return (
    Boolean(contract.activatedAt) ||
    ["IN_PROGRESS", "TESTING", "COMPLETED", "PAID", "DISPUTED"].includes(normalizedProjectStatus)
  );
};

const formatHumanStatus = (status?: string | null) => String(status || "UNKNOWN").replace(/_/g, " ");

export default function ProjectRequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<ProjectRequest | null>(null);
  const [specFlow, setSpecFlow] = useState<BrokerSpecFlow>({ clientSpec: null, fullSpec: null });
  const [linkedContract, setLinkedContract] = useState<ContractSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingContract, setIsCreatingContract] = useState(false);

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getStoredJson(STORAGE_KEYS.USER));
  }, []);

  const isAdmin = user?.role === "ADMIN";

  // Helper moved to top level

  const handleBack = () => {
    if (isAdmin) {
      navigate("/admin/specs");
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

  const fetchRequest = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [requestResponse, specs, contractList] = await Promise.all([
        projectRequestsApi.getById(id),
        projectSpecsApi.getSpecsByRequest(id),
        contractsApi.listContracts().catch((error) => {
          console.warn("Failed to load contracts for broker request details", error);
          return [] as ContractSummary[];
        }),
      ]);
      setRequest(requestResponse);
      setSpecFlow({
        clientSpec: pickLatestSpecByPhase(specs, SpecPhase.CLIENT_SPEC),
        fullSpec: pickLatestSpecByPhase(specs, SpecPhase.FULL_SPEC),
      });
      setLinkedContract(contractList.find((contract) => contract.requestId === requestResponse.id) || null);
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

  const clientSpec = specFlow.clientSpec;
  const fullSpec = specFlow.fullSpec;
  const freelancerProposalList =
    ((request as any).freelancerProposals as any[]) ||
    ((request as any).proposals as any[]) ||
    [];
  const acceptedFreelancers = freelancerProposalList.filter(
    (proposal) => String(proposal?.status || "").toUpperCase() === "ACCEPTED",
  );
  const legacyPendingFreelancers = freelancerProposalList.filter(
    (proposal) => String(proposal?.status || "").toUpperCase() === "PENDING",
  );
  const hasSelectedFreelancer =
    acceptedFreelancers.length > 0 ||
    (acceptedFreelancers.length === 0 && legacyPendingFreelancers.length === 1);
  const selectedFreelancerProposal =
    acceptedFreelancers[0] || (acceptedFreelancers.length === 0 ? legacyPendingFreelancers[0] : null);

  const brokerWorkflowPhase = (() => {
    const contractStatuses = ["CONTRACT_PENDING", "CONVERTED_TO_PROJECT", "IN_PROGRESS", "COMPLETED"];
    if (contractStatuses.includes(String(request.status || "").toUpperCase())) return 5;
    if (fullSpec?.status === ProjectSpecStatus.ALL_SIGNED) return 5;
    if (!hasSelectedFreelancer) return 3;
    if (
      fullSpec &&
      [
        ProjectSpecStatus.DRAFT,
        ProjectSpecStatus.REJECTED,
        ProjectSpecStatus.FINAL_REVIEW,
      ].includes(fullSpec.status)
    ) {
      return 4;
    }
    if (hasSelectedFreelancer) return 4;
    if (clientSpec?.status === ProjectSpecStatus.CLIENT_APPROVED || request.status === "SPEC_APPROVED") {
      return 3;
    }
    if (clientSpec) return 2;
    return 1;
  })();

  const canBrokerReviewFinalSpec =
    !!fullSpec &&
    (fullSpec.status === ProjectSpecStatus.FINAL_REVIEW || fullSpec.status === ProjectSpecStatus.ALL_SIGNED);
  const canInitializeContract = fullSpec?.status === ProjectSpecStatus.ALL_SIGNED;
  const contractActivated = isContractActivated(linkedContract);
  const canOpenWorkspace = Boolean(linkedContract?.projectId && contractActivated);

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

  const handleInitializeContract = async () => {
    if (!fullSpec?.id) return;

    try {
      setIsCreatingContract(true);
      const contract = await contractsApi.initializeContract(fullSpec.id);
      navigate(`/broker/contracts/${contract.id}`);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || "Failed to create contract from final spec.";
      if (String(message).toLowerCase().includes("already initialized")) {
        alert(`${message}\nOpening contracts list.`);
        navigate("/broker/contracts");
        return;
      }
      alert(message);
    } finally {
      setIsCreatingContract(false);
    }
  };

  const isAssignedToCurrentBroker = user?.role === "BROKER" && request.brokerId === user?.id;
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

    if (!request.brokerId) {
      return {
        title: "Assign request first",
        description: "You need to assign this request to yourself before drafting specs.",
        ctaLabel: "Assign to Me",
        onClick: handleAssign,
        ctaVariant: "primary" as const,
      };
    }

    if (!isAssignedToCurrentBroker) {
      return {
        title: "Waiting for assigned broker",
        description: "Only the assigned broker can continue this request's spec workflow.",
        ctaLabel: "Open Marketplace",
        onClick: () => navigate("/broker/marketplace"),
        ctaVariant: "outline" as const,
      };
    }

    if (!clientSpec) {
      return {
        title: "Draft Client Spec",
        description: "Start with a client-readable spec so the client can approve scope.",
        ctaLabel: "Create Client Spec",
        onClick: () => navigate(`/broker/project-requests/${request.id}/create-client-spec`),
        ctaVariant: "primary" as const,
      };
    }

    if (clientSpec.status === ProjectSpecStatus.REJECTED) {
      return {
        title: "Client Spec was rejected",
        description: "Revise the Client Spec and submit it again for client review.",
        ctaLabel: "Edit Client Spec",
        onClick: () => navigate(`/broker/specs/${clientSpec.id}`),
        ctaVariant: "primary" as const,
      };
    }

    if (
      clientSpec.status === ProjectSpecStatus.DRAFT ||
      clientSpec.status === ProjectSpecStatus.CLIENT_REVIEW
    ) {
      return {
        title: "Complete Client Spec approval",
        description: "Client must approve Client Spec before freelancer selection and Final Spec sign-off.",
        ctaLabel: "Open Client Spec",
        onClick: () => navigate(`/broker/specs/${clientSpec.id}`),
        ctaVariant: "outline" as const,
      };
    }

    if (!hasSelectedFreelancer) {
      return {
        title: "Wait for freelancer acceptance",
        description: "Client needs to invite freelancer and get one accepted signer before final review.",
        ctaLabel: "Refresh",
        onClick: () => void fetchRequest(),
        ctaVariant: "outline" as const,
      };
    }

    if (!fullSpec) {
      return {
        title: "Draft Final Spec",
        description: "Create the technical Final Spec to prepare for 3-party sign-off.",
        ctaLabel: "Create Final Spec",
        onClick: () => navigate(`/broker/project-requests/${request.id}/create-spec`),
        ctaVariant: "primary" as const,
      };
    }

    if (fullSpec.status === ProjectSpecStatus.DRAFT || fullSpec.status === ProjectSpecStatus.REJECTED) {
      return {
        title: "Submit Final Spec for sign-off",
        description: "Finalize milestones and submit Final Spec for client/broker/freelancer signing.",
        ctaLabel: "Open Final Spec",
        onClick: () => navigate(`/broker/project-requests/${request.id}/create-spec`),
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
        ctaLabel: isCreatingContract ? "Creating Contract..." : "Create Contract",
        onClick: handleInitializeContract,
        ctaVariant: "primary" as const,
        disabled: isCreatingContract,
      };
    }

    if (linkedContract && !contractActivated) {
      return {
        title: "Contract signing",
        description: "Contract exists. Keep collecting signatures until project is activated.",
        ctaLabel: "Open Contract",
        onClick: () => navigate(`/broker/contracts/${linkedContract.id}`),
        ctaVariant: "primary" as const,
      };
    }

    if (linkedContract && canOpenWorkspace) {
      return {
        title: "Project activated",
        description: "All contract steps are complete. Continue execution in workspace.",
        ctaLabel: "Open Workspace",
        onClick: () => navigate(`/broker/workspace/${linkedContract.projectId}`),
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">

           {user?.role === "BROKER" && request.brokerId === user.id && (
             <Card className="overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_38%),linear-gradient(135deg,_#f8fffe_0%,_#f8fafc_52%,_#eefbf8_100%)] shadow-sm">
               <CardHeader className="pb-3">
                 <CardTitle className="text-base">Broker Spec Actions</CardTitle>
                 <CardDescription>
                   Keep the request moving from approved client scope to selected freelancer, final spec, and contract.
                 </CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="grid gap-3 md:grid-cols-3">
                   <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                     <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                       Client Spec
                     </p>
                     <p className="mt-2 text-sm font-semibold text-slate-950">
                       {clientSpec ? formatHumanStatus(clientSpec.status) : "Not started"}
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
                       {fullSpec ? formatHumanStatus(fullSpec.status) : "Not started"}
                     </p>
                   </div>
                 </div>

                 {!hasSelectedFreelancer && fullSpec && (
                   <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                     Final Spec drafting can happen early, but the request is still operationally in
                     freelancer-selection until one signer is accepted.
                   </div>
                 )}

                 <div className="flex flex-wrap gap-3">
                 <Button onClick={() => navigate(`/broker/project-requests/${request.id}/create-client-spec`)}>
                   {clientSpec ? "Open Client Spec" : "Create Client Spec"}
                 </Button>
                 <Button
                   variant="outline"
                   onClick={() => navigate(`/broker/project-requests/${request.id}/create-spec`)}
                 >
                   {fullSpec ? "Open Final Spec" : "Create Final Spec"}
                 </Button>
                 {canBrokerReviewFinalSpec && fullSpec && (
                   <Button
                     variant={fullSpec.status === ProjectSpecStatus.FINAL_REVIEW ? "primary" : "outline"}
                     onClick={() => navigate(`/broker/specs/${fullSpec.id}`)}
                   >
                     {fullSpec.status === ProjectSpecStatus.FINAL_REVIEW
                       ? "Review & Sign Final Spec"
                       : "View Final Spec"}
                   </Button>
                 )}
                 {canInitializeContract && (
                   <Button onClick={handleInitializeContract} disabled={isCreatingContract}>
                     {isCreatingContract ? "Creating Contract..." : "Create Contract"}
                   </Button>
                 )}
                 </div>
               </CardContent>
             </Card>
           )}

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

            <TabsContent value="phases" className="space-y-4">
              <Card className={brokerWorkflowPhase === 1 ? "border-2 border-primary" : ""}>
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
                    Request must be assigned to a broker before spec drafting starts.
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

              <Card className={brokerWorkflowPhase === 2 ? "border-2 border-primary" : ""}>
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
                      {clientSpec?.status?.replace(/_/g, " ") || "NOT CREATED"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Broker drafts client-readable spec, then client approves/rejects it.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={clientSpec ? "outline" : "primary"}
                      onClick={() => navigate(`/broker/project-requests/${request.id}/create-client-spec`)}
                    >
                      {clientSpec ? "Open Client Spec" : "Create Client Spec"}
                    </Button>
                    {clientSpec && (
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/broker/specs/${clientSpec.id}`)}
                      >
                        View Client Spec
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={brokerWorkflowPhase === 3 ? "border-2 border-primary" : ""}>
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
                    <Badge variant={hasSelectedFreelancer ? "default" : "outline"}>
                      {hasSelectedFreelancer ? "Freelancer Selected" : "Waiting selection"}
                    </Badge>
                    {selectedFreelancerProposal && (
                      <span className="text-sm text-muted-foreground">
                        Proposal status: {String(selectedFreelancerProposal.status || "").toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    After Client Spec is approved, client invites freelancer and one accepted freelancer becomes final-spec signer.
                  </p>
                  {fullSpec &&
                    [
                      ProjectSpecStatus.DRAFT,
                      ProjectSpecStatus.REJECTED,
                    ].includes(fullSpec.status) &&
                    !hasSelectedFreelancer && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        Final Spec draft already exists, but workflow stays in Phase 3 until a freelancer is selected. Drafting early is allowed; sign-off is not.
                      </div>
                    )}
                </CardContent>
              </Card>

              <Card className={brokerWorkflowPhase === 4 ? "border-2 border-primary" : ""}>
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
                    Broker drafts Final Spec, submits final review, then Client + Broker + Freelancer sign.
                  </p>
                  {!hasSelectedFreelancer && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      You can draft the Final Spec early, but Phase 4 only becomes active after freelancer selection in Phase 3.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={fullSpec ? "outline" : "primary"}
                      onClick={() => navigate(`/broker/project-requests/${request.id}/create-spec`)}
                    >
                      {fullSpec ? "Open Final Spec" : "Create Final Spec"}
                    </Button>
                    {canBrokerReviewFinalSpec && fullSpec && (
                      <Button
                        onClick={() => navigate(`/broker/specs/${fullSpec.id}`)}
                        variant={fullSpec.status === ProjectSpecStatus.FINAL_REVIEW ? "primary" : "outline"}
                      >
                        {fullSpec.status === ProjectSpecStatus.FINAL_REVIEW
                          ? "Review & Sign Final Spec"
                          : "View Final Spec"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={brokerWorkflowPhase === 5 ? "border-2 border-primary" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-green-100 p-2 rounded-full">
                      <FileSignature className="w-5 h-5 text-green-600" />
                    </div>
                    Phase 5: Contract
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant="outline">{String(request.status || "").replace(/_/g, " ")}</Badge>
                  <p className="text-sm text-muted-foreground">
                    Contract starts after Final Spec is all-signed. Contract signing and project activation happen in the contract flow.
                  </p>
                  {linkedContract ? (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                      <p className="text-sm font-medium">{linkedContract.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Status: {String(linkedContract.status || "DRAFT").replace(/_/g, " ")}
                        {contractActivated ? " · Project activated" : ""}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button onClick={() => navigate(`/broker/contracts/${linkedContract.id}`)}>
                          Open Contract
                        </Button>
                        {canOpenWorkspace && (
                          <Button
                            variant="primary"
                            onClick={() => navigate(`/broker/workspace/${linkedContract.projectId}`)}
                          >
                            Open Workspace
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => void fetchRequest()}>
                          Refresh
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {canInitializeContract && (
                        <Button onClick={handleInitializeContract} disabled={isCreatingContract}>
                          {isCreatingContract ? "Creating Contract..." : "Create Contract"}
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => navigate("/broker/contracts")}>
                        Open Contracts
                      </Button>
                    </div>
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
               <CardHeader>
                 <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Next Action (Broker)</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="flex items-start gap-2 mb-4">
                   <Clock3 className="mt-0.5 h-5 w-5 text-blue-600" />
                   <div>
                     <p className="font-semibold">{nextAction.title}</p>
                     <p className="text-sm text-muted-foreground">{nextAction.description}</p>
                   </div>
                 </div>
                 <div className="mb-3 flex items-center gap-2">
                   <Badge variant="outline">{`Workflow phase ${brokerWorkflowPhase}/5`}</Badge>
                   <Badge variant="secondary">{formatHumanStatus(request.status)}</Badge>
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
        </div>
      </div>
    </div>
  );
}
