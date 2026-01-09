/**
 * ClientSidebar Component
 * Sidebar navigation for client dashboard
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clientSidebarMenuItems, sectionTitles } from "./clientSidebarConfig";
import type { ClientSidebarMenuItem } from "./clientSidebarConfig";
import { Logo } from "../../custom/Logo";

interface ClientSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ClientSidebar: React.FC<ClientSidebarProps> = ({
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const location = useLocation();

  // Group items by section
  const groupedItems = clientSidebarMenuItems.reduce((acc, item) => {
    const section = item.section || "main";
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, ClientSidebarMenuItem[]>);

  return (
    <aside
      className={`
        fixed top-0 left-0 h-screen bg-white border-r border-gray-200
        transition-all duration-300 ease-in-out z-40 flex flex-col
        ${isCollapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Logo */}
      <div
        className={`p-4 border-b border-gray-200 ${
          isCollapsed ? "flex justify-center" : ""
        }`}
      >
        <Link to="/client/dashboard" className="flex items-center">
          <Logo size="sm" isCollapsed={isCollapsed} />
        </Link>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto py-6">
        {/* Navigation Sections */}
        <nav className="px-3 space-y-6">
          {Object.entries(groupedItems).map(([section, items]) => (
            <div key={section}>
              {/* Section Title */}
              {!isCollapsed && (
                <div className="px-3 mb-2">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider">
                    {sectionTitles[section] || section}
                  </h3>
                </div>
              )}

              {/* Menu Items */}
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.path;

                  return (
                    <li key={item.id}>
                      <Link
                        to={item.path}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                          transition-all duration-150 relative group
                          ${
                            active
                              ? "bg-teal-50 text-teal-600"
                              : "text-gray-700 hover:bg-gray-50"
                          }
                          ${isCollapsed ? "justify-center" : ""}
                        `}
                      >
                        {/* Icon */}
                        <Icon
                          className={`h-5 w-5 shrink-0 ${
                            active ? "text-teal-600" : ""
                          }`}
                        />

                        {/* Label - Hidden when collapsed */}
                        {!isCollapsed && (
                          <span className="text-sm flex-1">{item.label}</span>
                        )}

                        {/* Badge - Only visible when expanded */}
                        {!isCollapsed && item.badge && (
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-md">
                            {item.badge}
                          </span>
                        )}

                        {/* Tooltip - Only visible when collapsed */}
                        {isCollapsed && (
                          <div
                            className="
                            absolute left-full ml-2 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg
                            opacity-0 invisible group-hover:opacity-100 group-hover:visible
                            transition-all duration-200 whitespace-nowrap z-50 pointer-events-none
                          "
                          >
                            {item.label}
                            {item.badge && (
                              <span className="ml-2 px-1.5 py-0.5 bg-teal-500 text-white text-xs rounded">
                                {item.badge}
                              </span>
                            )}
                            {/* Arrow */}
                            <div
                              className="
                              absolute right-full top-1/2 -translate-y-1/2
                              border-4 border-transparent border-r-slate-900
                            "
                            />
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Collapse Toggle Button */}
      {onToggleCollapse && (
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center gap-2 p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </aside>
  );
};
