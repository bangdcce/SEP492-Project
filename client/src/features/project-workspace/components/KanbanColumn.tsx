import { Droppable } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import type { Task } from "../types";
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
};

export function KanbanColumn({
  columnId,
  title,
  tasks,
  onAddTask,
  onTaskClick,
  isReadOnly = false,
}: KanbanColumnProps) {

  return (
    <Droppable droppableId={columnId}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="bg-slate-100 rounded-[3px] p-2 min-h-[420px] flex flex-col gap-2"
        >
          <div className="flex items-center justify-between px-1 py-1 mb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wide">
                {title}
              </h2>
            </div>
            {tasks.length > 0 && (
                <span className="text-xs font-medium text-slate-500 px-1.5 bg-slate-200/50 rounded-sm">
                    {tasks.length}
                </span>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-3 max-h-[560px] overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300">
            {tasks.length === 0 ? (
              <div className="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-300 rounded-[3px]">
                No issues
              </div>
            ) : (
              tasks.map((task, index) => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  index={index} 
                  onClick={onTaskClick}
                />
              ))
            )}
            {provided.placeholder}
            {/* Hide Add Task button in read-only mode (CLIENT users) */}
            {!isReadOnly && (
              <button
                type="button"
                className="mt-1 flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200 rounded-[3px] transition-colors w-full"
                onClick={onAddTask}
              >
                <Plus className="h-3.5 w-3.5" />
                Create issue
              </button>
            )}
          </div>
        </div>
      )}
    </Droppable>
  );
}
