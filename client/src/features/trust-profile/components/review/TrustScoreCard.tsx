import { CheckCircle, XCircle } from "lucide-react";
import type { User } from "../../types";
import { TrustBadge } from "../ui/TrustBadge";

interface TrustScoreCardProps {
  user: User;
}

export function TrustScoreCard({ user }: TrustScoreCardProps) {
  // Convert to number in case API returns string
  const score = Number(user.currentTrustScore) || 0;

  // Determine color based on score
  const getScoreColor = (score: number) => {
    if (score >= 4.0) return "text-teal-600";
    if (score >= 3.0) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressColor = (score: number) => {
    if (score >= 4.0) return "bg-teal-500";
    if (score >= 3.0) return "bg-yellow-500";
    return "bg-red-500";
  };

  const progressPercentage = (score / 5.0) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Trust Score</h3>
        <TrustBadge type={user.badge} />
      </div>

      {/* Score Display */}
      <div className="text-center mb-4">
        <div
          className={`text-3xl sm:text-4xl font-bold ${getScoreColor(score)}`}
        >
          {score.toFixed(1)}
          <span className="text-lg sm:text-xl text-gray-400">/5.0</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-300 ${getProgressColor(
            score
          )}`}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Statistics Grid - Horizontal layout */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t border-gray-200">
        {/* Projects Done */}
        <div className="text-center">
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {user.stats.finished}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">Projects</div>
        </div>

        {/* Disputes */}
        <div className="text-center">
          <div
            className={`text-xl sm:text-2xl font-bold ${
              Number(user.stats.disputes) > 0
                ? "text-red-600"
                : "text-slate-900"
            }`}
          >
            {user.stats.disputes}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">Disputes</div>
        </div>

        {/* Identity Verification */}
        <div className="text-center">
          <div className="flex items-center justify-center">
            {user.isVerified ? (
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
            ) : (
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
            )}
          </div>
          <div
            className={`text-xs sm:text-sm ${
              user.isVerified ? "text-teal-600" : "text-gray-600"
            }`}
          >
            {user.isVerified ? "Verified" : "Unverified"}
          </div>
        </div>
      </div>
    </div>
  );
}
