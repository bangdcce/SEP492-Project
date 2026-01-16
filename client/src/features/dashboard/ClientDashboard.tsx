import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  Button,
  Badge,
  Spinner,
} from "@/shared/components/ui";
import { wizardService } from "../wizard/services/wizardService";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { PlusCircle, AlertCircle } from "lucide-react";
import { ROUTES } from "@/constants";
import { RequestStatus } from "../requests/types";

export function ClientDashboard() {
  const navigate = useNavigate();
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecent();
  }, []);

  const fetchRecent = async () => {
    try {
      const data = await wizardService.getRequests();
      setRecentRequests(data.slice(0, 5));
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
      switch(status) {
          case RequestStatus.DRAFT: 
          case RequestStatus.PUBLIC_DRAFT: 
          case RequestStatus.PRIVATE_DRAFT: 
            return 'secondary';
          case RequestStatus.PENDING: 
          case RequestStatus.PENDING_SPECS: 
            return 'default'; 
          case RequestStatus.HIRING: 
          case RequestStatus.IN_PROGRESS:
            return 'default';
          default: return 'outline';
      }
  };

  if (loading)
    return (
      <div className="flex justify-center p-10">
        <Spinner size="lg" />
      </div>
    );

  const attentionItems = recentRequests.filter(
    (r) => r.status === RequestStatus.PENDING || r.status === RequestStatus.PENDING_SPECS || r.status === "WAITING_FOR_REVIEW"
  );

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Hero Section */}
      <div className="bg-primary/5 rounded-2xl p-8 mb-8 border border-primary/10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">
              Welcome back!
            </h1>
            <p className="text-muted-foreground text-lg">
              Ready to start your next big project?
            </p>
          </div>
          <Button
            size="lg"
            className="gap-2 shadow-lg"
            onClick={() => navigate(ROUTES.CLIENT_WIZARD)}
          >
            <PlusCircle className="w-5 h-5" /> Create New Request
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column: Attention & Stats */}
        <div className="md:col-span-2 space-y-8">
          {/* Attention Needed */}
          {attentionItems.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader>
                <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-900">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Needs Attention
                </h2>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {attentionItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col p-4 border border-amber-200 bg-white rounded-lg cursor-pointer hover:shadow-sm transition-all"
                      onClick={() => navigate(`/client/requests/${item.id}`)}
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium text-lg truncate pr-4 text-amber-900">
                          {item.title || "Untitled Request"}
                        </h3>
                        <Badge variant="outline" className="border-amber-200 text-amber-700">
                          {item.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
                        <span>Created {format(new Date(item.createdAt), 'MMM d, yyyy')}</span>
                        <span>{item.answers?.length || 0} details</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity Card */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {recentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border"
                      onClick={() => navigate(`/client/requests/${request.id}`)}
                    >
                        <div
                          className={`w-2 h-12 rounded-full ${
                            request.status.includes("DRAFT")
                              ? "bg-gray-300"
                              : request.status.includes("PENDING")
                              ? "bg-yellow-400"
                              : "bg-green-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            {request.title || "Untitled Draft"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(request.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Badge variant={getStatusVariant(request.status)}>
                            {request.status.replace(/_/g, ' ')}
                        </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate(ROUTES.CLIENT_MY_REQUESTS)}
              >
                View All Requests
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Quick Links / Resources */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-none">
            <CardHeader>
              <h3 className="font-semibold text-blue-900">How it works</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800">
                  1
                </div>
                <p className="text-sm text-blue-800">
                  Describe your project idea in our Wizard.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800">
                  2
                </div>
                <p className="text-sm text-blue-800">
                  Our Brokers review and formalize specs.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800">
                  3
                </div>
                <p className="text-sm text-blue-800">
                  Get matched with top Freelancers.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold">Project Stats</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Active Projects
                </span>
                <span className="font-bold">
                    {recentRequests.filter(r => !r.status.includes('DRAFT')).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Total Requests
                </span>
                <span className="font-bold">{recentRequests.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
