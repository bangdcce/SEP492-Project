import { useEffect, useMemo, useState } from "react";
import { Check, Eye, Search, ShieldCheck, ShieldX, X } from "lucide-react";
import { toast } from "sonner";
import {
  approveStaffApplication,
  getStaffApplicationById,
  listStaffApplications,
  rejectStaffApplication,
  type StaffApplicationRecord,
  type StaffApplicationStatus,
} from "@/features/staff-applications/api";

const statusOptions: Array<StaffApplicationStatus | ""> = ["", "PENDING", "APPROVED", "REJECTED"];

const getStatusClasses = (status: StaffApplicationStatus) => {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800";
    case "REJECTED":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-amber-100 text-amber-800";
  }
};

export default function AdminStaffApplicationsPage() {
  const [applications, setApplications] = useState<StaffApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StaffApplicationStatus | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedApplication, setSelectedApplication] = useState<StaffApplicationRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const result = await listStaffApplications({
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
      });
      setApplications(result.items);
      setTotalPages(result.totalPages || 1);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to load staff applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApplications();
  }, [page, search, status]);

  const statusCounts = useMemo(() => {
    return applications.reduce<Record<string, number>>((acc, application) => {
      acc[application.status] = (acc[application.status] || 0) + 1;
      return acc;
    }, {});
  }, [applications]);

  const openApplication = async (applicationId: string) => {
    try {
      setDetailLoading(true);
      const detail = await getStaffApplicationById(applicationId);
      setSelectedApplication(detail);
      setRejectionReason(detail.rejectionReason || "");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to load application detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedApplication(null);
    setRejectionReason("");
  };

  const handleApprove = async () => {
    if (!selectedApplication?.id) {
      return;
    }

    try {
      setSaving(true);
      const updated = await approveStaffApplication(selectedApplication.id);
      setSelectedApplication(updated);
      toast.success("Staff application approved");
      await fetchApplications();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to approve application");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication?.id) {
      return;
    }

    if (!rejectionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    try {
      setSaving(true);
      const updated = await rejectStaffApplication(selectedApplication.id, rejectionReason.trim());
      setSelectedApplication(updated);
      toast.success("Staff application rejected");
      await fetchApplications();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to reject application");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Staff Applications</h1>
          <p className="mt-2 text-gray-600">
            Review pending staff registrations without mixing them into user management.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Showing</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{applications.length}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="mt-2 text-3xl font-semibold text-amber-600">{statusCounts.PENDING || 0}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Approved</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-600">{statusCounts.APPROVED || 0}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Rejected</p>
            <p className="mt-2 text-3xl font-semibold text-rose-600">{statusCounts.REJECTED || 0}</p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Applicant name or email"
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as StaffApplicationStatus | "");
                  setPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              >
                {statusOptions.map((option) => (
                  <option key={option || "ALL"} value={option}>
                    {option || "ALL"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Applicant
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Submitted
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                    Loading staff applications...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                    No staff applications found.
                  </td>
                </tr>
              ) : (
                applications.map((application) => (
                  <tr key={application.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{application.user?.fullName}</p>
                        <p className="mt-1 text-sm text-gray-500">{application.user?.phoneNumber || "No phone number"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(application.status)}`}
                      >
                        {application.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div>
                        <p>{application.user?.email}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {application.user?.isEmailVerified ? "Email verified" : "Email not verified"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {new Date(application.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => application.id && void openApplication(application.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-teal-500 hover:text-teal-700"
                      >
                        <Eye className="h-4 w-4" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-600">
                  Staff application
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                  {selectedApplication.user?.fullName}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {detailLoading ? (
                <div className="py-12 text-center text-sm text-gray-500">Loading details...</div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                      <p className="text-sm font-medium text-gray-700">Applicant</p>
                      <dl className="mt-4 space-y-2 text-sm text-gray-700">
                        <div>
                          <dt className="text-gray-500">Email</dt>
                          <dd>{selectedApplication.user?.email}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Phone</dt>
                          <dd>{selectedApplication.user?.phoneNumber || "No phone number"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Submitted</dt>
                          <dd>{new Date(selectedApplication.createdAt).toLocaleString()}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Status</dt>
                          <dd>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(selectedApplication.status)}`}
                            >
                              {selectedApplication.status}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                      <p className="text-sm font-medium text-gray-700">Review metadata</p>
                      <dl className="mt-4 space-y-2 text-sm text-gray-700">
                        <div>
                          <dt className="text-gray-500">Reviewer</dt>
                          <dd>{selectedApplication.reviewer?.fullName || "Not reviewed yet"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Reviewed at</dt>
                          <dd>
                            {selectedApplication.reviewedAt
                              ? new Date(selectedApplication.reviewedAt).toLocaleString()
                              : "Not reviewed yet"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Email verification</dt>
                          <dd>
                            {selectedApplication.user?.isEmailVerified ? "Verified" : "Not verified"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Compatibility verification flag</dt>
                          <dd>{selectedApplication.user?.isVerified ? "Verified" : "Not verified"}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 p-5">
                      <p className="text-sm font-medium text-gray-700">Selected domains</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedApplication.user?.domains?.length ? (
                          selectedApplication.user.domains.map((domain) => (
                            <span
                              key={domain.id}
                              className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                            >
                              {domain.name}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No domains selected</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 p-5">
                      <p className="text-sm font-medium text-gray-700">Selected skills</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedApplication.user?.skills?.length ? (
                          selectedApplication.user.skills.map((skill) => (
                            <span
                              key={skill.id}
                              className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-700"
                            >
                              {skill.name}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No skills selected</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-5">
                    <label className="block text-sm font-medium text-gray-700">
                      Rejection reason
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      placeholder="Explain why this application should be rejected"
                      rows={4}
                      className="mt-3 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                    />
                    {selectedApplication.rejectionReason && (
                      <p className="mt-3 text-sm text-rose-600">
                        Current rejection note: {selectedApplication.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-white"
              >
                Close
              </button>

              {selectedApplication.status === "PENDING" && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleReject()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <ShieldX className="h-4 w-4" />
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApprove()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                </>
              )}
              {selectedApplication.status === "APPROVED" && (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800">
                  <ShieldCheck className="h-4 w-4" />
                  Already approved
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
