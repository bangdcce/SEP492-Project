import type { Task } from "./types";

export const calculateProgress = (tasks?: Task[] | null): number => {
  if (!tasks || tasks.length === 0) return 0;
  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  return Math.round((doneCount / tasks.length) * 100);
};
