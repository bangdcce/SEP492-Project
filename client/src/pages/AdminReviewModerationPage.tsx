/**
 * AdminReviewModerationPage
 * Admin-only page for moderating reviews (soft delete, restore, manage reports)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield,
  Flag,
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  Clock,
  User,
  Users,
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
  getReviewsForModeration,
  getModerationAssignees,
  openModerationCase,
  releaseModerationCase,
  reassignModerationCase,
  takeModerationCase,
  type ModerationAssigneeOption,
} from "../features/trust-profile/api/adminReviewService";
import { toast } from "sonner";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { getApiErrorDetails } from "@/shared/utils/apiError";
import { connectSocket } from "@/shared/realtime/socket";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

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
  deletedByUser?: {
    id?: string;
    fullName?: string;
    email?: string;
  } | null;
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
  openedBy?: {
    id?: string;
    fullName?: string;
    email?: string;
    role?: string;
  } | null;
  currentAssignee?: {
    id?: string;
    fullName?: string;
    email?: string;
    role?: string;
  } | null;
  lastAssignedBy?: {
    id?: string;
    fullName?: string;
    email?: string;
    role?: string;
  } | null;
  lastAssignedAt?: string | null;
  assignmentVersion?: number;
  lockStatus?: {
    isOpened: boolean;
    isAssigned: boolean;
    openedById?: string | null;
    currentAssigneeId?: string | null;
  };
  moderationHistorySummary?: Array<{
    id: string;
    action: "SOFT_DELETE" | "RESTORE" | "DISMISS_REPORT" | "ASSIGNED" | "RELEASED";
    reason?: string | null;
    performedAt: string;
    performedBy?: {
      id?: string;
      fullName?: string;
      email?: string;
      role?: string;
    } | null;
  }>;
}

type FilterTab = "ALL" | "ACTIVE" | "FLAGGED" | "SOFT_DELETED";

export default function AdminReviewModerationPage() {
  const navigate = useNavigate();
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
  const [queueActionReviewId, setQueueActionReviewId] = useState<string | null>(null);
  const [reassignTargetReview, setReassignTargetReview] = useState<AdminReview | null>(null);
  const [availableAssignees, setAvailableAssignees] = useState<ModerationAssigneeOption[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [reassignReason, setReassignReason] = useState("");

  const currentAdmin = useMemo(
    () =>
      getStoredJson<{ id?: string; fullName?: string; role?: string }>(
        STORAGE_KEYS.USER,
      ),
    [],
  );

  useEffect(() => {
    const loadAssignees = async () => {
      try {
        const admins = await getModerationAssignees();
        setAvailableAssignees(admins);
      } catch (err) {
        console.warn("Failed to load moderation assignees", err);
      }
    };

    void loadAssignees();
  }, []);

  const fetchReviews = useCallback(async () => {
    setIsDataLoading(true);
    setError(null);
    try {
      const data = await getReviewsForModeration(
        activeTab === "ALL" ? undefined : { status: activeTab },
      );

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
            openedBy: review.openedBy
              ? {
                  id: review.openedBy.id || "",
                  fullName: review.openedBy.fullName,
                  email: review.openedBy.email,
                  role: review.openedBy.role,
                }
              : undefined,
            currentAssignee: review.currentAssignee
              ? {
                  id: review.currentAssignee.id || "",
                  fullName: review.currentAssignee.fullName,
                  email: review.currentAssignee.email,
                  role: review.currentAssignee.role,
                }
              : undefined,
            lastAssignedBy: review.lastAssignedBy
              ? {
                  id: review.lastAssignedBy.id || "",
                  fullName: review.lastAssignedBy.fullName,
                  email: review.lastAssignedBy.email,
                  role: review.lastAssignedBy.role,
                }
              : undefined,
            lastAssignedAt: review.lastAssignedAt || undefined,
            assignmentVersion: review.assignmentVersion ?? 0,
            lockStatus: review.lockStatus,
            moderationHistory: review.moderationHistorySummary?.map((action) => ({
              id: action.id,
              action,
            })).map(({ action }) => ({
              id: action.id,
              action: action.action,
              reason: action.reason || undefined,
              performedBy: {
                id: action.performedBy?.id || "",
                fullName: action.performedBy?.fullName || action.performedBy?.email || "Admin",
                role: action.performedBy?.role || "ADMIN",
              },
              performedAt: action.performedAt,
            })),
          })
        );

      setReviews(transformedReviews);
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
      setError("Failed to load reviews. Please try again later.");
    } finally {
      setIsDataLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    const socket = connectSocket();
    const handleNotificationCreated = (payload: {
      notification?: { relatedType?: string | null; relatedId?: string | null };
      relatedType?: string | null;
      relatedId?: string | null;
    }) => {
      const notification = payload?.notification ?? payload;
      if (String(notification?.relatedType || "") === "Review") {
        void fetchReviews();
      }
    };

    socket.on("NOTIFICATION_CREATED", handleNotificationCreated);
    return () => {
      socket.off("NOTIFICATION_CREATED", handleNotificationCreated);
    };
  }, [fetchReviews]);

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
      await fetchReviews();
      setShowDeleteModal(false);
      setSelectedReview(null);
      toast.success("Review soft deleted successfully.");
    } catch (error) {
      console.error("Failed to soft delete review:", error);
      toast.error(getApiErrorDetails(error, "Failed to delete review.").message);
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
      await fetchReviews();
      setShowRestoreModal(false);
      setSelectedReview(null);
      toast.success("Review restored successfully.");
    } catch (error) {
      console.error("Failed to restore review:", error);
      toast.error(getApiErrorDetails(error, "Failed to restore review.").message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeOwnership = async (review: AdminReview) => {
    setQueueActionReviewId(review.id);
    try {
      const action = review.currentAssignee?.id === currentAdmin?.id
        ? releaseModerationCase(review.id, review.assignmentVersion ?? 0)
        : takeModerationCase(review.id, review.assignmentVersion ?? 0);
      await action;
      await fetchReviews();
      toast.success(
        review.currentAssignee?.id === currentAdmin?.id
          ? "Queue ownership released."
          : "Queue ownership assigned to you.",
      );
    } catch (error) {
      toast.error(getApiErrorDetails(error, "Failed to update moderation ownership.").message);
      await fetchReviews();
    } finally {
      setQueueActionReviewId(null);
    }
  };

  const handleOpenCase = async (review: AdminReview) => {
    setQueueActionReviewId(review.id);
    try {
      await openModerationCase(review.id, review.assignmentVersion ?? 0);
      await fetchReviews();
      toast.success("Moderation case opened.");
    } catch (error) {
      toast.error(getApiErrorDetails(error, "Failed to open moderation case.").message);
      await fetchReviews();
    } finally {
      setQueueActionReviewId(null);
    }
  };

  const openReassignDialog = (review: AdminReview) => {
    const fallbackAssigneeId =
      review.currentAssignee?.id ||
      availableAssignees.find((assignee) => assignee.id !== currentAdmin?.id)?.id ||
      "";
    setSelectedAssigneeId(fallbackAssigneeId);
    setReassignReason("");
    setReassignTargetReview(review);
  };

  const handleReassignCase = async () => {
    if (!reassignTargetReview || !selectedAssigneeId) {
      toast.error("Select an assignee first.");
      return;
    }

    setQueueActionReviewId(reassignTargetReview.id);
    try {
      await reassignModerationCase(
        reassignTargetReview.id,
        selectedAssigneeId,
        reassignTargetReview.assignmentVersion ?? 0,
        reassignReason.trim() || undefined,
      );
      await fetchReviews();
      setReassignTargetReview(null);
      setSelectedAssigneeId("");
      setReassignReason("");
      toast.success("Moderation case reassigned.");
    } catch (error) {
      toast.error(getApiErrorDetails(error, "Failed to reassign moderation case.").message);
      await fetchReviews();
    } finally {
      setQueueActionReviewId(null);
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

  const formatActor = (actor?: {
    fullName?: string;
    email?: string;
    role?: string;
  } | null) => {
    if (!actor) return "Unassigned";
    return actor.fullName || actor.email || "Unknown admin";
  };

  const getQueueStatusBadge = (review: AdminReview) => {
    if (review.currentAssignee?.id) {
      const isMine = review.currentAssignee.id === currentAdmin?.id;
      return (
        <span
          className={`px-2 py-1 text-xs rounded-md ${
            isMine
              ? "bg-teal-100 text-teal-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {isMine ? "Assigned to you" : `Assigned to ${formatActor(review.currentAssignee)}`}
        </span>
      );
    }

    if (review.openedBy?.id) {
      return (
        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-md">
          Opened by {formatActor(review.openedBy)}
        </span>
      );
    }

    return (
      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md">
        Queue not opened
      </span>
    );
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
          onClick={() => void fetchReviews()}
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
              Moderate review content outside the report-resolution inbox
            </p>
            <p className="text-xs text-slate-500">
              Signed in as {currentAdmin?.fullName || currentAdmin?.id || "Admin"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={ROUTES.ADMIN_REPORTS}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open report inbox
          </Link>
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
              are logged and auditable. Resolve user-submitted abuse reports from
              the dedicated report inbox so reporter outcomes remain traceable.
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
              data-testid={`moderation-review-${review.id}`}
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
                <div className="flex flex-wrap justify-end gap-2">
                  {!review.lockStatus?.isOpened && (
                    <button
                      data-testid={`moderation-open-case-${review.id}`}
                      onClick={() => handleOpenCase(review)}
                      disabled={queueActionReviewId === review.id}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Shield className="w-4 h-4" />
                      {queueActionReviewId === review.id ? "Opening..." : "Open Case"}
                    </button>
                  )}
                  <button
                    data-testid={`moderation-take-ownership-${review.id}`}
                    onClick={() => handleTakeOwnership(review)}
                    disabled={queueActionReviewId === review.id}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <User className="w-4 h-4" />
                    {queueActionReviewId === review.id
                      ? "Updating..."
                      : review.currentAssignee?.id === currentAdmin?.id
                        ? "Release"
                        : "Take Ownership"}
                  </button>
                  {availableAssignees.length > 1 && (
                    <button
                      data-testid={`moderation-reassign-${review.id}`}
                      onClick={() => openReassignDialog(review)}
                      disabled={queueActionReviewId === review.id}
                      className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Users className="w-4 h-4" />
                      Reassign
                    </button>
                  )}
                  {review.status === "SOFT_DELETED" ? (
                    <button
                      data-testid={`moderation-restore-${review.id}`}
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
                          data-testid={`moderation-open-reports-${review.id}`}
                          onClick={() =>
                            navigate(
                              `${ROUTES.ADMIN_REPORTS}?reviewId=${review.id}`,
                            )
                          }
                          disabled={queueActionReviewId === review.id}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Flag className="w-4 h-4" />
                          Open Reports
                        </button>
                      )}
                      {!review.reportInfo ? (
                        <button
                          data-testid={`moderation-soft-delete-${review.id}`}
                          onClick={() => {
                            setSelectedReview(review);
                            setShowDeleteModal(true);
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={queueActionReviewId === review.id}
                        >
                          <Trash2 className="w-4 h-4" />
                          Soft Delete
                        </button>
                      ) : null}
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

              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {getQueueStatusBadge(review)}
                  <span className="px-2 py-1 bg-white text-slate-600 text-xs rounded-md border border-slate-200">
                    Version {review.assignmentVersion ?? 0}
                  </span>
                </div>
                <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Opened By</div>
                    <div className="mt-1 font-medium text-slate-800">
                      {review.openedBy ? formatActor(review.openedBy) : "Not opened yet"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Current Assignee</div>
                    <div className="mt-1 font-medium text-slate-800">
                      {review.currentAssignee ? formatActor(review.currentAssignee) : "Unassigned"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Last Routed By</div>
                    <div className="mt-1 font-medium text-slate-800">
                      {review.lastAssignedBy ? formatActor(review.lastAssignedBy) : "No assignment history"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Last Assignment</div>
                    <div className="mt-1 font-medium text-slate-800">
                      {review.lastAssignedAt ? formatDate(review.lastAssignedAt) : "No assignment history"}
                    </div>
                  </div>
                </div>
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
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `${ROUTES.ADMIN_REPORTS}?reviewId=${review.id}`,
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-yellow-300 bg-white px-3 py-2 text-xs font-medium text-yellow-900 hover:bg-yellow-100"
                        >
                          <Flag className="h-3.5 w-3.5" />
                          Resolve from report inbox
                        </button>
                      </div>
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

      <Dialog
        open={Boolean(reassignTargetReview)}
        onOpenChange={(open) => {
          if (!open) {
            setReassignTargetReview(null);
            setSelectedAssigneeId("");
            setReassignReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign moderation case</DialogTitle>
            <DialogDescription>
              Choose another admin owner for this review. The request will be rejected if another
              admin already changed the assignment version.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <div className="font-medium text-slate-900">
                {reassignTargetReview?.project.title || "Review case"}
              </div>
              <div className="mt-1">
                Reviewer: {reassignTargetReview?.reviewer.fullName || "Unknown"}
              </div>
              <div className="mt-1">
                Current assignee:{" "}
                {reassignTargetReview?.currentAssignee
                  ? formatActor(reassignTargetReview.currentAssignee)
                  : "Unassigned"}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900" htmlFor="moderation-assignee">
                Assign to
              </label>
              <select
                id="moderation-assignee"
                value={selectedAssigneeId}
                onChange={(event) => setSelectedAssigneeId(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option value="">Select an admin</option>
                {availableAssignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.fullName}
                    {assignee.email ? ` (${assignee.email})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900" htmlFor="moderation-reason">
                Handoff note
              </label>
              <textarea
                id="moderation-reason"
                rows={3}
                value={reassignReason}
                onChange={(event) => setReassignReason(event.target.value)}
                placeholder="Optional context for the next admin owner"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setReassignTargetReview(null);
                setSelectedAssigneeId("");
                setReassignReason("");
              }}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleReassignCase()}
              disabled={!selectedAssigneeId || queueActionReviewId === reassignTargetReview?.id}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {queueActionReviewId === reassignTargetReview?.id ? "Reassigning..." : "Confirm Reassign"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
