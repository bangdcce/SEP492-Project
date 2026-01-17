/**
 * ClientDashboardLayout Component
 * Main layout wrapper for client-facing pages
 */

import React, { useState } from "react";
import { ClientSidebar } from "./ClientSidebar";
import { ClientHeader } from "./ClientHeader";
import { ClientFooter } from "./ClientFooter";

interface ClientDashboardLayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
}

export const ClientDashboardLayout: React.FC<ClientDashboardLayoutProps> = ({
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
      {/* Sidebar Area */}
      <ClientSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-30"
            onClick={handleMobileMenuToggle}
          />
          {/* Sidebar */}
          <div className="lg:hidden fixed inset-y-0 left-0 z-40">
            <ClientSidebar className="flex" />
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
