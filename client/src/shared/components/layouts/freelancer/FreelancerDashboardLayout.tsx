/**
 * FreelancerDashboardLayout Component
 * Main layout wrapper for freelancer-facing pages
 */

import React, { useState } from "react";
import { FreelancerSidebar } from "./FreelancerSidebar";
import { ClientHeader } from "../client/ClientHeader";
import { ClientFooter } from "../client/ClientFooter";

interface FreelancerDashboardLayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
  contentMode?: "default" | "hearing-room";
}

export const FreelancerDashboardLayout: React.FC<
  FreelancerDashboardLayoutProps
> = ({ children, showFooter = true, contentMode = "default" }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const contentContainerClass =
    contentMode === "hearing-room"
      ? "w-full flex-1"
      : "max-w-7xl mx-auto w-full flex-1";

  const mainClass =
    contentMode === "hearing-room"
      ? "flex-1 overflow-y-auto overflow-x-hidden px-[2.5%] py-3 flex flex-col"
      : "flex-1 overflow-y-auto overflow-x-hidden p-6 flex flex-col";

  return (
    <div className="flex h-screen bg-slate-50/50 overflow-hidden">
      <FreelancerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {isMobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-50"
            onClick={handleMobileMenuToggle}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50">
            <FreelancerSidebar className="flex" />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <ClientHeader
          onMenuToggle={handleMobileMenuToggle}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className={mainClass}>
          <div className={contentContainerClass}>{children}</div>
          {showFooter && <ClientFooter />}
        </main>
      </div>
    </div>
  );
};
