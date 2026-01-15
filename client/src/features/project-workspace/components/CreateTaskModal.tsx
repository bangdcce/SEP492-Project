type CreateTaskModalProps = {
  open: boolean;
  title: string;
  description: string;
  milestoneId?: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
};

export function CreateTaskModal({
  open,
  title,
  description,
  milestoneId,
  isSubmitting,
  onClose,
  onSubmit,
  onChangeTitle,
  onChangeDescription,
}: CreateTaskModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Create New Task
          </h3>
          {milestoneId && (
            <span className="text-xs text-teal-700 bg-teal-50 px-2 py-1 rounded-full border border-teal-100">
              Milestone: {milestoneId}
            </span>
          )}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-700">Title *</label>
            <input
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Task title"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="text-sm text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => onChangeDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Optional description"
              rows={3}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-70"
          >
            {isSubmitting ? "Creating..." : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
