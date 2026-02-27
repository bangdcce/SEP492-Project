import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock3,
  Compass,
  FileText,
  FolderKanban,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Spinner,
} from "@/shared/components/ui";
import { projectRequestsApi } from "../project-requests/api";
import type { ProjectRequest } from "../project-requests/types";
import { RequestStatus } from "../project-requests/types";
import { fetchProjectsByUser } from "@/features/project-list/api";
import type { Project } from "@/features/project-list/types";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";

const WORKSPACE_LIVE_STATUSES = new Set([
  "INITIALIZING",
  "PLANNING",
  "IN_PROGRESS",
  "TESTING",
  "DISPUTED",
]);

const COMPLETED_PROJECT_STATUSES = new Set(["COMPLETED", "PAID"]);

const SPEC_PIPELINE_STATUSES: ReadonlySet<RequestStatus> = new Set<RequestStatus>([
  RequestStatus.BROKER_ASSIGNED,
  RequestStatus.SPEC_SUBMITTED,
  RequestStatus.SPEC_APPROVED,
  RequestStatus.HIRING,
  RequestStatus.CONTRACT_PENDING,
  RequestStatus.CONVERTED_TO_PROJECT,
]);

const getStatusBadgeClass = (status?: string) => {
  switch ((status || "").toUpperCase()) {
    case "SPEC_APPROVED":
    case "CONTRACT_PENDING":
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case "CONVERTED_TO_PROJECT":
    case "IN_PROGRESS":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "HIRING":
    case "SPEC_SUBMITTED":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "BROKER_ASSIGNED":
      return "bg-sky-100 text-sky-700 border-sky-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

export function BrokerDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = getStoredJson<{ id?: string }>(STORAGE_KEYS.USER);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [requestData, projectData] = await Promise.all([
          projectRequestsApi.getAll(),
          currentUser?.id ? fetchProjectsByUser(currentUser.id) : Promise.resolve([]),
        ]);
        setRequests(requestData);
        setProjects(projectData);
      } catch (error) {
        console.error("Failed to fetch broker dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser?.id]);

  const myRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.brokerId === currentUser?.id ||
          request.brokerProposals?.some(
            (proposal: { brokerId?: string; status?: string }) =>
              proposal.brokerId === currentUser?.id && proposal.status === "ACCEPTED",
          ),
      ),
    [requests, currentUser?.id],
  );

  const marketplaceQueue = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status === RequestStatus.PUBLIC_DRAFT || request.status === RequestStatus.PENDING,
      ),
    [requests],
  );

  const specPipelineRequests = useMemo(
    () => myRequests.filter((request) => SPEC_PIPELINE_STATUSES.has(request.status)),
    [myRequests],
  );

  const workspaceProjects = useMemo(
    () => projects.filter((project) => project.brokerId === currentUser?.id),
    [projects, currentUser?.id],
  );

  const activeWorkspaces = useMemo(
    () =>
      workspaceProjects.filter((project) => WORKSPACE_LIVE_STATUSES.has(project.status?.toUpperCase())),
    [workspaceProjects],
  );

  const completedProjects = useMemo(
    () =>
      workspaceProjects.filter((project) =>
        COMPLETED_PROJECT_STATUSES.has(project.status?.toUpperCase()),
      ),
    [workspaceProjects],
  );

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <Card className="overflow-hidden border-teal-100 bg-gradient-to-r from-teal-50 via-cyan-50 to-white">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1 text-xs font-semibold text-teal-700">
              <Sparkles className="h-3.5 w-3.5" />
              Broker Command Center
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/broker/marketplace")}>
              <Compass className="mr-2 h-4 w-4" />
              Open Marketplace
            </Button>
            <Button onClick={() => navigate("/broker/projects")}>
              <FolderKanban className="mr-2 h-4 w-4" />
              Open Workspaces
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription>Marketplace Queue</CardDescription>
            <CardTitle className="text-2xl">{marketplaceQueue.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Unclaimed public/pending requests</CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription>Spec Pipeline</CardDescription>
            <CardTitle className="text-2xl text-indigo-600">{specPipelineRequests.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Requests in Client Spec / Final Spec flow</CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription>Active Workspaces</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{activeWorkspaces.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Project execution in progress</CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription>Completed Projects</CardDescription>
            <CardTitle className="text-2xl">{completedProjects.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Delivered and finalized</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Spec & Contract Pipeline
              </CardTitle>
              <CardDescription>Your assigned requests in governance flow</CardDescription>
            </div>
            <Badge variant="outline">{specPipelineRequests.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {specPipelineRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No requests in spec pipeline.
              </p>
            ) : (
              specPipelineRequests.slice(0, 6).map((request) => (
                <div
                  key={request.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 transition-colors hover:border-indigo-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{request.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Updated{" "}
                        {formatDistanceToNowStrict(new Date(request.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Badge className={getStatusBadgeClass(request.status)}>
                      {request.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/broker/project-requests/${request.id}`)}
                    >
                      Open Request
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-600" />
                Workspace Entry
              </CardTitle>
              <CardDescription>Open project workspace directly from dashboard</CardDescription>
            </div>
            <Badge variant="outline">{activeWorkspaces.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeWorkspaces.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No active workspace yet.
              </p>
            ) : (
              activeWorkspaces.slice(0, 6).map((project) => (
                <div
                  key={project.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{project.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Status: {project.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    {project.status?.toUpperCase() === "DISPUTED" ? (
                      <Badge className="bg-red-100 text-red-700 border-red-200">Disputed</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        Live
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/broker/workspace/${project.id}`)}
                    >
                      Open Workspace
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
          <CardContent className="pt-0">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/broker/projects")}
            >
              <FolderKanban className="mr-2 h-4 w-4" />
              View All Workspaces
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock3 className="h-4 w-4 text-slate-500" />
            Tip: create/update milestones inside Workspace before contract activation. After
            activation, milestone scope is locked and requires amendment flow.
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Governance lock active
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
