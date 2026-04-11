import { useEffect, useMemo, useState, type SVGProps } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { discoveryApi } from "../discovery/api";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Separator,
  Skeleton,
} from "@/shared/components/ui";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Monitor,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { useKYCStatus } from "@/shared/components/custom/KYCBlocker";
import { buildTrustProfilePath } from "@/features/trust-profile/routes";
import {
  normalizeInvitationStatus,
  useMyInvitationsRealtime,
} from "@/shared/hooks/useMyInvitationsRealtime";

const formatDisplayDate = (value?: string | null): string => {
  if (!value) {
    return "Not specified";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

export const InvitationDetailsPage = () => {
  const { id } = useParams<{ id: string }>(); // Invitation ID
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { invitations, isLoading, refresh } = useMyInvitationsRealtime();
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const { checkKycStatus } = useKYCStatus();
  const roleBasePath = location.pathname.startsWith("/freelancer")
    ? "/freelancer"
    : location.pathname.startsWith("/broker")
      ? "/broker"
      : "/client";
  const isFreelancerRoute = roleBasePath === "/freelancer";
  const hasKycApproval = kycStatus === "APPROVED";

  const invitation = useMemo(
    () => invitations.find((item) => item.id === id) ?? null,
    [id, invitations],
  );

  useEffect(() => {
    checkKycStatus().then(setKycStatus);
  }, [checkKycStatus]);

  const handleRespond = async (status: "ACCEPTED" | "REJECTED") => {
    if (!invitation) return;
    const invitationStatus = normalizeInvitationStatus(invitation?.status);
    if (invitationStatus !== "INVITED") {
      toast({
        title: "Invitation is no longer pending",
        description: `Current status: ${invitationStatus || "UNKNOWN"}.`,
      });
      void refresh({ silent: true });
      return;
    }

    // Check KYC before accepting
    if (status === "ACCEPTED" && !hasKycApproval) {
      toast({
        title: "KYC Verification Required",
        description: "Please complete KYC verification to accept invitations.",
        variant: "destructive",
      });
      return;
    }

    try {
      await discoveryApi.respondToInvitation(invitation.id, status);
      toast({
        title:
          status === "ACCEPTED" ? "Invitation Accepted" : "Invitation Denied",
        description:
          status === "ACCEPTED"
            ? "You have joined the project negotiation."
            : "Invitation has been removed.",
        variant: status === "ACCEPTED" ? "default" : "destructive",
      });
      if (
        status === "ACCEPTED" &&
        isFreelancerRoute &&
        invitation.request?.id
      ) {
        navigate(`/freelancer/requests/${invitation.request.id}`);
        return;
      }
      await refresh({ silent: true });
      navigate(`${roleBasePath}/invitations`);
    } catch {
      toast({
        title: "Error",
        description: "Failed to update invitation status.",
        variant: "destructive",
      });
    }
  };

  if (isLoading)
    return (
      <div className="container p-10 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  if (!invitation)
    return <div className="container p-10">Invitation not found.</div>;

  const { request } = invitation;
  if (!request) {
    return (
      <div className="container p-10">
        Invitation request details are unavailable.
      </div>
    );
  }

  const invitationStatus = normalizeInvitationStatus(
    invitation.status || "UNKNOWN",
  );
  const canRespond = invitationStatus === "INVITED";
  const goalSummary =
    request.requestScopeBaseline?.projectGoalSummary ||
    request.description ||
    "No project goal summary provided yet.";
  const budgetLabel = request.budgetRange || "Not specified";
  const timelineLabel = request.intendedTimeline || "Not specified";
  const requestedDeadline =
    request.requestScopeBaseline?.requestedDeadline ||
    request.requestedDeadline ||
    null;
  const techPreferences = request.techPreferences || "Not specified";
  const clientInitial =
    request.client?.fullName?.trim()?.charAt(0)?.toUpperCase() || "C";
  const clientId = request.client?.id;

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate(`${roleBasePath}/invitations`)}
        className="gap-2 pl-0"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Invitations
      </Button>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">{request.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                    <Badge variant="secondary">
                      {String(request.status || "UNKNOWN").replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline">
                      Invitation: {invitationStatus.replace("_", " ")}
                    </Badge>
                    <span className="text-sm border-l pl-2 ml-2">
                      Posted {formatDisplayDate(request.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-slate-50/70 p-4">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  Decision Snapshot
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {goalSummary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Budget
                  </span>
                  <p className="font-medium">{budgetLabel}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Timeline
                  </span>
                  <p className="font-medium">{timelineLabel}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Requested deadline
                  </span>
                  <p className="font-medium">
                    {formatDisplayDate(requestedDeadline)}
                  </p>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Monitor className="w-4 h-4" /> Tech Stack
                  </span>
                  <p className="font-medium">{techPreferences}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {request.description}
                </p>
              </div>

              {invitation.coverLetter && (
                <div className="bg-muted/30 p-4 rounded-lg border">
                  <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                    <MailIcon className="w-4 h-4" /> Message from Client
                  </h3>
                  <p className="text-sm italic text-muted-foreground">
                    "{invitation.coverLetter}"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:w-80 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {canRespond ? "Action Required" : "Invitation Status"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canRespond && !hasKycApproval && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <span>
                    KYC approval is required before you can accept this
                    invitation.
                  </span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {canRespond
                  ? "You have been invited to this project. Accepting will move you to the candidate list."
                  : `This invitation is already ${invitationStatus.replace("_", " ").toLowerCase()}.`}
              </p>
              {canRespond ? (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 gap-2"
                    onClick={() => handleRespond("ACCEPTED")}
                    disabled={!hasKycApproval}
                  >
                    <Check className="w-4 h-4" /> Accept Invitation
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:bg-destructive/10 border-destructive/20 gap-2"
                    onClick={() => handleRespond("REJECTED")}
                  >
                    <X className="w-4 h-4" /> Deny
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`${roleBasePath}/invitations`)}
                >
                  Back to Invitations
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {clientInitial}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-semibold">{request.client?.fullName}</p>
                  </div>
                </div>
                {clientId && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      navigate(
                        buildTrustProfilePath(clientId, {
                          pathname: location.pathname,
                        }),
                      )
                    }
                  >
                    View Trust Profile
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
