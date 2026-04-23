import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createDispute,
  getMyDisputes,
  uploadDisputeEvidence,
} from "../../api";
import {
  DisputeCategory,
  DisputeStatus,
} from "../../../staff/types/staff.types";
import type { CreateDisputeDto } from "../../types/dispute.dto";
import type { MilestoneDisputePolicy } from "@/features/project-workspace/types";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { resolveRoleBasePath } from "@/features/hearings/utils/hearingRouting";
import {
  DISPUTE_DISCLAIMER_VERSION,
} from "../../constants/disputeLegal";
import { DisputeDisclaimerCheckbox } from "../shared/DisputeDisclaimerCheckbox";

interface CreateDisputeWizardProps {
  onClose: () => void;
  milestoneId: string;
  projectId: string;
  milestoneStatus: string;
  disputePolicy?: MilestoneDisputePolicy | null;
  currentUserId: string;
  projectMembers: Array<{ id: string; name: string; role: string }>;
}

const REPORT_REASONS = [
  {
    id: DisputeCategory.QUALITY,
    title: "Low Quality / Not as Described",
    desc: "Deliverables do not match the agreed specifications.",
  },
  {
    id: DisputeCategory.DEADLINE,
    title: "Missed Deadline",
    desc: "The freelancer did not deliver on time.",
  },
  {
    id: DisputeCategory.COMMUNICATION,
    title: "Unresponsive / Ghosting",
    desc: "Party has stopped communicating for >24 hours.",
  },
  {
    id: DisputeCategory.PAYMENT,
    title: "Payment Issue",
    desc: "Disagreement about payment amounts or release status.",
  },
];

const PROJECT_PARTICIPANT_ROLES = new Set(["CLIENT", "BROKER", "FREELANCER"]);
const MIN_DISPUTE_REASON_LENGTH = 20;

