import { Draggable } from "@hello-pangea/dnd";
import { GripVertical, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "../types";

const getAssigneeVisuals = (task: Task) => {
  const name = task.assignee?.fullName || task.assignee?.email || "Unassigned";
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "NA";

  const colors = [
    "bg-amber-100 text-amber-700",
    "bg-emerald-100 text-emerald-700",
    "bg-sky-100 text-sky-700",
    "bg-indigo-100 text-indigo-700",
    "bg-pink-100 text-pink-700",
    "bg-lime-100 text-lime-700",
  ];
  const hash = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const colorClass = colors[hash % colors.length];

  return { name, initials, colorClass };
};

type TaskCardProps = {
  task: Task;
  index: number;
  onClick: (taskId: string) => void;
};

export function TaskCard({ task, index, onClick }: TaskCardProps) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(dragProvided, snapshot) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          {...dragProvided.dragHandleProps}
          onClick={() => onClick(task.id)}
          className={cn(
            "group bg-white border border-gray-300 rounded-[3px] p-3 shadow-sm hover:bg-gray-50 transition-colors cursor-pointer",
            snapshot.isDragging
              ? "shadow-lg border-teal-500 ring-1 ring-teal-400/50 z-50 rotate-2"
              : "hover:border-gray-400"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors absolute top-2 right-2">
              <GripVertical className="h-3 w-3" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  {(() => {
                    const { name, initials, colorClass } =
                      getAssigneeVisuals(task);
                    return (
                      <>
                        <div
                          className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-white shadow-sm",
                            colorClass
                          )}
                        >
                          {initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 group-hover:text-slate-800 transition-colors">{name}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {task.dueDate && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
