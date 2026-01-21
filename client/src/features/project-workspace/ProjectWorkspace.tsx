import { useEffect, useMemo, useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useParams } from "react-router-dom";
import { LayoutGrid, Calendar as CalendarIcon } from "lucide-react";
import { Spinner } from "@/shared/components/ui";
import {
  fetchBoard,
  updateTaskStatus,
  createTask,
  fetchMilestones,
  createMilestone,
} from "./api";
import type { KanbanBoard, KanbanColumnKey, Task, Milestone } from "./types";
import { KanbanColumn } from "./components/KanbanColumn";
import { CreateTaskModal } from "./components/CreateTaskModal";
import { MilestoneTabs } from "./components/MilestoneTabs";
import { CalendarView } from "./components/CalendarView";
import { calculateProgress } from "./utils";

const initialBoard: KanbanBoard = {
  TODO: [],
  IN_PROGRESS: [],
  DONE: [],
};

export function ProjectWorkspace() {
  const [board, setBoard] = useState<KanbanBoard>(initialBoard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"board" | "calendar">("board");
  const { projectId } = useParams();

  useEffect(() => {
    if (!projectId) {
      setError("No project selected. Please choose a project from the list.");
      setLoading(false);
      return;
    }
    const loadBoard = async () => {
      try {
        setLoading(true);
        setError(null);
        const [milestoneData, boardData] = await Promise.all([
          fetchMilestones(projectId),
          fetchBoard(projectId),
        ]);
        console.log("API Data:", { milestoneData, boardData });
        setMilestones(milestoneData || []);
        setSelectedMilestoneId(
          milestoneData && milestoneData.length > 0 ? milestoneData[0].id : null
        );
        setBoard({
          TODO: boardData?.TODO || [],
          IN_PROGRESS: boardData?.IN_PROGRESS || [],
          DONE: boardData?.DONE || [],
        });
      } catch (err: any) {
        setError(err?.message || "Failed to load task board");
      } finally {
        setLoading(false);
      }
    };

    loadBoard();
  }, [projectId]);

  const columns = useMemo<
    { key: KanbanColumnKey; title: string; description: string }[]
  >(
    () => [
      {
        key: "TODO",
        title: "Todo",
        description: "Tasks in backlog for this milestone",
      },
      {
        key: "IN_PROGRESS",
        title: "In Progress",
        description: "Currently being worked on",
      },
      {
        key: "DONE",
        title: "Done",
        description: "Completed tasks",
      },
    ],
    []
  );

  const openCreateModal = () => setIsModalOpen(true);
  const handleSelectMilestone = (id: string) => setSelectedMilestoneId(id);

  const handleCreateMilestone = async () => {
    if (!projectId) {
      setError("No project selected. Please choose a project from the list.");
      return;
    }
    const title = window.prompt("Milestone title");
    if (!title) return;
    const amountInput = window.prompt("Amount (optional, default 0)", "0");
    const amount = amountInput ? Number(amountInput) || 0 : 0;
    try {
      const created = await createMilestone({
        projectId,
        title,
        amount,
      });
      setMilestones((prev) => [...prev, created]);
      setSelectedMilestoneId(created.id);
    } catch (err: any) {
      setError(err?.message || "Failed to create milestone");
    }
  };

  const filteredBoard = useMemo(() => {
    if (!selectedMilestoneId) return board;
    const filterByMilestone = (tasks: Task[]) =>
      tasks.filter((t) => t.milestoneId === selectedMilestoneId);
    return {
      TODO: filterByMilestone(board.TODO),
      IN_PROGRESS: filterByMilestone(board.IN_PROGRESS),
      DONE: filterByMilestone(board.DONE),
    };
  }, [board, selectedMilestoneId]);

  const tasksByMilestone = useMemo(() => {
    const map: Record<string, Task[]> = {};
    ["TODO", "IN_PROGRESS", "DONE"].forEach((col) => {
      board[col as KanbanColumnKey].forEach((t) => {
        if (!t.milestoneId) return;
        if (!map[t.milestoneId]) map[t.milestoneId] = [];
        map[t.milestoneId].push(t);
      });
    });
    return map;
  }, [board]);
  const activeMilestone = selectedMilestoneId
    ? milestones.find((m) => m.id === selectedMilestoneId)
    : null;
  const activeTasks =
    selectedMilestoneId && tasksByMilestone[selectedMilestoneId]
      ? tasksByMilestone[selectedMilestoneId]
      : [];
  const activeProgress = calculateProgress(activeTasks);

  // Get all tasks in a flat array for calendar view
  const allTasks = useMemo(() => {
    const tasks: Task[] = [];
    ["TODO", "IN_PROGRESS", "DONE"].forEach((col) => {
      tasks.push(...board[col as KanbanColumnKey]);
    });
    return tasks;
  }, [board]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const fromColumn = source.droppableId as KanbanColumnKey;
    const toColumn = destination.droppableId as KanbanColumnKey;

    if (fromColumn === toColumn && destination.index === source.index) {
      return;
    }

    const prevBoard: KanbanBoard = (
      ["TODO", "IN_PROGRESS", "DONE"] as KanbanColumnKey[]
    ).reduce(
      (acc, key) => ({
        ...acc,
        [key]: board[key].map((t) => ({ ...t })),
      }),
      { ...initialBoard }
    );

    const nextBoard: KanbanBoard = {
      ...prevBoard,
      [fromColumn]: [...prevBoard[fromColumn]],
      [toColumn]: [...prevBoard[toColumn]],
    };

    const [movedTask] = nextBoard[fromColumn].splice(source.index, 1);
    if (!movedTask) return;
    const updatedTask = { ...movedTask, status: toColumn };
    nextBoard[toColumn].splice(destination.index, 0, updatedTask);

    setBoard(nextBoard);

    try {
      await updateTaskStatus(draggableId, toColumn);
      setError(null);
    } catch (err: any) {
      setBoard(prevBoard);
      setError(err?.message || "Failed to update task status");
    }
  };

  const handleCreateTask = async () => {
    const title = newTitle.trim();
    if (!title) {
      setError("Title is required");
      return;
    }
    if (!projectId) {
      setError("No project selected. Please choose a project from the list.");
      return;
    }
    if (!selectedMilestoneId) {
      setError("Please create a milestone before adding tasks.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const created = await createTask({
        title,
        description: newDescription,
        projectId,
        milestoneId: selectedMilestoneId,
      });

      setBoard((prev) => ({
        ...prev,
        TODO: [created, ...prev.TODO],
      }));

      setIsModalOpen(false);
      setNewTitle("");
      setNewDescription("");
    } catch (err: any) {
      setError(err?.message || "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Project Task Board
          </h1>
          <p className="text-gray-600">
            Project ID:{" "}
            <span className="font-mono text-sky-600">{projectId || "N/A"}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === "board"
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Board
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === "calendar"
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <CalendarIcon className="h-4 w-4" />
              Calendar
            </button>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
          >
            + New Task
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error}
        </div>
      ) : milestones.length === 0 ? (
        <div className="border border-dashed border-teal-300 rounded-2xl p-6 bg-teal-50/40 text-center space-y-3">
          <p className="text-slate-800 text-lg font-semibold">
            No milestones yet
          </p>
          <p className="text-sm text-gray-600">
            Create your first milestone to start adding tasks for this project.
          </p>
          <button
            onClick={handleCreateMilestone}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            + Create Milestone
          </button>
        </div>
      ) : (
        <>
          <MilestoneTabs
            milestones={milestones}
            selectedId={selectedMilestoneId || undefined}
            tasksMap={tasksByMilestone}
            onSelect={handleSelectMilestone}
            onAdd={handleCreateMilestone}
          />

          {activeMilestone && viewMode === "board" && (
            <div className="border border-gray-200 bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-slate-900">
                  {activeMilestone.title}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <span>{activeProgress}%</span>
                </div>
              </div>
              {activeMilestone.description ? (
                <p className="text-xs text-gray-600 mb-2">
                  {activeMilestone.description}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mb-2">No description</p>
              )}
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 transition-all"
                  style={{ width: `${activeProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Conditional View Rendering */}
          {viewMode === "board" ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {columns.map((col) => (
                  <KanbanColumn
                    key={col.key}
                    columnId={col.key}
                    title={col.title}
                    description={col.description}
                    tasks={filteredBoard[col.key]}
                    onAddTask={openCreateModal}
                  />
                ))}
              </div>
            </DragDropContext>
          ) : (
            <CalendarView tasks={allTasks} />
          )}
        </>
      )}

      <CreateTaskModal
        open={isModalOpen}
        title={newTitle}
        description={newDescription}
        milestoneId={selectedMilestoneId || undefined}
        isSubmitting={isSubmitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTask}
        onChangeTitle={setNewTitle}
        onChangeDescription={setNewDescription}
      />
    </div>
  );
}
