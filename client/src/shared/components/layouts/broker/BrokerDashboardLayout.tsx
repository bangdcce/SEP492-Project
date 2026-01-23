/**
 * BrokerDashboardLayout Component
 * Main layout wrapper for broker-facing pages
 */

import React, { useState } from "react";
import { BrokerSidebar } from "./BrokerSidebar";
import { ClientHeader } from "../client/ClientHeader";
import { ClientFooter } from "../client/ClientFooter";

interface BrokerDashboardLayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
}

export const BrokerDashboardLayout: React.FC<BrokerDashboardLayoutProps> = ({
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
    <div className="flex h-screen bg-slate-50/50 overflow-hidden">
      {/* Desktop Sidebar */}
      <BrokerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-50"
            onClick={handleMobileMenuToggle}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50">
            <BrokerSidebar className="flex" />
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
