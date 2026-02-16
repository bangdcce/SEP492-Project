import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { toast } from "sonner";
import { setStoredItem } from "@/shared/utils/storage";

export function GoogleSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Backend OAuth now sets tokens in httpOnly cookies
    // Check if authentication was successful (backend should set a success flag or user data)
    const success = searchParams.get("success");
    const userData = searchParams.get("user");

    if (success === "true" && userData) {
      try {
        // Save user info to localStorage (tokens are in httpOnly cookies)
        const user = JSON.parse(decodeURIComponent(userData));
        setStoredItem(STORAGE_KEYS.USER, JSON.stringify(user), true);
        
        toast.success("Welcome back!");
        navigate(ROUTES.DASHBOARD);
      } catch (error) {
        toast.error("Authentication failed");
        navigate(ROUTES.LOGIN);
      }
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
