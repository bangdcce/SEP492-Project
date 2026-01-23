/**
 * AdminDashboardLayout Component
 * Main layout wrapper for admin-facing pages
 */

import React, { useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { ClientHeader } from "../client/ClientHeader";
import { ClientFooter } from "../client/ClientFooter";

interface AdminDashboardLayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
}

export const AdminDashboardLayout: React.FC<AdminDashboardLayoutProps> = ({
  children,
  showFooter = true,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Desktop Sidebar */}
      <AdminSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-30"
            onClick={handleMobileMenuToggle}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 z-40">
            <AdminSidebar className="flex" />
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <ClientHeader
          onMenuToggle={handleMobileMenuToggle}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 flex flex-col">
          <div className="max-w-7xl mx-auto w-full flex-1">{children}</div>
          {showFooter && <ClientFooter />}
        </main>
      </div>
    </div>
  );
};
