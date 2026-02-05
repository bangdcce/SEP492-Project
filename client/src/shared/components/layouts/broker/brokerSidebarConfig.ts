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
  FileSignature,
  Video,
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
    id: "my-invitations",
    label: "My Invitations",
    icon: FileSearch, // Reusing icon or import Mail if needed, but FileSearch is fine for now or import new one. 
    // Wait, let's use a better icon if possible. "Mail" is not imported. 
    // I will use FileSearch for now to avoid import errors or check imports.
    // Actually, let's check imports. FileSearch, Briefcase, Users etc are imported. 
    // I'll stick to FileSearch or maybe add Mail to imports if I can.
    // To be safe and quick, I'll use FileSearch (or maybe Briefcase?) 
    // Let's use FileSearch matching "Project Requests" style or just duplicate.
    // Actually, "FileSignature" is used for Contracts. 
    // Let's just use "FileSearch" for "My Invitations" as well for now.
    path: "/broker/invitations",
    description: "Job invitations",
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
    id: "hearings",
    label: "Hearings",
    icon: Video,
    path: "/broker/hearings",
    description: "Upcoming dispute hearings",
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
  {
    id: "contracts",
    label: "Contracts",
    icon: FileSignature,
    path: "/broker/contracts",
    description: "Manage project contracts",
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
