import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../shared/components/layouts/AuthLayout";
import { Input } from "../shared/components/custom/input";
import { Button } from "../shared/components/custom/Button";
// import { GoogleButton } from '../shared/components/auth/GoogleButton';
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { signIn } from "@/features/auth";
import { setStoredItem } from "@/shared/utils/storage";

export interface SignInPageProps {
  onNavigateToSignUp?: () => void;
  onNavigateToForgotPassword?: () => void;
  onSignInSuccess?: () => void;
}

export function SignInPage({
  onNavigateToSignUp,
  onNavigateToForgotPassword,
  onSignInSuccess,
}: SignInPageProps = {}) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const resolvePostLoginRoute = (user?: {
    role?: string;
    isVerified?: boolean;
    staffApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  }) => {
    const userRole = user?.role?.toUpperCase();

    if (userRole === "ADMIN") {
      return ROUTES.ADMIN_DASHBOARD;
    }
    if (userRole === "CLIENT") {
      return ROUTES.CLIENT_DASHBOARD;
    }
    if (userRole === "FREELANCER") {
      return ROUTES.FREELANCER_DASHBOARD;
    }
    if (userRole === "BROKER") {
      return ROUTES.BROKER_DASHBOARD;
    }
    if (userRole === "STAFF") {
      const isApproved =
        user?.staffApprovalStatus === "APPROVED" ||
        (!user?.staffApprovalStatus && user?.isVerified === true);
      return isApproved
        ? ROUTES.STAFF_DASHBOARD
        : ROUTES.STAFF_APPLICATION_STATUS;
    }
    return ROUTES.CLIENT_DASHBOARD;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    // Validation
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Invalid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const response = await signIn({
        email: formData.email,
        password: formData.password,
      });

      // Backend returns {message, data: {user}}
      // Tokens are now stored in httpOnly cookies
      const loginData = (response as any).data || response;

      // Only save user info to localStorage (not tokens)
      setStoredItem(
        STORAGE_KEYS.USER,
        JSON.stringify(loginData.user),
        formData.rememberMe,
      );

      // Dispatch events to notify components
      window.dispatchEvent(new Event("userLoggedIn")); // For API client to track login time
      window.dispatchEvent(new Event("userDataUpdated")); // For header and other components

      toast.success("Sign in successful!");

      // Wait a bit to ensure cookies are fully propagated in browser
      await new Promise(resolve => setTimeout(resolve, 100));

      if (onSignInSuccess) {
        onSignInSuccess();
      } else {
        const targetRoute = resolvePostLoginRoute(loginData.user);

        // Force a full navigation after cookie-based login so the app bootstraps
        // from a clean authenticated state and avoids race conditions with guards.
        if (typeof window !== "undefined") {
          window.location.assign(targetRoute);
        } else {
          navigate(targetRoute);
        }
      }
    } catch (error: any) {
      // Check if error is due to unverified email
      if (error.response?.data?.error === "EMAIL_NOT_VERIFIED") {
        const email = error.response?.data?.email || formData.email;
        toast.error("Email not verified. Redirecting to verification page...");

        // Redirect to verify email page with email as query param
        setTimeout(() => {
          navigate(`${ROUTES.VERIFY_EMAIL}?email=${encodeURIComponent(email)}`);
        }, 1500);
        return;
      }

      const errorMessage =
        error.response?.data?.message || "Invalid email or password";
      setErrors({ password: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <AuthLayout
      title="Sign In"
      subtitle="Welcome back! Access your dashboard and manage your projects."
    >
      <button
        type="button"
        onClick={() => navigate(ROUTES.LANDING)}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-600 hover:text-teal-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back to Home</span>
      </button>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Google OAuth Button - TEMPORARILY DISABLED
        <GoogleButton text="Continue with Google" />

        Divider
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>
        */}

        <Input
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          placeholder="Enter your email"
          value={formData.email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("email", e.target.value)
          }
          error={errors.email}
        />

        <div className="relative">
          <Input
            id="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            hasTrailingAction
            autoComplete="current-password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleChange("password", e.target.value)
            }
            error={errors.password}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-11 text-gray-500 hover:text-gray-700"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff
                className="w-5 h-5"
                style={{ color: "var(--auth-text-muted)" }}
              />
            ) : (
              <Eye
                className="w-5 h-5"
                style={{ color: "var(--auth-text-muted)" }}
              />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.rememberMe}
              onChange={(e) => handleChange("rememberMe", e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
              style={{
                accentColor: "var(--auth-primary)",
              }}
            />
            <span style={{ color: "var(--auth-text)", fontSize: "0.875rem" }}>
              Remember me
            </span>
          </label>

          <button
            type="button"
            onClick={() =>
              onNavigateToForgotPassword
                ? onNavigateToForgotPassword()
                : navigate(ROUTES.FORGOT_PASSWORD)
            }
            className="text-sm hover:underline"
            style={{ color: "var(--auth-primary)" }}
          >
            Forgot password?
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full py-3 text-base font-medium justify-center"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </Button>

        <p
          className="text-center"
          style={{ color: "var(--auth-text-muted)", fontSize: "0.875rem" }}
        >
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() =>
              onNavigateToSignUp
                ? onNavigateToSignUp()
                : navigate(ROUTES.REGISTER)
            }
            className="hover:underline"
            style={{ color: "var(--auth-primary)", fontWeight: 500 }}
          >
            Sign up
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}

export default SignInPage;
