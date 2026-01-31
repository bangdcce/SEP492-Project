import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { ClientDashboardLayout } from "@/shared/components/layouts/client";
import { BrokerDashboardLayout } from "@/shared/components/layouts/broker";
import { FreelancerDashboardLayout } from "@/shared/components/layouts/freelancer/FreelancerDashboardLayout";
import { AdminDashboardLayout } from "@/shared/components/layouts/admin";
import { Spinner } from "@/shared/components/ui";
import { RoleGuard } from "@/shared/components/auth/RoleGuard";

// Lazy load pages for better performance
import { lazy, Suspense } from "react";

// ========== CLIENT PAGES ==========
const ClientDashboard = lazy(() =>
  import("@/features/dashboard/ClientDashboard").then((module) => ({
    default: module.ClientDashboard,
  })),
);
const WizardPage = lazy(() => import("@/features/wizard/WizardPage"));
const MyRequestsPage = lazy(() =>
  import("@/features/requests/MyRequestsPage").then((module) => ({
    default: module.MyRequestsPage,
  })),
);
const RequestDetailPage = lazy(
  () => import("@/features/requests/RequestDetailPage"),
);

// ========== PROJECT PAGES ==========
const ProjectListPage = lazy(
  () => import("@/features/project-list/ProjectListPage"),
);
const ProjectWorkspacePage = lazy(() => import("@/pages/ProjectWorkspacePage"));

// ========== ADMIN PAGES ==========
const AdminDashboard = lazy(() =>
  import("@/features/dashboard/AdminDashboard").then((module) => ({
    default: module.AdminDashboard,
  })),
);
const BrokerDashboard = lazy(() =>
  import("@/features/dashboard/BrokerDashboard").then((module) => ({
    default: module.BrokerDashboard,
  })),
);
const AuditLogsPage = lazy(() => import("@/pages/AuditLogsPage"));
const AdminReviewModerationPage = lazy(
  () => import("@/pages/AdminReviewModerationPage"),
);
const ProjectRequestsPage = lazy(() =>
  import("@/features/project-requests/ProjectRequestsPage").then((module) => ({
    default: module.ProjectRequestsPage,
  })),
);
const ProjectRequestDetailsPage = lazy(
  () => import("@/features/project-requests/ProjectRequestDetailsPage"),
);
const CreateProjectSpecPage = lazy(
  () => import("@/features/project-specs/CreateProjectSpecPage"),
);
const AuditSpecsPage = lazy(
  () => import("@/features/project-specs/AuditSpecsPage"),
);
const ContractPage = lazy(() => import("@/features/contracts/ContractPage"));
const ContractListPage = lazy(
  () => import("@/features/contracts/ContractListPage"),
);
const AdminKYCPage = lazy(() => import("@/pages/AdminKYCPage"));
const AdminUsersPage = lazy(() => import("@/pages/AdminUsersPage"));

// ========== FREELANCER PAGES ==========
const FreelancerOnboardingPage = lazy(
  () => import("@/pages/FreelancerOnboardingPage"),
);
const FreelancerDashboardPage = lazy(
  () => import("@/pages/FreelancerDashboardPage"),
);

// ========== SHARED PAGES ==========
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const KYCPage = lazy(() => import("@/pages/KYCPage"));

// ========== STAFF PAGES ==========
const StaffLayout = lazy(() =>
  import("@/features/staff/components/layout/StaffLayout").then((m) => ({
    default: m.StaffLayout,
  })),
);
const StaffDashboardPage = lazy(() =>
  import("@/features/staff/pages/StaffDashboardPage").then((m) => ({
    default: m.StaffDashboardPage,
  })),
);
const StaffQueuePage = lazy(() =>
  import("@/features/staff/pages/StaffQueuePage").then((m) => ({
    default: m.StaffQueuePage,
  })),
);
const StaffCaseloadPage = lazy(() =>
  import("@/features/staff/pages/StaffCaseloadPage").then((m) => ({
    default: m.StaffCaseloadPage,
  })),
);
const StaffCalendarPage = lazy(() =>
  import("@/features/staff/pages/StaffCalendarPage").then((m) => ({
    default: m.StaffCalendarPage,
  })),
);
const StaffHearingsPage = lazy(() =>
  import("@/features/staff/pages/StaffHearingsPage").then((m) => ({
    default: m.StaffHearingsPage,
  })),
);
const StaffHearingRoomPage = lazy(() =>
  import("@/features/staff/pages/StaffHearingRoomPage").then((m) => ({
    default: m.StaffHearingRoomPage,
  })),
);

