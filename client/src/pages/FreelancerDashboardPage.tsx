import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock3,
  DollarSign,
  Search,
  Sparkles,
  UserPlus,
} from "lucide-react";

import { ROUTES } from "@/constants";
import { apiClient } from "@/shared/api/client";
import { FreelancerDashboardLayout } from "@/shared/components/layouts/freelancer/FreelancerDashboardLayout";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Progress } from "@/shared/components/ui/progress";
import Spinner from "@/shared/components/ui/spinner";
import { connectSocket } from "@/shared/realtime/socket";

type FreelancerDashboardResponse = {
  filters: {
    search?: string | null;
    skills: string[];
    availableSkills: string[];
  };
  stats: {
    activeProjects: number;
    completedProjects: number;
    pendingInvitations: number;
    totalEarnings: number;
    currentMonthEarnings: number;
  };
  profileCompleteness: {
    percentage: number;
    isComplete: boolean;
    missingFields: string[];
  };
  activeProjects: Array<{
    id: string;
    title: string;
    status: string;
    totalBudget: number;
    currency: string;
    updatedAt: string;
    client?: { id: string; fullName: string } | null;
    broker?: { id: string; fullName: string } | null;
  }>;
  pendingInvitations: Array<{
    id: string;
    status: string;
    createdAt: string;
    request?: {
      id: string;
      title: string;
      requestedDeadline?: string | null;
      budgetLabel?: string | null;
      clientName?: string | null;
      brokerName?: string | null;
    } | null;
  }>;
  recommendedJobs: Array<{
    id: string;
    title: string;
    description: string;
    productType?: string | null;
    projectGoalSummary?: string | null;
    requestedDeadline?: string | null;
    budgetAmount?: number | null;
    budgetLabel?: string | null;
    featureCount: number;
    matchedSkills: string[];
    matchingScore: number;
    createdAt: string;
    client?: {
      id: string;
      fullName: string;
      currentTrustScore?: number | null;
      totalProjectsFinished?: number | null;
    } | null;
  }>;
};

const formatMoney = (amount: number, currency = "USD") =>
  `${Number(amount || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${currency.toUpperCase()}`;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "Not set";

