import { memo } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { GripVertical, Clock, Flag, Layout } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "../../types";
import {
  isTaskImageAttachment,
  resolveTaskAttachmentUrl,
} from "../../utils/task-attachments";

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

const PRIORITY_STYLES: Record<string, { color: string; bg: string }> = {
  LOW: { color: "text-blue-600", bg: "bg-blue-50" },
  MEDIUM: { color: "text-amber-600", bg: "bg-amber-50" },
  HIGH: { color: "text-orange-600", bg: "bg-orange-50" },
  URGENT: { color: "text-red-600", bg: "bg-red-50" },
};

type TaskCardProps = {
  task: Task;
  index: number;
  onClick: (taskId: string) => void;
  isReadOnly?: boolean;
};

function TaskCardInner({
  task,
  index,
  onClick,
  isReadOnly = false,
}: TaskCardProps) {
  const coverAttachment = task.attachments?.find(isTaskImageAttachment);
  const coverImageUrl = resolveTaskAttachmentUrl(coverAttachment?.url);
  const hasCoverImage = Boolean(coverImageUrl);

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={isReadOnly}>
      {(dragProvided, snapshot) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          {...dragProvided.dragHandleProps}
          onClick={() => onClick(task.id)}
          className={cn(
            "group relative shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50",
            hasCoverImage ? "min-h-[7.75rem]" : "min-h-[5.75rem]",
            isReadOnly ? "cursor-default" : "cursor-pointer",
            snapshot.isDragging
              ? "shadow-lg border-teal-500 ring-1 ring-teal-400/50 z-50 rotate-2"
              : "hover:border-slate-300"
          )}
        >
          {!isReadOnly && (
            <div className="absolute right-2 top-2 z-10 hidden h-6 w-6 items-center justify-center rounded bg-slate-100/90 text-slate-400 transition-colors hover:text-slate-600 group-hover:flex">
              <GripVertical className="h-3 w-3" />
            </div>
          )}

          {coverImageUrl ? (
            <div className="relative h-12 w-full overflow-hidden border-b border-slate-200 bg-slate-100">
              <img
                src={coverImageUrl}
                alt={coverAttachment?.fileName || `${task.title} cover`}
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </div>
          ) : null}

          <div className="p-2.5">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 transition-colors group-hover:text-blue-600">
                      {task.title}
                    </p>
                    {task.description && !coverImageUrl && (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {(() => {
                      const { name, initials, colorClass } = getAssigneeVisuals(task);
                      return (
                        <div
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border border-white text-[9px] font-bold shadow-sm ring-1 ring-gray-100",
                            colorClass
                          )}
                          title={name}
                        >
                          {initials}
                        </div>
                      );
                    })()}

                    {task.priority && (
                      <div
                        className={cn(
                          "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
                          PRIORITY_STYLES[task.priority]?.bg || "bg-gray-50",
                          PRIORITY_STYLES[task.priority]?.color || "text-gray-600",
                          "border-transparent"
                        )}
                        title={`Priority: ${task.priority}`}
                      >
                        <Flag className="h-3 w-3" />
                        <span className="hidden xl:inline">{task.priority}</span>
                      </div>
                    )}

                    {task.storyPoints !== undefined && task.storyPoints !== null && (
                      <div
                        className="flex items-center gap-1 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                        title="Story Points"
                      >
                        <Layout className="h-3 w-3" />
                        <span>{task.storyPoints}</span>
                      </div>
                    )}
                  </div>

                  {task.dueDate && (
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                        new Date(task.dueDate) < new Date()
                          ? "border-red-100 bg-red-50 text-red-600"
                          : "border-gray-200 bg-gray-50 text-gray-500"
                      )}
                    >
                      <Clock className="h-3 w-3" />
                      <span>
                        {new Date(task.dueDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

export const TaskCard = memo(TaskCardInner);