// ========== AUTH PAGES ==========
const SignInPage = lazy(() => import("@/pages/SignInPage"));
const SignUpPage = lazy(() => import("@/pages/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const VerifyEmailPage = lazy(() => import("@/pages/VerifyEmailPage"));

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
        <Route path={ROUTES.VERIFY_EMAIL} element={<VerifyEmailPage />} />
        <Route path="/kyc" element={<KYCPage />} />

        {/* ========== FREELANCER ROUTES - /freelancer/* ========== */}
        <Route
          path={ROUTES.FREELANCER_ONBOARDING}
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerOnboardingPage />
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.FREELANCER_DASHBOARD}
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardPage />
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.FREELANCER_PROJECTS}
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <ProjectListPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.FREELANCER_WORKSPACE}
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <ProjectWorkspacePage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.FREELANCER_PROFILE}
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <ProfilePage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />

        {/* ========== CLIENT ROUTES - /client/* ========== */}
        <Route
          path={ROUTES.CLIENT_DASHBOARD}
          element={
            <RoleGuard allowedRoles={["CLIENT", "CLIENT_SME", "SME"]}>
              <ClientDashboardLayout>
                <ClientDashboard />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_WIZARD}
          element={
            <RoleGuard allowedRoles={["CLIENT", "CLIENT_SME", "SME"]}>
              <ClientDashboardLayout>
                <WizardPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_MY_REQUESTS}
          element={
            <RoleGuard allowedRoles={["CLIENT", "CLIENT_SME", "SME"]}>
              <ClientDashboardLayout>
                <MyRequestsPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/client/requests/:id"
          element={
            <RoleGuard allowedRoles={["CLIENT", "CLIENT_SME", "SME"]}>
              <ClientDashboardLayout>
                <RequestDetailPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_PROFILE}
          element={
            <RoleGuard allowedRoles={["CLIENT", "CLIENT_SME", "SME"]}>
              <ClientDashboardLayout>
                <ProfilePage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_PROJECTS}
          element={
            <RoleGuard allowedRoles={["CLIENT", "CLIENT_SME", "SME"]}>
              <ClientDashboardLayout>
                <ProjectListPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_WORKSPACE}
          element={
            <RoleGuard allowedRoles={["CLIENT", "CLIENT_SME", "SME"]}>
              <ClientDashboardLayout>
                <ProjectWorkspacePage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/client/contracts/:id"
          element={
            <RoleGuard allowedRoles={["CLIENT", "CLIENT_SME", "SME"]}>
              <ClientDashboardLayout>
                <ContractPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />

        {/* ========== ADMIN ROUTES - /admin/* ========== */}
        <Route
          path={ROUTES.ADMIN_DASHBOARD}
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <AdminDashboard />
              </AdminDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.ADMIN_AUDIT_LOGS}
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <AuditLogsPage />
              </AdminDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.ADMIN_REVIEW_MODERATION}
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <AdminReviewModerationPage />
              </AdminDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/admin/kyc"
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <AdminKYCPage />
              </AdminDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <AdminUsersPage />
              </AdminDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/admin/specs"
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <AuditSpecsPage />
              </AdminDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/admin/requests/:id"
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <ProjectRequestDetailsPage />
              </AdminDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.ADMIN_PROFILE}
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <ProfilePage />
              </AdminDashboardLayout>
            </RoleGuard>
          }
        />

        {/* ========== BROKER ROUTES - /broker/* ========== */}
        <Route
          path={ROUTES.BROKER_DASHBOARD}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <BrokerDashboard />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.BROKER_PROJECTS}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ProjectListPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.BROKER_WORKSPACE}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ProjectWorkspacePage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/broker/contracts"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ContractListPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/broker/contracts/:id"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ContractPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.BROKER_PROFILE}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ProfilePage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />

        {/* ========== PROJECT REQUEST ROUTES (Broker) ========== */}
        <Route
          path="/project-requests"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ProjectRequestsPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/project-requests/:id"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ProjectRequestDetailsPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/project-requests/:id/create-spec"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <CreateProjectSpecPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        {/* ========== STAFF ROUTES - /staff/* ========== */}
        <Route path="/staff" element={<StaffLayout />}>
          <Route path="dashboard" element={<StaffDashboardPage />} />
          <Route path="queue" element={<StaffQueuePage />} />
          <Route path="caseload" element={<StaffCaseloadPage />} />
          <Route path="calendar" element={<StaffCalendarPage />} />
          <Route path="hearings" element={<StaffHearingsPage />} />
          <Route path="hearings/:hearingId" element={<StaffHearingRoomPage />} />
          <Route path="profile" element={<ProfilePage />} />
          {/* Fallback */}
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

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
