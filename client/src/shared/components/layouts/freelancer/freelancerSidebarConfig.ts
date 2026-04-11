/**
 * Freelancer Sidebar Configuration
 * Menu items for Freelancer Dashboard
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Inbox,
  Search,
  Briefcase,
  FolderOpen,
  User,
  Video,
  Scale,
  ShieldCheck,
  FileSignature,
  WalletCards,
  CreditCard,
} from "lucide-react";
import { ROUTES } from "@/constants";

export interface FreelancerSidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  description?: string;
  activePatterns?: string[];
  activeExclusions?: string[];
  section?: "main" | "workspace" | "account";
}

export const freelancerSidebarMenuItems: FreelancerSidebarMenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutGrid,
    path: ROUTES.FREELANCER_DASHBOARD,
    description: "Your overview",
    section: "main",
  },
  {
    id: "find-work",
    label: "Marketplace",
    icon: Search,
    path: ROUTES.FREELANCER_MARKETPLACE,
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
    id: "invited-requests",
    label: "Requests",
    icon: FolderOpen,
    path: "/freelancer/requests",
    description: "Open invited requests and continue workflow",
    section: "workspace",
  },
  {
    id: "projects",
    label: "My Projects",
    icon: Briefcase,
    path: ROUTES.FREELANCER_PROJECTS,
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
    path: ROUTES.FREELANCER_DISPUTES,
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
    path: ROUTES.FREELANCER_PROFILE,
    description: "Manage your profile",
    section: "account",
  },
  {
    id: "kyc-status",
    label: "KYC Status",
    icon: ShieldCheck,
    path: ROUTES.FREELANCER_KYC_STATUS,
    description: "Verify your identity",
    section: "account",
  },
  {
    id: "billing",
    label: "Earnings Wallet",
    icon: WalletCards,
    path: ROUTES.FREELANCER_BILLING,
    description: "Track released earnings and wallet history",
    section: "account",
  },
  {
    id: "subscription",
    label: "Subscription",
    icon: CreditCard,
    path: ROUTES.FREELANCER_SUBSCRIPTION,
    description: "Manage your premium plan",
    section: "account",
  },
];

export const sectionTitles: Record<string, string> = {
  main: "Main",
  workspace: "Workspace",
  account: "Account",
};
