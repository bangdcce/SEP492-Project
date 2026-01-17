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
  className?: string;
}

export const ClientSidebar: React.FC<ClientSidebarProps> = ({
  isCollapsed = false,
  onToggleCollapse,
  className,
}) => {
  const location = useLocation();
  const displayClassName = className === undefined ? "hidden lg:flex" : className;

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
        ${displayClassName} h-full flex-shrink-0 bg-white border-r border-gray-200
        transition-all duration-200 ease-in-out flex flex-col
        ${isCollapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Logo */}
      <div
        className={`h-14 border-b border-gray-200 flex items-center ${
          isCollapsed ? "justify-center px-0" : "justify-between pr-4"
        }`}
      >
        <Link
          to="/client/dashboard"
          className={`flex items-center min-w-0 transition-all duration-300 ${
            isCollapsed ? "justify-center w-full" : "pl-6"
          }`}
        >
          <div className="transition-all duration-300">
            {isCollapsed ? (
              <Logo size="lg" variant="icon" />
            ) : (
              <Logo size="md" variant="full" />
            )}
          </div>
        </Link>
        {onToggleCollapse && !isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {/* Collapsed Expand Button */}
      {onToggleCollapse && isCollapsed && (
        <div className="h-12 flex items-center justify-center border-b border-gray-200">
          <button
            onClick={onToggleCollapse}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto py-4">
        {/* Navigation Sections */}
        <nav className="px-2 space-y-4">
          {Object.entries(groupedItems).map(([section, items]) => (
            <div key={section}>
              {/* Section Title */}
              {!isCollapsed && (
                <div className="px-3 mb-2">
                  <h3 className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">
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
                          w-full flex items-center gap-3 py-2 px-3 rounded-r-md
                          transition-colors duration-150 relative group border-l-4
                          ${
                            active
                              ? "bg-teal-50 text-teal-700 border-teal-600 font-medium"
                              : "text-gray-700 border-transparent hover:bg-gray-50 hover:text-gray-900"
                          }
                          ${isCollapsed ? "justify-center" : ""}
                        `}
                      >
                        {/* Icon */}
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            active ? "text-teal-700" : ""
                          }`}
                        />

                        {/* Label - Hidden when collapsed */}
                        {!isCollapsed && (
                          <span className="text-sm flex-1">{item.label}</span>
                        )}

                        {/* Badge - Only visible when expanded */}
                        {!isCollapsed && item.badge && (
                          <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 text-[10px] rounded">
                            {item.badge}
                          </span>
                        )}

                        {/* Tooltip - Only visible when collapsed */}
                        {isCollapsed && (
                          <div
                            className="
                            absolute left-full ml-2 px-2.5 py-2 bg-slate-900 text-white text-xs rounded-md
                            opacity-0 invisible group-hover:opacity-100 group-hover:visible
                            transition-all duration-200 whitespace-nowrap z-50 pointer-events-none
                          "
                          >
                            {item.label}
                            {item.badge && (
                              <span className="ml-2 px-1.5 py-0.5 bg-teal-500 text-white text-[10px] rounded">
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

    </aside>
  );
};
