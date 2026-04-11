import type { KanbanBoard, KanbanColumnKey, Task } from "./types";

export const BOARD_COLUMNS: KanbanColumnKey[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

export const createEmptyBoard = (): KanbanBoard => ({
  TODO: [],
  IN_PROGRESS: [],
  IN_REVIEW: [],
  DONE: [],
});

type TaskLocation = {
  columnKey: KanbanColumnKey;
  index: number;
};

export type BoardAssigneeOption = {
  id: string;
  name: string;
  avatar?: string;
};

export type BoardMeta = {
  allTasks: Task[];
  taskMap: Map<string, Task>;
  tasksByMilestone: Record<string, Task[]>;
  uniqueAssignees: BoardAssigneeOption[];
};

const findTaskLocation = (board: KanbanBoard, taskId: string): TaskLocation | null => {
  for (const columnKey of BOARD_COLUMNS) {
    const index = board[columnKey].findIndex((task) => task.id === taskId);
    if (index >= 0) {
      return { columnKey, index };
    }
  }

  return null;
};

export const upsertTaskInBoard = (board: KanbanBoard, incomingTask: Task): KanbanBoard => {
  const taskId = incomingTask.id;
  const targetColumn = incomingTask.status;
  const location = findTaskLocation(board, taskId);

  if (!location) {
    return {
      ...board,
      [targetColumn]: [incomingTask, ...board[targetColumn]],
    };
  }

  if (location.columnKey === targetColumn) {
    const currentColumn = board[targetColumn];
    if (currentColumn[location.index] === incomingTask) {
      return board;
    }

    const nextColumn = currentColumn.slice();
    nextColumn[location.index] = incomingTask;
    return {
      ...board,
      [targetColumn]: nextColumn,
    };
  }

  const nextSourceColumn = board[location.columnKey].filter((task) => task.id !== taskId);
  return {
    ...board,
    [location.columnKey]: nextSourceColumn,
    [targetColumn]: [incomingTask, ...board[targetColumn]],
  };
};

export const moveTaskInBoard = (
  board: KanbanBoard,
  params: {
    fromColumn: KanbanColumnKey;
    toColumn: KanbanColumnKey;
    sourceIndex: number;
    destinationIndex: number;
    transformTask?: (task: Task) => Task;
  },
): { board: KanbanBoard; task: Task } | null => {
  const { fromColumn, toColumn, sourceIndex, destinationIndex, transformTask } = params;
  const sourceTasks = board[fromColumn];
  const movedTask = sourceTasks[sourceIndex];

  if (!movedTask) {
    return null;
  }

  const nextTask = transformTask ? transformTask(movedTask) : movedTask;

  if (fromColumn === toColumn) {
    const nextColumn = sourceTasks.slice();
    nextColumn.splice(sourceIndex, 1);
    nextColumn.splice(destinationIndex, 0, nextTask);

    return {
      board: {
        ...board,
        [fromColumn]: nextColumn,
      },
      task: nextTask,
    };
  }

  const nextSourceColumn = sourceTasks.slice();
  nextSourceColumn.splice(sourceIndex, 1);

  const nextTargetColumn = board[toColumn].slice();
  nextTargetColumn.splice(destinationIndex, 0, nextTask);

  return {
    board: {
      ...board,
      [fromColumn]: nextSourceColumn,
      [toColumn]: nextTargetColumn,
    },
    task: nextTask,
  };
};

export const buildBoardMeta = (board: KanbanBoard): BoardMeta => {
  const allTasks: Task[] = [];
  const taskMap = new Map<string, Task>();
  const tasksByMilestone: Record<string, Task[]> = {};
  const assigneeMap = new Map<string, BoardAssigneeOption>();

  for (const columnKey of BOARD_COLUMNS) {
    for (const task of board[columnKey]) {
      allTasks.push(task);
      taskMap.set(task.id, task);

      if (task.milestoneId) {
        if (!tasksByMilestone[task.milestoneId]) {
          tasksByMilestone[task.milestoneId] = [];
        }
        tasksByMilestone[task.milestoneId].push(task);
      }

      if (task.assignee?.id) {
        assigneeMap.set(task.assignee.id, {
          id: task.assignee.id,
          name: task.assignee.fullName || "Unknown",
          avatar: task.assignee.avatarUrl,
        });
      }
    }
  }

  return {
    allTasks,
    taskMap,
    tasksByMilestone,
    uniqueAssignees: Array.from(assigneeMap.values()),
  };
};
