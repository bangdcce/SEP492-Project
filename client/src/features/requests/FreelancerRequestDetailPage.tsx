import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
} from "@/shared/components/ui";
import { ArrowLeft, FileText, Sparkles, UserCheck, Users } from "lucide-react";
import { wizardService } from "@/features/wizard/services/wizardService";
import type { ProjectSpec } from "@/features/project-specs/types";
import { ProjectSpecStatus, SpecPhase } from "@/features/project-specs/types";
import type { ContractSummary } from "@/features/contracts/types";
import { connectSocket } from "@/shared/realtime/socket";
import { getApiErrorDetails } from "@/shared/utils/apiError";
import type { ProjectRequest } from "./types";
import { RequestAttachmentGallery } from "./components/RequestAttachmentGallery";
import { RequestChatPanel } from "@/features/request-chat/RequestChatPanel";
import {
  formatHumanStatus as formatStatus,
  isContractActivated,
  pickLatestSpecByPhase,
  resolveRequestFlowSnapshot,
} from "./requestFlow";
import { buildTrustProfilePath } from "@/features/trust-profile/routes";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";

type RequestWithRelations = ProjectRequest & {
  client?: { id: string; fullName: string; email?: string };
  broker?: { id: string; fullName: string; email?: string } | null;
  freelancerProposals?: Array<{
    id: string;
    freelancerId: string;
    status: string;
    createdAt?: string;
  }>;
  proposals?: Array<{
    id: string;
    freelancerId: string;
    status: string;
    createdAt?: string;
  }>;
};

type CurrentUserSummary = {
  id?: string;
};

