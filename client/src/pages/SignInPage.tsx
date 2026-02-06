import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../shared/components/layouts/AuthLayout";
import { Input } from "../shared/components/custom/input";
import { Button } from "../shared/components/custom/Button";
// import { GoogleButton } from '../shared/components/auth/GoogleButton';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES, STORAGE_KEYS } from '@/constants';
import { signIn } from '@/features/auth';
import { setStoredItem } from '@/shared/utils/storage';

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

      // Save tokens based on remember-me choice


      // Backend returns {message, data: {user}}
      // Tokens are now stored in httpOnly cookies, not in localStorage
      const loginData = (response as any).data || response;

      // Only save user info to localStorage (not tokens)
      setStoredItem(
        STORAGE_KEYS.USER,
        JSON.stringify(loginData.user),
        formData.rememberMe
      );

      // Dispatch event to notify Header component of user data update
      window.dispatchEvent(new Event("userDataUpdated"));

      toast.success("Sign in successful!");

      if (onSignInSuccess) {
        onSignInSuccess();
      } else {
        // Role-based redirect
        const userRole = loginData.user?.role?.toUpperCase();

        if (userRole === "ADMIN") {
          navigate(ROUTES.ADMIN_DASHBOARD);
        } else if (userRole === "CLIENT" || userRole === "SME" || userRole === "CLIENT_SME") {
          navigate(ROUTES.CLIENT_DASHBOARD);
        } else if (userRole === "FREELANCER") {
          navigate(ROUTES.FREELANCER_DASHBOARD);
        } else if (userRole === "BROKER") {
          navigate(ROUTES.BROKER_DASHBOARD);
        } else if (userRole === "STAFF") {
          navigate("/staff/dashboard");
        } else {
          // Default fallback to client dashboard
          navigate(ROUTES.CLIENT_DASHBOARD);
        }
      }
    } catch (error: any) {
      console.error("Sign in error:", error);

      // Check if error is due to unverified email
      if (error.response?.data?.error === 'EMAIL_NOT_VERIFIED') {
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
