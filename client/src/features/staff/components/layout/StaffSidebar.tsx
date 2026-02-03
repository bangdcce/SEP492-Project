import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  Briefcase,
  Calendar,
  Video,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Logo from "@/assets/logo/logo.png";

interface StaffSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const StaffSidebar = ({ collapsed, onToggle }: StaffSidebarProps) => {
  const menuItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/staff/dashboard" },
    { label: "Dispute Queue", icon: Inbox, path: "/staff/queue" },
    { label: "My Caseload", icon: Briefcase, path: "/staff/caseload" },
    { label: "Calendar", icon: Calendar, path: "/staff/calendar" },
    { label: "Leave", icon: Calendar, path: "/staff/leave" },
    { label: "Hearings", icon: Video, path: "/staff/hearings" },
    { label: "Profile", icon: User, path: "/staff/profile" },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out bg-white border-r border-gray-200
        ${collapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Logo Area */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100">
        <div
          className={`flex items-center gap-3 ${collapsed ? "justify-center w-full" : ""}`}
        >
          <img src={Logo} alt="Logo" className="w-40 h-36 object-contain" />
          {!collapsed && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-700 uppercase tracking-wide">
              Staff
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group font-medium
              ${
                isActive
                  ? "bg-teal-50 text-teal-700 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-slate-900"
              }
            `}
          >
            <item.icon
              className={`w-5 h-5 transition-colors ${
                collapsed ? "mx-auto" : ""
              } ${
                /* Active icon color is handled by parent text color, but we can enforce if needed */
                ""
              }`}
            />

            {!collapsed && <span className="">{item.label}</span>}

            {/* Tooltip for collapsed state */}
            {collapsed && (
              <div className="absolute left-full ml-2 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transform translate-x-2 transition-all">
                {item.label}
              </div>
            )}

            {/* Active Indicator (Right Border optional, using Pill style instead per design) */}
          </NavLink>
        ))}
      </nav>

      {/* Footer / Toggle */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full p-2 text-gray-400 hover:text-slate-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
