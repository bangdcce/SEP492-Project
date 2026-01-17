import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { ClientDashboardLayout } from "@/shared/components/layouts/client";
import { BrokerDashboardLayout } from "@/shared/components/layouts/broker";
import { FreelancerDashboardLayout } from "@/shared/components/layouts/freelancer/FreelancerDashboardLayout";
import { AdminDashboardLayout } from "@/shared/components/layouts/admin";
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
        <Route
          path={ROUTES.FREELANCER_PROJECTS}
          element={
            <FreelancerDashboardLayout>
              <ProjectListPage />
            </FreelancerDashboardLayout>
          }
        />
        <Route
          path={ROUTES.FREELANCER_WORKSPACE}
          element={
            <FreelancerDashboardLayout>
              <ProjectWorkspacePage />
            </FreelancerDashboardLayout>
          }
        />
        <Route
          path={ROUTES.FREELANCER_PROFILE}
          element={
            <FreelancerDashboardLayout>
              <ProfilePage />
            </FreelancerDashboardLayout>
          }
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
            <AdminDashboardLayout>
              <AdminDashboard />
            </AdminDashboardLayout>
          }
        />
        <Route
          path={ROUTES.ADMIN_AUDIT_LOGS}
          element={
            <AdminDashboardLayout>
              <AuditLogsPage />
            </AdminDashboardLayout>
          }
        />
        <Route
          path={ROUTES.ADMIN_REVIEW_MODERATION}
          element={
            <AdminDashboardLayout>
              <AdminReviewModerationPage />
            </AdminDashboardLayout>
          }
        />
        <Route
          path="/admin/kyc"
          element={
            <AdminDashboardLayout>
              <AdminKYCPage />
            </AdminDashboardLayout>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminDashboardLayout>
              <AdminUsersPage />
            </AdminDashboardLayout>
          }
        />
        <Route
          path={ROUTES.ADMIN_PROFILE}
          element={
            <AdminDashboardLayout>
              <ProfilePage />
            </AdminDashboardLayout>
          }
        />

        {/* ========== BROKER ROUTES - /broker/* ========== */}
        <Route
          path={ROUTES.BROKER_DASHBOARD}
          element={
            <BrokerDashboardLayout>
              <BrokerDashboard />
            </BrokerDashboardLayout>
          }
        />
        <Route
          path={ROUTES.BROKER_PROJECTS}
          element={
            <BrokerDashboardLayout>
              <ProjectListPage />
            </BrokerDashboardLayout>
          }
        />
        <Route
          path={ROUTES.BROKER_WORKSPACE}
          element={
            <BrokerDashboardLayout>
              <ProjectWorkspacePage />
            </BrokerDashboardLayout>
          }
        />
        <Route
          path={ROUTES.BROKER_PROFILE}
          element={
            <BrokerDashboardLayout>
              <ProfilePage />
            </BrokerDashboardLayout>
          }
        />

        {/* ========== PROJECT REQUEST ROUTES (Broker) ========== */}
        <Route
          path="/project-requests"
          element={
            <BrokerDashboardLayout>
              <ProjectRequestsPage />
            </BrokerDashboardLayout>
          }
        />
        <Route
          path="/project-requests/:id"
          element={
            <BrokerDashboardLayout>
              <ProjectRequestDetailsPage />
            </BrokerDashboardLayout>
          }
        />
        <Route
          path="/project-requests/:id/create-spec"
          element={
            <BrokerDashboardLayout>
              <CreateProjectSpecPage />
            </BrokerDashboardLayout>
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
        {/* /broker -> Broker Dashboard */}
        <Route
          path="/broker"
          element={<Navigate to={ROUTES.BROKER_DASHBOARD} replace />}
        />
        {/* /freelancer -> Freelancer Dashboard */}
        <Route
          path="/freelancer"
          element={<Navigate to={ROUTES.FREELANCER_DASHBOARD} replace />}
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