const getSpecBadgeClass = (status?: string) => {
  switch (status) {
    case ProjectSpecStatus.CLIENT_APPROVED:
    case ProjectSpecStatus.ALL_SIGNED:
    case ProjectSpecStatus.APPROVED:
      return "bg-green-100 text-green-800 border-green-200";
    case ProjectSpecStatus.CLIENT_REVIEW:
    case ProjectSpecStatus.FINAL_REVIEW:
      return "bg-amber-100 text-amber-800 border-amber-200";
    case ProjectSpecStatus.REJECTED:
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export default function FreelancerRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useCurrentUser<CurrentUserSummary>();

  const [request, setRequest] = useState<RequestWithRelations | null>(null);
  const [specs, setSpecs] = useState<ProjectSpec[]>([]);
  const [linkedContract, setLinkedContract] = useState<ContractSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequest = useCallback(async (requestId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const requestData = (await wizardService.getRequestById(requestId)) as RequestWithRelations;
      setRequest(requestData);
      setSpecs(Array.isArray(requestData.specs) ? requestData.specs : []);
      setLinkedContract(
        (requestData?.linkedContractSummary as ContractSummary | null) || null,
      );
    } catch (loadError) {
      console.error(loadError);
      const details = getApiErrorDetails(loadError, "Unable to load request details.");
      setError(details.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    void fetchRequest(id);
  }, [fetchRequest, id]);

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
      const knownSpecIds = new Set(
        (request?.specs || [])
          .map((spec) => spec.id)
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
        void fetchRequest(id);
      }
    };

    socket.on("NOTIFICATION_CREATED", handleNotificationCreated);
    return () => {
      socket.off("NOTIFICATION_CREATED", handleNotificationCreated);
    };
  }, [fetchRequest, id, request?.linkedContractSummary?.id, request?.linkedProjectSummary?.id, request?.specs]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container mx-auto max-w-5xl py-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || "Request not found."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const clientSpec = pickLatestSpecByPhase(specs, SpecPhase.CLIENT_SPEC);
  const fullSpec = pickLatestSpecByPhase(specs, SpecPhase.FULL_SPEC);
  const flowSnapshot = resolveRequestFlowSnapshot(request, { clientSpec, fullSpec }, linkedContract);

  const proposalList = request.freelancerProposals || request.proposals || [];
  const myProposal = proposalList.find((proposal) => proposal.freelancerId === currentUser?.id) || null;
  const normalizedProposalStatus = String(myProposal?.status || "").toUpperCase();
  const canUseRequestChat = ["ACCEPTED", "PENDING"].includes(normalizedProposalStatus);
  const canOpenFinalSpec = Boolean(fullSpec);
  const shouldHighlightFinalSign =
    fullSpec?.specPhase === SpecPhase.FULL_SPEC &&
    fullSpec.status === ProjectSpecStatus.FINAL_REVIEW;
  const canOpenContract = Boolean(linkedContract?.id);
  const contractActivated = isContractActivated(linkedContract);
  const canOpenWorkspace = Boolean(contractActivated && linkedContract?.projectId);
  const clientTrustProfilePath = request.client?.id
    ? buildTrustProfilePath(request.client.id, {
        role: "FREELANCER",
      })
    : null;
  const freelancerNextAction = (() => {
    if (!myProposal || normalizedProposalStatus === "INVITED") {
      return {
        title: "Accept invitation first",
        description: "Go to Invitations and accept this request before spec/contract actions.",
        ctaLabel: "Open Invitations",
        onClick: () => navigate("/freelancer/invitations"),
      };
    }

    if (!["ACCEPTED", "PENDING"].includes(normalizedProposalStatus)) {
      return {
        title: "Invitation is not active",
        description: "This request is not currently active for you. Check your invitation status first.",
        ctaLabel: "Open Invitations",
        onClick: () => navigate("/freelancer/invitations"),
      };
    }

    if (!fullSpec) {
        return {
          title: "Waiting for Final Spec",
          description: "Broker is drafting Final Spec from approved client scope.",
          ctaLabel: "Refresh",
          onClick: () => id && fetchRequest(id),
        };
    }

    if (fullSpec.status === ProjectSpecStatus.FINAL_REVIEW) {
      return {
        title: "Sign Final Spec",
        description: "Your signature is required together with client and broker.",
        ctaLabel: "Review & Sign Final Spec",
        onClick: () => navigate(`/freelancer/spec-review/${fullSpec.id}`),
      };
    }

    if (canOpenContract && linkedContract) {
      if (canOpenWorkspace) {
        return {
          title: "Project activated",
          description: "Contract is active. Continue implementation in workspace.",
          ctaLabel: "Open Workspace",
          onClick: () => navigate(`/freelancer/workspace/${linkedContract.projectId}`),
        };
      }
      if (linkedContract.status === "SIGNED") {
        return {
          title: "Waiting for project activation",
          description: "All required signatures are complete. Broker can activate the project next.",
          ctaLabel: "Open Contract",
          onClick: () => navigate(`/freelancer/contracts/${linkedContract.id}`),
        };
      }
      return {
        title: "Sign contract",
        description: "Contract is ready. Complete signatures to activate project.",
        ctaLabel: "Open Contract",
        onClick: () => navigate(`/freelancer/contracts/${linkedContract.id}`),
      };
    }

    if (fullSpec.status === ProjectSpecStatus.ALL_SIGNED) {
        return {
          title: "Waiting for contract creation",
          description: "Broker needs to initialize contract from the signed Final Spec.",
          ctaLabel: "Refresh",
          onClick: () => id && fetchRequest(id),
        };
    }

    return {
      title: "Follow current workflow",
      description: "Final Spec and contract actions will unlock automatically by phase.",
      ctaLabel: "Open Final Spec",
      onClick: () => navigate(`/freelancer/spec-review/${fullSpec.id}`),
    };
  })();

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/freelancer/invitations")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Request Detail</h1>
              <p className="text-sm text-muted-foreground">
                Freelancer view for phase {flowSnapshot.phaseNumber}/5 in the request workflow
              </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{request.title}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Request ID: {request.id}
              </p>
            </div>
            <Badge variant="outline" className="uppercase">
              {formatStatus(request.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {request.description}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Budget (reference)</p>
              <p className="font-medium">{request.budgetRange || "—"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Timeline</p>
              <p className="font-medium">{request.intendedTimeline || "—"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Tech Preferences</p>
              <p className="font-medium">{request.techPreferences || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {request.attachments?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-4 w-4" />
              Request Attachments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RequestAttachmentGallery attachments={request.attachments} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <p className="font-semibold">{freelancerNextAction.title}</p>
              <p className="text-sm text-muted-foreground">{freelancerNextAction.description}</p>
            </div>
          </div>
          <Button onClick={freelancerNextAction.onClick}>{freelancerNextAction.ctaLabel}</Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-4 w-4" />
              Team Context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-medium">{request.client?.fullName || "—"}</p>
              {clientTrustProfilePath && (
                <Button
                  variant="link"
                  className="mt-1 h-auto px-0 text-sm"
                  onClick={() => navigate(clientTrustProfilePath)}
                >
                  View Trust Profile
                </Button>
              )}
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Broker</p>
              <p className="font-medium">{request.broker?.fullName || "Not assigned yet"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Your invitation status</p>
              <p className="font-medium">{formatStatus(myProposal?.status || "INVITED")}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-4 w-4" />
              What You Can Do
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              You can review specs and sign the Final Spec when the broker submits it for
              final review.
            </p>
            <p>
              Contract signing becomes available after all 3 parties sign the Final Spec and
              the broker initializes the contract.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Spec Workflow
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">1. Client Spec (client-readable spec)</p>
                <p className="text-sm text-muted-foreground">
                  Client approves this first before freelancer invitation/selection.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getSpecBadgeClass(clientSpec?.status)}>
                  {formatStatus(clientSpec?.status || "NOT_CREATED")}
                </Badge>
                {clientSpec && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/freelancer/spec-review/${clientSpec.id}`)}
                  >
                    View
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">2. Final Spec (technical spec)</p>
                <p className="text-sm text-muted-foreground">
                  You sign this in final review together with client and broker.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getSpecBadgeClass(fullSpec?.status)}>
                  {formatStatus(fullSpec?.status || "NOT_CREATED")}
                </Badge>
                {canOpenFinalSpec && (
                  <Button
                    size="sm"
                    variant={shouldHighlightFinalSign ? "default" : "outline"}
                    onClick={() => navigate(`/freelancer/spec-review/${fullSpec!.id}`)}
                  >
                    {shouldHighlightFinalSign ? "Review & Sign Final Spec" : "View Final Spec"}
                  </Button>
                )}
              </div>
            </div>

            {!fullSpec && (
              <p className="mt-3 text-sm text-muted-foreground">
                Broker has not submitted a Final Spec yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {canUseRequestChat ? (
        <RequestChatPanel requestId={request.id} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Contract Workflow
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canOpenContract ? (
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{linkedContract?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Status: {formatStatus(linkedContract?.status || "DRAFT")}
                  </p>
                  {contractActivated && (
                    <p className="text-xs text-muted-foreground">
                      Project activated. Continue in workspace.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/freelancer/contracts/${linkedContract!.id}`)}
                  >
                    Open Contract
                  </Button>
                  {canOpenWorkspace && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/freelancer/workspace/${linkedContract!.projectId}`)}
                    >
                      Open Workspace
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {fullSpec?.status === ProjectSpecStatus.ALL_SIGNED
                ? "Waiting for broker to initialize contract from Final Spec."
                : "Contract becomes available after Final Spec is signed by all 3 parties."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
