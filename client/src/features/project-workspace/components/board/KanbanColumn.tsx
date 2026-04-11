import { memo } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "../../types";
import { TaskCard } from "./TaskCard";

type KanbanColumnProps = {
  columnId: string;
  title: string;
  description?: string;
  tasks: Task[];
  onAddTask: () => void;
  onTaskClick: (taskId: string) => void;
  /** If true, hide "Add Task" button (for CLIENT read-only mode) */
  isReadOnly?: boolean;
  canAddTask?: boolean;
};

function KanbanColumnInner({
  columnId,
  title,
  tasks,
  onAddTask,
  onTaskClick,
  isReadOnly = false,
  canAddTask = true,
}: KanbanColumnProps) {
  return (
    <Droppable droppableId={columnId}>
      {(provided, snapshot) => (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100/80 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-3 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {title}
              </h2>
            </div>
            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {tasks.length}
            </span>
          </div>

          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 [scrollbar-gutter:stable] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300",
              snapshot.isDraggingOver && "bg-teal-50/50",
            )}
          >
            {tasks.length === 0 ? (
              <div className="flex min-h-[9rem] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/70 px-4 text-center text-xs text-slate-400">
                No issues
              </div>
            ) : (
              tasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  onClick={onTaskClick}
                  isReadOnly={isReadOnly}
                />
              ))
            )}
            {provided.placeholder}
          </div>

          {!isReadOnly && canAddTask && (
            <div className="border-t border-slate-200 bg-white/85 px-3 py-2">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
                onClick={onAddTask}
              >
                <Plus className="h-3.5 w-3.5" />
                Create issue
              </button>
            </div>
          )}
        </div>
      )}
    </Droppable>
  );
}

export const KanbanColumn = memo(KanbanColumnInner);
