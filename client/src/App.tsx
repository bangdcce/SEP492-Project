import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { MainLayout } from "@/shared/components/layouts";
import { ClientDashboardLayout } from "@/shared/components/layouts/client";
import { Spinner } from "@/shared/components/ui";

// Lazy load pages for better performance
import { lazy, Suspense } from "react";

// ========== CLIENT PAGES ==========
const ClientDashboard = lazy(() =>
  import("@/features/dashboard/ClientDashboard").then((module) => ({
    default: module.ClientDashboard,
  }))
);
const WizardPage = lazy(() => import("@/features/wizard/WizardPage"));
const MyRequestsPage = lazy(() =>
  import("@/features/requests/MyRequestsPage").then((module) => ({
    default: module.MyRequestsPage,
  }))
);
const RequestDetailPage = lazy(
  () => import("@/features/requests/RequestDetailPage")
);

// ========== ADMIN PAGES ==========
const AdminDashboard = lazy(() =>
  import("@/features/dashboard/AdminDashboard").then((module) => ({
    default: module.AdminDashboard,
  }))
);
const AuditLogsPage = lazy(() => import("@/pages/AuditLogsPage"));
const AdminReviewModerationPage = lazy(
  () => import("@/pages/AdminReviewModerationPage")
);

// ========== SHARED PAGES ==========
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));

// ========== AUTH PAGES ==========
const SignInPage = lazy(() => import("@/pages/SignInPage"));
const SignUpPage = lazy(() => import("@/pages/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));

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
        {/* ========== AUTH ROUTES - No Layout ========== */}
        <Route path={ROUTES.LOGIN} element={<SignInPage />} />
        <Route path={ROUTES.REGISTER} element={<SignUpPage />} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />

        {/* ========== CLIENT ROUTES - /client/* ========== */}
        <Route
          path={ROUTES.CLIENT_DASHBOARD}
          element={
            <ClientDashboardLayout>
              <ClientDashboard />
            </ClientDashboardLayout>
          }
        />
        <Route
          path={ROUTES.CLIENT_WIZARD}
          element={
            <ClientDashboardLayout>
              <WizardPage />
            </ClientDashboardLayout>
          }
        />
        <Route
          path={ROUTES.CLIENT_MY_REQUESTS}
          element={
            <ClientDashboardLayout>
              <MyRequestsPage />
            </ClientDashboardLayout>
          }
        />
        <Route
          path="/client/requests/:id"
          element={
            <ClientDashboardLayout>
              <RequestDetailPage />
            </ClientDashboardLayout>
          }
        />
        <Route
          path={ROUTES.CLIENT_PROFILE}
          element={
            <ClientDashboardLayout>
              <ProfilePage />
            </ClientDashboardLayout>
          }
        />

        {/* ========== ADMIN ROUTES - /admin/* ========== */}
        <Route
          path={ROUTES.ADMIN_DASHBOARD}
          element={
            <MainLayout>
              <AdminDashboard />
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.ADMIN_AUDIT_LOGS}
          element={
            <MainLayout>
              <AuditLogsPage />
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.ADMIN_REVIEW_MODERATION}
          element={
            <MainLayout>
              <AdminReviewModerationPage />
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.ADMIN_PROFILE}
          element={
            <MainLayout>
              <ProfilePage />
            </MainLayout>
          }
        />

        {/* ========== REDIRECTS ========== */}
        {/* Root -> Login */}
        <Route
          path={ROUTES.HOME}
          element={<Navigate to={ROUTES.LOGIN} replace />}
        />
        {/* /admin -> Admin Dashboard */}
        <Route
          path="/admin"
          element={<Navigate to={ROUTES.ADMIN_DASHBOARD} replace />}
        />
        {/* /client -> Client Dashboard */}
        <Route
          path="/client"
          element={<Navigate to={ROUTES.CLIENT_DASHBOARD} replace />}
        />

        {/* ========== 404 - Not Found ========== */}
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