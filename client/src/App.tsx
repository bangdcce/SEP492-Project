import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { ClientDashboardLayout } from "@/shared/components/layouts/client";
import { BrokerDashboardLayout } from "@/shared/components/layouts/broker";
import { FreelancerDashboardLayout } from "@/shared/components/layouts/freelancer/FreelancerDashboardLayout";
import { AdminDashboardLayout } from "@/shared/components/layouts/admin";
import { Spinner } from "@/shared/components/ui";
import { RoleGuard } from "@/shared/components/auth/RoleGuard";
import { apiClient } from "@/shared/api/client";
import { getStoredItem } from "@/shared/utils/storage";

// Lazy load pages for better performance
import { lazy, Suspense, useEffect, useState } from "react";

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
const FreelancerRequestDetailPage = lazy(
  () => import("@/features/requests/FreelancerRequestDetailPage"),
);
const FreelancerRequestsPage = lazy(
  () => import("@/features/requests/FreelancerRequestsPage"),
);
const MyInvitationsPage = lazy(() => import("@/features/dashboard/MyInvitationsPage").then(m => ({ default: m.MyInvitationsPage })));
const InvitationDetailsPage = lazy(() => import("@/features/dashboard/InvitationDetailsPage").then(m => ({ default: m.InvitationDetailsPage })));
const DiscoveryPage = lazy(() => import("@/features/discovery/DiscoveryPage").then(m => ({ default: m.DiscoveryPage })));
const TrustProfilePage = lazy(() =>
  import("@/features/trust-profile/pages/TrustProfilePage").then((m) => ({
    default: m.TrustProfilePage,
  })),
);
const ParticipantDisputesPage = lazy(() =>
  import("@/features/disputes/pages/ParticipantDisputesPage").then((m) => ({
    default: m.ParticipantDisputesPage,
  })),
);
const ParticipantDisputeDetailPage = lazy(() =>
  import("@/features/disputes/pages/ParticipantDisputeDetailPage").then((m) => ({
    default: m.ParticipantDisputeDetailPage,
  })),
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
const BrokerProjectsPage = lazy(() =>
  import("@/features/project-requests/BrokerProjectsPage").then((module) => ({
    default: module.BrokerProjectsPage,
  })),
);
const AuditSpecsPage = lazy(
  () => import("@/features/project-specs/AuditSpecsPage"),
);
const CreateClientSpecPage = lazy(
  () => import("@/features/project-specs/CreateClientSpecPage"),
);
const ClientSpecReviewPage = lazy(
  () => import("@/features/project-specs/ClientSpecReviewPage"),
);
const ContractPage = lazy(() => import("@/features/contracts/ContractPage"));
const ContractListPage = lazy(
  () => import("@/features/contracts/ContractListPage"),
);
const AdminKYCPage = lazy(() => import("@/pages/AdminKYCPage"));
const AdminUsersPage = lazy(() => import("@/pages/AdminUsersPage"));
const AdminWizardQuestionsPage = lazy(() => import("@/pages/AdminWizardQuestionsPage"));
const AdminLeaveManagementPage = lazy(
  () => import("@/pages/AdminLeaveManagementPage"),
);
const AdminAppealQueuePage = lazy(() =>
  import("@/features/disputes/pages/AdminAppealQueuePage").then((module) => ({
    default: module.AdminAppealQueuePage,
  })),
);

// ========== HEARINGS (CLIENT/BROKER/FREELANCER) ==========
const ParticipantHearingsPage = lazy(() =>
  import("@/features/hearings/pages/ParticipantHearingsPage").then((module) => ({
    default: module.ParticipantHearingsPage,
  })),
);
const ParticipantHearingRoomPage = lazy(() =>
  import("@/features/hearings/pages/ParticipantHearingRoomPage").then((module) => ({
    default: module.ParticipantHearingRoomPage,
  })),
);

// ========== FREELANCER PAGES ==========
const FreelancerDashboardPage = lazy(
  () => import("@/pages/FreelancerDashboardPage"),
);

// ========== SHARED PAGES ==========
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const KYCPage = lazy(() => import("@/pages/KYCPage"));
const KYCStatusPage = lazy(() => import("@/pages/KYCStatusPage"));

// ========== SUBSCRIPTION PAGE ==========
const SubscriptionPage = lazy(() =>
  import("@/features/subscriptions/SubscriptionPage"),
);
const SubscriptionCheckoutPage = lazy(() =>
  import("@/features/subscriptions/SubscriptionCheckoutPage"),
);
const BillingPage = lazy(() => import("@/features/payments/BillingPage"));
const AdminFinancePage = lazy(() => import("@/features/payments/AdminFinancePage"));

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
const StaffProjectsPage = lazy(() =>
  import("@/features/staff/pages/StaffProjectsPage").then((m) => ({
    default: m.StaffProjectsPage,
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
const StaffLeavePage = lazy(() =>
  import("@/features/staff/pages/StaffLeavePage").then((m) => ({
    default: m.StaffLeavePage,
  })),
);
const StaffHearingRoomPage = lazy(() =>
  import("@/features/staff/pages/StaffHearingRoomPage").then((m) => ({
    default: m.StaffHearingRoomPage,
  })),
);

// ========== LANDING PAGE ==========
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const FAQPage = lazy(() => import("@/pages/FAQPage"));
const LegalTermsPage = lazy(() => import("@/pages/LegalTermsPage"));
const LegalPrivacyPage = lazy(() => import("@/pages/LegalPrivacyPage"));

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
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const { isAuthenticated } = await apiClient.bootstrapSession();

        // Only start proactive refresh if authenticated and session is stable
        // Wait a bit to ensure cookies are fully set after login
        if (isAuthenticated) {
          // Delay proactive refresh to avoid conflict with fresh login
          setTimeout(() => {
            if (!cancelled) {
              apiClient.startProactiveRefresh();
            }
          }, 5000); // 5 seconds after bootstrap
        }
      } finally {
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let isReconciling = false;

    const reconcileSession = async () => {
      if (isReconciling) {
        return;
      }

      isReconciling = true;
      try {
        await apiClient.bootstrapSession();
      } finally {
        isReconciling = false;
      }
    };

    const handleWindowFocus = () => {
      void reconcileSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void reconcileSession();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Listen for authentication state changes
  useEffect(() => {
    const handleUserDataUpdate = () => {
      // Check if user is still authenticated
      const userStr = getStoredItem("user");
      if (userStr && userStr !== 'null') {
        // User logged in or session restored
        apiClient.startProactiveRefresh();
      } else {
        // User logged out
        apiClient.stopProactiveRefresh();
      }
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdate);

    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate);
    };
  }, []);

  if (!sessionReady) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ========== LANDING PAGE ========== */}
        <Route path={ROUTES.LANDING} element={<LandingPage />} />
        <Route path={ROUTES.FAQ} element={<FAQPage />} />
        <Route path={ROUTES.LEGAL_TERMS} element={<LegalTermsPage />} />
        <Route path={ROUTES.LEGAL_PRIVACY} element={<LegalPrivacyPage />} />

        {/* ========== AUTH ROUTES - No Layout ========== */}
        <Route path={ROUTES.LOGIN} element={<SignInPage />} />
        <Route path={ROUTES.REGISTER} element={<SignUpPage />} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.VERIFY_EMAIL} element={<VerifyEmailPage />} />
        <Route path="/kyc" element={<KYCPage />} />

        {/* ========== FREELANCER ROUTES - /freelancer/* ========== */}
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
          path="/freelancer/hearings"
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <ParticipantHearingsPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.FREELANCER_DISPUTES}
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <ParticipantDisputesPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.FREELANCER_DISPUTE_DETAIL}
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout showFooter={false} contentMode="hearing-room">
                <ParticipantDisputeDetailPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/freelancer/hearings/:hearingId"
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout showFooter={false} contentMode="hearing-room">
                <ParticipantHearingRoomPage />
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
        <Route
          path="/freelancer/profiles/:id"
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <TrustProfilePage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/freelancer/contracts"
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <ContractListPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/freelancer/contracts/:id"
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <ContractPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />

        <Route
          path="/freelancer/invitations"
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <MyInvitationsPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/freelancer/invitations/:id"
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <InvitationDetailsPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/freelancer/requests"
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <FreelancerRequestsPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/freelancer/requests/:id"
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <FreelancerRequestDetailPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/freelancer/spec-review/:specId"
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <ClientSpecReviewPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.FREELANCER_KYC_STATUS}
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <KYCStatusPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />

        {/* Freelancer Subscription */}
        <Route
          path={ROUTES.FREELANCER_SUBSCRIPTION}
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <SubscriptionPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.FREELANCER_SUBSCRIPTION_CHECKOUT}
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <SubscriptionCheckoutPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.FREELANCER_BILLING}
          element={
            <RoleGuard allowedRoles={["FREELANCER"]}>
              <FreelancerDashboardLayout>
                <BillingPage />
              </FreelancerDashboardLayout>
            </RoleGuard>
          }
        />

        {/* ========== CLIENT ROUTES - /client/* ========== */}
        <Route
          path={ROUTES.CLIENT_DASHBOARD}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <ClientDashboard />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_WIZARD}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <WizardPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_MY_REQUESTS}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <MyRequestsPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/client/requests/:id"
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <RequestDetailPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_PROFILE}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <ProfilePage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/client/profiles/:id"
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <TrustProfilePage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_PROJECTS}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <ProjectListPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/client/hearings"
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <ParticipantHearingsPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_DISPUTES}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <ParticipantDisputesPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_DISPUTE_DETAIL}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout showFooter={false} contentMode="hearing-room">
                <ParticipantDisputeDetailPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/client/hearings/:hearingId"
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout showFooter={false} contentMode="hearing-room">
                <ParticipantHearingRoomPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/client/spec-review/:specId"
          element={
            <RoleGuard allowedRoles={["CLIENT", "CLIENT_SME", "SME"]}>
              <ClientDashboardLayout>
                <ClientSpecReviewPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_WORKSPACE}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <ProjectWorkspacePage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/client/contracts"
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <ContractListPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/client/contracts/:id"
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <ContractPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_KYC_STATUS}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <KYCStatusPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />

        <Route
          path="/client/discovery"
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <DiscoveryPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/client/discovery/profile/:id"
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <TrustProfilePage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />

        {/* Client Subscription */}
        <Route
          path={ROUTES.CLIENT_SUBSCRIPTION}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <SubscriptionPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_SUBSCRIPTION_CHECKOUT}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <SubscriptionCheckoutPage />
              </ClientDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.CLIENT_BILLING}
          element={
            <RoleGuard allowedRoles={["CLIENT"]}>
              <ClientDashboardLayout>
                <BillingPage />
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
          path={ROUTES.ADMIN_FINANCE}
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <AdminFinancePage />
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
          path={ROUTES.ADMIN_DISPUTE_APPEALS}
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <AdminAppealQueuePage />
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
            <RoleGuard allowedRoles={["ADMIN", "STAFF"]}>
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
          path="/admin/wizard-questions"
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <AdminWizardQuestionsPage />
              </AdminDashboardLayout>
            </RoleGuard>
          }
        />

        <Route
          path="/admin/leave"
          element={
            <RoleGuard allowedRoles={["ADMIN"]}>
              <AdminDashboardLayout>
                <AdminLeaveManagementPage />
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
          path="/broker/hearings"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ParticipantHearingsPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.BROKER_DISPUTES}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ParticipantDisputesPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.BROKER_DISPUTE_DETAIL}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout showFooter={false} contentMode="hearing-room">
                <ParticipantDisputeDetailPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/broker/hearings/:hearingId"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout showFooter={false} contentMode="hearing-room">
                <ParticipantHearingRoomPage />
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
        <Route
          path="/broker/profiles/:id"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <TrustProfilePage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/broker/invitations"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <MyInvitationsPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/broker/invitations/:id"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <InvitationDetailsPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />

        {/* ========== PROJECT REQUEST ROUTES (Broker) ========== */}
        <Route
          path={ROUTES.BROKER_MARKETPLACE}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ProjectRequestsPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.PROJECT_REQUEST_DETAILS}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ProjectRequestDetailsPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/broker/project-requests/:id/create-client-spec"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <CreateClientSpecPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/broker/project-requests/:id/create-spec"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <CreateProjectSpecPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/broker/specs/:specId"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <ClientSpecReviewPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path="/broker/my-requests"
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <BrokerProjectsPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.BROKER_KYC_STATUS}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <KYCStatusPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />

        {/* Broker Subscription */}
        <Route
          path={ROUTES.BROKER_SUBSCRIPTION}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <SubscriptionPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.BROKER_SUBSCRIPTION_CHECKOUT}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <SubscriptionCheckoutPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />
        <Route
          path={ROUTES.BROKER_BILLING}
          element={
            <RoleGuard allowedRoles={["BROKER"]}>
              <BrokerDashboardLayout>
                <BillingPage />
              </BrokerDashboardLayout>
            </RoleGuard>
          }
        />

        {/* ========== STAFF ROUTES - /staff/* ========== */}
        <Route path="/staff" element={<StaffLayout />}>
          <Route path="dashboard" element={<StaffDashboardPage />} />
          <Route path="projects" element={<StaffProjectsPage />} />
          <Route path="queue" element={<StaffQueuePage />} />
          <Route path="caseload" element={<StaffCaseloadPage />} />
          <Route path="calendar" element={<StaffCalendarPage />} />
          <Route path="leave" element={<StaffLeavePage />} />
          <Route path="hearings" element={<StaffHearingsPage />} />
          <Route path="hearings/:hearingId" element={<StaffHearingRoomPage />} />
          <Route path="kyc" element={<AdminKYCPage />} />
          <Route path="profile" element={<ProfilePage />} />
          {/* Fallback */}
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route
          path={ROUTES.STAFF_WORKSPACE}
          element={
            <RoleGuard allowedRoles={["STAFF", "ADMIN"]}>
              <StaffLayout />
            </RoleGuard>
          }
        >
          <Route index element={<ProjectWorkspacePage />} />
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
