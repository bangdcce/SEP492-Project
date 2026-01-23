import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { StaffSidebar } from "./StaffSidebar";
import { StaffHeader } from "./StaffHeader";
import { ROUTES, STORAGE_KEYS } from "@/constants";

export const StaffLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const userJson = localStorage.getItem(STORAGE_KEYS.USER);
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
        <main className="flex-1 p-6 mt-16 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
