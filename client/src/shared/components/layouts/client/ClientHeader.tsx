/**
 * ClientHeader Component
 * Top navigation header for client dashboard
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { Logo } from "../../custom/Logo";

interface ClientHeaderProps {
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

export const ClientHeader: React.FC<ClientHeaderProps> = ({
  userName: propUserName,
  userRole: propUserRole,
  userAvatar: propUserAvatar,
  onMenuToggle,
  isMobileMenuOpen = false,
}) => {
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Get user from localStorage (sync initial read)
  const getInitialUser = () => {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return {};
      }
    }
    return {};
  };

  const [user, setUser] = useState<{
    fullName?: string;
    role?: string;
    avatarUrl?: string;
  }>(getInitialUser);

  useEffect(() => {
    // Listen for user data updates
    const handleUserUpdate = () => {
      const updatedUserStr = localStorage.getItem(STORAGE_KEYS.USER);
      if (updatedUserStr) {
        try {
          setUser(JSON.parse(updatedUserStr));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("userDataUpdated", handleUserUpdate);
    return () =>
      window.removeEventListener("userDataUpdated", handleUserUpdate);
  }, []);

  const userName = propUserName || user.fullName || "User";
  const userRole = propUserRole || user.role || "Client";
  const userAvatar = propUserAvatar || user.avatarUrl;

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    navigate(ROUTES.LOGIN);
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="px-6">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Left Section: Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle */}
            <button
              onClick={onMenuToggle}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-900" />
              ) : (
                <Menu className="w-5 h-5 text-gray-900" />
              )}
            </button>

            {/* Logo for mobile */}
            <Link
              to="/client/dashboard"
              className="lg:hidden flex items-center"
            >
              <Logo size="sm" />
            </Link>
          </div>

          {/* Center Section: Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects, freelancers, or messages..."
                className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Right Section: Actions + User Menu */}
          <div className="flex items-center gap-2">
            {/* Search Icon (Mobile) */}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-gray-900" />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                className="p-2 hover:bg-gray-100 rounded-md transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-gray-900" />
                {/* Notification Badge */}
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
              </button>
            </div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                aria-label="User menu"
              >
                {/* Avatar */}
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {getInitials(userName)}
                    </span>
                  </div>
                )}

                {/* User Info (Desktop) */}
                <div className="hidden lg:block text-left">
                  <div className="text-sm text-gray-900 leading-tight">
                    {userName}
                  </div>
                  <div className="text-xs text-gray-500">{userRole}</div>
                </div>

                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition-transform hidden lg:block ${
                    isProfileMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isProfileMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />

                  {/* Menu */}
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-md shadow-lg border border-gray-200 py-1.5 z-20">
                    {/* User Info */}
                    <div className="px-3 py-2.5 border-b border-gray-200">
                      <div className="text-sm text-gray-900">{userName}</div>
                      <div className="text-xs text-gray-500">{userRole}</div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <Link
                        to={ROUTES.CLIENT_PROFILE}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsProfileMenuOpen(false)}
                      >
                        <User className="w-4 h-4" />
                        My Profile
                      </Link>
                      <Link
                        to="/settings"
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsProfileMenuOpen(false)}
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-gray-200 pt-1">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {isSearchOpen && (
          <div className="md:hidden mt-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                autoFocus
                className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm placeholder:text-gray-400"
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
