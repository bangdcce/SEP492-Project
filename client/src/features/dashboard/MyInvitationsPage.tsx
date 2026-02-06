import { useState, useEffect } from "react";
import { discoveryApi } from "../discovery/api";
import { InvitationCard } from "./components/InvitationCard";
import { Button, Card, CardContent } from "@/shared/components/ui";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KYCBlocker, useKYCStatus } from "@/shared/components/custom/KYCBlocker";

export const MyInvitationsPage = () => {
    const [invitations, setInvitations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [kycStatus, setKycStatus] = useState<string | null>(null);
    const navigate = useNavigate();
    const { checkKycStatus } = useKYCStatus();

    const fetchInvitations = async () => {
        try {
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

    const handleRespond = async (id: string, status: 'ACCEPTED' | 'REJECTED') => {
        // Check KYC before accepting
        if (status === 'ACCEPTED' && kycStatus !== 'APPROVED') {
            toast.error("KYC Verification Required", {
                description: "Please complete KYC verification to accept invitations."
            });
            return;
        }
        
        try {
            await discoveryApi.respondToInvitation(id, status);
            if (status === 'ACCEPTED') {
                toast.success("Invitation Accepted", {
                    description: "You have joined the project negotiation."
                });
            } else {
                toast.info("Invitation Denied", {
                    description: "Invitation has been removed."
                });
            }
            // Refresh list
            fetchInvitations();
        } catch (error) {
            toast.error("Error", {
                description: "Failed to update invitation status."
            });
        }
    };

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>;

    // Show KYC blocker if not approved
    if (kycStatus && kycStatus !== 'APPROVED') {
        return (
            <KYCBlocker 
                kycStatus={kycStatus} 
                role="freelancer" 
                action="accept project invitations"
            />
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">My Invitations</h1>
            </div>

            {invitations.length === 0 ? (
                <Card>
                    <CardContent className="p-10 text-center space-y-4">
                        <div className="text-muted-foreground">You have no pending invitations.</div>
                        <Button variant="outline" onClick={() => navigate('/client/discovery')}>
                            Browse Marketplace
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {invitations.map((invitation) => (
                        <InvitationCard 
                            key={invitation.id} 
                            invitation={invitation} 
                            onAccept={() => handleRespond(invitation.id, 'ACCEPTED')}
                            onReject={() => handleRespond(invitation.id, 'REJECTED')}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
