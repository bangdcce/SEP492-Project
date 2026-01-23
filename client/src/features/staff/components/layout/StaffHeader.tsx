import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { UserNav } from "../../../../shared/components/custom/UserNav";
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

          <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 rounded-lg transition-colors">
            <UserNav />
            <div className="hidden md:block text-sm text-left">
              <p className="font-medium text-slate-900">Staff Admin</p>
              <p className="text-xs text-gray-500">Tier 1 Moderator</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
