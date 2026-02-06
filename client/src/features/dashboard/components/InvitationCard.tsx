import { Card, CardContent, Button, Badge } from "@/shared/components/ui";
import { Link } from "react-router-dom";
import { Calendar, User } from "lucide-react";

interface InvitationCardProps {
  invitation: any; // Type appropriately
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export const InvitationCard = ({ invitation, onAccept, onReject }: InvitationCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
               <Badge variant="outline" className="text-xs">
                 {invitation.request.status.replace("_", " ")}
               </Badge>
               <span className="text-sm text-muted-foreground flex items-center gap-1">
                 <Calendar className="w-3 h-3" />
                 {new Date(invitation.createdAt).toLocaleDateString()}
               </span>
            </div>
            
            <h3 className="font-semibold text-lg hover:underline">
              <Link to={`/dashboard/invitations/${invitation.id}`}>
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
             <Button size="sm" onClick={() => onAccept(invitation.id)} className="bg-green-600 hover:bg-green-700">
                Accept
             </Button>
             <Button size="sm" variant="outline" onClick={() => onReject(invitation.id)} className="text-destructive hover:bg-destructive/10 border-destructive/50">
                Deny
             </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
