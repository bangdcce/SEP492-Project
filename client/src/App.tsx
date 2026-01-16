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

// ========== PROJECT PAGES ==========
const ProjectListPage = lazy(
  () => import("@/features/project-list/ProjectListPage")
);
const ProjectWorkspacePage = lazy(() => import("@/pages/ProjectWorkspacePage"));

// ========== ADMIN PAGES ==========
const AdminDashboard = lazy(() =>
  import("@/features/dashboard/AdminDashboard").then((module) => ({
    default: module.AdminDashboard,
  }))
);
const BrokerDashboard = lazy(() =>
  import("@/features/dashboard/BrokerDashboard").then((module) => ({
    default: module.BrokerDashboard,
  }))
);
const AuditLogsPage = lazy(() => import("@/pages/AuditLogsPage"));
const AdminReviewModerationPage = lazy(
  () => import("@/pages/AdminReviewModerationPage")
);
const ProjectRequestsPage = lazy(() => import("@/features/project-requests/ProjectRequestsPage").then(module => ({ default: module.ProjectRequestsPage })));
const ProjectRequestDetailsPage = lazy(() => import("@/features/project-requests/ProjectRequestDetailsPage"));
const CreateProjectSpecPage = lazy(() => import("@/features/project-specs/CreateProjectSpecPage"));
const AdminKYCPage = lazy(() => import("@/pages/AdminKYCPage"));
const AdminUsersPage = lazy(() => import("@/pages/AdminUsersPage"));

// ========== FREELANCER PAGES ==========
const FreelancerOnboardingPage = lazy(() => import("@/pages/FreelancerOnboardingPage"));
const FreelancerDashboardPage = lazy(() => import("@/pages/FreelancerDashboardPage"));

// ========== SHARED PAGES ==========
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const KYCPage = lazy(() => import("@/pages/KYCPage"));

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
        <Route path="/kyc" element={<KYCPage />} />

        {/* ========== FREELANCER ROUTES - /freelancer/* ========== */}
        <Route
          path={ROUTES.FREELANCER_ONBOARDING}
          element={<FreelancerOnboardingPage />}
        />
        <Route
          path={ROUTES.FREELANCER_DASHBOARD}
          element={<FreelancerDashboardPage />}
        />

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
        <Route
          path={ROUTES.CLIENT_PROJECTS}
          element={
            <ClientDashboardLayout>
              <ProjectListPage />
            </ClientDashboardLayout>
          }
        />
        <Route
          path={ROUTES.CLIENT_WORKSPACE}
          element={
            <ClientDashboardLayout>
              <ProjectWorkspacePage />
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
          path="/admin/kyc"
          element={
            <MainLayout>
              <AdminKYCPage />
            </MainLayout>
          }
        />
        <Route
          path="/admin/users"
          element={
            <MainLayout>
              <AdminUsersPage />
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

        {/* ========== BROKER ROUTES ========== */}
        <Route
          path={ROUTES.BROKER_DASHBOARD}
          element={
            <MainLayout>
              <BrokerDashboard />
            </MainLayout>
          }
        />

        {/* ========== PROJECT REQUEST ROUTES ========== */}
        <Route
          path="/project-requests"
          element={
            <MainLayout>
              <ProjectRequestsPage />
            </MainLayout>
          }
        />

        <Route
          path="/project-requests/:id"
          element={
            <MainLayout>
              <ProjectRequestDetailsPage />
            </MainLayout>
          }
        />

        <Route
          path="/project-requests/:id/create-spec"
          element={
            <MainLayout>
              <CreateProjectSpecPage />
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
