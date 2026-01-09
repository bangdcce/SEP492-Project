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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <ClientSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
            onClick={handleMobileMenuToggle}
          />
          {/* Sidebar */}
          <div className="lg:hidden fixed inset-y-0 left-0 z-40">
            <ClientSidebar />
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div
        className={`
          flex flex-col min-h-screen
          transition-all duration-300 ease-in-out
          ${isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}
        `}
      >
        {/* Header */}
        <ClientHeader
          onMenuToggle={handleMobileMenuToggle}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8">{children}</main>

        {/* Footer */}
        {showFooter && <ClientFooter />}
      </div>
    </div>
  );
};
