import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { MainLayout } from "@/shared/components/layouts";
import { Spinner } from "@/shared/components/ui";

// Lazy load pages for better performance
import { lazy, Suspense } from "react";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const AuditLogsPage = lazy(() => import("@/pages/AuditLogsPage"));
const SignInPage = lazy(() => import("@/pages/SignInPage"));
const SignUpPage = lazy(() => import("@/pages/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
// const GoogleCompletePage = lazy(() => import("@/pages/GoogleCompletePage"));
// const GoogleSuccessPage = lazy(() => import("@/pages/GoogleSuccessPage"));

// Loading fallback
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth Routes - No Layout */}
        <Route path={ROUTES.LOGIN} element={<SignInPage />} />
        <Route path={ROUTES.REGISTER} element={<SignUpPage />} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
        {/* Google OAuth Routes - TEMPORARILY DISABLED
        <Route path="/auth/google-complete" element={<GoogleCompletePage />} />
        <Route path="/auth/google-success" element={<GoogleSuccessPage />} />
        */}

        {/* Dashboard */}
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          }
        />

        {/* Audit Logs */}
        <Route
          path={ROUTES.AUDIT_LOGS}
          element={
            <MainLayout>
              <AuditLogsPage />
            </MainLayout>
          }
        />

        {/* Redirect root to login */}
        <Route
          path={ROUTES.HOME}
          element={<Navigate to={ROUTES.LOGIN} replace />}
        />

        {/* 404 - Not Found */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-background">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-muted-foreground">
                  404
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                  Trang không tìm thấy
                </p>
              </div>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default App;
