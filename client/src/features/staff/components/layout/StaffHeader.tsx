import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ChevronDown, User, Settings, LogOut } from "lucide-react";
import { STORAGE_KEYS, ROUTES } from "@/constants";
import { getStoredJson, removeStoredItem } from "@/shared/utils/storage";
import { signOut } from "@/features/auth";
import type { NotificationItem } from "@/features/notifications/types";
import { NotificationDropdown } from "@/features/notifications/components/NotificationDropdown";

interface StaffHeaderProps {
  collapsed: boolean;
  title?: string;
}

export const StaffHeader = ({ collapsed, title }: StaffHeaderProps) => {
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Get user from storage
  const getInitialUser = () => {
    return getStoredJson<{
      fullName?: string;
      role?: string;
      avatarUrl?: string;
    }>(STORAGE_KEYS.USER) || {};
  };

  const [user, setUser] = useState<{
    fullName?: string;
    role?: string;
    avatarUrl?: string;
  }>(getInitialUser);

  useEffect(() => {
    // Listen for user data updates
    const handleUserUpdate = () => {
      const updatedUser = getStoredJson<{
        fullName?: string;
        role?: string;
        avatarUrl?: string;
      }>(STORAGE_KEYS.USER);
      if (updatedUser) setUser(updatedUser);
    };

    window.addEventListener("userDataUpdated", handleUserUpdate);
    return () =>
      window.removeEventListener("userDataUpdated", handleUserUpdate);
  }, []);

  const userName = user.fullName || "Staff User";
  const userRole = user.role || "STAFF";
  const userAvatar = user.avatarUrl;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // Continue with logout even if request fails
    }
    removeStoredItem(STORAGE_KEYS.USER);
    window.dispatchEvent(new Event("userDataUpdated"));
    navigate(ROUTES.LOGIN);
  };

  const getInitials = (name: string) => {
    if (!name) return "S";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleNotificationSelect = useCallback((item: NotificationItem) => {
    if (item.relatedType === "Dispute" && item.relatedId) {
      navigate(`/staff/caseload?disputeId=${item.relatedId}`);
    } else if (item.relatedType === "DisputeHearing") {
      navigate("/staff/calendar");
    }
  }, [navigate]);

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-white border-b border-gray-200 transition-all duration-300
        ${collapsed ? "left-20" : "left-64"}
      `}
    >
      <div className="flex items-center justify-between h-full px-6">
        {/* Left: Breadcrumbs / Title */}
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-slate-900">
            {title || "Dashboard"}
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
            STAFF PORTAL
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          <NotificationDropdown onSelect={handleNotificationSelect} />

          <div className="h-8 w-px bg-gray-200 mx-1"></div>

          {/* User Profile Dropdown - Client Style */}
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
                <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {getInitials(userName)}
                  </span>
                </div>
              )}

              {/* User Info */}
              <div className="hidden md:block text-left">
                <div className="text-sm text-gray-900 leading-tight">
                  {userName}
                </div>
                <div className="text-xs text-gray-500">{userRole}</div>
              </div>

              <ChevronDown
                className={`w-4 h-4 text-gray-500 transition-transform hidden md:block ${isProfileMenuOpen ? "rotate-180" : ""
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
                      to={
                        userRole === "ADMIN" ? ROUTES.ADMIN_PROFILE :
                          userRole === "BROKER" ? ROUTES.BROKER_PROFILE :
                            userRole === "FREELANCER" ? ROUTES.FREELANCER_PROFILE :
                              userRole === "STAFF" ? ROUTES.STAFF_PROFILE :
                                ROUTES.CLIENT_PROFILE
                      }
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
    </header>
  );
};
