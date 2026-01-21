import React, { useEffect, useState } from "react";
import { sidebarMenuItems } from "./sidebarConfig";
import type { SidebarMenuItem } from "./sidebarConfig";
import { ChevronLeft } from "lucide-react";
import { Logo } from "../custom/Logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui";

const STORAGE_KEY = "sidebar_collapsed";

interface SidebarProps {
  activePath: string;
  onNavigate: (path: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  menuItems?: SidebarMenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePath,
  onNavigate,
  isCollapsed: isCollapsedProp,
  onToggleCollapse,
  menuItems = sidebarMenuItems,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const collapsed = isCollapsedProp ?? isCollapsed;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  const handleToggleCollapse = () => {
    onToggleCollapse?.();
    if (isCollapsedProp === undefined) {
      setIsCollapsed((prev) => !prev);
    }
  };
  const isActive = (item: SidebarMenuItem) => activePath === item.path;

  return (
    <aside
      className={`
        sticky top-0 h-screen flex flex-col border-r border-slate-200 bg-white/50 backdrop-blur-xl relative
        transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${collapsed ? "w-[70px]" : "w-64"}
      `}
    >
      {/* Logo Section - Always visible, centered, 3/4 of container */}
      <div
        className={`
        h-20 px-4 py-4 flex items-center border-b border-slate-200/60 transition-all duration-300
        ${collapsed ? "justify-center" : "justify-between"}
      `}
      >
        <Logo
          variant={collapsed ? "icon" : "full"}
          size={collapsed ? "lg" : "md"}
          className={collapsed ? "w-full justify-center" : "flex-1"}
        />
      </div>

      <button
        onClick={handleToggleCollapse}
        type="button"
        className="absolute -right-3 top-9 z-50 h-6 w-6 rounded-full border border-slate-200 bg-white shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronLeft
          size={14}
          className={`transition-transform duration-200 ${
            collapsed ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            const button = (
              <button
                onClick={() => onNavigate(item.path)}
                className={`
                  w-full h-10 flex items-center rounded-lg px-3
                  transition-colors duration-150 relative group
                  ${
                    active
                      ? "bg-teal-50 text-teal-700 font-medium"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }
                  ${collapsed ? "justify-center" : "justify-start"}
                `}
                aria-label={collapsed ? item.label : undefined}
              >
                {/* Active indicator bar */}
                {active && (
                  <span className="absolute left-0 top-1 bottom-1 w-1 bg-teal-500 rounded-r" />
                )}

                <Icon className="h-5 w-5 flex-shrink-0" />

                <span
                  className={`
                    whitespace-nowrap overflow-hidden transition-all duration-300 origin-left text-sm
                    ${collapsed ? "w-0 opacity-0 -translate-x-2 ml-0" : "w-auto opacity-100 translate-x-0 ml-3"}
                  `}
                >
                  {item.label}
                </span>
              </button>
            );

            return (
              <li key={item.id}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent
                      side="right"
                      sideOffset={8}
                      className="bg-slate-900 text-white"
                    >
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  button
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200/60">
        <span
          className={`
            text-xs text-gray-500 whitespace-nowrap overflow-hidden transition-all duration-300 origin-left
            ${collapsed ? "w-0 opacity-0 -translate-x-2" : "w-auto opacity-100 translate-x-0"}
          `}
        >
          Ac 2025 InterDev
        </span>
      </div>
    </aside>
  );
};
