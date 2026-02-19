import { useState } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { NotificationItem } from "../types";
import { useNotifications } from "../hooks/useNotifications";

interface NotificationDropdownProps {
  onSelect?: (item: NotificationItem) => void;
  limit?: number;
  buttonClassName?: string;
  panelClassName?: string;
}

export const NotificationDropdown = ({
  onSelect,
  limit = 10,
  buttonClassName,
  panelClassName,
}: NotificationDropdownProps) => {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    refresh,
    markOneAsRead,
    markAllAsRead,
  } = useNotifications(limit);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      void refresh({ silent: true });
    }
  };

  const handleSelect = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await markOneAsRead(item.id);
      } catch {
        // Keep navigation available even if mark-read fails.
      }
    }
    onSelect?.(item);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
    } catch {
      // Non-blocking UI behavior.
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative",
            buttonClassName,
          )}
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full border border-white text-[10px] text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn("w-96 p-0", panelClassName)}>
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
          {loading ? (
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
                    void handleSelect(item);
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
  );
};
