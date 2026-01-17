/**
 * Freelancer Sidebar Configuration
 * Menu items for Freelancer Dashboard
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Search,
  FileText,
  CheckSquare,
  Briefcase,
  User,
} from "lucide-react";

export interface FreelancerSidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  description?: string;
  section?: "main" | "workspace" | "account";
}

export const freelancerSidebarMenuItems: FreelancerSidebarMenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutGrid,
    path: "/freelancer/dashboard",
    description: "Your overview",
    section: "main",
  },
  {
    id: "find-work",
    label: "Find Work",
    icon: Search,
    path: "/freelancer/find-work",
    description: "Discover new projects",
    section: "workspace",
  },
  {
    id: "proposals",
    label: "My Proposals",
    icon: FileText,
    path: "/freelancer/proposals",
    description: "Your submissions",
    section: "workspace",
  },
  {
    id: "jobs",
    label: "My Jobs",
    icon: CheckSquare,
    path: "/freelancer/jobs",
    description: "Active engagements",
    section: "workspace",
  },
  {
    id: "projects",
    label: "My Projects",
    icon: Briefcase,
    path: "/freelancer/projects",
    description: "Manage your projects",
    section: "workspace",
  },
  {
    id: "profile",
    label: "Profile",
    icon: User,
    path: "/freelancer/profile",
    description: "Manage your profile",
    section: "account",
  },
];

export const sectionTitles: Record<string, string> = {
  main: "Main",
  workspace: "Workspace",
  account: "Account",
};
