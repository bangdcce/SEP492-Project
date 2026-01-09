import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  Briefcase,
  Mail,
  Award,
} from "lucide-react";
import type { Review } from "../types";
import { StarRating } from "../components/ui/StarRating";
import { TrustBadge } from "../components/ui/TrustBadge";

interface ReviewDetailPageProps {
  review: Review;
  onBack: () => void;
}

export function ReviewDetailPage({ review, onBack }: ReviewDetailPageProps) {
  // Format date

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  // Format short date
  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Format VND currency
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  //Check if review was edited
  const isEdited = review.updatedAt !== review.createdAt;

  //Check if high value project
  const isHighValueProject = review.weight >= 1.5;

  // Status is always COMPLETED (business rule: only completed projects can be reviewed)
  // Keep simple fallback for data consistency
  const getStatusColor = (status?: string) => {
    return status === "COMPLETE"
      ? "bg-green-50 text-green-700 border-green-700"
      : "bg-gray-50 text-gray-700 border-gray-200";
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto h-full w-full">
      {/* Fixed Header with Back Button */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-900 hover:text-teal-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Reviews</span>
          </button>
        </div>
      </div>
      {/* Main Content */}

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Page Title */}
        <div className="border-b-gray-500 border-b-2 py-1">
          <h1 className="text-slate-900 text-3xl mb-2">Review Details</h1>
          <p className="text-gray-600">
            Complete information about this review and project
          </p>
        </div>
        {/* Review Header Section */}
        <div className="bg-linear-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <StarRating rating={review.rating} editable={false} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 ">
              <Calendar className="w-4 h-4" />
              {formatDate(review.createdAt)}
              {isEdited && (
                <span className="italic text-xs text-gray-500">
                  (edited on {formatShortDate(review.updatedAt)})
                </span>
              )}
            </div>
          </div>
          {isHighValueProject && (
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-300 shadow-sm">
              <Award className="w-5 h-5" />
              <span>High Value Project</span>
              <span className="px-2 py-0.5 bg-indigo-200 rounded text-xs">
                Weight: {review.weight.toFixed(1)}x
              </span>
            </div>
          )}
        </div>
        {/* Full Comment */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-slate-900 mb-3">Review Comment</h3>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {review.comment}
          </p>
        </div>
      </div>

      {/* Grid: Reviewer Info | Project Info */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Grid: Reviewer Info | Project Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 shadow-sm">
          <h3 className="text-slate-900 text-xl flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-600" />
            Reviewer Information
          </h3>
          {/* Avatar & Name */}
          <div className="flex items-center gap-4">
            {review.reviewer.avatarUrl ? (
              <img
                src={review.reviewer.avatarUrl}
                alt={review.reviewer.fullName}
                className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center border-2 border-gray-200">
                <span className="text-slate-900 text-2xl">
                  {review.reviewer.fullName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <div className="text-slate-900 text-lg">
                {review.reviewer.fullName}
              </div>
              {review.reviewer.badge && (
                <div className="mt-1">
                  <TrustBadge type={review.reviewer.badge} />
                </div>
              )}
            </div>
          </div>
          {/* Trust Score */}
          {review.reviewer.currentTrustScore !== undefined && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <Award className="w-5 h-5 text-teal-600" />
              <div className="flex-1">
                <div className="text-sm text-gray-600">Trust Score</div>
                <div className="text-xl text-slate-900">
                  {review.reviewer.currentTrustScore.toFixed(1)}
                </div>
              </div>
              <StarRating
                rating={review.reviewer.currentTrustScore}
                editable={false}
              />
            </div>
          )}
          {/* Stats */}
          {review.reviewer.stats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                <div className="text-xs text-gray-600">Finished</div>
                <div className="text-lg text-teal-600">
                  {review.reviewer.stats.finished}
                </div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-xs text-gray-600">Disputes</div>
                <div className="text-lg text-red-600">
                  {review.reviewer.stats.disputes}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-gray-600">Score</div>
                <div className="text-lg text-slate-900">
                  {Number(review.reviewer.stats.score).toFixed(1)}
                </div>
              </div>
            </div>
          )}
          {/* Email */}
          {review.reviewer.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4" />
              {review.reviewer.email}
            </div>
          )}
          {/* Join Date */}
          {review.reviewer.joinedDate && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              Joined {formatShortDate(review.reviewer.joinedDate)}
            </div>
          )}

          {/* Bio */}
          {review.reviewer.bio && (
            <div className="pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600 mb-1">About</div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {review.reviewer.bio}
              </p>
            </div>
          )}
        </div>

        {/*Project Information */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 shadow-sm">
          <h3 className="text-slate-900 text-xl flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-teal-600" />
            Project Information
          </h3>

          {/* Project Title */}
          <div>
            <h4 className="text-slate-900 text-lg mb-2">
              {review.project.title}
            </h4>
            {review.project.status && (
              <span
                className={`inline-block px-3 py-1 rounded-lg text-sm border ${getStatusColor(
                  review.project.status
                )}`}
              >
                {review.project.status.replace("_", " ")}
              </span>
            )}
          </div>
          {/* Budget */}

          <div className="p-4 bg-linear-to-r from-teal-50 to-green-50 border border-teal-200 rounded-lg shadow-sm">
            <div className="text-sm text-gray-600 mb-1">Total Budget</div>
            <div className="text-2xl text-slate-900">
              {formatVND(review.project.totalBudget)}
            </div>
          </div>
          {/* Category */}
          {review.project.category && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Category:</span>
              <span className="px-3 py-1 bg-slate-100 text-slate-900 rounded-lg border border-slate-200">
                {review.project.category}
              </span>
            </div>
          )}
          {/* Timeline */}
          {(review.project.startDate || review.project.endDate) && (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Timeline</div>
              {review.project.startDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">Start:</span>
                  <span className="text-slate-900">
                    {formatShortDate(review.project.startDate)}
                  </span>
                </div>
              )}
              {review.project.endDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">End:</span>
                  <span className="text-slate-900">
                    {formatShortDate(review.project.endDate)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {review.project.description && (
            <div className="pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600 mb-2">Description</div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {review.project.description}
              </p>
            </div>
          )}
          {/* Bottom Action - Back to Reviews */}
          <div className="flex justify-center pt-4">
            <button
              onClick={onBack}
              className="px-8 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors shadow-sm"
            >
              Back to Reviews
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
