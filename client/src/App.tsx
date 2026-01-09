import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { MainLayout } from "@/shared/components/layouts";
import { Spinner } from "@/shared/components/ui";

// Lazy load pages for better performance
import { lazy, Suspense } from "react";

const ClientDashboard = lazy(() => import("@/features/dashboard/ClientDashboard").then(module => ({ default: module.ClientDashboard })));
const RequestDetailPage = lazy(() => import("@/features/requests/RequestDetailPage"));
const AuditLogsPage = lazy(() => import("@/pages/AuditLogsPage"));
const WizardPage = lazy(() => import("@/features/wizard/WizardPage"));
const MyRequestsPage = lazy(() => import("@/features/requests/MyRequestsPage").then(module => ({ default: module.MyRequestsPage })));
const SignInPage = lazy(() => import("@/pages/SignInPage"));
const SignUpPage = lazy(() => import("@/pages/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
// const GoogleCompletePage = lazy(() => import("@/pages/GoogleCompletePage"));
// const GoogleSuccessPage = lazy(() => import("@/pages/GoogleSuccessPage"));

// Other Pages
const AdminReviewModerationPage = lazy(
  () => import("@/pages/AdminReviewModerationPage")
);
const AdminDashboard = lazy(() => import("@/features/dashboard/AdminDashboard").then(module => ({ default: module.AdminDashboard })));

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
        {/* Wizard */}
        <Route
            path={ROUTES.WIZARD}
            element={
                <MainLayout>
                    <WizardPage />
                </MainLayout>
            }
        />
        
        {/* Auth Routes - No Layout */}
        <Route path={ROUTES.LOGIN} element={<SignInPage />} />
        <Route path={ROUTES.REGISTER} element={<SignUpPage />} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
        {/* Google OAuth Routes - TEMPORARILY DISABLED
        <Route path="/auth/google-complete" element={<GoogleCompletePage />} />
        <Route path="/auth/google-success" element={<GoogleSuccessPage />} />
        */}
        {/* Client Dashboard */}
        <Route
          path={ROUTES.CLIENT_DASHBOARD}
          element={
            <MainLayout>
              <ClientDashboard />
            </MainLayout>
          }
        />
        
        {/* Admin Dashboard (Main /dashboard) */}
        <Route
          path={ROUTES.ADMIN_DASHBOARD}
          element={
            <MainLayout>
              <AdminDashboard />
            </MainLayout>
          }
        />

        {/* Request Detail */}
        <Route
          path="/requests/:id"
          element={
            <MainLayout>
              <RequestDetailPage />
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

        {/* My Requests */}
        <Route
          path={ROUTES.MY_REQUESTS}
          element={
            <MainLayout>
              <MyRequestsPage />
            </MainLayout>
          }
        />

        {/* Client Profile - No sidebar layout */}
        <Route
          path={ROUTES.CLIENT_PROFILE}
          element={<ProfilePage />}
        />

        {/* Admin Profile - No sidebar layout */}
        <Route
          path={ROUTES.PROFILE}
          element={<ProfilePage />}
        />

        {/* Review Moderation (Admin) */}
        <Route
          path={ROUTES.REVIEW_MODERATION}
          element={
            <MainLayout>
              <AdminReviewModerationPage />
            </MainLayout>
          }
        />

        {/* Redirect root to login */}
        <Route
          path={ROUTES.HOME}
          element={<Navigate to={ROUTES.LOGIN} replace />}
        />

        <Route
          path="/admin"
          element={<Navigate to={ROUTES.ADMIN_DASHBOARD} replace />}
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
