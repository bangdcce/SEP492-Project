import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardFooter,
  Button,
  Badge,
  Spinner,
} from "@/shared/components/ui";
import { projectRequestsApi } from "../project-requests/api";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Briefcase, Clock, CheckCircle, ArrowRight } from "lucide-react";
import { RequestStatus } from "../project-requests/types";

export function BrokerDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await projectRequestsApi.getAll();
      setRequests(data);
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center p-10">
        <Spinner size="lg" />
      </div>
    );

  // Filter lists
  const pendingRequests = requests.filter(
    (r) => r.status === RequestStatus.PENDING
  );

  const myProjects = requests.filter(
    (r) =>
      r.status === RequestStatus.PROCESSING ||
      r.status === RequestStatus.SPEC_SUBMITTED ||
      r.status === RequestStatus.SPEC_APPROVED ||
      r.status === RequestStatus.APPROVED
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Broker Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage project requests and specifications.
          </p>
        </div>
        <Button onClick={() => navigate("/broker/marketplace")}>
          Browse All Requests
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-blue-50 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-blue-900 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-700">
              {pendingRequests.length}
            </div>
            <p className="text-sm text-blue-600 mt-1">
              waiting for assignment
            </p>
          </CardContent>
        </Card>

        <Card className="bg-indigo-50 border-indigo-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-indigo-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5" /> Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-indigo-700">
              {myProjects.length}
            </div>
            <p className="text-sm text-indigo-600 mt-1">
              currently processing
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-green-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-700">
              {requests.filter((r) => r.status === RequestStatus.COMPLETED).length}
            </div>
            <p className="text-sm text-green-600 mt-1">projects finalized</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left: Pending Requests (Marketplace) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>New Requests</CardTitle>
            <Badge variant="secondary">{pendingRequests.length} available</Badge>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">
                No pending requests.
              </p>
            ) : (
              <div className="space-y-4">
                {pendingRequests.slice(0, 5).map((req) => (
                  <div
                    key={req.id}
                    className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/broker/project-requests/${req.id}`)}
                  >
                    <div>
                      <h4 className="font-semibold line-clamp-1">
                        {req.title}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span>
                          {format(new Date(req.createdAt), "MMM d, yyyy")}
                        </span>
                        <span>•</span>
                        <span>{req.budgetRange || "No budget"}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/broker/marketplace")}
            >
              View Market
            </Button>
          </CardFooter>
        </Card>

        {/* Right: My Active Projects */}
        <Card>
          <CardHeader>
            <CardTitle>My Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {myProjects.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">
                No active projects.
              </p>
            ) : (
              <div className="space-y-4">
                {myProjects.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 border rounded-lg hover:shadow-md transition-all bg-white"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4
                        className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors"
                        onClick={() => navigate(`/broker/project-requests/${req.id}`)}
                      >
                        {req.title}
                      </h4>
                      <Badge
                        variant={
                          req.status === RequestStatus.PROCESSING
                            ? "default"
                            : "secondary"
                        }
                      >
                        {req.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {req.description}
                    </p>
                    <div className="flex gap-2">
                    <Button
                        variant="default"
                        size="sm"
                        className="w-full"
                        onClick={() => navigate(`/broker/project-requests/${req.id}`)}
                      >
                       Manage Project
                      </Button>
                      
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
