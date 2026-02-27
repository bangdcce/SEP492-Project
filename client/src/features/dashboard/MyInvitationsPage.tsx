import { useState, useEffect } from "react";
import { discoveryApi } from "../discovery/api";
import { InvitationCard } from "./components/InvitationCard";
import { Button, Card, CardContent } from "@/shared/components/ui";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useKYCStatus } from "@/shared/components/custom/KYCBlocker";

export const MyInvitationsPage = () => {
    const [invitations, setInvitations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [kycStatus, setKycStatus] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { checkKycStatus } = useKYCStatus();
    const isFreelancerRoute = location.pathname.startsWith("/freelancer");
    const isBrokerRoute = location.pathname.startsWith("/broker");
    const hasKycApproval = kycStatus === "APPROVED";

    const fetchInvitations = async () => {
        try {
            setIsLoading(true);
            const data = await discoveryApi.getMyInvitations();
            setInvitations(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvitations();
        checkKycStatus().then(setKycStatus);
    }, []);

    const handleRespond = async (invitation: any, status: 'ACCEPTED' | 'REJECTED') => {
        const invitationStatus = String(invitation?.status || "").toUpperCase();
        if (invitationStatus !== "INVITED") {
            toast.info("Invitation is no longer pending", {
                description: `Current status: ${invitationStatus || "UNKNOWN"}.`
            });
            return;
        }

        // Check KYC before accepting
        if (status === 'ACCEPTED' && !hasKycApproval) {
            toast.error("KYC Verification Required", {
                description: "Please complete KYC verification to accept invitations."
            });
            return;
        }
        
        try {
            await discoveryApi.respondToInvitation(invitation.id, status);
            if (status === 'ACCEPTED') {
                toast.success("Invitation Accepted", {
                    description: "You have joined the project negotiation."
                });
                if (isFreelancerRoute && invitation.request?.id) {
                    navigate(`/freelancer/requests/${invitation.request.id}`);
                    return;
                }
            } else {
                toast.info("Invitation Denied", {
                    description: "Invitation has been removed."
                });
            }
            // Refresh list
            fetchInvitations();
        } catch {
            toast.error("Error", {
                description: "Failed to update invitation status."
            });
        }
    };

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>;

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">My Invitations</h1>
            </div>

            {!hasKycApproval && (
                <Card className="border-amber-200 bg-amber-50/60">
                    <CardContent className="p-4 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div className="text-sm text-amber-900">
                            Your KYC is not approved yet. You can view invitations, but accepting is disabled until verification is approved.
                        </div>
                    </CardContent>
                </Card>
            )}

            {invitations.length === 0 ? (
                <Card>
                    <CardContent className="p-10 text-center space-y-4">
                        <div className="text-muted-foreground">You have no invitations yet.</div>
                        <Button
                            variant="outline"
                            onClick={() =>
                                navigate(isBrokerRoute ? "/broker/marketplace" : "/freelancer/requests")
                            }
                        >
                            {isBrokerRoute ? "Browse Marketplace" : "View Requests"}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {invitations.map((invitation) => (
                        <InvitationCard 
                            key={invitation.id} 
                            invitation={invitation} 
                            onAccept={() => handleRespond(invitation, 'ACCEPTED')}
                            onReject={() => handleRespond(invitation, 'REJECTED')}
                            acceptDisabledReason={!hasKycApproval ? "KYC approval required" : undefined}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
