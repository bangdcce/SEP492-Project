import { apiClient } from "@/shared/api/client";
import type { Project } from "./types";

export const fetchProjectsByUser = async (userId: string): Promise<Project[]> => {
  return apiClient.get<Project[]>(`/projects/list/${userId}`);
};
