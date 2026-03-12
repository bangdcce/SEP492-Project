import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Archive,
  FileSignature,
  Search,
  ArrowRight,
  Clock3,
  CheckCircle2,
  Briefcase,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Badge } from "@/shared/components/ui/badge";
import Spinner from "@/shared/components/ui/Spinner";
import { contractsApi } from "./api";
import type { ContractSummary } from "./types";
import { getStoredJson } from "@/shared/utils/storage";
import { STORAGE_KEYS } from "@/constants";

type ContractFilter =
  | "ALL"
  | "ACTION_REQUIRED"
  | "SENT"
  | "SIGNED"
  | "ACTIVATED"
  | "ARCHIVED";

const isActivatedContract = (contract: ContractSummary) =>
  contract.status === "ACTIVATED" ||
  contract.status === "ACTIVE" ||
  Boolean(contract.activatedAt);

const getContractStageCopy = (contract: ContractSummary) => {
  if (isActivatedContract(contract)) {
    return {
      tone: "bg-emerald-100 text-emerald-700 border-emerald-200",
      label: "Activated",
      description: "Frozen schedule is live in workspace.",
    };
  }
  if (contract.status === "SIGNED") {
    return {
      tone: "bg-amber-100 text-amber-800 border-amber-200",
      label: "Ready to activate",
      description: "All signatures are done. One party can activate now.",
    };
  }
  if (contract.status === "SENT") {
    return {
      tone: "bg-sky-100 text-sky-700 border-sky-200",
      label: "Waiting for signatures",
      description: "Frozen agreement is out for party sign-off.",
    };
  }
  if (contract.status === "ARCHIVED") {
    return {
      tone: "bg-slate-200 text-slate-700 border-slate-300",
      label: "Archived",
      description: "This agreement is no longer active.",
    };
  }
  return {
    tone: "bg-slate-100 text-slate-700 border-slate-200",
    label: contract.status === "DRAFT" ? "Legacy draft" : contract.status,
    description: "Legacy or transitional contract state.",
  };
};

