/**
 * Admin Sidebar Configuration
 * Menu items for Admin Dashboard
 */

import type { LucideIcon } from "lucide-react";
import { 
  LayoutDashboard, 
  ScrollText, 
  Shield,
  Star,
  Users,
  FileText,
  BarChart3,
  Settings
} from "lucide-react";

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  description?: string;
}

export const sidebarMenuItems: SidebarMenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin/dashboard",
    description: "Overview and statistics",
  },
  {
    id: "audit-logs",
    label: "System Logs",
    icon: ScrollText,
    path: "/admin/audit-logs",
    description: "View all system activities",
  },
  {
    id: "review-moderation",
    label: "Review Moderation",
    icon: Shield,
    path: "/admin/reviews",
    description: "Moderate user reviews",
  },
  {
    id: "trust-profiles",
    label: "Trust Profiles",
    icon: Star,
    path: "/admin/trust-profiles",
    description: "User trust scores & badges",
  },
  {
    id: "freelancers",
    label: "Freelancers",
    icon: Users,
    path: "/admin/freelancers",
    description: "Manage freelancers",
  },
  {
    id: "projects",
    label: "Projects",
    icon: FileText,
    path: "/admin/projects",
    description: "View all projects",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    path: "/admin/analytics",
    description: "Platform analytics",
  },
  {
    id: "project-requests",
    label: "Project Requests",
    icon: FileText,
    path: "/project-requests",
    description: "Manage project requests",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    path: "/admin/settings",
    description: "System settings",
  },
];
