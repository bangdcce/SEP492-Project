import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";
import { DisputeCategory } from "../../../staff/types/staff.types";

interface CreateDisputeWizardProps {
  onClose: () => void;
  milestoneId: string;
  projectId: string;
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
  {
    id: DisputeCategory.SCOPE_CHANGE,
    title: "Scope Change",
    desc: "Work requested is outside original agreement.",
  },
  {
    id: DisputeCategory.OTHER,
    title: "Other Issue",
    desc: "Something else not listed here.",
  },
];

export const CreateDisputeWizard = ({
  onClose,
  currentUserId,
  projectMembers,
}: CreateDisputeWizardProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCategory, setSelectedCategory] =
    useState<DisputeCategory | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [selectedDefendant, setSelectedDefendant] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out current user from defendant list
  const availableDefendants = projectMembers.filter(
    (m) => m.id !== currentUserId,
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    console.log({
      category: selectedCategory,
      reason: customReason, // Backend expects mapped reason
      defendantId: selectedDefendant,
      files,
    });

    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
      // Trigger toast success here
    }, 1500);
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
          <h4 className="text-base font-medium text-slate-900">
            Why do you want to open a dispute?
          </h4>
          <div role="radiogroup" className="space-y-3">
            {REPORT_REASONS.map((reason) => {
              const checked = selectedCategory === reason.id;
              return (
                <button
                  key={reason.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setSelectedCategory(reason.id)}
                  className={`relative flex w-full cursor-pointer rounded-lg border p-4 shadow-sm focus:outline-none ${
                    checked
                      ? "border-teal-600 ring-1 ring-teal-600 bg-teal-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
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
              disabled={!selectedCategory || !selectedDefendant}
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
              Describe the issue in detail{" "}
              {selectedCategory === DisputeCategory.OTHER && "(Required)"}
            </label>
            <div className="mt-1">
              <textarea
                rows={4}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-3 border placeholder-gray-400"
                placeholder="Please explain what happened, referencing specific contract terms..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
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
              className="text-gray-600 hover:text-slate-900 text-sm font-medium"
            >
              Back
            </button>
            <button
              disabled={customReason.length < 20}
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

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="text-gray-600 hover:text-slate-900 text-sm font-medium"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
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
