/**
 * Admin Sidebar Configuration
 * Menu items for Admin Dashboard
 */

import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, ScrollText, Shield, UserCheck, Users, Search } from "lucide-react";

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  description?: string;
}

export const adminMenuItems: SidebarMenuItem[] = [
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
    id: "kyc-verification",
    label: "KYC Verification",
    icon: UserCheck,
    path: "/admin/kyc",
    description: "Review KYC submissions",
  },
  {
    id: "user-management",
    label: "User Management",
    icon: Users,
    path: "/admin/users",
    description: "Manage users, ban/unban",
  },
];

export const brokerMenuItems: SidebarMenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/broker/dashboard",
    description: "Overview and statistics",
  },
  {
    id: "project-requests",
    label: "Find Requests",
    icon: Search,
    path: "/project-requests",
    description: "Browse and assign to project requests",
  },
];

// Fallback/Default
export const sidebarMenuItems = adminMenuItems;
