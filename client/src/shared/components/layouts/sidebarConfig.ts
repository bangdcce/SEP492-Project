/**
 * Admin Sidebar Configuration
 * Menu items for Admin Dashboard
 */

import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, ScrollText, Shield } from "lucide-react";

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
];
