import { Plus, Flag } from "lucide-react";
import type { Milestone, Task } from "../types";
import { cn } from "@/lib/utils";
import { calculateProgress } from "../utils";

type MilestoneTabsProps = {
  milestones: Milestone[];
  selectedId?: string | null;
  tasksMap?: Record<string, Task[]>;
  onSelect: (id: string) => void;
  /** Optional - if not provided, "Add Milestone" button is hidden (read-only mode) */
  onAdd?: () => void;
};

export function MilestoneTabs({
  milestones,
  selectedId,
  tasksMap = {},
  onSelect,
  onAdd,
}: MilestoneTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {milestones.map((ms) => (
        <button
          key={ms.id}
          onClick={() => onSelect(ms.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
            selectedId === ms.id
              ? "border-teal-500 text-teal-700 bg-teal-50"
              : "border-gray-200 text-slate-700 hover:border-teal-200 hover:text-teal-600"
          )}
        >
          <Flag className="h-4 w-4" />
          <span
            className={cn(
              "line-clamp-1",
              calculateProgress(tasksMap[ms.id] || []) === 100
                ? "text-emerald-600"
                : undefined
            )}
          >
            {ms.title}
            {typeof calculateProgress(tasksMap[ms.id] || []) === "number" && (
              <span className="ml-1 text-xs text-slate-600">
                ({calculateProgress(tasksMap[ms.id] || [])}%)
              </span>
            )}
          </span>
        </button>
      ))}
      {/* Only show Add Milestone button if onAdd is provided (not read-only mode) */}
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-teal-300 text-teal-700 hover:bg-teal-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Milestone
        </button>
      )}
    </div>
  );
}
