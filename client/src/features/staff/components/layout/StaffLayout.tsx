import { useEffect, useState } from "react";
import { Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { StaffSidebar } from "./StaffSidebar";
import { StaffHeader } from "./StaffHeader";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { getStoredItem } from "@/shared/utils/storage";

export const StaffLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isHearingRoomRoute = Boolean(
    matchPath("/staff/hearings/:hearingId", location.pathname),
  );
  const contentContainerClass = isHearingRoomRoute
    ? "w-full"
    : "w-full max-w-[1440px] mx-auto";

  const mainClass = isHearingRoomRoute
    ? "flex-1 px-[2.5%] py-3 mt-16 overflow-x-hidden"
    : "flex-1 p-6 mt-16 overflow-x-hidden";

  useEffect(() => {
    const userJson = getStoredItem(STORAGE_KEYS.USER);
    if (!userJson) {
      navigate(ROUTES.LOGIN);
      return;
    }

    try {
      const user = JSON.parse(userJson);
      // Strict Role Check
      if (user.role !== "STAFF" && user.role !== "ADMIN") {
        // Admin can access too typically
        toast.error("Access Denied: Staff only area");
        navigate("/client"); // Send back to client dashboard or home
      }
    } catch (e) {
      navigate(ROUTES.LOGIN);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar Component */}
      <StaffSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />

      {/* Main Content Area */}
      <div
        className={`transition-all duration-300 min-h-screen flex flex-col
          ${collapsed ? "ml-20" : "ml-64"}
        `}
      >
        {/* Header Component */}
        <StaffHeader collapsed={collapsed} />

        {/* Page Content */}
        <main className={mainClass}>
          <div className={contentContainerClass}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
