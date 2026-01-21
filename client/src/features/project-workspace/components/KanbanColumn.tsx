import { Droppable } from "@hello-pangea/dnd";
import { Circle, Clock3, CheckCircle2, Plus } from "lucide-react";
import type { Task } from "../types";
import { TaskCard } from "./TaskCard";

type KanbanColumnProps = {
  columnId: string;
  title: string;
  description?: string;
  tasks: Task[];
  onAddTask: () => void;
};

export function KanbanColumn({
  columnId,
  title,
  description,
  tasks,
  onAddTask,
}: KanbanColumnProps) {
  const renderIcon = () => {
    if (columnId === "DONE") {
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    }
    if (columnId === "IN_PROGRESS") {
      return <Clock3 className="h-5 w-5 text-sky-500" />;
    }
    return <Circle className="h-5 w-5 text-slate-500" />;
  };

  const badgeColor =
    columnId === "DONE"
      ? "bg-emerald-100 text-emerald-700"
      : columnId === "IN_PROGRESS"
      ? "bg-sky-100 text-sky-700"
      : "bg-slate-100 text-slate-700";

  return (
    <Droppable droppableId={columnId}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="bg-white/60 border border-gray-200 rounded-2xl p-4 min-h-[420px] flex flex-col gap-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-gray-200">
                {renderIcon()}
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {title}
                </h2>
                {description ? (
                  <p className="text-xs text-gray-500">{description}</p>
                ) : null}
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badgeColor}`}
            >
              {tasks.length}
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-3 max-h-[560px] overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300">
            {tasks.length === 0 ? (
              <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-3 text-center">
                No tasks
              </div>
            ) : (
              tasks.map((task, index) => (
                <TaskCard key={task.id} task={task} index={index} />
              ))
            )}
            {provided.placeholder}
            <button
              type="button"
              className={`mt-1 flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-medium transition-colors duration-200 ${
                columnId === "DONE"
                  ? "border-emerald-300/80 text-emerald-600 bg-emerald-50/40"
                  : columnId === "IN_PROGRESS"
                  ? "border-sky-300/80 text-sky-600 bg-sky-50/40"
                  : "border-slate-300/80 text-slate-500 bg-transparent"
              } hover:text-teal-700 hover:border-teal-400 hover:bg-teal-50`}
              onClick={onAddTask}
            >
              <Plus className="h-4 w-4" />
              Add task
            </button>
          </div>
        </div>
      )}
    </Droppable>
  );
}
