import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { discoveryApi } from "../discovery/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Separator, Skeleton } from "@/shared/components/ui";
import { ArrowLeft, Calendar, DollarSign, Monitor, User, Check, X } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { KYCBlocker, useKYCStatus } from "@/shared/components/custom/KYCBlocker";

export const InvitationDetailsPage = () => {
    const { id } = useParams<{ id: string }>(); // Invitation ID
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const [invitation, setInvitation] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [kycStatus, setKycStatus] = useState<string | null>(null);
    const { checkKycStatus } = useKYCStatus();

    useEffect(() => {
        checkKycStatus().then(setKycStatus);
        
        const loadInvitation = async () => {
             try {
                // Since we don't have a direct GET /invitation/:id, we fetch all and find.
                // Improvement: Add specific endpoint.
                const all = await discoveryApi.getMyInvitations();
                const found = all.find((i: any) => i.id === id);
                if (found) {
                    setInvitation(found);
                } else {
                    // Handle not found
                }
             } catch (e) {
                 console.error(e);
             } finally {
                 setIsLoading(false);
             }
        };
        loadInvitation();
    }, [id]);

    const handleRespond = async (status: 'ACCEPTED' | 'REJECTED') => {
        if (!invitation) return;
        
        // Check KYC before accepting
        if (status === 'ACCEPTED' && kycStatus !== 'APPROVED') {
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
                title: status === 'ACCEPTED' ? "Invitation Accepted" : "Invitation Denied",
                description: status === 'ACCEPTED' ? "You have joined the project negotiation." : "Invitation has been removed.",
                variant: status === 'ACCEPTED' ? "default" : "destructive",
            });
            navigate('/dashboard/invitations');
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update invitation status.",
                variant: "destructive",
            });
        }
    };

    if (isLoading) return <div className="container p-10 space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
    
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
    
    if (!invitation) return <div className="container p-10">Invitation not found.</div>;

    const { request } = invitation;

    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-6">
            <Button variant="ghost" onClick={() => navigate('/dashboard/invitations')} className="gap-2 pl-0">
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
                                        <Badge variant="secondary">{request.status.replace("_", " ")}</Badge>
                                        <span className="text-sm border-l pl-2 ml-2">Posted {new Date(request.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" /> Budget
                                    </span>
                                    <p className="font-medium">{request.budgetRange}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> Timeline
                                    </span>
                                    <p className="font-medium">{request.intendedTimeline}</p>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Monitor className="w-4 h-4" /> Tech Stack
                                    </span>
                                    <p className="font-medium">{request.techPreferences}</p>
                                </div>
                             </div>

                             <Separator />

                             <div>
                                <h3 className="font-semibold mb-2">Description</h3>
                                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{request.description}</p>
                             </div>

                             {invitation.coverLetter && (
                                <div className="bg-muted/30 p-4 rounded-lg border">
                                    <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                                        <MailIcon className="w-4 h-4" /> Message from Client
                                    </h3>
                                    <p className="text-sm italic text-muted-foreground">"{invitation.coverLetter}"</p>
                                </div>
                             )}
                        </CardContent>
                    </Card>
                </div>

                <div className="md:w-80 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Action Required</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                You have been invited to apply for this project. Accepting will move you to the candidate list.
                            </p>
                            <Button className="w-full bg-green-600 hover:bg-green-700 gap-2" onClick={() => handleRespond('ACCEPTED')}>
                                <Check className="w-4 h-4" /> Accept Invitation
                            </Button>
                            <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 border-destructive/20 gap-2" onClick={() => handleRespond('REJECTED')}>
                                <X className="w-4 h-4" /> Deny
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                                    {request.client?.fullName.substring(0,1)}
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Client</p>
                                    <p className="font-semibold">{request.client?.fullName}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

function MailIcon(props: any) {
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
    )
}
