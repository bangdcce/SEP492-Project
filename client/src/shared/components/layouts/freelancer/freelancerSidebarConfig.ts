/**
 * Freelancer Sidebar Configuration
 * Menu items for Freelancer Dashboard
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Search,
  FileText,
  Inbox,
  CheckSquare,
  Briefcase,
  User,
  Video,
  Scale,
  ShieldCheck,
  FileSignature,
  WalletCards,
  CreditCard,
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
    label: "Marketplace",
    icon: Search,
    path: "/freelancer/marketplace",
    description: "Browse phase-3 freelancer hiring requests",
    section: "workspace",
  },
  {
    id: "invitations",
    label: "Invitations",
    icon: Inbox,
    path: "/freelancer/invitations",
    description: "Review client invitations",
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
    id: "hearings",
    label: "Calendar & Hearings",
    icon: Video,
    path: "/freelancer/hearings",
    description: "Meetings, confirmations, and dispute hearings",
    section: "workspace",
  },
  {
    id: "disputes",
    label: "Disputes",
    icon: Scale,
    path: "/freelancer/disputes",
    description: "Track dispute history, verdicts, and appeals",
    section: "workspace",
  },
  {
    id: "contracts",
    label: "Contracts",
    icon: FileSignature,
    path: "/freelancer/contracts",
    description: "Review and sign contracts",
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
  {
    id: "kyc-status",
    label: "KYC Status",
    icon: ShieldCheck,
    path: "/freelancer/kyc-status",
    description: "Verify your identity",
    section: "account",
  },
  {
    id: "billing",
    label: "Earnings Wallet",
    icon: WalletCards,
    path: "/freelancer/billing",
    description: "Track released earnings and wallet history",
    section: "account",
  },
  {
    id: "subscription",
    label: "Subscription",
    icon: CreditCard,
    path: "/freelancer/subscription",
    description: "Manage your premium plan",
    section: "account",
  },
];

export const sectionTitles: Record<string, string> = {
  main: "Main",
  workspace: "Workspace",
  account: "Account",
};
