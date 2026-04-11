import { Card, CardContent, Button, Badge } from "@/shared/components/ui";
import { Link, useLocation } from "react-router-dom";
import { Calendar, Clock3, DollarSign, Target, User } from "lucide-react";
import { buildTrustProfilePath } from "@/features/trust-profile/routes";
import {
  normalizeInvitationStatus,
  type MyInvitationItem,
} from "@/shared/hooks/useMyInvitationsRealtime";

interface InvitationCardProps {
  invitation: MyInvitationItem;
  onAccept: () => void;
  onReject: () => void;
  acceptDisabledReason?: string;
}

export const InvitationCard = ({
  invitation,
  onAccept,
  onReject,
  acceptDisabledReason,
}: InvitationCardProps) => {
  const location = useLocation();
  const roleBasePath = location.pathname.startsWith("/freelancer")
    ? "/freelancer"
    : location.pathname.startsWith("/broker")
      ? "/broker"
      : "/client";
  const invitationStatus = normalizeInvitationStatus(
    invitation?.status || "UNKNOWN",
  );
  const canRespond = invitationStatus === "INVITED";
  const isAcceptDisabled = !canRespond || Boolean(acceptDisabledReason);
  const request = invitation.request;
  const projectGoalPreview = String(
    request?.requestScopeBaseline?.projectGoalSummary ||
      request?.description ||
      "",
  ).trim();
  const condensedProjectGoal =
    projectGoalPreview.length > 200
      ? `${projectGoalPreview.slice(0, 197)}...`
      : projectGoalPreview;
  const budgetLabel = request?.budgetRange || "Not specified";
  const timelineLabel =
    request?.intendedTimeline ||
    request?.requestScopeBaseline?.requestedDeadline ||
    "Not specified";
  const createdDateLabel = (() => {
    if (!invitation.createdAt) {
      return "Unknown date";
    }

    const parsed = new Date(invitation.createdAt);
    return Number.isNaN(parsed.getTime())
      ? "Unknown date"
      : parsed.toLocaleDateString();
  })();
  const clientProfilePath = invitation.request?.client?.id
    ? buildTrustProfilePath(invitation.request.client.id, {
        pathname: location.pathname,
      })
    : null;

  const getInvitationStatusBadgeClass = (status: string) => {
    switch (status) {
      case "INVITED":
        return "bg-sky-100 text-sky-700 border-sky-200";
      case "PENDING":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "ACCEPTED":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "REJECTED":
        return "bg-rose-100 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                className={`text-xs border ${getInvitationStatusBadgeClass(invitationStatus)}`}
              >
                {invitationStatus.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Request:{" "}
                {String(request?.status || "UNKNOWN").replace(/_/g, " ")}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {createdDateLabel}
              </span>
            </div>

            <h3 className="font-semibold text-lg hover:underline">
              <Link to={`${roleBasePath}/invitations/${invitation.id}`}>
                {request?.title || "Untitled request"}
              </Link>
            </h3>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>
                Invited by{" "}
                <span className="font-medium text-foreground">
                  {request?.client?.fullName || "Client"}
                </span>
              </span>
            </div>

            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="flex items-center gap-1.5 rounded-md border bg-slate-50 px-2.5 py-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                <span>Budget: {budgetLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md border bg-slate-50 px-2.5 py-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                <span>Timeline: {timelineLabel}</span>
              </div>
            </div>

            {condensedProjectGoal && (
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Target className="h-3.5 w-3.5" />
                  Project goal preview
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {condensedProjectGoal}
                </p>
              </div>
            )}

            {invitation.coverLetter && (
              <div className="bg-muted/30 p-3 rounded-md text-sm italic border mt-2">
                "{invitation.coverLetter}"
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={onAccept}
              className="bg-green-600 hover:bg-green-700"
              disabled={isAcceptDisabled}
              title={acceptDisabledReason}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              className="text-destructive hover:bg-destructive/10 border-destructive/50"
              disabled={!canRespond}
            >
              Deny
            </Button>
            {clientProfilePath && (
              <Button size="sm" variant="ghost" asChild>
                <Link to={clientProfilePath}>View Trust Profile</Link>
              </Button>
            )}
            {!canRespond && (
              <span className="text-xs text-muted-foreground text-right">
                Read-only
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
