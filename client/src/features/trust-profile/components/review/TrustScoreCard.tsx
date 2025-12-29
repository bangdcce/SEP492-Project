import { CheckCircle, XCircle } from "lucide-react";
import type { User } from "../../types";
import { TrustBadge } from "../ui/TrustBadge";

interface TrustScoreCardProps {
  user: User;
}

export function TrustScoreCard({ user }: TrustScoreCardProps) {
  const score = user.currentTrustScore;

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
    <div className="bg-white border-gray-200 rounded-lg p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-slate-900">Trust Score</h3>
        <TrustBadge type={user.badge}></TrustBadge>
      </div>

      {/* Score Display */}
      <div className="text-center mb-6">
        <div className={`text-5xl mb-2 ${getScoreColor(score)}`}>
          {score.toFixed(1)}
          <span className="text-2xl text-gray-400">/5.0</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-lg h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${getProgressColor(
            score
          )}`}
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>

      {/* Statistics Grid */}
      <div className="grid gird-cols-3 gap-4 pt-4 border-t border-gray-200">
        {/* Projects Done */}
        <div className="text-center">
          <div className="text-2xl text-slate-900 mb-1">
            {user.stats.finished}
          </div>
          <div className="text-sm text-gray-600">Projects Done</div>
        </div>

        {/* Disputes */}
        <div className="text-center">
          <div
            className={`text-2xl mb-1 ${
              user.stats.disputes > 0 ? "text-red-600" : "text-slate-900"
            }`}
          >
            {user.stats.disputes}
          </div>
          <div className="text-sm text-gray-600">Disputes</div>
        </div>
        {/* Identity Verification */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            {user.isVerified ? (
              <CheckCircle className="w-6 h-6 text-teal-600" />
            ) : (
              <XCircle className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <div
            className={`text-sm ${
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
