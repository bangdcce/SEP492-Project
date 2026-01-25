import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bell, ChevronDown, User, Settings, LogOut } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson, removeStoredItem } from "@/shared/utils/storage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api";
import type { NotificationItem } from "@/features/notifications/types";

interface StaffHeaderProps {
  collapsed: boolean;
  title?: string;
}

export const StaffHeader = ({ collapsed, title }: StaffHeaderProps) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  const handleLogout = () => {
    removeStoredItem(STORAGE_KEYS.ACCESS_TOKEN);
    removeStoredItem(STORAGE_KEYS.REFRESH_TOKEN);
    removeStoredItem(STORAGE_KEYS.USER);
    navigate("/login");
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

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  const loadNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);
      const data = await getNotifications({ page: 1, limit: 10 });
      setNotifications(data.items ?? []);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationClick = async (item: NotificationItem) => {
    try {
      if (!item.isRead) {
        await markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((entry) =>
            entry.id === item.id ? { ...entry, isRead: true } : entry,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }

    if (item.relatedType === "Dispute" && item.relatedId) {
      navigate(`/staff/caseload?disputeId=${item.relatedId}`);
    } else if (item.relatedType === "DisputeHearing") {
      navigate("/staff/calendar");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((entry) => ({ ...entry, isRead: true })),
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

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
          <DropdownMenu
            open={menuOpen}
            onOpenChange={(open) => {
              setMenuOpen(open);
              if (open) {
                loadNotifications();
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full border border-white text-[10px] text-white flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-96 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <DropdownMenuLabel className="p-0 text-sm font-semibold text-slate-900">
                  Notifications
                </DropdownMenuLabel>
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-teal-600 hover:text-teal-700"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loadingNotifications ? (
                  <div className="px-4 py-6 text-sm text-gray-500">
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id}>
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          handleNotificationClick(item);
                        }}
                        className="flex flex-col items-start gap-1 px-4 py-3"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm font-medium text-slate-900">
                            {item.title}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(item.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{item.body}</p>
                        {!item.isRead && (
                          <span className="text-[10px] text-teal-600 font-medium">
                            Unread
                          </span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </div>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

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
                        userRole === "ADMIN" ? "/admin/profile" :
                          userRole === "BROKER" ? "/broker/profile" :
                            userRole === "FREELANCER" ? "/freelancer/profile" :
                              userRole === "STAFF" ? "/staff/profile" :
                                "/client/profile"
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
