import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  FileText,
  Search,
  ShieldCheck,
  ShieldX,
  UserSquare2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  approveStaffApplication,
  getStaffApplicationById,
  getStaffApplicationReviewAssets,
  listStaffApplications,
  rejectStaffApplication,
  type StaffApplicationRecord,
  type StaffApplicationReviewAssets,
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

const formatFileSize = (value: number | null) => {
  if (!value) {
    return "Unknown size";
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${Math.round(value / 1024)} KB`;
};

const decodePossiblyMisencodedFilename = (value?: string | null) => {
  if (!value) {
    return "Not provided";
  }

  const normalized = value.trim();
  if (!normalized) {
    return "Not provided";
  }

  if (!/[ÃÂÊÔÆÐÑØÙÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(normalized)) {
    return normalized;
  }

  try {
    const latin1Bytes = Uint8Array.from(normalized, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(latin1Bytes).trim();
    return decoded || normalized;
  } catch {
    return normalized;
  }
};

const renderNullable = (value?: string | null) => value || "Not provided";

export default function AdminStaffApplicationsPage() {
  const [applications, setApplications] = useState<StaffApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StaffApplicationStatus | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedApplication, setSelectedApplication] = useState<StaffApplicationRecord | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<StaffApplicationReviewAssets | null>(null);
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
      const [detail, assets] = await Promise.all([
        getStaffApplicationById(applicationId),
        getStaffApplicationReviewAssets(applicationId),
      ]);
      setSelectedApplication(detail);
      setSelectedAssets(assets);
      setRejectionReason(detail.rejectionReason || "");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to load application detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedApplication(null);
    setSelectedAssets(null);
    setRejectionReason("");
  };

  const refreshSelectedApplication = async (applicationId: string) => {
    const [detail, assets] = await Promise.all([
      getStaffApplicationById(applicationId),
      getStaffApplicationReviewAssets(applicationId),
    ]);
    setSelectedApplication(detail);
    setSelectedAssets(assets);
    setRejectionReason(detail.rejectionReason || "");
  };

  const handleApprove = async () => {
    if (!selectedApplication?.id) {
      return;
    }

    try {
      setSaving(true);
      await approveStaffApplication(selectedApplication.id);
      await refreshSelectedApplication(selectedApplication.id);
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
      await rejectStaffApplication(selectedApplication.id, rejectionReason.trim());
      await refreshSelectedApplication(selectedApplication.id);
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
            Review pending staff registrations without changing the global approval flow.
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
                  Submission
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
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
                        <p className="mt-1 text-sm text-gray-500">{application.user?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <p>{application.submissionSummary.documentType || "Document type not set"}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {application.submissionSummary.hasCv ? "CV uploaded" : "CV missing"} ·{" "}
                        {application.submissionSummary.hasKyc ? "KYC submitted" : "KYC incomplete"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(application.status)}`}
                      >
                        {application.status}
                      </span>
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
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
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
                      <p className="text-sm font-medium text-gray-700">Submission summary</p>
                      <dl className="mt-4 space-y-2 text-sm text-gray-700">
                        <div>
                          <dt className="text-gray-500">Document type</dt>
                          <dd>{renderNullable(selectedApplication.submissionSummary.documentType)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Document number</dt>
                          <dd>{renderNullable(selectedApplication.submissionSummary.maskedDocumentNumber)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">CV uploaded</dt>
                          <dd>{selectedApplication.submissionSummary.hasCv ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">KYC package</dt>
                          <dd>{selectedApplication.submissionSummary.hasKyc ? "Submitted" : "Incomplete"}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-gray-200 p-5">
                      <div className="flex items-center gap-2">
                        <UserSquare2 className="h-5 w-5 text-teal-600" />
                        <p className="text-sm font-medium text-gray-700">Manual KYC fields</p>
                      </div>
                      <dl className="mt-4 grid gap-4 md:grid-cols-2 text-sm text-gray-700">
                        <div>
                          <dt className="text-gray-500">Full name on document</dt>
                          <dd className="mt-1">{renderNullable(selectedApplication.manualKyc?.fullNameOnDocument)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Document type</dt>
                          <dd className="mt-1">{renderNullable(selectedApplication.manualKyc?.documentType)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Document number</dt>
                          <dd className="mt-1">{renderNullable(selectedApplication.manualKyc?.documentNumber)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Date of birth</dt>
                          <dd className="mt-1">
                            {selectedApplication.manualKyc?.dateOfBirth
                              ? new Date(selectedApplication.manualKyc.dateOfBirth).toLocaleDateString()
                              : "Not provided"}
                          </dd>
                        </div>
                        <div className="md:col-span-2">
                          <dt className="text-gray-500">Address</dt>
                          <dd className="mt-1 whitespace-pre-wrap">
                            {renderNullable(selectedApplication.manualKyc?.address)}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-2xl border border-gray-200 p-5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-teal-600" />
                        <p className="text-sm font-medium text-gray-700">CV</p>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-gray-700">
                        <p>
                          <span className="text-gray-500">Filename:</span>{" "}
                          {decodePossiblyMisencodedFilename(
                            selectedAssets?.cv.originalFilename || selectedApplication.cv.originalFilename,
                          )}
                        </p>
                        <p>
                          <span className="text-gray-500">Type:</span>{" "}
                          {renderNullable(selectedAssets?.cv.mimeType || selectedApplication.cv.mimeType)}
                        </p>
                        <p>
                          <span className="text-gray-500">Size:</span>{" "}
                          {formatFileSize(selectedAssets?.cv.size ?? selectedApplication.cv.size)}
                        </p>
                      </div>
                      {selectedAssets?.cv.url ? (
                        <a
                          href={selectedAssets.cv.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-100"
                        >
                          <FileText className="h-4 w-4" />
                          Open CV
                        </a>
                      ) : (
                        <p className="mt-4 text-sm text-gray-500">CV asset is not available.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-5">
                    <p className="text-sm font-medium text-gray-700">KYC image previews</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Images are watermarked for manual review.
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      {[
                        { label: "ID Front", url: selectedAssets?.previews.idCardFrontUrl },
                        { label: "ID Back", url: selectedAssets?.previews.idCardBackUrl },
                        { label: "Selfie", url: selectedAssets?.previews.selfieUrl },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                          <p className="mb-3 text-sm font-medium text-gray-700">{item.label}</p>
                          {item.url ? (
                            <img
                              src={item.url}
                              alt={item.label}
                              className="h-56 w-full rounded-xl object-cover"
                            />
                          ) : (
                            <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-500">
                              Preview unavailable
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {selectedAssets?.watermarkInfo && (
                      <p className="mt-4 text-xs text-amber-700">
                        {selectedAssets.watermarkInfo.warning}
                      </p>
                    )}
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
