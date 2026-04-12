import { Plus, Flag } from "lucide-react";
import type { Milestone, Task } from "../../types";
import type { MilestoneInteractionGate } from "../../milestone-interaction";
import { cn } from "@/lib/utils";
import { calculateProgress } from "../../utils";

type MilestoneTabsProps = {
  milestones: Milestone[];
  selectedId?: string | null;
  tasksMap?: Record<string, Task[]>;
  interactionGates?: Record<string, MilestoneInteractionGate>;
  onSelect: (id: string) => void;
  /** Optional - if not provided, "Add Milestone" button is hidden (read-only mode) */
  onAdd?: () => void;
};

export function MilestoneTabs({
  milestones,
  selectedId,
  tasksMap = {},
  interactionGates = {},
  onSelect,
  onAdd,
}: MilestoneTabsProps) {
  return (
    <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
      {milestones.map((ms) => {
        const gate = interactionGates[ms.id];
        const progress = calculateProgress(tasksMap[ms.id] || []);
        const normalizedStatus = (ms.status || "").toUpperCase();
        const isPaidAndReleased =
          normalizedStatus.includes("PAID") ||
          normalizedStatus.includes("RELEASE");
        const fallbackStatusLabel = isPaidAndReleased
          ? "PAID AND RELEASED"
          : "IN PROGRESS";
        return (
          <button
            key={ms.id}
            onClick={() => onSelect(ms.id)}
            className={cn(
              "flex min-h-[4.25rem] min-w-[15rem] max-w-[18.5rem] shrink-0 items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
              selectedId === ms.id
                ? "border-teal-500 bg-teal-50 text-teal-700 shadow-[0_0_0_1px_rgba(20,184,166,0.12)]"
                : "border-gray-200 bg-white text-slate-700 hover:border-teal-200 hover:text-teal-600"
            )}
          >
            <Flag className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "truncate",
                    progress === 100 ? "text-emerald-600" : undefined
                  )}
                >
                  {ms.title}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  ({progress}%)
                </span>
              </span>
              <span className="mt-2 flex min-h-[1.25rem] items-center">
                {gate?.shortLabel ? (
                  <span
                    className={cn(
                      "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      gate.state === "LOCKED_NOT_FUNDED"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-slate-100 text-slate-600"
                    )}
                  >
                    <span className="truncate">{gate.shortLabel}</span>
                  </span>
                ) : (
                  <span
                    className={cn(
                      "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      isPaidAndReleased
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-sky-200 bg-sky-50 text-sky-700"
                    )}
                  >
                    <span className="truncate">{fallbackStatusLabel}</span>
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })}
      {/* Only show Add Milestone button if onAdd is provided (not read-only mode) */}
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex min-h-[4.25rem] shrink-0 items-center gap-2 rounded-xl border border-dashed border-teal-300 px-4 py-3 text-teal-700 transition-colors hover:bg-teal-50"
        >
          <Plus className="h-4 w-4" />
          Add Milestone
        </button>
      )}
    </div>
  );
}
