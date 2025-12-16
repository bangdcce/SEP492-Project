import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-interdev-navy items-center justify-center p-12">
        <div className="max-w-md text-center">
          <h1 className="text-4xl font-bold text-white mb-4">InterDev</h1>
          <p className="text-lg text-white/80">
            Nền tảng kết nối và quản lý dự án phát triển phần mềm chuyên nghiệp
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <div className="h-2 w-2 rounded-full bg-interdev-teal" />
            <div className="h-2 w-2 rounded-full bg-interdev-teal/60" />
            <div className="h-2 w-2 rounded-full bg-interdev-teal/30" />
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <Link to={ROUTES.HOME} className="lg:hidden inline-block mb-6">
              <span className="text-2xl font-bold text-interdev-teal">
                InterDev
              </span>
            </Link>
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
            {subtitle && (
              <p className="mt-2 text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
