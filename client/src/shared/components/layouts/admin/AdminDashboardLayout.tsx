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
    <div className="flex min-h-screen bg-slate-50/50">
      {/* Desktop Sidebar */}
      <div className="hidden self-start lg:sticky lg:top-0 lg:block lg:h-screen">
        <AdminSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-50"
            onClick={handleMobileMenuToggle}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50">
            <AdminSidebar className="flex" />
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <ClientHeader
          onMenuToggle={handleMobileMenuToggle}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className="flex min-w-0 flex-1 flex-col p-6">
          <div className="max-w-7xl mx-auto w-full flex-1">{children}</div>
          {showFooter && <ClientFooter />}
        </main>
      </div>
    </div>
  );
};
