import { Layers, CalendarDays, X } from "lucide-react";
import { WorkspaceDatePicker } from "../shared/WorkspaceDatePicker";

export type SpecFeatureOption = {
  id: string;
  title: string;
  complexity?: "LOW" | "MEDIUM" | "HIGH";
  description?: string;
  acceptanceCriteriaCount?: number;
};

type CreateTaskModalProps = {
  open: boolean;
  title: string;
  description: string;
  milestoneId?: string;
  specFeatures: SpecFeatureOption[];
  specFeatureId: string;
  startDate: string;
  dueDate: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeSpecFeature: (value: string) => void;
  onChangeStartDate: (value: string) => void;
  onChangeDueDate: (value: string) => void;
};

export function CreateTaskModal({
  open,
  title,
  description,
  milestoneId,
  specFeatures,
  specFeatureId,
  startDate,
  dueDate,
  isSubmitting,
  onClose,
  onSubmit,
  onChangeTitle,
  onChangeDescription,
  onChangeSpecFeature,
  onChangeStartDate,
  onChangeDueDate,
}: CreateTaskModalProps) {
  if (!open) return null;

  const featuresByComplexity = specFeatures.reduce((acc, feat) => {
    const key = feat.complexity || "UNSPECIFIED";
    if (!acc[key]) acc[key] = [];
    acc[key].push(feat);
    return acc;
  }, {} as Record<string, SpecFeatureOption[]>);

  const selectedFeature = specFeatures.find((feature) => feature.id === specFeatureId);
  const hasSpecFeatures = specFeatures.length > 0;

  const complexityLabelMap: Record<string, string> = {
    HIGH: "High Complexity",
    MEDIUM: "Medium Complexity",
    LOW: "Low Complexity",
    UNSPECIFIED: "Unspecified",
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Create New Task
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Link task to a spec feature to prevent scope creep
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Milestone Badge */}
        {milestoneId && (
          <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 px-3 py-2 rounded-lg border border-teal-100">
            <Layers className="h-3.5 w-3.5" />
            <span className="font-medium">Milestone:</span>
            <span className="font-mono">{milestoneId.slice(0, 8)}...</span>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="e.g., Implement login form validation"
              disabled={isSubmitting}
            />
          </div>

          {/* Related Feature (Spec Mapping) - Anti-Scope Creep */}
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Layers className="h-4 w-4 text-teal-600" />
              Related Feature (Spec)
              <span className="text-xs font-normal text-gray-400">(Anti-Scope Creep)</span>
            </label>
            <select
              value={specFeatureId}
              onChange={(e) => onChangeSpecFeature(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
              disabled={isSubmitting || !hasSpecFeatures}
            >
              <option value="">
                {hasSpecFeatures
                  ? "-- Select a feature from approved spec --"
                  : "-- No features found in current spec --"}
              </option>
              {Object.entries(featuresByComplexity).map(([complexity, features]) => (
                <optgroup key={complexity} label={complexityLabelMap[complexity] || complexity}>
                  {features.map((feat) => (
                    <option key={feat.id} value={feat.id}>
                      {feat.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedFeature && (
              <p className="mt-1.5 text-xs text-teal-600 flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-teal-500 rounded-full"></span>
                Task linked to: <strong>{selectedFeature.title}</strong>
                {selectedFeature.acceptanceCriteriaCount
                  ? ` (${selectedFeature.acceptanceCriteriaCount} acceptance criteria)`
                  : ""}
              </p>
            )}
            {!specFeatureId && (
              <p className="mt-1.5 text-xs text-amber-600">
                {hasSpecFeatures
                  ? "Tasks without a linked feature may indicate scope creep."
                  : "Spec feature list is empty. Broker should update final spec if needed."}
              </p>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-500" />
                Start Date
              </label>
              <div className="mt-1">
                <WorkspaceDatePicker
                  value={startDate || null}
                  onChange={(value) => onChangeStartDate(value ?? "")}
                  placeholder="Set start date"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-500" />
                Due Date
              </label>
              <div className="mt-1">
                <WorkspaceDatePicker
                  value={dueDate || null}
                  onChange={(value) => onChangeDueDate(value ?? "")}
                  placeholder="Set due date"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => onChangeDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              placeholder="Describe what needs to be done..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting || !title.trim()}
            className="px-5 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Creating...
              </span>
            ) : (
              "Create Task"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
