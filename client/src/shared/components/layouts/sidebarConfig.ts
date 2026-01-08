import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ScrollText,
  Users,
  FileText,
  Settings,
  BarChart3,
} from "lucide-react";

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

export const sidebarMenuItems: SidebarMenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    id: "my-requests",
    label: "My Requests",
    icon: FileText,
    path: "/requests",
  },
  {
    id: "audit-logs",
    label: "System Logs",
    icon: ScrollText,
    path: "/audit-logs",
  },
  {
    id: "freelancers",
    label: "Freelancers",
    icon: Users,
    path: "/freelancers",
  },
  {
    id: "projects",
    label: "Projects",
    icon: FileText,
    path: "/projects",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    path: "/analytics",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    path: "/settings",
  },
];
