/**
 * AdminReviewModerationPage
 * Admin-only page for moderating reviews (soft delete, restore, manage reports)
 */

import { useState, useEffect } from "react";
import {
  Shield,
  Flag,
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  Clock,
  User,
  Star,
  EyeOff,
  Loader2,
} from "lucide-react";
import type {
  AdminReview,
  ReviewStatus,
  BadgeType,
} from "../features/trust-profile/types";
import { SoftDeleteConfirmModal } from "../features/trust-profile/modals/SoftDeleteConfirmModal";
import { RestoreReviewModal } from "../features/trust-profile/modals/RestoreReviewModal";
import {
  softDeleteReview,
  restoreReview,
  dismissReport,
  getReviewsForModeration,
} from "../features/trust-profile/api/adminReviewService";

// Type for review data from server
interface ServerReviewData {
  id: string;
  rating: number;
  comment?: string;
  weight: string | number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  reviewer?: {
    id: string;
    fullName: string;
    badge?: string;
    currentTrustScore?: number;
    profile?: {
      avatarUrl?: string;
    };
  };
  project?: {
    id: string;
    title: string;
    totalBudget: string | number;
    status?: string;
  };
  // Report info from backend
  reportInfo?: {
    reportCount: number;
    reasons: string[];
    lastReportedAt: string;
    reportedBy?: Array<{ id: string; fullName: string }>;
  };
}

type FilterTab = "ALL" | "ACTIVE" | "FLAGGED" | "SOFT_DELETED";

