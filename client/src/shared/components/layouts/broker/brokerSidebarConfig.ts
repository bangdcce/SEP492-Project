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
  ShieldCheck,
  Mail,
  CreditCard,
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
    id: "marketplace",
    label: "Marketplace",
    icon: FileSearch,
    path: "/broker/marketplace",
    description: "Browse and claim requests",
    section: "workspace",
  },
  {
    id: "my-requests",
    label: "My Requests",
    icon: Briefcase,
    path: "/broker/my-requests",
    description: "Your assigned requests",
    section: "workspace",
  },
  {
    id: "my-invitations",
    label: "My Invitations",
    icon: Mail,
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
    label: "Calendar & Hearings",
    icon: Video,
    path: "/broker/hearings",
    description: "Meetings, confirmations, and dispute hearings",
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
  {
    id: "kyc-status",
    label: "KYC Status",
    icon: ShieldCheck,
    path: "/broker/kyc-status",
    description: "Verify your identity",
    section: "account",
  },
  {
    id: "subscription",
    label: "Subscription",
    icon: CreditCard,
    path: "/broker/subscription",
    description: "Manage your premium plan",
    section: "account",
  },
];

export const sectionTitles: Record<string, string> = {
  main: "Main",
  workspace: "Workspace",
  account: "Account",
};
