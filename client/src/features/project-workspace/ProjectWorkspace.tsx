import { useEffect, useMemo, useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useParams } from "react-router-dom";
import { LayoutGrid, Calendar as CalendarIcon, BarChart2, Search, XCircle } from "lucide-react";
import { Spinner } from "@/shared/components/ui";
import { STORAGE_KEYS } from "@/constants";
import {
  fetchBoard,
  updateTaskStatus,
  createTask,
  fetchMilestones,
  createMilestone,
  submitTask,
  approveMilestone,
} from "./api";
import type { KanbanBoard, KanbanColumnKey, Task, Milestone } from "./types";
import { KanbanColumn } from "./components/KanbanColumn";
import { CreateTaskModal } from "./components/CreateTaskModal";
import { TaskDetailModal } from "./components/TaskDetailModal";
import { MilestoneTabs } from "./components/MilestoneTabs";
import { CalendarView } from "./components/CalendarView";
import { MilestoneApprovalCard } from "./components/MilestoneApprovalCard";
import { ProjectOverview } from "./components/ProjectOverview";
import { calculateProgress } from "./utils";

const initialBoard: KanbanBoard = {
  TODO: [],
  IN_PROGRESS: [],
  IN_REVIEW: [],
  DONE: [],
};

// Helper to get current user from localStorage
const getCurrentUser = (): { id: string; role?: string } | null => {
  try {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (userStr) {
      return JSON.parse(userStr);
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

export function ProjectWorkspace() {
  const [board, setBoard] = useState<KanbanBoard>(initialBoard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSpecFeatureId, setNewSpecFeatureId] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"summary" | "board" | "calendar">("summary");

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [isMyTasksFilter, setIsMyTasksFilter] = useState(false);
  
  // Task Detail Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);

  const { projectId } = useParams();

  // Get current user for role-based UI restrictions
  const currentUser = useMemo(() => getCurrentUser(), []);
  
  // CLIENT users should have read-only access (no creating tasks/milestones)
  const isReadOnly = useMemo(() => {
    const role = currentUser?.role?.toUpperCase();
    return role === "CLIENT";
  }, [currentUser]);

  const canApproveMilestone = useMemo(() => {
    const role = currentUser?.role?.toUpperCase();
    return role === "CLIENT" || role === "BROKER";
  }, [currentUser]);

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
          IN_REVIEW: boardData?.IN_REVIEW || [],
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
        title: "To Do",
        description: "Tasks in backlog",
      },
      {
        key: "IN_PROGRESS",
        title: "In Progress",
        description: "Being worked on",
      },
      {
        key: "IN_REVIEW",
        title: "In Review",
        description: "Waiting for review",
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
      IN_REVIEW: filterByMilestone(board.IN_REVIEW),
      DONE: filterByMilestone(board.DONE),
    };
  }, [board, selectedMilestoneId]);

  const tasksByMilestone = useMemo(() => {
    const map: Record<string, Task[]> = {};
    ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].forEach((col) => {
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
    ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].forEach((col) => {
      tasks.push(...board[col as KanbanColumnKey]);
    });
    return tasks;
  }, [board]);

  // Derive unique assignees for filter
  const uniqueAssignees = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar?: string }>();
    allTasks.forEach((t) => {
      if (t.assignee && t.assignee.id) {
        map.set(t.assignee.id, {
          id: t.assignee.id,
          name: t.assignee.fullName || "Unknown",
          avatar: t.assignee.avatarUrl,
        });
      }
    });
    return Array.from(map.values());
  }, [allTasks]);

  // Filter Logic: processedBoard applies Search & Text filters on top of Milestone filter
  const processedBoard = useMemo(() => {
    let result = { ...filteredBoard }; // Start with milestone-filtered board

    // 1. Text Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = {
        TODO: result.TODO.filter((t) => t.title.toLowerCase().includes(query)),
        IN_PROGRESS: result.IN_PROGRESS.filter((t) => t.title.toLowerCase().includes(query)),
        IN_REVIEW: result.IN_REVIEW.filter((t) => t.title.toLowerCase().includes(query)),
        DONE: result.DONE.filter((t) => t.title.toLowerCase().includes(query)),
      };
    }

    // 2. Assignee Filter
    if (selectedAssigneeId) {
      const filterByAssignee = (list: Task[]) =>
        list.filter((t) => t.assignee?.id === selectedAssigneeId);
      result = {
        TODO: filterByAssignee(result.TODO),
        IN_PROGRESS: filterByAssignee(result.IN_PROGRESS),
        IN_REVIEW: filterByAssignee(result.IN_REVIEW),
        DONE: filterByAssignee(result.DONE),
      };
    } else if (isMyTasksFilter && currentUser?.id) {
       // "Only My Issues" filter
       const filterByMe = (list: Task[]) =>
        list.filter((t) => t.assignee?.id === currentUser.id);
       result = {
        TODO: filterByMe(result.TODO),
        IN_PROGRESS: filterByMe(result.IN_PROGRESS),
        IN_REVIEW: filterByMe(result.IN_REVIEW),
        DONE: filterByMe(result.DONE),
      };
    }

    return result;
  }, [filteredBoard, searchQuery, selectedAssigneeId, isMyTasksFilter, currentUser]);

  // Handle viewing task details (from Calendar or Kanban)
  const handleViewTaskDetails = (taskId: string) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setIsTaskDetailOpen(true);
    }
  };

  // Handle closing task detail modal
  const handleCloseTaskDetail = () => {
    setIsTaskDetailOpen(false);
    setSelectedTask(null);
  };

  // Handle task update from modal
  const handleTaskUpdate = (updatedTask: Task) => {
    // Update local state for the modal
    setSelectedTask(updatedTask);
    
    // Update board state
    setBoard((prevBoard) => {
      const newBoard = { ...prevBoard };
      
      // Find and replace the task in the board columns
      Object.keys(newBoard).forEach((key) => {
        const colKey = key as KanbanColumnKey;
        newBoard[colKey] = newBoard[colKey].map((t) => 
          t.id === updatedTask.id ? updatedTask : t
        );
        
        // Handle status change if column doesn't match
        if (updatedTask.status !== colKey) {
             // If task is in this column but status changed, logic is complex
             // For simplicity, we might reload board or carefully move it
             // But existing drag-drop logic handles status changes well.
             // If status changed via modal dropdown:
             if(newBoard[colKey].find(t => t.id === updatedTask.id)) {
                 // Remove from old column
                 newBoard[colKey] = newBoard[colKey].filter(t => t.id !== updatedTask.id);
             }
        }
      });

      // If status changed, ensure it's in the new column
      if (!newBoard[updatedTask.status].find(t => t.id === updatedTask.id)) {
          newBoard[updatedTask.status].push(updatedTask);
      }
      
      return newBoard;
    });
  };

  // Handle milestone approval (Client/Broker only)
  const handleApproveMilestone = async (
    milestoneId: string,
    feedback?: string
  ) => {
    try {
      setError(null);
      const result = await approveMilestone(milestoneId, feedback);

      // Update the milestone status in local state
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId
            ? { ...m, status: "COMPLETED" }
            : m
        )
      );

      console.log(
        `✅ Milestone "${result.milestone.title}" approved! Funds released: ${result.fundsReleased}`
      );
      
      // Show success message (you could use a toast here)
      alert(result.message);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to approve milestone";
      setError(errorMessage);
      throw err; // Re-throw so the modal can handle it
    }
  };

  // Handle raising a dispute (UI only)
  const handleRaiseDispute = (milestoneId: string) => {
    void milestoneId;
    alert("Feature coming soon");
  };

  // Handle task submission with proof of work
  const handleSubmitTask = async (
    taskId: string,
    data: { submissionNote?: string; proofLink: string }
  ) => {
    try {
      setError(null);
      const result = await submitTask(taskId, data);

      // Update the board with the submitted task (moved to DONE)
      setBoard((prev) => {
        const newBoard = { ...prev };

        // Remove task from its current column
        for (const column of ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as KanbanColumnKey[]) {
          newBoard[column] = newBoard[column].filter((t) => t.id !== taskId);
        }

        // Add updated task to DONE column
        newBoard.DONE = [
          {
            ...result.task,
            status: "DONE" as KanbanColumnKey,
            submissionNote: data.submissionNote || null,
            proofLink: data.proofLink,
            submittedAt: new Date().toISOString(),
          },
          ...newBoard.DONE,
        ];

        return newBoard;
      });

      // Update selected task to show the submission info
      setSelectedTask((prev) =>
        prev?.id === taskId
          ? {
              ...prev,
              status: "DONE" as KanbanColumnKey,
              submissionNote: data.submissionNote || null,
              proofLink: data.proofLink,
              submittedAt: new Date().toISOString(),
            }
          : prev
      );

      console.log(
        `✅ Task ${taskId} submitted! Milestone progress: ${result.milestoneProgress}%`
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to submit task";
      setError(errorMessage);
      throw err; // Re-throw so the modal can handle it
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const fromColumn = source.droppableId as KanbanColumnKey;
    const toColumn = destination.droppableId as KanbanColumnKey;

    if (fromColumn === toColumn && destination.index === source.index) {
      return;
    }

    // Save previous state for rollback
    const prevBoard: KanbanBoard = (
      ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as KanbanColumnKey[]
    ).reduce(
      (acc, key) => ({
        ...acc,
        [key]: board[key].map((t) => ({ ...t })),
      }),
      { ...initialBoard }
    );

    // Optimistic UI update - move the card immediately
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
      // Call API and get updated milestone progress
      const response = await updateTaskStatus(draggableId, toColumn);
      setError(null);

      // 🎯 REAL-TIME PROGRESS UPDATE
      // If the task moved to/from DONE column, the backend recalculated progress
      // Update the milestones state to reflect the new progress
      if (response.milestoneId) {
        setMilestones((prevMilestones) =>
          prevMilestones.map((milestone) =>
            milestone.id === response.milestoneId
              ? {
                  ...milestone,
                  // Store progress info in milestone for display
                  // (Milestone type doesn't have progress field, but UI uses tasksByMilestone)
                }
              : milestone
          )
        );

        // Log for debugging
        console.log(
          `✅ Milestone ${response.milestoneId} progress updated: ${response.milestoneProgress}% (${response.completedTasks}/${response.totalTasks})`
        );
      }
    } catch (err: any) {
      // Rollback on error
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
        specFeatureId: newSpecFeatureId || undefined,
        startDate: newStartDate || undefined,
        dueDate: newDueDate || undefined,
      });

      setBoard((prev) => ({
        ...prev,
        TODO: [created, ...prev.TODO],
      }));

      // Reset form fields
      setIsModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewSpecFeatureId("");
      setNewStartDate("");
      setNewDueDate("");
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
              onClick={() => setViewMode("summary")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === "summary"
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <BarChart2 className="h-4 w-4" />
              Summary
            </button>
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
          {/* Hide New Task button for CLIENT users (read-only mode) */}
          {!isReadOnly && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
            >
              + New Task
            </button>
          )}
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
            {isReadOnly
              ? "The team will create milestones soon. Check back later."
              : "Create your first milestone to start adding tasks for this project."}
          </p>
          {/* Hide Create Milestone button for CLIENT users (read-only mode) */}
          {!isReadOnly && (
            <button
              onClick={handleCreateMilestone}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              + Create Milestone
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Milestone Approval Card - Show when progress is 100% */}
          {activeMilestone &&
           activeProgress === 100 &&
           activeMilestone.status !== "COMPLETED" &&
           activeMilestone.status !== "PAID" &&
           canApproveMilestone && (
            <MilestoneApprovalCard
              milestone={activeMilestone}
              tasks={activeTasks}
              progress={activeProgress}
              onApprove={handleApproveMilestone}
              onRaiseDispute={handleRaiseDispute}
            />
          )}

          <MilestoneTabs
            milestones={milestones}
            selectedId={selectedMilestoneId || undefined}
            tasksMap={tasksByMilestone}
            onSelect={handleSelectMilestone}
            onAdd={isReadOnly ? undefined : handleCreateMilestone}
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
          {viewMode === "summary" ? (
             <ProjectOverview milestones={milestones} tasks={allTasks} />
          ) : viewMode === "board" ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              {/* JIRA STYLE TOOLBAR */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                
                {/* LEFT: SEARCH & QUICK FILTERS */}
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  {/* Search Input (Integrated look) */}
                  <div className="relative group w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-transparent hover:bg-slate-100 focus:bg-white focus:border-teal-500 rounded-md text-sm transition-all outline-none"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full text-slate-400"
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                  {/* "Only My Issues" Button */}
                  {!isReadOnly && (
                    <button
                      onClick={() => {
                        const newState = !isMyTasksFilter;
                        setIsMyTasksFilter(newState);
                        if (newState) setSelectedAssigneeId(null); // Clear specific assignee if selecting "Mine"
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                        isMyTasksFilter
                          ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="relative flex h-2 w-2">
                         <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75 ${isMyTasksFilter ? 'block' : 'hidden'}`}></span>
                         <span className={`relative inline-flex rounded-full h-2 w-2 ${isMyTasksFilter ? 'bg-teal-500' : 'bg-slate-400'}`}></span>
                      </span>
                      My Issues
                    </button>
                  )}
                </div>

                {/* RIGHT: ASSIGNEES & CLEAR */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center -space-x-2 overflow-hidden py-1 pl-1">
                    {uniqueAssignees.map((assignee) => {
                      const isSelected = selectedAssigneeId === assignee.id;
                      return (
                        <button
                          key={assignee.id}
                          onClick={() => {
                            setSelectedAssigneeId(isSelected ? null : assignee.id);
                            setIsMyTasksFilter(false); // Disable "My Issues" if picking specific person
                          }}
                          className={`relative transition-transform hover:z-10 hover:scale-110 focus:outline-none ${isSelected ? 'z-20 scale-110' : ''}`}
                          title={assignee.name}
                        >
                          <div className={`h-8 w-8 rounded-full border-2 border-white ${isSelected ? 'ring-2 ring-teal-500 ring-offset-2' : ''}`}>
                             <img 
                               src={assignee.avatar || `https://ui-avatars.com/api/?name=${assignee.name}&background=random`} 
                               alt={assignee.name}
                               className="h-full w-full rounded-full object-cover bg-slate-200" 
                             />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Clear All Button (Only show if filters active) */}
                  {(searchQuery || selectedAssigneeId || isMyTasksFilter) && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedAssigneeId(null);
                        setIsMyTasksFilter(false);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              <div className="flex xl:grid xl:grid-cols-4 gap-4 overflow-x-auto xl:overflow-visible pb-4 h-full items-start">
                {columns.map((col) => (
                  <div key={col.key} className="min-w-[280px] xl:min-w-0 xl:w-auto flex-shrink-0">
                    <KanbanColumn
                      key={col.key}
                      columnId={col.key}
                      title={col.title}
                      description={col.description}
                      tasks={processedBoard[col.key]}
                      onAddTask={openCreateModal}
                      onTaskClick={handleViewTaskDetails}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                ))}
              </div>
            </DragDropContext>
          ) : (
            <CalendarView
              tasks={allTasks}
              onViewTaskDetails={handleViewTaskDetails}
            />
          )}
        </>
      )}

      <CreateTaskModal
        open={isModalOpen}
        title={newTitle}
        description={newDescription}
        milestoneId={selectedMilestoneId || undefined}
        specFeatureId={newSpecFeatureId}
        startDate={newStartDate}
        dueDate={newDueDate}
        isSubmitting={isSubmitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTask}
        onChangeTitle={setNewTitle}
        onChangeDescription={setNewDescription}
        onChangeSpecFeature={setNewSpecFeatureId}
        onChangeStartDate={setNewStartDate}
        onChangeDueDate={setNewDueDate}
      />

      {/* Task Detail Modal - View & Submit Work */}
      <TaskDetailModal
        isOpen={isTaskDetailOpen}
        task={selectedTask}
        onClose={handleCloseTaskDetail}
        onUpdate={handleTaskUpdate}
        onSubmitTask={handleSubmitTask}
      />

    </div>
  );
}
