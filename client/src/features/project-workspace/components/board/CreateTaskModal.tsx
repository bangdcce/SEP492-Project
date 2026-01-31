import { Layers, CalendarDays, X } from "lucide-react";

/**
 * MOCK SPEC FEATURES
 * Simulates the functional requirements from ProjectSpec
 * TODO: Replace with real API data when backend is ready
 */
export const MOCK_SPEC_FEATURES = [
  { id: "feat-1", name: "User Authentication", category: "Core" },
  { id: "feat-2", name: "Dashboard Analytics", category: "Core" },
  { id: "feat-3", name: "Payment Gateway Integration", category: "Payment" },
  { id: "feat-4", name: "Notification System", category: "Communication" },
  { id: "feat-5", name: "File Upload & Storage", category: "Storage" },
  { id: "feat-6", name: "Search & Filtering", category: "UX" },
  { id: "feat-7", name: "Report Generation", category: "Reporting" },
  { id: "feat-8", name: "API Integration (3rd Party)", category: "Integration" },
] as const;

type SpecFeature = (typeof MOCK_SPEC_FEATURES)[number];

type CreateTaskModalProps = {
  open: boolean;
  title: string;
  description: string;
  milestoneId?: string;
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

  // Group features by category for better UX
  const featuresByCategory = MOCK_SPEC_FEATURES.reduce((acc, feat) => {
    if (!acc[feat.category]) acc[feat.category] = [];
    acc[feat.category].push(feat);
    return acc;
  }, {} as Record<string, SpecFeature[]>);

  const selectedFeature = MOCK_SPEC_FEATURES.find(f => f.id === specFeatureId);

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
              disabled={isSubmitting}
            >
              <option value="">-- Select a feature from project spec --</option>
              {Object.entries(featuresByCategory).map(([category, features]) => (
                <optgroup key={category} label={`📁 ${category}`}>
                  {features.map((feat) => (
                    <option key={feat.id} value={feat.id}>
                      {feat.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedFeature && (
              <p className="mt-1.5 text-xs text-teal-600 flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-teal-500 rounded-full"></span>
                Task linked to: <strong>{selectedFeature.name}</strong>
              </p>
            )}
            {!specFeatureId && (
              <p className="mt-1.5 text-xs text-amber-600">
                ⚠️ Tasks without a linked feature may indicate scope creep
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
              <input
                type="date"
                value={startDate}
                onChange={(e) => onChangeStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-500" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => onChangeDueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={isSubmitting}
              />
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
