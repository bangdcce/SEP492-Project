import { CalendarDays, Flag, X } from "lucide-react";

type CreateMilestoneModalProps = {
  open: boolean;
  title: string;
  amount: string;
  description: string;
  startDate: string;
  dueDate: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onChangeTitle: (value: string) => void;
  onChangeAmount: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeStartDate: (value: string) => void;
  onChangeDueDate: (value: string) => void;
};

export function CreateMilestoneModal({
  open,
  title,
  amount,
  description,
  startDate,
  dueDate,
  isSubmitting,
  onClose,
  onSubmit,
  onChangeTitle,
  onChangeAmount,
  onChangeDescription,
  onChangeStartDate,
  onChangeDueDate,
}: CreateMilestoneModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-5 rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Create Milestone</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Define milestone scope before adding tasks.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Milestone Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(event) => onChangeTitle(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., API + Core Features Delivery"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Flag className="h-4 w-4 text-teal-600" />
                Amount (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => onChangeAmount(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-500" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => onChangeStartDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gray-500" />
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => onChangeDueDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(event) => onChangeDescription(event.target.value)}
              className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={3}
              placeholder="Define expected outcomes for this milestone..."
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting || !title.trim()}
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Milestone"}
          </button>
        </div>
      </div>
    </div>
  );
}