export default function FreelancerDashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<FreelancerDashboardResponse | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(searchQuery.trim());
  const deferredSkillsKey = useDeferredValue(selectedSkills.join(","));

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<FreelancerDashboardResponse>(
        "/freelancer/dashboard",
        {
          params: {
            search: deferredSearch || undefined,
            skills: deferredSkillsKey || undefined,
          },
        },
      );
      setDashboard(response);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Could not load freelancer dashboard data.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [deferredSearch, deferredSkillsKey]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) {
      return;
    }

    const handleRefresh = () => {
      void loadDashboard();
    };

    socket.on("NOTIFICATION_CREATED", handleRefresh);
    socket.on("REQUEST_UPDATED", handleRefresh);
    socket.on("CONTRACT_UPDATED", handleRefresh);

    return () => {
      socket.off("NOTIFICATION_CREATED", handleRefresh);
      socket.off("REQUEST_UPDATED", handleRefresh);
      socket.off("CONTRACT_UPDATED", handleRefresh);
    };
  }, [deferredSearch, deferredSkillsKey]);

  const availableSkills = dashboard?.filters.availableSkills || [];
  const recommendedJobs = dashboard?.recommendedJobs || [];
  const activeProjects = dashboard?.activeProjects || [];
  const pendingInvitations = dashboard?.pendingInvitations || [];

  const summaryCards = useMemo(
    () => [
      {
        label: "Active Projects",
        value: dashboard?.stats.activeProjects || 0,
        helper: "Currently in execution",
        icon: Briefcase,
      },
      {
        label: "Pending Invitations",
        value: dashboard?.stats.pendingInvitations || 0,
        helper: "Waiting for your response",
        icon: UserPlus,
      },
      {
        label: "Completed Projects",
        value: dashboard?.stats.completedProjects || 0,
        helper: "Paid or completed work",
        icon: CheckCircle2,
      },
      {
        label: "Total Earnings",
        value: formatMoney(dashboard?.stats.totalEarnings || 0),
        helper: `This month: ${formatMoney(
          dashboard?.stats.currentMonthEarnings || 0,
        )}`,
        icon: DollarSign,
      },
    ],
    [dashboard],
  );

  const toggleSkill = (skill: string) => {
    startTransition(() => {
      setSelectedSkills((current) =>
        current.includes(skill)
          ? current.filter((item) => item !== skill)
          : [...current, skill],
      );
    });
  };

  return (
    <FreelancerDashboardLayout>
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-950">
            Freelancer Dashboard
          </h1>
          <p className="text-sm text-slate-600">
            Live invitations, current execution, and request matches generated
            from real platform data.
          </p>
        </div>

        {dashboard && !dashboard.profileCompleteness.isComplete && (
          <Alert className="border-amber-200 bg-amber-50/80 text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-700" />
            <AlertTitle>Profile still needs work</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                Profile completeness is {dashboard.profileCompleteness.percentage}%.
                Missing: {dashboard.profileCompleteness.missingFields.join(", ")}.
              </p>
              <div className="max-w-md">
                <Progress value={dashboard.profileCompleteness.percentage} />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
                onClick={() => navigate(ROUTES.FREELANCER_ONBOARDING)}
              >
                Complete Profile
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Dashboard Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="border-slate-200 shadow-sm">
                <CardContent className="flex items-start justify-between gap-4 p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {card.label}
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {card.value}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{card.helper}</p>
                  </div>
                  <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Find Matching Work</CardTitle>
            <CardDescription>
              Server-side search and skill filters update recommendations from
              the live request pool.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) =>
                  startTransition(() => setSearchQuery(event.target.value))
                }
                placeholder="Search by request title, goal, or feature keywords"
                className="pl-10"
              />
            </div>

            {availableSkills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableSkills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      selectedSkills.includes(skill)
                        ? "border-teal-500 bg-teal-500 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {skill}
                  </button>
                ))}
                {selectedSkills.length > 0 && (
                  <button
                    type="button"
                    onClick={() => startTransition(() => setSelectedSkills([]))}
                    className="rounded-full border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex h-[30vh] items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-teal-600" />
                    Recommended Jobs
                  </CardTitle>
                  <CardDescription>
                    {recommendedJobs.length} live requests currently match your
                    filters and profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recommendedJobs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-600">
                      No requests matched the current filters.
                    </div>
                  ) : (
                    recommendedJobs.map((job) => (
                      <div
                        key={job.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-950">
                                {job.title}
                              </h3>
                              {job.productType && (
                                <Badge variant="outline">{job.productType}</Badge>
                              )}
                            </div>
                            <p className="text-sm leading-6 text-slate-600">
                              {job.description}
                            </p>
                            {job.projectGoalSummary && (
                              <p className="text-sm text-slate-600">
                                Goal: {job.projectGoalSummary}
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={() => navigate(`/freelancer/requests/${job.id}`)}
                          >
                            Open Request
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                            <span className="font-medium text-slate-900">Budget:</span>{" "}
                            {job.budgetAmount != null
                              ? formatMoney(job.budgetAmount)
                              : job.budgetLabel || "Not set"}
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                            <span className="font-medium text-slate-900">Deadline:</span>{" "}
                            {formatDate(job.requestedDeadline)}
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                            <span className="font-medium text-slate-900">Features:</span>{" "}
                            {job.featureCount}
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                            <span className="font-medium text-slate-900">Client:</span>{" "}
                            {job.client?.fullName || "N/A"}
                          </div>
                        </div>

                        {job.matchedSkills.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {job.matchedSkills.map((skill) => (
                              <Badge key={`${job.id}-${skill}`} variant="secondary">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Pending Invitations</CardTitle>
                  <CardDescription>
                    Direct freelancer invitations that still need your response.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingInvitations.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-600">
                      No pending invitations.
                    </div>
                  ) : (
                    pendingInvitations.map((invitation) => (
                      <button
                        key={invitation.id}
                        type="button"
                        onClick={() =>
                          navigate(`/freelancer/invitations/${invitation.id}`)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-200 hover:bg-teal-50/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-950">
                              {invitation.request?.title || "Untitled request"}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              Client: {invitation.request?.clientName || "N/A"}
                            </p>
                          </div>
                          <Badge variant="outline">{invitation.status}</Badge>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                          <p>Deadline: {formatDate(invitation.request?.requestedDeadline)}</p>
                          <p>Budget: {invitation.request?.budgetLabel || "Not set"}</p>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Active Projects</CardTitle>
                  <CardDescription>
                    Projects where you are already assigned as the freelancer.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeProjects.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-600">
                      No active projects right now.
                    </div>
                  ) : (
                    activeProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => navigate(`/freelancer/workspace/${project.id}`)}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-200 hover:bg-teal-50/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-950">
                              {project.title}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              Client: {project.client?.fullName || "N/A"}
                            </p>
                          </div>
                          <Badge variant="outline">{project.status}</Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-600">
                          <p>{formatMoney(project.totalBudget, project.currency)}</p>
                          <p>Updated {formatDate(project.updatedAt)}</p>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </FreelancerDashboardLayout>
  );
}
