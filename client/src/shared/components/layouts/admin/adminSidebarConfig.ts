/**
 * Admin Sidebar Configuration
 * Menu items for Admin Dashboard
 */

import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  LayoutDashboard,
  Scale,
  ScrollText,
  Shield,
  UserCheck,
  Users,
  User,
  HelpCircle,
  Wallet,
} from "lucide-react";

export interface AdminSidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  description?: string;
  section?: "main" | "management" | "account";
}

export const adminSidebarMenuItems: AdminSidebarMenuItem[] = [
  // Main Navigation
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin/dashboard",
    description: "Overview and statistics",
    section: "main",
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    path: "/admin/finance",
    description: "Platform revenue and treasury wallet",
    section: "main",
  },
  // Management
  {
    id: "audit-logs",
    label: "System Logs",
    icon: ScrollText,
    path: "/admin/audit-logs",
    description: "View all system activities",
    section: "management",
  },
  {
    id: "leave-approvals",
    label: "Leave Approvals",
    icon: CalendarDays,
    path: "/admin/leave",
    description: "Review leave requests and staff quotas",
    section: "management",
  },
  {
    id: "dispute-appeals",
    label: "Appeal Queue",
    icon: Scale,
    path: "/admin/disputes/appeals",
    description: "Review and route dispute appeals",
    section: "management",
  },
  {
    id: "review-moderation",
    label: "Review Moderation",
    icon: Shield,
    path: "/admin/reviews",
    description: "Moderate user reviews",
    section: "management",
  },
  {
    id: "kyc-verification",
    label: "KYC Verification",
    icon: UserCheck,
    path: "/admin/kyc",
    description: "Review KYC submissions",
    section: "management",
  },
  {
    id: "spec-audit",
    label: "Spec Audit",
    icon: Shield,
    path: "/admin/specs",
    description: "Approve project specifications",
    section: "management",
  },
  {
    id: "user-management",
    label: "User Management",
    icon: Users,
    path: "/admin/users",
    description: "Manage users, ban/unban",
    section: "management",
  },
  {
    id: "wizard-questions",
    label: "Wizard Questions",
    icon: HelpCircle,
    path: "/admin/wizard-questions",
    description: "Manage wizard questions",
    section: "management",
  },
  // Account
  {
    id: "profile",
    label: "Profile",
    icon: User,
    path: "/admin/profile",
    description: "Manage your profile",
    section: "account",
  },
];

export const sectionTitles: Record<string, string> = {
  main: "Main",
  management: "Management",
  account: "Account",
};