export const CreateDisputeWizard = ({
  onClose,
  milestoneId,
  projectId,
  milestoneStatus,
  disputePolicy,
  currentUserId,
  projectMembers,
}: CreateDisputeWizardProps) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCategory, setSelectedCategory] =
    useState<DisputeCategory | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [selectedDefendant, setSelectedDefendant] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingParentDisputes, setExistingParentDisputes] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [loadingParentDisputes, setLoadingParentDisputes] = useState(false);
  const [addToExistingCase, setAddToExistingCase] = useState(false);
  const [selectedParentDisputeId, setSelectedParentDisputeId] = useState("");
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const normalizedStatus = useMemo(
    () => milestoneStatus?.toUpperCase() ?? "UNKNOWN",
    [milestoneStatus],
  );

  const allowedCategories = useMemo(
    () => disputePolicy?.allowedCategories ?? [],
    [disputePolicy],
  );

  const statusLabel = useMemo(() => {
    switch (normalizedStatus) {
      case "IN_PROGRESS":
        return "In progress";
      case "SUBMITTED":
        return "Submitted (awaiting approval)";
      case "REVISIONS_REQUIRED":
        return "Revisions required";
      case "COMPLETED":
        return "Completed (approved)";
      case "PAID":
        return "Paid";
      case "LOCKED":
        return "Locked (in dispute)";
      default:
        return milestoneStatus || "Unknown";
    }
  }, [normalizedStatus, milestoneStatus]);

  const policyReason = disputePolicy?.reason ?? null;
  const warrantyEndsAt = disputePolicy?.warrantyEndsAt ?? null;
  const blockedCategories = useMemo(
    () => disputePolicy?.blockedCategories ?? {},
    [disputePolicy],
  );
  const isDisputeAllowed = Boolean(disputePolicy?.canRaise);

  const roleBasePath = useMemo(() => {
    const user = getStoredJson<{ role?: string }>(STORAGE_KEYS.USER);
    return resolveRoleBasePath(user?.role);
  }, []);

  const isCategoryAllowed = useCallback(
    (category: DisputeCategory) => allowedCategories.includes(category),
    [allowedCategories],
  );

  const getCategoryHint = useCallback(
    (category: DisputeCategory) => {
      const blockedReason = blockedCategories[category];
      if (blockedReason) {
        return blockedReason;
      }

      if (category === DisputeCategory.QUALITY) {
        return "Use this when delivered work does not match the agreed milestone outputs.";
      }
      if (category === DisputeCategory.DEADLINE) {
        return "Use this when the milestone due date has already passed.";
      }
      if (normalizedStatus === "COMPLETED" || normalizedStatus === "PAID") {
        return "Available during the post-delivery warranty window while evidence is still available.";
      }
      return "Available while the milestone is in progress or awaiting approval.";
    },
    [blockedCategories, normalizedStatus],
  );

  // Filter out current user from defendant list
  const availableDefendants = useMemo(
    () =>
      projectMembers.filter(
        (member) =>
          member.id !== currentUserId &&
          PROJECT_PARTICIPANT_ROLES.has(String(member.role || "").toUpperCase()),
      ),
    [projectMembers, currentUserId],
  );

  useEffect(() => {
    let cancelled = false;
    const loadParentDisputes = async () => {
      if (!milestoneId) {
        if (!cancelled) {
          setExistingParentDisputes([]);
          setAddToExistingCase(false);
          setSelectedParentDisputeId("");
        }
        return;
      }

      try {
        setLoadingParentDisputes(true);
        const response = await getMyDisputes(
          {
            page: 1,
            limit: 30,
            projectId,
            milestoneId,
            asInvolved: true,
            statusIn: [
              DisputeStatus.TRIAGE_PENDING,
              DisputeStatus.PREVIEW,
              DisputeStatus.PENDING_REVIEW,
              DisputeStatus.INFO_REQUESTED,
              DisputeStatus.IN_MEDIATION,
            ],
          },
          { preferCache: false },
        );

        if (cancelled) return;

        const options = (response.data ?? [])
          .filter((dispute) => dispute.id)
          .map((dispute) => ({
            id: dispute.id,
            label: `#${dispute.id.slice(0, 8)} - ${dispute.category} (${dispute.status})`,
          }));

        setExistingParentDisputes(options);
        if (options.length === 0) {
          setAddToExistingCase(false);
          setSelectedParentDisputeId("");
        }
      } catch {
        if (!cancelled) {
          setExistingParentDisputes([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingParentDisputes(false);
        }
      }
    };

    loadParentDisputes();

    return () => {
      cancelled = true;
    };
  }, [milestoneId, projectId]);

  const resetForm = useCallback(() => {
    setStep(1);
    setSelectedCategory(null);
    setCustomReason("");
    setSelectedDefendant("");
    setFiles([]);
    setAddToExistingCase(false);
    setSelectedParentDisputeId("");
    setDisclaimerAccepted(false);
  }, []);

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as
        | { message?: string | string[]; error?: string }
        | undefined;
      const message = data?.message;
      if (Array.isArray(message) && message.length > 0) {
        return message.join(", ");
      }
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
      if (typeof data?.error === "string" && data.error.trim().length > 0) {
        return data.error;
      }
    }
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (typeof error === "object" && error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    return "Failed to submit dispute.";
  };

  const uploadEvidenceInBackground = useCallback(
    (disputeId: string, filesToUpload: File[]) => {
      if (filesToUpload.length === 0) {
        toast.success("Dispute submitted successfully.");
        return;
      }

      toast.info(
        `Dispute created. Uploading ${filesToUpload.length} evidence file${
          filesToUpload.length > 1 ? "s" : ""
        } in the background...`,
      );

      void Promise.allSettled(
        filesToUpload.map((file) => uploadDisputeEvidence(disputeId, file)),
      ).then((results) => {
        const failedCount = results.filter(
          (result) => result.status === "rejected",
        ).length;

        if (failedCount === 0) {
          toast.success("Dispute submitted and evidence uploaded.");
          return;
        }

        toast.warning(
          `Dispute submitted, but ${failedCount}/${filesToUpload.length} evidence file${
            failedCount > 1 ? "s" : ""
          } failed to upload. You can retry from the dispute detail page.`,
        );
      });
    },
    [],
  );

  const handleSubmit = async () => {
    if (!isDisputeAllowed) {
      toast.error(policyReason || "Dispute is not available for this milestone.");
      return;
    }
    if (!selectedCategory || !selectedDefendant) {
      toast.error("Please select a category and defendant.");
      return;
    }
    if (addToExistingCase && !selectedParentDisputeId) {
      toast.error("Please choose an existing dispute case to add a new party.");
      return;
    }
    if (!isCategoryAllowed(selectedCategory)) {
      toast.error(getCategoryHint(selectedCategory));
      return;
    }

    const reasonText = customReason.trim();
    if (reasonText.length < MIN_DISPUTE_REASON_LENGTH) {
      toast.error(
        `Please provide more detail (at least ${MIN_DISPUTE_REASON_LENGTH} characters).`,
      );
      return;
    }
    if (!projectId || !milestoneId) {
      toast.error("Missing project or milestone context.");
      return;
    }
    if (!disclaimerAccepted) {
      toast.error("You must acknowledge the dispute ADR disclaimer before submitting.");
      return;
    }

    const evidenceLabels =
      files.length > 0
        ? files.map((file) => file.name)
        : [reasonText.slice(0, 120)];

    const payload: CreateDisputeDto = {
      milestoneId,
      projectId,
      reason: reasonText,
      category: selectedCategory,
      defendantId: selectedDefendant,
      evidence: evidenceLabels,
      parentDisputeId:
        addToExistingCase && selectedParentDisputeId
          ? selectedParentDisputeId
          : undefined,
      disclaimerAccepted: true,
      disclaimerVersion: DISPUTE_DISCLAIMER_VERSION,
    };

    try {
      setIsSubmitting(true);
      const created = await createDispute(payload);
      const disputeId = created?.id;
      if (!disputeId) {
        throw new Error("Dispute created but missing ID.");
      }

      const filesToUpload = [...files];
      resetForm();
      onClose();
      navigate(
        `${roleBasePath}/hearings?createdDisputeId=${encodeURIComponent(disputeId)}&projectId=${encodeURIComponent(projectId)}`,
      );
      uploadEvidenceInBackground(disputeId, filesToUpload);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Steps Indicator */}
      <div className="flex items-center justify-center space-x-2 mb-6">
        <div
          className={`h-2 w-16 rounded-full transition-colors ${step >= 1 ? "bg-teal-500" : "bg-gray-200"}`}
        />
        <div
          className={`h-2 w-16 rounded-full transition-colors ${step >= 2 ? "bg-teal-500" : "bg-gray-200"}`}
        />
        <div
          className={`h-2 w-16 rounded-full transition-colors ${step >= 3 ? "bg-teal-500" : "bg-gray-200"}`}
        />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Milestone status:</span>{" "}
            {statusLabel}
            {!isDisputeAllowed && (
              <div className="mt-2 text-xs text-slate-500">
                {policyReason || "Disputes are not available for the current milestone status."}
              </div>
            )}
            {warrantyEndsAt && (
              <div className="mt-2 text-xs text-slate-500">
                Warranty window ends on{" "}
                {new Date(warrantyEndsAt).toLocaleDateString("en-GB")}.
              </div>
            )}
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Scope changes are not a dispute category. Use the Change Request flow
            for scope negotiations.
          </div>

          {loadingParentDisputes ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              Checking existing disputes on this milestone...
            </div>
          ) : existingParentDisputes.length > 0 ? (
            <div className="rounded-lg border border-teal-200 bg-teal-50/50 px-4 py-3 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={addToExistingCase}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setAddToExistingCase(checked);
                    if (!checked) {
                      setSelectedParentDisputeId("");
                    }
                  }}
                />
                Add another party to an existing dispute case on this milestone
              </label>
              {addToExistingCase && (
                <select
                  className="block w-full rounded-md border border-teal-200 bg-white p-2 text-sm"
                  value={selectedParentDisputeId}
                  onChange={(event) =>
                    setSelectedParentDisputeId(event.target.value)
                  }
                >
                  <option value="">Select existing case...</option>
                  {existingParentDisputes.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
          <h4 className="text-base font-medium text-slate-900">
            Why do you want to open a dispute?
          </h4>
          <div role="radiogroup" className="space-y-3">
            {REPORT_REASONS.map((reason) => {
              const checked = selectedCategory === reason.id;
              const allowed = isCategoryAllowed(reason.id);
              return (
                <button
                  key={reason.id}
                  type="button"
                  data-testid={`dispute-category-${String(reason.id).toLowerCase()}`}
                  role="radio"
                  aria-checked={checked}
                  aria-disabled={!allowed}
                  onClick={() => {
                    if (!allowed) return;
                    setSelectedCategory(reason.id);
                  }}
                  className={`relative flex w-full rounded-lg border p-4 shadow-sm focus:outline-none ${
                    checked
                      ? "border-teal-600 ring-1 ring-teal-600 bg-teal-50"
                      : "border-gray-200"
                  } ${allowed ? "cursor-pointer hover:bg-gray-50" : "cursor-not-allowed opacity-60"}`}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="text-sm text-left">
                      <p
                        className={`font-medium ${checked ? "text-teal-900" : "text-gray-900"}`}
                      >
                        {reason.title}
                      </p>
                      <span
                        className={`inline ${checked ? "text-teal-700" : "text-gray-500"}`}
                      >
                        {reason.desc}
                      </span>
                      {!allowed && (
                        <p className="mt-1 text-xs text-slate-500">
                          {getCategoryHint(reason.id)}
                        </p>
                      )}
                    </div>
                    {checked && (
                      <div className="shrink-0 text-teal-600">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Show Defendant Select only after category picked */}
          {selectedCategory && (
            <div className="mt-4 animate-fadeIn">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Who is at fault?
              </label>
              <select
                data-testid="dispute-defendant-select"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-2 border"
                value={selectedDefendant}
                onChange={(e) => setSelectedDefendant(e.target.value)}
              >
                <option value="">Select a person...</option>
                {availableDefendants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              disabled={
                !isDisputeAllowed ||
                !selectedCategory ||
                !selectedDefendant ||
                !isCategoryAllowed(selectedCategory)
              }
              data-testid="dispute-step-1-next"
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
            >
              Next Step <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900">
              Describe the issue in detail
            </label>
            <div className="mt-1">
              <textarea
                data-testid="dispute-reason-textarea"
                rows={4}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-3 border placeholder-gray-400"
                placeholder="Please explain what happened, referencing specific contract terms..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>
                {customReason.length} characters
                {customReason.length > 0 &&
                customReason.length < MIN_DISPUTE_REASON_LENGTH ? (
                  <span className="ml-1 text-amber-500">
                    (min {MIN_DISPUTE_REASON_LENGTH})
                  </span>
                ) : null}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Be specific. Vague descriptions may lead to your dispute being
              rejected during Triage.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Upload Evidence (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center">
              <input
                type="file"
                multiple
                className="hidden"
                id="evidence-upload"
                data-testid="dispute-evidence-upload"
                onChange={handleFileUpload}
                accept="image/*,.pdf,.docx"
              />
              <label
                htmlFor="evidence-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-teal-600">
                  Click to upload
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  PNG, JPG, PDF up to 50MB
                </span>
              </label>
            </div>

            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((file, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded"
                  >
                    <span className="truncate max-w-[80%]">
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)
                    </span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              data-testid="dispute-step-2-back"
              className="text-gray-600 hover:text-slate-900 text-sm font-medium"
            >
              Back
            </button>
            <button
              disabled={
                !isDisputeAllowed ||
                customReason.trim().length < MIN_DISPUTE_REASON_LENGTH ||
                !selectedCategory ||
                !isCategoryAllowed(selectedCategory)
              }
              data-testid="dispute-step-2-next"
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg disabled:opacity-50 hover:bg-slate-800 transition-colors"
            >
              Review <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h5 className="text-sm font-medium text-amber-800">
                Before you submit
              </h5>
              <p className="text-sm text-amber-700 mt-1">
                Opening a dispute will{" "}
                <strong>freeze the funds in Escrow</strong>. Mediation typically
                takes 3-7 days. False disputes may damage your Trust Score.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Reason:</span>
              <span className="font-medium text-slate-900">
                {REPORT_REASONS.find((r) => r.id === selectedCategory)?.title}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Defendant:</span>
              <span className="font-medium text-slate-900">
                User ID: {selectedDefendant}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Evidence:</span>
              <span className="font-medium text-slate-900">
                {files.length} files attached
              </span>
            </div>
          </div>

          <DisputeDisclaimerCheckbox
            id="dispute-disclaimer-checkbox"
            testId="dispute-disclaimer-checkbox"
            checked={disclaimerAccepted}
            onCheckedChange={setDisclaimerAccepted}
            disabled={isSubmitting}
            leadInText="I understand that"
          />

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              data-testid="dispute-step-3-back"
              className="text-gray-600 hover:text-slate-900 text-sm font-medium"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !disclaimerAccepted}
              data-testid="dispute-confirm-submit"
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-md transition-colors disabled:opacity-70"
            >
              {isSubmitting ? "Submitting..." : "Confirm Dispute"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
