import React from "react";
import { sidebarMenuItems } from "./sidebarConfig";
import type { SidebarMenuItem } from "./sidebarConfig";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Logo } from "../custom/Logo";

interface SidebarProps {
  activePath: string;
  onNavigate: (path: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePath,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
}) => {
  const isActive = (item: SidebarMenuItem) => activePath === item.path;

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-white border-r border-gray-200 flex flex-col
        transition-all duration-300 ease-in-out
        ${isCollapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Logo Section - Always visible, centered, 3/4 of container */}
      <div
        className={`
        h-20 px-4 py-4 flex items-center border-b border-gray-100
        ${isCollapsed ? "justify-center" : "justify-between"}
      `}
      >
        <Logo
          isCollapsed={isCollapsed}
          className={isCollapsed ? "w-full" : "flex-1"}
        />

        {/* Toggle Button - Only visible when expanded */}
        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-3"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Collapsed State - Expand Button */}
      {isCollapsed && (
        <div className="h-14 flex justify-center items-center border-b border-gray-100">
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {sidebarMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.path)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-150 relative group
                    ${
                      active
                        ? "bg-teal-50 text-teal-600"
                        : "text-gray-700 hover:bg-slate-50"
                    }
                    ${isCollapsed ? "justify-center" : ""}
                  `}
                  title={isCollapsed ? item.label : undefined}
                >
                  {/* Active indicator bar */}
                  {active && (
                    <span className="absolute left-0 top-1 bottom-1 w-1 bg-teal-500 rounded-r" />
                  )}

                  <Icon className="h-5 w-5 flex-shrink-0" />

                  {/* Label - Hidden when collapsed */}
                  {!isCollapsed && (
                    <span className="text-sm">{item.label}</span>
                  )}

                  {/* Tooltip on hover when collapsed */}
                  {isCollapsed && (
                    <span
                      className="
                      absolute left-full ml-6 px-2 py-1 bg-slate-900 text-white text-xs rounded
                      opacity-0 group-hover:opacity-100 pointer-events-none
                      transition-opacity duration-200 whitespace-nowrap z-50
                    "
                    >
                      {item.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className={`
        p-6 border-t border-gray-200
        ${isCollapsed ? "text-center" : ""}
      `}
      >
        {!isCollapsed ? (
          <p className="text-xs text-gray-500">© 2025 InterDev</p>
        ) : (
          <p className="text-xs text-gray-500">©</p>
        )}
      </div>
    </aside>
  );
};
