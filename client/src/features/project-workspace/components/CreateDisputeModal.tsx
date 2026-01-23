import { useState } from "react";
import {
  AlertTriangle,
  X,
  Loader2,
  ShieldAlert,
  FileWarning,
  Clock,
  MessageSquareOff,
  FileX,
} from "lucide-react";
import type { Milestone } from "../types";

// Dispute reason categories matching backend DisputeCategory enum
export const DISPUTE_CATEGORIES = {
  QUALITY: {
    value: "QUALITY",
    label: "Deliverable quality is poor",
    icon: FileWarning,
    description: "The work does not meet expected quality standards",
  },
  DEADLINE: {
    value: "DEADLINE",
    label: "Freelancer missed the deadline",
    icon: Clock,
    description: "Work was not delivered on time",
  },
  COMMUNICATION: {
    value: "COMMUNICATION",
    label: "Freelancer is not responding",
    icon: MessageSquareOff,
    description: "Unable to reach or get response from freelancer",
  },
  SCOPE_CHANGE: {
    value: "SCOPE_CHANGE",
    label: "Work does not match requirements",
    icon: FileX,
    description: "Deliverables don't align with project specifications",
  },
} as const;

export type DisputeCategory = keyof typeof DISPUTE_CATEGORIES;

export interface CreateDisputeData {
  title: string;
  category: DisputeCategory;
  description: string;
  evidence: string[];
}

interface CreateDisputeModalProps {
  isOpen: boolean;
  milestone: Milestone | null;
  onClose: () => void;
  onSubmit: (data: CreateDisputeData) => Promise<void>;
}

export function CreateDisputeModal({
  isOpen,
  milestone,
  onClose,
  onSubmit,
}: CreateDisputeModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DisputeCategory | "">("");
  const [description, setDescription] = useState("");
  const [evidenceInput, setEvidenceInput] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !milestone) return null;

  const handleAddEvidence = () => {
    const trimmed = evidenceInput.trim();
    if (trimmed && !evidence.includes(trimmed)) {
      setEvidence((prev) => [...prev, trimmed]);
      setEvidenceInput("");
    }
  };

  const handleRemoveEvidence = (url: string) => {
    setEvidence((prev) => prev.filter((e) => e !== url));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEvidence();
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      setError("Please enter a dispute title");
      return;
    }
    if (!category) {
      setError("Please select a reason category");
      return;
    }
    if (!description.trim()) {
      setError("Please describe the issue in detail");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        title: title.trim(),
        category,
        description: description.trim(),
        evidence,
      });
      // Reset form on success
      resetForm();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to submit dispute";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setDescription("");
    setEvidence([]);
    setEvidenceInput("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header - Warning Theme */}
        <div className="rounded-t-2xl bg-gradient-to-r from-red-500 to-orange-500 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <ShieldAlert className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Raise a Dispute</h2>
                <p className="text-sm text-white/80">
                  Report an issue with this milestone
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {/* Milestone Context */}
          <div className="mb-5 rounded-xl bg-red-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-red-600">
                  Disputing Milestone
                </p>
                <p className="font-semibold text-slate-900">{milestone.title}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-red-600">Amount at Stake</p>
                <p className="text-lg font-bold text-red-600">
                  {formatAmount(milestone.amount)}
                </p>
              </div>
            </div>
          </div>

          {/* Title Input */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold text-slate-800">
              Dispute Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Quality does not match spec"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20"
            />
          </div>

          {/* Category Selection */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold text-slate-800">
              Reason Category <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(DISPUTE_CATEGORIES).map(([key, cat]) => {
                const Icon = cat.icon;
                const isSelected = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key as DisputeCategory)}
                    className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-all ${
                      isSelected
                        ? "border-red-400 bg-red-50 text-red-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 flex-shrink-0 ${
                        isSelected ? "text-red-500" : "text-slate-400"
                      }`}
                    />
                    <span className="text-sm font-medium">{cat.label}</span>
                  </button>
                );
              })}
            </div>
            {category && (
              <p className="mt-2 text-xs text-slate-500">
                {DISPUTE_CATEGORIES[category].description}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold text-slate-800">
              Describe the Issue <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide detailed information about the problem. Include specific examples, dates, and any relevant context that will help resolve this dispute..."
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20"
            />
          </div>

          {/* Evidence Links */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold text-slate-800">
              Evidence Links{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <p className="mb-2 text-xs text-slate-500">
              Add links to screenshots, documents, or communications that support
              your case.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={evidenceInput}
                onChange={(e) => setEvidenceInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://example.com/evidence.png"
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20"
              />
              <button
                type="button"
                onClick={handleAddEvidence}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
              >
                Add
              </button>
            </div>
            {evidence.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {evidence.map((url, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs"
                  >
                    <span className="max-w-[180px] truncate text-slate-700">
                      {url}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEvidence(url)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warning Notice */}
          <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Important Notice</p>
              <p className="mt-1 text-xs text-amber-700">
                Once submitted, this dispute will be reviewed by our mediation team.
                The milestone funds will be held in escrow until a resolution is
                reached. Please ensure all information is accurate.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 border-t border-slate-100 p-5">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 font-semibold text-white shadow-lg shadow-red-500/30 transition-all hover:from-red-600 hover:to-orange-600 hover:shadow-xl hover:shadow-red-500/40 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                Submit Dispute
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
