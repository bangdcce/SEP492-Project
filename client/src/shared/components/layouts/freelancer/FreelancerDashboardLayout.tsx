/**
 * FreelancerDashboardLayout Component
 * Main layout wrapper for freelancer-facing pages
 */

import React, { useState } from "react";
import { FreelancerSidebar } from "./FreelancerSidebar";
import { ClientHeader } from "../client/ClientHeader";
import { ClientFooter } from "../client/ClientFooter";
import { useCaptureMode } from "@/shared/hooks";

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
  const isCaptureMode = useCaptureMode();

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
      ? "flex min-w-0 flex-1 flex-col px-[2.5%] py-3"
      : "flex min-w-0 flex-1 flex-col p-6";

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <div className="hidden self-start lg:sticky lg:top-0 lg:block lg:h-screen">
        <FreelancerSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
      </div>

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

      <div className="relative flex min-w-0 flex-1 flex-col">
        <ClientHeader
          onMenuToggle={handleMobileMenuToggle}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className={mainClass}>
          <div className={contentContainerClass}>{children}</div>
          {showFooter && !isCaptureMode && <ClientFooter />}
        </main>
      </div>
    </div>
  );
};
