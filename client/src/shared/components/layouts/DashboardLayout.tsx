import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { adminMenuItems, brokerMenuItems, sidebarMenuItems } from "./sidebarConfig";
import { STORAGE_KEYS } from "@/constants";

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Determine menu items based on user role
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  const user = userStr ? JSON.parse(userStr) : null;
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

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        menuItems={menuItems}
        activePath={location.pathname}
        onNavigate={handleNavigate}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      <div
        className={`
          transition-all duration-300 ease-in-out
          ${isSidebarCollapsed ? "ml-20" : "ml-64"}
        `}
      >
        <Header breadcrumbs={breadcrumbs} />

        <main className="p-8">{children}</main>
      </div>
    </div>
  );
};
