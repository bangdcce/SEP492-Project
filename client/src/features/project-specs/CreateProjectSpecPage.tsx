import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileSignature,
  FileText,
  UserPlus,
} from "lucide-react";
import { Button } from "@/shared/components/custom/Button";
import { CreateProjectSpecForm } from "./components/CreateProjectSpecForm";
import { projectRequestsApi } from "../project-requests/api";
import { projectSpecsApi } from "./api";
import type { ProjectRequest } from "../project-requests/types";
import type { CreateProjectSpecDTO, ProjectSpec } from "./types";
import { SpecPhase } from "./types";
import Spinner from "@/shared/components/ui/Spinner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/Card";

const FULL_SPEC_EDITABLE_STATUSES = new Set(["DRAFT", "REJECTED"]);

const toTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareSpecsByRecency = (a: ProjectSpec, b: ProjectSpec) => {
  const updatedDiff = toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;
  return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
};

const pickPreferredFullSpec = (
  specs: ProjectSpec[],
  approvedClientSpecId?: string,
) => {
  const matchingFullSpecs = specs
    .filter((spec) => {
      if (spec.specPhase !== SpecPhase.FULL_SPEC) return false;
      if (!approvedClientSpecId) return true;
      return spec.parentSpecId === approvedClientSpecId;
    })
    .sort(compareSpecsByRecency);

  if (matchingFullSpecs.length === 0) {
    return null;
  }

  return (
    matchingFullSpecs.find((spec) =>
      FULL_SPEC_EDITABLE_STATUSES.has(spec.status),
    ) || matchingFullSpecs[0]
  );
};

const formatSpecStatusLabel = (status?: string | null) =>
  String(status || "NOT_STARTED").replace(/_/g, " ");

