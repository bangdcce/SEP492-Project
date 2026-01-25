import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { toast } from "sonner";
import { setStoredItem } from "@/shared/utils/storage";

export function GoogleSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");

    if (accessToken && refreshToken) {
      // Save tokens (OAuth defaults to remember)
      setStoredItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken, true);
      setStoredItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken, true);

      toast.success("Welcome back!");
      navigate(ROUTES.DASHBOARD);
    } else {
      toast.error("Authentication failed");
      navigate(ROUTES.LOGIN);
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Signing you in...</p>
      </div>
    </div>
  );
}

export default GoogleSuccessPage;
