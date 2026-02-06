import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Clock, Globe } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Avatar, AvatarImage, AvatarFallback, Badge, Separator, Skeleton } from "@/shared/components/ui";
import { discoveryApi } from "./api";
import { InviteModal } from "./InviteModal";
import { useState, useEffect } from "react";
import { UserRole } from "../../shared/types/user.types";

export const PartnerProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!id) return;
        discoveryApi.getPublicProfile(id)
            .then(data => setUser(data))
            .catch(() => setError(true))
            .finally(() => setIsLoading(false));
    }, [id]);

    if (isLoading) return <ProfileSkeleton />;
    if (error || !user) return <div className="text-center py-10 text-destructive">Failed to load profile</div>;

    const isBroker = user.role === UserRole.BROKER;

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-6">
            <Button variant="ghost" className="pl-0 gap-2 mb-4" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4" /> Back to Discovery
            </Button>

            {/* Header Card */}
            <Card>
                <div className={`h-4 ${isBroker ? 'bg-purple-500' : 'bg-blue-500'}`} />
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        <Avatar className="h-32 w-32 border-4 border-background shadow-lg -mt-12 md:mt-0">
                            <AvatarImage src={user.profile?.avatarUrl} />
                            <AvatarFallback className="text-4xl">{user.fullName.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 space-y-2">
                             <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-3xl font-bold">{user.fullName}</h1>
                                    <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                                        <Badge variant="secondary">{user.role}</Badge>
                                        {user.isVerified && (
                                            <span className="flex items-center text-green-600 gap-1 text-sm font-medium">
                                                <CheckCircle className="w-4 h-4" /> Identity Verified
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1 text-sm">
                                           <Clock className="w-4 h-4" /> Joined {new Date(user.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 items-end">
                                    <div className="text-2xl font-bold flex items-center gap-1">
                                        <span className="text-yellow-500 text-3xl">★</span> 
                                        {Number(user.currentTrustScore || 0).toFixed(1)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">Trust Score</div>
                                </div>
                             </div>
                             
                             {/* Bio */}
                             <p className="text-muted-foreground pt-2 leading-relaxed">
                                {user.profile?.bio || "This user hasn't added a bio yet."}
                             </p>

                             {/* Socials / External Links (Mock hidden if empty) */}
                             <div className="flex gap-4 pt-2">
                                {/* Example links - relying on profile data structure */}
                                {user.profile?.portfolioLinks?.map((link: any, idx: number) => (
                                    <a key={idx} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline text-sm font-medium">
                                        <Globe className="w-4 h-4" /> {link.title || "Portfolio"}
                                    </a>
                                ))}
                             </div>
                        </div>
                    </div>

                    <div className="flex justify-end mt-6">
                         <Button size="lg" onClick={() => setIsInviteModalOpen(true)}>
                            Invite to Project
                         </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Main Content */}
                 <div className="md:col-span-2 space-y-6">
                      <Card>
                        <CardHeader>
                            <CardTitle>Skills & Expertise</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {user.userSkills?.length ? (
                                    user.userSkills.map((us: any) => (
                                        <Badge key={us.id} variant="secondary" className="px-3 py-1 text-sm">
                                            {us.skill?.name}
                                        </Badge>
                                    ))
                                ) : (
                                    <span className="text-muted-foreground italic">No skills listed.</span>
                                )}
                            </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                            <CardTitle>Work History</CardTitle>
                        </CardHeader>
                         <CardContent className="space-y-4">
                             {/* Mock History - Future: Fetch from API */}
                             <div className="text-muted-foreground italic text-center py-4">
                                No public project history displayed.
                             </div>
                         </CardContent>
                      </Card>
                 </div>

                 {/* Sidebar Stats */}
                 <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Performance Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Successful Projects</span>
                                <span className="font-bold">0</span> {/* Add to API if needed */}
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">On-time Completion</span>
                                <span className="font-bold">100%</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Dispute Rate</span>
                                <span className="font-bold text-green-600">0%</span>
                            </div>
                        </CardContent>
                    </Card>
                 </div>
            </div>

            <InviteModal 
                isOpen={isInviteModalOpen} 
                onClose={() => setIsInviteModalOpen(false)} 
                partnerId={user.id}
                partnerName={user.fullName}
                partnerRole={user.role as "BROKER" | "FREELANCER"}
            />
        </div>
    );
};

function ProfileSkeleton() {
    return (
        <div className="container mx-auto p-6 space-y-6">
             <Skeleton className="h-10 w-32" />
             <Skeleton className="h-64 w-full" />
             <div className="grid grid-cols-3 gap-6">
                <Skeleton className="col-span-2 h-96" />
                <Skeleton className="h-96" />
             </div>
        </div>
    )
}