export default function CreateProjectSpecPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<ProjectRequest | null>(null);
  const [clientSpec, setClientSpec] = useState<ProjectSpec | null>(null);
  const [existingFullSpec, setExistingFullSpec] = useState<ProjectSpec | null>(
    null,
  );
  const [createdSpec, setCreatedSpec] = useState<ProjectSpec | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadedExistingSpec, setLoadedExistingSpec] = useState(false);
  const freelancerProposalList =
    (request as any)?.freelancerProposals || (request as any)?.proposals || [];
  const acceptedFreelancerCount = freelancerProposalList.filter(
    (proposal: any) =>
      String(proposal?.status || "").toUpperCase() === "ACCEPTED",
  ).length;
  const legacyPendingFreelancerCount = freelancerProposalList.filter(
    (proposal: any) =>
      String(proposal?.status || "").toUpperCase() === "PENDING",
  ).length;
  const hasSelectedFreelancer =
    acceptedFreelancerCount > 0 ||
    (acceptedFreelancerCount === 0 && legacyPendingFreelancerCount === 1);
  const isEditableFullSpec = (spec: ProjectSpec | null | undefined) =>
    Boolean(spec && (spec.status === "DRAFT" || spec.status === "REJECTED"));
  const activeSpec = createdSpec || existingFullSpec;
  const isCommerciallyLocked = Boolean(activeSpec?.lockedByContractId);
  const editableDraftSpec = isEditableFullSpec(createdSpec)
    ? createdSpec
    : isEditableFullSpec(existingFullSpec)
      ? existingFullSpec
      : null;
  const formInitialValues = useMemo(
    () =>
      isEditingExisting && editableDraftSpec
        ? {
            requestId: id!,
            parentSpecId: editableDraftSpec.parentSpecId || undefined,
            title: editableDraftSpec.title,
            description: editableDraftSpec.description,
            totalBudget: Number(editableDraftSpec.totalBudget || 0),
            techStack: editableDraftSpec.techStack || "",
            richContentJson: editableDraftSpec.richContentJson || undefined,
            features: (editableDraftSpec.features || []).map((feature) => ({
              title: feature.title,
              description: feature.description,
              complexity: feature.complexity,
              acceptanceCriteria: feature.acceptanceCriteria || [],
              inputOutputSpec: feature.inputOutputSpec || undefined,
            })),
            milestones: [...(editableDraftSpec.milestones || [])]
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((milestone) => ({
                title: milestone.title,
                description: milestone.description,
                amount: Number(milestone.amount || 0),
                deliverableType: milestone.deliverableType,
                retentionAmount: Number(milestone.retentionAmount || 0),
                acceptanceCriteria: milestone.acceptanceCriteria || [],
                sortOrder: milestone.sortOrder,
                startDate: (milestone as any).startDate || undefined,
                dueDate: (milestone as any).dueDate || undefined,
              })),
          }
        : null,
    [editableDraftSpec, id, isEditingExisting],
  );
  const workflowReadiness = [
    {
      key: "client-spec",
      label: "Client Spec approved",
      ready: Boolean(clientSpec),
      icon: FileText,
      helper: clientSpec ? "Approved scope is available as the parent spec." : "Waiting for the approved client-facing scope.",
    },
    {
      key: "freelancer",
      label: "Freelancer selected",
      ready: hasSelectedFreelancer,
      icon: UserPlus,
      helper: hasSelectedFreelancer
        ? "A freelancer signer is available for final review."
        : "You can draft early, but 3-party sign-off stays locked.",
    },
    {
      key: "final-spec",
      label: "Final Spec state",
      ready: Boolean(activeSpec),
      icon: FileSignature,
      helper: activeSpec
        ? `Current status: ${formatSpecStatusLabel(activeSpec.status)}`
        : "No full spec record exists yet for this request.",
    },
  ];

  const formatApiErrorMessage = (value: unknown, fallback: string): string => {
    if (Array.isArray(value)) {
      const flattened = value.flatMap((entry) =>
        typeof entry === "string" ? [entry] : [],
      );
      return flattened.length > 0 ? flattened.join("\n") : fallback;
    }

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    return fallback;
  };

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [reqData, specs] = await Promise.all([
          projectRequestsApi.getById(id),
          projectSpecsApi.getSpecsByRequest(id),
        ]);
        setRequest(reqData);

        // Find the approved client spec (parent for full spec)
        const approved = specs.find(
          (s) =>
            s.specPhase === SpecPhase.CLIENT_SPEC &&
            s.status === "CLIENT_APPROVED",
        );
        if (approved) setClientSpec(approved);

        const existingFullSpec = pickPreferredFullSpec(
          specs,
          approved?.id,
        );

        if (existingFullSpec) {
          setExistingFullSpec(existingFullSpec);
          setLoadedExistingSpec(true);
          if (
            existingFullSpec.status === "DRAFT" ||
            existingFullSpec.status === "REJECTED"
          ) {
            setCreatedSpec(null);
            setIsEditingExisting(true);
          } else {
            setCreatedSpec(existingFullSpec);
            setIsEditingExisting(false);
          }
        } else {
          setExistingFullSpec(null);
          setCreatedSpec(null);
          setLoadedExistingSpec(false);
          setIsEditingExisting(false);
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Could not load project request details.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmit = async (data: CreateProjectSpecDTO) => {
    if (isCommerciallyLocked) {
      setSubmitError(
        "This full spec is locked by an active contract and can no longer be edited.",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      setWarnings([]);

      const shouldSubmitFinalReview = Boolean(
        clientSpec && data.status === "PENDING_APPROVAL",
      );
      const createPayload: CreateProjectSpecDTO = shouldSubmitFinalReview
        ? { ...data, status: "DRAFT" as any }
        : data;
      let newSpec: ProjectSpec;
      let createWarnings: string[] = [];
      const editingSpec =
        isEditingExisting && editableDraftSpec ? editableDraftSpec : null;

      if (editingSpec) {
        const response = await projectSpecsApi.updateFullSpec(editingSpec.id, {
          ...createPayload,
          parentSpecId: editingSpec.parentSpecId || clientSpec?.id || undefined,
        });
        newSpec = response.spec;
        createWarnings = response.warnings || [];
      } else if (clientSpec) {
        // Phase 2: Create full spec linked to parent client spec
        const response = await projectSpecsApi.createFullSpec({
          ...createPayload,
          parentSpecId: clientSpec.id,
        });
        newSpec = response.spec;
        createWarnings = response.warnings || [];
      } else {
        // Legacy: No client spec exists, create directly
        const response = await projectSpecsApi.createSpec(createPayload);
        newSpec = response.spec;
        createWarnings = response.warnings || [];
      }

      if (shouldSubmitFinalReview) {
        newSpec = await projectSpecsApi.submitForFinalReview(newSpec.id);
      }

      setWarnings(createWarnings);
      setCreatedSpec(newSpec);
      setExistingFullSpec(newSpec);
      setLoadedExistingSpec(Boolean(editingSpec) || loadedExistingSpec);
      setIsEditingExisting(false);
    } catch (err: any) {
      const message = formatApiErrorMessage(
        err?.response?.data?.message,
        "Failed to save project specification.",
      );
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForFinalReview = async () => {
    const targetSpec = activeSpec;
    if (!targetSpec) return;
    if (clientSpec && !hasSelectedFreelancer) {
      setSubmitError(
        "Freelancer must accept invitation before submitting full spec for final review. You can keep drafting and save the full spec now.",
      );
      return;
    }
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const updated = await projectSpecsApi.submitForFinalReview(targetSpec.id);
      setCreatedSpec(updated);
      setExistingFullSpec(updated);
      setIsEditingExisting(false);
    } catch (err: any) {
      const message = formatApiErrorMessage(
        err?.response?.data?.message,
        "Failed to submit full spec for final review.",
      );
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || "Request not found"}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/broker/project-requests")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Requests
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          className="h-9 w-9 p-0"
          onClick={() => navigate(`/broker/project-requests/${id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Create Full Specification
          </h1>
          <p className="text-muted-foreground">For request: {request.title}</p>
        </div>
        {clientSpec && (
          <Badge variant="secondary" className="ml-auto text-xs">
            Phase 2 — Technical Spec
          </Badge>
        )}
      </div>

      <Card className="overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_42%),linear-gradient(135deg,_#f8fffe_0%,_#f8fafc_55%,_#ecfeff_100%)] shadow-sm">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                <FileSignature className="h-3.5 w-3.5" />
                Final Spec Workspace
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {request.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Draft the broker-facing technical scope, freeze the right milestone details, then
                  move it into 3-party review when the freelancer signer is ready.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Current record
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {activeSpec ? formatSpecStatusLabel(activeSpec.status) : "Not started"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {activeSpec
                  ? `${activeSpec.milestones?.length || 0} milestones · $${Number(
                      activeSpec.totalBudget || 0,
                    ).toLocaleString()}`
                  : "Create the first draft once the commercial shape is ready."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {workflowReadiness.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    item.ready
                      ? "border-emerald-200 bg-white/90"
                      : "border-white/70 bg-white/75"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`rounded-full p-2 ${
                          item.ready ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                    </div>
                    {item.ready ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Badge variant="outline" className="border-slate-200 text-slate-500">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.helper}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Show approved Client Spec summary as context */}
      {clientSpec && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-600" />
              <CardTitle className="text-sm text-green-700">
                Client Spec (Approved)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              <strong>Title:</strong> {clientSpec.title}
            </p>
            <p className="text-muted-foreground line-clamp-3">
              {clientSpec.description}
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Budget: ${clientSpec.totalBudget?.toLocaleString()}</span>
              <span>Timeline: {clientSpec.estimatedTimeline || "—"}</span>
              {clientSpec.clientFeatures && (
                <span>{clientSpec.clientFeatures.length} features</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning if no client spec */}
      {!clientSpec && (
        <Alert>
          <AlertTitle>No Client Spec Found</AlertTitle>
          <AlertDescription>
            No approved client specification was found for this request. You can
            still create a full spec directly, but the recommended flow is to
            create a Client Spec first for client approval.
          </AlertDescription>
        </Alert>
      )}

      {clientSpec && !hasSelectedFreelancer && (
        <Alert>
          <AlertTitle>Draft first, submit later</AlertTitle>
          <AlertDescription>
            You can draft the full spec now. Submitting for final review is
            locked until a freelancer accepts the invitation.
          </AlertDescription>
        </Alert>
      )}

      {submitError && (
        <Alert variant="destructive">
          <AlertTitle>Submission Error</AlertTitle>
          <AlertDescription className="whitespace-pre-line">
            {submitError}
          </AlertDescription>
        </Alert>
      )}

      {loadedExistingSpec && activeSpec && !isEditingExisting && (
        <Alert>
          <AlertTitle>Existing full spec loaded</AlertTitle>
          <AlertDescription>
            A full spec already exists for this request, so this page loaded the
            existing record instead of creating a new one.
          </AlertDescription>
        </Alert>
      )}

      {activeSpec?.lockedByContractId && (
        <Alert>
          <AlertTitle>Full spec locked by contract</AlertTitle>
          <AlertDescription>
            Contract <strong>{activeSpec.lockedByContractId}</strong> now owns the frozen commercial snapshot for this scope. Continue contract review there instead of editing this spec.
          </AlertDescription>
        </Alert>
      )}

      {activeSpec?.status === "REJECTED" && activeSpec.rejectionReason && (
        <Alert>
          <AlertTitle>Revision requested</AlertTitle>
          <AlertDescription>{activeSpec.rejectionReason}</AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert>
          <AlertTitle>Governance Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {(isEditingExisting || !activeSpec) && !isCommerciallyLocked && (
        <CreateProjectSpecForm
          requestId={id!}
          projectRequest={request}
          approvedBudgetCap={
            clientSpec ? Number(clientSpec.totalBudget || 0) : null
          }
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          isPhasedFlow={Boolean(clientSpec)}
          initialValues={formInitialValues}
          submitLabel={isEditingExisting ? "Update Full Spec Draft" : undefined}
        />
      )}

      {activeSpec && !isEditingExisting && (
        <Card>
          <CardHeader>
            <CardTitle>
              {loadedExistingSpec ? "Full spec details" : "Full spec created"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Spec ID: {activeSpec.id} · Current status:{" "}
              <strong>{activeSpec.status}</strong>
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Budget
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  ${Number(activeSpec.totalBudget || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Milestones
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {activeSpec.milestones?.length || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Updated
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {activeSpec.updatedAt
                    ? new Date(activeSpec.updatedAt).toLocaleString()
                    : new Date(activeSpec.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {clientSpec &&
              activeSpec.status !== "FINAL_REVIEW" &&
              hasSelectedFreelancer && (
                <Alert>
                  <AlertTitle>Next step</AlertTitle>
                  <AlertDescription>
                    Submit this full spec for 3-party final review so Client,
                    Broker, and Freelancer can sign.
                  </AlertDescription>
                </Alert>
              )}

            {isCommerciallyLocked && (
              <Alert>
                <AlertTitle>Commercial review moved to contract</AlertTitle>
                <AlertDescription>
                  This full spec is frozen for contract review. Review the frozen contract there instead of editing this spec.
                </AlertDescription>
              </Alert>
            )}

            {clientSpec &&
              activeSpec.status !== "FINAL_REVIEW" &&
              !hasSelectedFreelancer && (
                <Alert>
                  <AlertTitle>Waiting for freelancer acceptance</AlertTitle>
                  <AlertDescription>
                    Full spec draft is saved. Invite/select a freelancer first,
                    then submit for final review.
                  </AlertDescription>
                </Alert>
              )}

            {activeSpec.status === "FINAL_REVIEW" && (
              <Alert>
                <AlertTitle>Submitted for final review</AlertTitle>
                <AlertDescription>
                  The full spec is ready for 3-party signing.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-3">
              {(activeSpec.status === "DRAFT" ||
                activeSpec.status === "REJECTED") && (
                <Button
                  variant="outline"
                  onClick={() => setIsEditingExisting(true)}
                  disabled={isSubmitting}
                >
                  Edit Draft
                </Button>
              )}
              {clientSpec &&
                (activeSpec.status === "DRAFT" ||
                  activeSpec.status === "REJECTED") && (
                  <Button
                    onClick={handleSubmitForFinalReview}
                    disabled={isSubmitting || !hasSelectedFreelancer}
                  >
                    {isSubmitting ? "Submitting..." : "Submit For Final Review"}
                  </Button>
                )}
              <Button
                variant="outline"
                onClick={() => navigate(`/broker/project-requests/${id}`)}
              >
                Return To Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