export default function ContractListPage() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractFilter>("ALL");
  const currentUser = getStoredJson<{ role?: string }>(STORAGE_KEYS.USER);
  const roleBasePath =
    currentUser?.role?.toUpperCase() === "CLIENT"
      ? "/client"
      : currentUser?.role?.toUpperCase() === "FREELANCER"
        ? "/freelancer"
        : "/broker";

  const pageTitle =
    roleBasePath === "/client"
      ? "My Contracts"
      : roleBasePath === "/freelancer"
        ? "Assigned Contracts"
        : "Contracts Management";
  const pageDescription =
    roleBasePath === "/client"
      ? "Track frozen agreements you need to sign or activate."
      : roleBasePath === "/freelancer"
        ? "Watch agreements move from review to activation and workspace."
        : "Keep the spec-to-contract pipeline moving without losing state.";

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setIsLoading(true);
        const res = await contractsApi.listContracts();
        setContracts(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error("Failed to fetch contracts", err);
        setContracts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContracts();
  }, []);

  const preSignCount = contracts.filter(
    (c) => c.status === "DRAFT" || c.status === "SENT",
  ).length;
  const readyToActivateCount = contracts.filter(
    (c) => c.status === "SIGNED",
  ).length;
  const activatedCount = contracts.filter(
    (c) => c.status === "ACTIVATED" || c.status === "ACTIVE",
  ).length;
  const archivedCount = contracts.filter((c) => c.status === "ARCHIVED").length;
  const attentionCount = contracts.filter(
    (c) => c.status === "SENT" || c.status === "SIGNED",
  ).length;

  const filterOptions: Array<{
    value: ContractFilter;
    label: string;
    count: number;
  }> = [
    { value: "ALL", label: "All", count: contracts.length },
    { value: "ACTION_REQUIRED", label: "Action needed", count: attentionCount },
    { value: "SENT", label: "Waiting signatures", count: contracts.filter((c) => c.status === "SENT").length },
    { value: "SIGNED", label: "Ready to activate", count: readyToActivateCount },
    { value: "ACTIVATED", label: "Activated", count: activatedCount },
    { value: "ARCHIVED", label: "Archived", count: archivedCount },
  ];

  const filtered = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return contracts.filter((contract) => {
      const matchesSearch =
        !normalizedSearch ||
        contract.title.toLowerCase().includes(normalizedSearch) ||
        contract.projectTitle.toLowerCase().includes(normalizedSearch) ||
        contract.clientName.toLowerCase().includes(normalizedSearch) ||
        String(contract.freelancerName || "").toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) return false;

      switch (statusFilter) {
        case "ACTION_REQUIRED":
          return contract.status === "SENT" || contract.status === "SIGNED";
        case "ACTIVATED":
          return isActivatedContract(contract);
        case "ARCHIVED":
          return contract.status === "ARCHIVED";
        case "SENT":
          return contract.status === "SENT";
        case "SIGNED":
          return contract.status === "SIGNED";
        default:
          return true;
      }
    });
  }, [contracts, searchTerm, statusFilter]);

  const actionHeadline =
    attentionCount === 0
      ? "Everything is caught up."
      : `${attentionCount} contract${attentionCount === 1 ? "" : "s"} still need attention.`;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_42%),linear-gradient(135deg,_#f8fffe_0%,_#f8fafc_48%,_#ecfeff_100%)] shadow-sm">
        <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Frozen Agreement Desk
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {pageTitle}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {pageDescription}
              </p>
            </div>
          </div>

          <div className="min-w-[260px] rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Pipeline pulse
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {actionHeadline}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Signed contracts are waiting on activation. Sent contracts are waiting on parties.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Total</p>
            <p className="mt-2 text-2xl font-semibold">{contracts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">
              Pre-sign
            </p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-amber-600">
              <Clock3 className="h-5 w-5" />
              {preSignCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">
              Ready to Activate
            </p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              {readyToActivateCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Activated</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-sky-600">
              <CheckCircle2 className="h-5 w-5" />
              {activatedCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Archived</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-slate-600">
              <Archive className="h-5 w-5" />
              {archivedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by contract, project, or party..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={statusFilter === option.value ? "default" : "outline"}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                  <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-[11px]">
                    {option.count}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileSignature className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-slate-700">No contracts match this view.</p>
              <p className="mt-1 text-sm text-slate-500">
                Try another status filter or search for a different party/project name.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((contract) => (
                <div
                  key={contract.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-teal-200 hover:bg-slate-50/70"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                        <FileSignature className="h-5 w-5" />
                      </div>
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {contract.title}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {contract.projectTitle}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge className={getContractStageCopy(contract).tone}>
                            {getContractStageCopy(contract).label}
                          </Badge>
                          {isActivatedContract(contract) && (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 text-emerald-700"
                            >
                              Workspace live
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-slate-600">
                          {getContractStageCopy(contract).description}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:min-w-[360px] xl:max-w-[440px]">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Parties
                        </p>
                        <p className="mt-2 font-medium text-slate-900">
                          Client: {contract.clientName}
                        </p>
                        <p className="mt-1">
                          Freelancer: {contract.freelancerName || "Not set"}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Timing
                        </p>
                        <p className="mt-2 font-medium text-slate-900">
                          Created{" "}
                          {formatDistanceToNowStrict(new Date(contract.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                        <p className="mt-1">
                          Project status: {String(contract.projectStatus || "—").replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
                    {isActivatedContract(contract) && contract.projectId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(`${roleBasePath}/workspace/${contract.projectId}`)
                        }
                      >
                        <Briefcase className="mr-2 h-4 w-4" />
                        Workspace
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate(`${roleBasePath}/contracts/${contract.id}`)
                      }
                    >
                      Open Contract <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
