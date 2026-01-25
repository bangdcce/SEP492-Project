import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { adminMenuItems, brokerMenuItems, sidebarMenuItems } from "./sidebarConfig";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";

interface DashboardLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: string[];
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  breadcrumbs = [],
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Determine menu items based on user role
  const user = getStoredJson<any>(STORAGE_KEYS.USER);
  const role = user?.role;

  const menuItems =
    role === "BROKER"
      ? brokerMenuItems
      : role === "ADMIN"
      ? adminMenuItems
      : sidebarMenuItems; // Default/Fallback

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex">
      <Sidebar
        menuItems={menuItems}
        activePath={location.pathname}
        onNavigate={handleNavigate}
      />

      <div className="flex-1 min-w-0">
        <Header breadcrumbs={breadcrumbs} />

        <main className="p-8">{children}</main>
      </div>
    </div>
  );
};
