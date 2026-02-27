import { Card, CardContent, Button, Badge } from "@/shared/components/ui";
import { Link, useLocation } from "react-router-dom";
import { Calendar, User } from "lucide-react";

interface InvitationCardProps {
  invitation: any; // Type appropriately
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
  const invitationStatus = String(invitation?.status || "UNKNOWN").toUpperCase();
  const canRespond = invitationStatus === "INVITED";
  const isAcceptDisabled = !canRespond || Boolean(acceptDisabledReason);

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
               <Badge className={`text-xs border ${getInvitationStatusBadgeClass(invitationStatus)}`}>
                 {invitationStatus.replace("_", " ")}
               </Badge>
               <Badge variant="outline" className="text-xs">
                 Request: {String(invitation.request?.status || "UNKNOWN").replace(/_/g, " ")}
               </Badge>
               <span className="text-sm text-muted-foreground flex items-center gap-1">
                 <Calendar className="w-3 h-3" />
                 {new Date(invitation.createdAt).toLocaleDateString()}
               </span>
            </div>
            
            <h3 className="font-semibold text-lg hover:underline">
              <Link to={`${roleBasePath}/invitations/${invitation.id}`}>
                {invitation.request.title}
              </Link>
            </h3>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Invited by <span className="font-medium text-foreground">{invitation.request.client?.fullName}</span></span>
            </div>

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
