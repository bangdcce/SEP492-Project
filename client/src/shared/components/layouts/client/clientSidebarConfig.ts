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
    id: "create-request",
    label: "Create Request",
    icon: PlusCircle,
    path: "/client/wizard",
    description: "Create new project request",
    section: "workspace",
  },
];

/**
 * Section titles for grouped menu display
 */
export const sectionTitles: Record<string, string> = {
  main: "Main",
  workspace: "Workspace",
};
