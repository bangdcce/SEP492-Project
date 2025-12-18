import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

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

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
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
