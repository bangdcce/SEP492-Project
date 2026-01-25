import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Filter, Star, ShieldCheck } from "lucide-react";
import { Button, Input, Badge, Card, CardContent, CardHeader, CardTitle, Avatar, AvatarImage, AvatarFallback, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/components/ui";
import { discoveryApi } from "./api";
import type { UserSearchFilters } from "./api";
import { UserRole } from "../../shared/types/user.types";
import { useDebounce } from "../../shared/hooks/useDebounce";

export const DiscoveryPage = () => {
  console.log("DiscoveryPage rendering");
  const [searchParams] = useSearchParams();
  const paramRole = searchParams.get("role");
  const initialRole = (paramRole === UserRole.BROKER || paramRole === UserRole.FREELANCER) ? paramRole : "ALL";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [role, setRole] = useState<UserRole | "ALL">(initialRole);

  const [data, setData] = useState<{ data: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const filters: UserSearchFilters = {
            search: debouncedSearch,
            role: role === "ALL" ? undefined : role,
        };
        const result = await discoveryApi.searchUsers(filters);
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [debouncedSearch, role]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Find Partners</h1>
          <p className="text-muted-foreground mt-1"> Discover top-rated Brokers and Freelancers for your projects.</p>
        </div>
        <div className="flex gap-2">
            {/* Create Request CTA for clients maybe? */}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search by name, skills, or bio..." 
                    className="pl-9" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <div className="w-full md:w-[200px]">
                <Select value={role} onValueChange={(v) => setRole(v as UserRole | "ALL")}>
                    <SelectTrigger>
                        <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Roles</SelectItem>
                        <SelectItem value={UserRole.BROKER}>Brokers</SelectItem>
                        <SelectItem value={UserRole.FREELANCER}>Freelancers</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-10">Loading...</div>
      ) : error ? (
        <div className="text-center py-10 text-destructive">Failed to load users</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.data?.length === 0 && (
                <div className="col-span-full text-center py-10 text-muted-foreground">
                    No users found matching your criteria.
                </div>
            )}
            {data?.data?.map((user: any) => (
                <UserCard key={user.id} user={user} />
            ))}
        </div>
      )}
    </div>
  );
};

function UserCard({ user }: { user: any }) {
    const isBroker = user.role === UserRole.BROKER;
    return (
        <Card className="hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden">
             {/* Color Banner */}
             <div className={`h-2 ${isBroker ? 'bg-purple-500' : 'bg-blue-500'}`} />
             
             <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                     <div className="flex gap-4">
                        <Avatar className="h-12 w-12 border-2 border-background">
                            <AvatarImage src={user.profile?.avatarUrl} />
                            <AvatarFallback>{user.fullName.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-semibold text-lg hover:underline group-hover:text-primary transition-colors">
                                <Link to={`/client/discovery/profile/${user.id}`}>
                                    {user.fullName}
                                </Link>
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="secondary" className="text-xs">
                                    {user.role}
                                </Badge>
                                {user.isVerified && (
                                    <span className="flex items-center text-green-600 gap-0.5 text-xs font-medium">
                                        <ShieldCheck className="w-3 h-3" /> Verified
                                    </span>
                                )}
                            </div>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="flex items-center gap-1 font-bold text-lg">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            {Number(user.currentTrustScore || 0).toFixed(1)}
                        </div>
                     </div>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-3 mb-4 min-h-[60px]">
                    {user.profile?.bio || "No bio available."}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                    {user.userSkills?.slice(0, 3).map((us: any) => (
                         <Badge key={us.id} variant="outline" className="text-xs bg-muted/50">
                            {us.skill?.name}
                         </Badge>
                    ))}
                    {(user.userSkills?.length || 0) > 3 && (
                        <span className="text-xs text-muted-foreground self-center">
                            +{user.userSkills.length - 3} more
                        </span>
                    )}
                </div>

                <Button className="w-full" asChild>
                    <Link to={`/client/discovery/profile/${user.id}`}>View Profile</Link>
                </Button>
             </CardContent>
        </Card>
    );
}
