import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Clock3, MailCheck, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ROUTES } from "@/constants";
import { apiClient } from "@/shared/api/client";
import {
  connectNamespacedSocket,
  disconnectNamespacedSocket,
} from "@/shared/realtime/socket";
import {
  getMyStaffApplication,
  type StaffApplicationRecord,
} from "@/features/staff-applications/api";

const STAFF_APPLICATIONS_REALTIME_NAMESPACE = "/ws/staff-applications";

export default function StaffApplicationStatusPage() {
  const [application, setApplication] = useState<StaffApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApplication = async (showToast = false, syncSession = false) => {
    try {
      setError(null);
      if (!application) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const nextApplication = await getMyStaffApplication();
      if (syncSession || nextApplication.status !== application?.status) {
        await apiClient.bootstrapSession();
      }
      setApplication(nextApplication);

      if (showToast) {
        toast.success("Application status refreshed");
      }
    } catch (err: any) {
      const nextError =
        err?.response?.data?.message || "Failed to load your staff application status";
      setError(nextError);
      toast.error(nextError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadApplication();
  }, []);

  useEffect(() => {
    const socket = connectNamespacedSocket(STAFF_APPLICATIONS_REALTIME_NAMESPACE);

    const handleRealtimeUpdate = () => {
      void loadApplication(false, true);
    };

    socket.on("connect", handleRealtimeUpdate);
    socket.on("staffApplicationUpdated", handleRealtimeUpdate);

    return () => {
      socket.off("connect", handleRealtimeUpdate);
      socket.off("staffApplicationUpdated", handleRealtimeUpdate);
      disconnectNamespacedSocket(STAFF_APPLICATIONS_REALTIME_NAMESPACE);
    };
  }, []);

  if (application?.status === "APPROVED") {
    return <Navigate to={ROUTES.STAFF_DASHBOARD} replace />;
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-600">
            Staff Application
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Application status</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Your account is verified by email, but staff access stays locked until an admin
            reviews your application.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center text-slate-500">
              Loading your application...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              <p className="font-medium">{error}</p>
              <button
                type="button"
                onClick={() => void loadApplication(true, true)}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-medium transition hover:bg-red-100"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : application ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-teal-100 p-3 text-teal-600">
                    {application.status === "REJECTED" ? (
                      <ShieldAlert className="h-7 w-7" />
                    ) : (
                      <Clock3 className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Current status</p>
                    <h2 className="mt-1 text-2xl font-semibold">
                      {application.status === "PENDING"
                        ? "Waiting for admin review"
                        : "Application needs changes"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Submitted on{" "}
                      {new Date(application.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void loadApplication(true, true)}
                  disabled={refreshing}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh status
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2 text-slate-800">
                    <MailCheck className="h-4 w-4 text-teal-600" />
                    <span className="text-sm font-medium">Email verification</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {application.user?.isEmailVerified
                      ? "Verified. You can sign in, but staff tools stay blocked until approval."
                      : "Please verify your email before trying to sign in again."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2 text-slate-800">
                    <ShieldCheck className="h-4 w-4 text-teal-600" />
                    <span className="text-sm font-medium">Staff access</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {application.status === "PENDING"
                      ? "No action needed right now. An admin will review your staff application."
                      : "Your application was not approved yet. Review the admin note below before contacting support."}
                  </p>
                </div>
              </div>

              {application.status === "REJECTED" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <p className="text-sm font-medium text-amber-800">Admin feedback</p>
                  <p className="mt-2 text-sm leading-6 text-amber-700">
                    {application.rejectionReason || "No rejection reason was provided."}
                  </p>
                  {application.reviewedAt && (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-amber-600">
                      Reviewed {new Date(application.reviewedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-medium text-slate-800">Application summary</p>
                <dl className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Name</dt>
                    <dd className="mt-1 text-sm text-slate-900">{application.user?.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Email</dt>
                    <dd className="mt-1 text-sm text-slate-900">{application.user?.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Document type</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {application.submissionSummary.documentType || "Not submitted"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Document number</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {application.submissionSummary.maskedDocumentNumber || "Not submitted"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">CV status</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {application.submissionSummary.hasCv ? "CV uploaded" : "CV missing"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Manual KYC</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {application.submissionSummary.hasKyc
                        ? "Submitted for admin review"
                        : "KYC submission incomplete"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
