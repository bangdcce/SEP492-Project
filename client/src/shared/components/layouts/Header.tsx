import React, { useState, useRef, useEffect } from "react";
import { Bell, ChevronRight, LogOut, UserCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { getStoredJson, removeStoredItem } from "@/shared/utils/storage";

interface HeaderProps {
  breadcrumbs: string[];
}

export const Header: React.FC<HeaderProps> = ({ breadcrumbs }) => {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load user data from storage (session/local)
  useEffect(() => {
    const loadUserData = () => {
      const user = getStoredJson<any>(STORAGE_KEYS.USER);
      if (user) {
        setAvatarUrl(user.avatarUrl || "");
        setUserName(user.fullName || user.email || "");
      }
    };

    loadUserData();

    // Listen for custom event when user data is updated
    window.addEventListener("userDataUpdated", loadUserData);
    return () => window.removeEventListener("userDataUpdated", loadUserData);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const handleViewProfile = () => {
    setShowDropdown(false);
    // Admin always goes to admin profile
    navigate(ROUTES.ADMIN_PROFILE);
  };

  const handleLogout = () => {
    setShowDropdown(false);

    // Clear storage (session/local)
    removeStoredItem(STORAGE_KEYS.ACCESS_TOKEN);
    removeStoredItem(STORAGE_KEYS.REFRESH_TOKEN);
    removeStoredItem(STORAGE_KEYS.USER);

    // Redirect to login
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

  const breadcrumbItems =
    breadcrumbs.length > 0 ? breadcrumbs : ["Home", "Projects", "..."];

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-8 py-4">
      <div className="flex items-center justify-between">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          {breadcrumbItems.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
              <span
                className={
                  index === breadcrumbItems.length - 1
                    ? "text-slate-900"
                    : "text-gray-500"
                }
              >
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* User Profile & Notifications */}
        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <button className="relative p-2 text-gray-500 hover:text-slate-900 hover:bg-gray-50 rounded-lg transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
          </button>

          {/* User Avatar with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center hover:ring-2 hover:ring-blue-300 transition-all cursor-pointer overflow-hidden"
              title="Menu"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-sm font-bold">
                  {getInitials(userName)}
                </span>
              )}
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={handleViewProfile}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <UserCircle className="h-4 w-4" />
                  View Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
