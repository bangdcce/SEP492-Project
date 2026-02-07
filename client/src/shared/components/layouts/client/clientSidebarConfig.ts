/**
 * Client Sidebar Configuration
 * Menu items for Client Dashboard
 * Easy to extend - just add new items to the array
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderKanban,
  PlusCircle,
  Briefcase,
  Video,
  ShieldCheck,
} from "lucide-react";

export interface ClientSidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  description?: string;
  section?: "main" | "workspace" | "account";
}

export const sectionTitles: Record<string, string> = {
  main: "Main",
  workspace: "Workspace",
  account: "Account",
};

/**
 * Client sidebar menu items
 * To add new pages, simply add a new object to this array
 */
export const clientSidebarMenuItems: ClientSidebarMenuItem[] = [
  // Main Navigation
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/client/dashboard",
    description: "Your overview",
    section: "main",
  },
  {
    id: "my-requests",
    label: "My Requests",
    icon: FolderKanban,
    path: "/client/my-requests",
    description: "Your project requests",
    section: "workspace",
  },
  {
    id: "projects",
    label: "Projects",
    icon: Briefcase,
    path: "/client/projects",
    description: "Manage and track projects",
    section: "workspace",
  },
  {
    id: "hearings",
    label: "Hearings",
    icon: Video,
    path: "/client/hearings",
    description: "Upcoming dispute hearings",
    section: "workspace",
  },
  {
    id: "create-request",
    label: "Create Request",
    icon: PlusCircle,
    path: "/client/wizard",
    description: "Create new project request",
    section: "workspace",
  },
  {
    id: "kyc-status",
    label: "KYC Status",
    icon: ShieldCheck,
    path: "/client/kyc-status",
    description: "Verify your identity",
    section: "account",
  },
];
