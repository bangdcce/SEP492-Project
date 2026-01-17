/**
 * Broker Sidebar Configuration
 * Menu items for Broker Dashboard
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  FileSearch,
  Briefcase,
  Users,
  User,
} from "lucide-react";

export interface BrokerSidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  description?: string;
  section?: "main" | "workspace" | "account";
}

export const brokerSidebarMenuItems: BrokerSidebarMenuItem[] = [
  // Main Navigation
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutGrid,
    path: "/broker/dashboard",
    description: "Overview and statistics",
    section: "main",
  },
  // Workspace
  {
    id: "project-requests",
    label: "Project Requests",
    icon: FileSearch,
    path: "/project-requests",
    description: "Browse and claim requests",
    section: "workspace",
  },
  {
    id: "manage-projects",
    label: "Manage Projects",
    icon: Briefcase,
    path: "/broker/projects",
    description: "Your active projects",
    section: "workspace",
  },
  {
    id: "freelancers",
    label: "My Freelancers",
    icon: Users,
    path: "/broker/freelancers",
    description: "Assigned freelancers",
    section: "workspace",
  },
  // Account
  {
    id: "profile",
    label: "Profile",
    icon: User,
    path: "/broker/profile",
    description: "Manage your profile",
    section: "account",
  },
];

export const sectionTitles: Record<string, string> = {
  main: "Main",
  workspace: "Workspace",
  account: "Account",
};
