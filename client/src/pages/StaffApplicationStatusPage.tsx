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
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-300">
            Staff Application
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Application status</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Your account is verified by email, but staff access stays locked until an admin
            reviews your application.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center text-slate-300">
              Loading your application...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
              <p className="font-medium">{error}</p>
              <button
                type="button"
                onClick={() => void loadApplication(true, true)}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-300/30 px-4 py-2 text-sm font-medium transition hover:bg-red-500/10"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : application ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-teal-400/10 p-3 text-teal-300">
                    {application.status === "REJECTED" ? (
                      <ShieldAlert className="h-7 w-7" />
                    ) : (
                      <Clock3 className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-300">Current status</p>
                    <h2 className="mt-1 text-2xl font-semibold">
                      {application.status === "PENDING"
                        ? "Waiting for admin review"
                        : "Application needs changes"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Submitted on{" "}
                      {new Date(application.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void loadApplication(true, true)}
                  disabled={refreshing}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh status
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-3 flex items-center gap-2 text-slate-200">
                    <MailCheck className="h-4 w-4 text-teal-300" />
                    <span className="text-sm font-medium">Email verification</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {application.user?.isEmailVerified
                      ? "Verified. You can sign in, but staff tools stay blocked until approval."
                      : "Please verify your email before trying to sign in again."}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-3 flex items-center gap-2 text-slate-200">
                    <ShieldCheck className="h-4 w-4 text-teal-300" />
                    <span className="text-sm font-medium">Staff access</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {application.status === "PENDING"
                      ? "No action needed right now. An admin will review your staff application."
                      : "Your application was not approved yet. Review the admin note below before contacting support."}
                  </p>
                </div>
              </div>

              {application.status === "REJECTED" && (
                <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-5">
                  <p className="text-sm font-medium text-amber-200">Admin feedback</p>
                  <p className="mt-2 text-sm leading-6 text-amber-50">
                    {application.rejectionReason || "No rejection reason was provided."}
                  </p>
                  {application.reviewedAt && (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-amber-200/80">
                      Reviewed {new Date(application.reviewedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <p className="text-sm font-medium text-slate-200">Application summary</p>
                <dl className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Name</dt>
                    <dd className="mt-1 text-sm text-slate-100">{application.user?.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</dt>
                    <dd className="mt-1 text-sm text-slate-100">{application.user?.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Domains</dt>
                    <dd className="mt-1 text-sm text-slate-100">
                      {application.user?.domains?.length
                        ? application.user.domains.map((domain) => domain.name).join(", ")
                        : "No domains selected"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Skills</dt>
                    <dd className="mt-1 text-sm text-slate-100">
                      {application.user?.skills?.length
                        ? application.user.skills.map((skill) => skill.name).join(", ")
                        : "No skills selected"}
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