export default function AdminReviewModerationPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(
    null
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock admin user - TODO: Get from auth context
  const currentAdmin = {
    id: "ADMIN001",
    fullName: "Admin User",
    role: "ADMIN",
  };

  // Fetch reviews from API
  useEffect(() => {
    const fetchReviews = async () => {
      setIsDataLoading(true);
      setError(null);
      try {
        // Get reviews from API
        const data = await getReviewsForModeration();

        // Transform server data to AdminReview format
        const transformedReviews: AdminReview[] = data.map(
          (review: ServerReviewData) => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment || "",
            weight: Number(review.weight),
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            status: review.deletedAt
              ? "SOFT_DELETED"
              : review.reportInfo
              ? "FLAGGED"
              : ("ACTIVE" as ReviewStatus),
            reviewer: {
              id: review.reviewer?.id || "",
              fullName: review.reviewer?.fullName || "Unknown User",
              avatarUrl: review.reviewer?.profile?.avatarUrl,
              badge: (review.reviewer?.badge as BadgeType) || "NORMAL",
              currentTrustScore: review.reviewer?.currentTrustScore,
            },
            project: {
              id: review.project?.id || "",
              title: review.project?.title || "Unknown Project",
              totalBudget: Number(review.project?.totalBudget) || 0,
              status: review.project?.status as
                | "PENDING"
                | "IN_PROGRESS"
                | "COMPLETED"
                | "CANCELLED"
                | undefined,
            },
            // Map reportInfo from server response
            reportInfo: review.reportInfo
              ? {
                  reportCount: review.reportInfo.reportCount,
                  reasons: review.reportInfo
                    .reasons as import("../features/trust-profile/types").ReportReason[],
                  lastReportedAt: review.reportInfo.lastReportedAt,
                  reportedBy: review.reportInfo.reportedBy,
                }
              : undefined,
            moderationHistory: review.deleteReason
              ? [
                  {
                    id: `mod-${review.id}`,
                    action: "SOFT_DELETE" as const,
                    reason: review.deleteReason,
                    performedBy: {
                      id: review.deletedBy || "",
                      fullName: "Admin",
                      role: "ADMIN",
                    },
                    performedAt: review.deletedAt || "",
                  },
                ]
              : undefined,
          })
        );

        setReviews(transformedReviews);
      } catch (err) {
        console.error("Failed to fetch reviews:", err);
        setError("Failed to load reviews. Please try again later.");
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchReviews();
  }, []);

  // Filter reviews by tab
  const filteredReviews = reviews.filter((review) => {
    // Tab filter
    if (activeTab !== "ALL" && review.status !== activeTab) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        review.comment.toLowerCase().includes(query) ||
        review.reviewer.fullName.toLowerCase().includes(query) ||
        review.project.title.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Handle soft delete
  const handleSoftDelete = async (reason: string, notes?: string) => {
    if (!selectedReview) return;

    setIsLoading(true);
    try {
      await softDeleteReview(selectedReview.id, reason, notes);

      // Update local state
      setReviews((prev) =>
        prev.map((r) =>
          r.id === selectedReview.id
            ? {
                ...r,
                status: "SOFT_DELETED" as ReviewStatus,
                moderationHistory: [
                  {
                    id: `MOD${Date.now()}`,
                    action: "SOFT_DELETE" as const,
                    reason,
                    notes,
                    performedBy: currentAdmin,
                    performedAt: new Date().toISOString(),
                  },
                  ...(r.moderationHistory || []),
                ],
              }
            : r
        )
      );

      setShowDeleteModal(false);
      setSelectedReview(null);
      alert("Review soft deleted successfully!");
    } catch (error) {
      console.error("Failed to soft delete review:", error);
      alert("Failed to delete review. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle restore
  const handleRestore = async (reason: string) => {
    if (!selectedReview) return;

    setIsLoading(true);
    try {
      await restoreReview(selectedReview.id, reason);

      // Update local state
      setReviews((prev) =>
        prev.map((r) =>
          r.id === selectedReview.id
            ? {
                ...r,
                status: "ACTIVE" as ReviewStatus,
                moderationHistory: [
                  {
                    id: `MOD${Date.now()}`,
                    action: "RESTORE" as const,
                    reason,
                    performedBy: currentAdmin,
                    performedAt: new Date().toISOString(),
                  },
                  ...(r.moderationHistory || []),
                ],
              }
            : r
        )
      );

      setShowRestoreModal(false);
      setSelectedReview(null);
      alert("Review restored successfully!");
    } catch (error) {
      console.error("Failed to restore review:", error);
      alert("Failed to restore review. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle dismiss report
  const handleDismissReport = async (reviewId: string) => {
    if (
      !confirm("Are you sure you want to dismiss all reports for this review?")
    ) {
      return;
    }

    try {
      await dismissReport(reviewId, "False report - content is acceptable");

      // Update local state
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                status: "ACTIVE" as ReviewStatus,
                reportInfo: undefined,
              }
            : r
        )
      );

      alert("Reports dismissed successfully!");
    } catch (error) {
      console.error("Failed to dismiss report:", error);
      alert("Failed to dismiss report. Please try again.");
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  // Get status badge
  const getStatusBadge = (status?: ReviewStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs rounded-md flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        );
      case "FLAGGED":
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-md flex items-center gap-1">
            <Flag className="w-3 h-3" />
            Flagged
          </span>
        );
      case "SOFT_DELETED":
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-md flex items-center gap-1">
            <EyeOff className="w-3 h-3" />
            Deleted
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
            Unknown
          </span>
        );
    }
  };

  // Get tab counts
  const tabCounts = {
    ALL: reviews.length,
    ACTIVE: reviews.filter((r) => r.status === "ACTIVE").length,
    FLAGGED: reviews.filter((r) => r.status === "FLAGGED").length,
    SOFT_DELETED: reviews.filter((r) => r.status === "SOFT_DELETED").length,
  };

  // Loading state
  if (isDataLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100">
        <Loader2 className="w-12 h-12 text-teal-600 animate-spin mb-4" />
        <p className="text-gray-600">Loading reviews...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          Failed to Load
        </h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl text-slate-900">Review Moderation</h1>
            <p className="text-gray-600">
              Manage reported reviews and moderate content
            </p>
          </div>
        </div>
      </div>

      {/* Admin Warning */}
      <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-red-900 mb-1">Admin Access Only</h3>
            <p className="text-red-800 text-sm">
              This page is restricted to administrators. All moderation actions
              are logged and auditable. Use soft delete to hide inappropriate
              content - reviews can be restored later if needed.
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="mb-6 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200">
          {(["ALL", "ACTIVE", "FLAGGED", "SOFT_DELETED"] as FilterTab[]).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm transition-colors relative ${
                  activeTab === tab
                    ? "text-teal-600 border-b-2 border-teal-600"
                    : "text-gray-600 hover:text-slate-900"
                }`}
              >
                {tab.replace("_", " ")}
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab
                      ? "bg-teal-100 text-teal-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {tabCounts[tab]}
                </span>
              </button>
            )
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by comment, reviewer, or project..."
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <Filter className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-slate-900 mb-2">No reviews found</h3>
            <p className="text-gray-600">
              {searchQuery
                ? "Try adjusting your search query"
                : "No reviews match the selected filter"}
            </p>
          </div>
        ) : (
          filteredReviews.map((review) => (
            <div
              key={review.id}
              className={`bg-white border rounded-lg p-6 shadow-sm ${
                review.status === "FLAGGED"
                  ? "border-yellow-300 bg-yellow-50/30"
                  : review.status === "SOFT_DELETED"
                  ? "border-red-300 bg-red-50/30 opacity-75"
                  : "border-gray-200"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  {/* Avatar */}
                  {review.reviewer.avatarUrl ? (
                    <img
                      src={review.reviewer.avatarUrl}
                      alt={review.reviewer.fullName}
                      className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center border border-gray-200">
                      <User className="w-6 h-6 text-slate-600" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-900">
                        {review.reviewer.fullName}
                      </span>
                      {getStatusBadge(review.status)}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Project:{" "}
                      <span className="text-slate-900">
                        {review.project.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(review.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500" />
                        {review.rating}/5
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {review.status === "SOFT_DELETED" ? (
                    <button
                      onClick={() => {
                        setSelectedReview(review);
                        setShowRestoreModal(true);
                      }}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore
                    </button>
                  ) : (
                    <>
                      {review.reportInfo && (
                        <button
                          onClick={() => handleDismissReport(review.id)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Dismiss
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedReview(review);
                          setShowDeleteModal(true);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Soft Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Comment */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {review.comment}
                </p>
              </div>

              {/* Report Info */}
              {review.reportInfo && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Flag className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm text-yellow-900 mb-2">
                        <strong>
                          {review.reportInfo.reportCount} Report(s)
                        </strong>{" "}
                        • Last reported:{" "}
                        {formatDate(review.reportInfo.lastReportedAt)}
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {review.reportInfo.reasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-md"
                          >
                            {reason.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                      {review.reportInfo.flaggedKeywords &&
                        review.reportInfo.flaggedKeywords.length > 0 && (
                          <div>
                            <div className="text-xs text-yellow-700 mb-1">
                              Flagged Keywords:
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {review.reportInfo.flaggedKeywords.map(
                                (keyword, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-mono"
                                  >
                                    {keyword}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* Moderation History */}
              {review.moderationHistory &&
                review.moderationHistory.length > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-xs text-gray-600 mb-2">
                      Moderation History:
                    </div>
                    {review.moderationHistory.map((action) => (
                      <div
                        key={action.id}
                        className="text-sm text-gray-700 flex items-center gap-2"
                      >
                        <span className="text-slate-900">{action.action}</span>
                        <span className="text-gray-500">•</span>
                        <span>{action.performedBy.fullName}</span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-500">
                          {formatDate(action.performedAt)}
                        </span>
                        {action.reason && (
                          <>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-600">
                              {action.reason}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {selectedReview && (
        <>
          <SoftDeleteConfirmModal
            review={selectedReview}
            isOpen={showDeleteModal}
            onClose={() => {
              setShowDeleteModal(false);
              setSelectedReview(null);
            }}
            onConfirm={handleSoftDelete}
            isLoading={isLoading}
          />
          <RestoreReviewModal
            review={selectedReview}
            isOpen={showRestoreModal}
            onClose={() => {
              setShowRestoreModal(false);
              setSelectedReview(null);
            }}
            onConfirm={handleRestore}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
}
