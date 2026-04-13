import { CheckCircle, ExternalLink, FileText, Globe, Linkedin, XCircle } from "lucide-react";
import type { User } from "../../types";
import { TrustBadge } from "../ui/TrustBadge";

interface TrustScoreCardProps {
  user: User;
}

export function TrustScoreCard({ user }: TrustScoreCardProps) {
  // Convert to number in case API returns string
  const score = Number(user.currentTrustScore) || 0;
  const normalizedRole = String(user.role || "").toUpperCase();
  const isProfessionalRole =
    normalizedRole === "FREELANCER" || normalizedRole === "BROKER";

  const sanitizeLink = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed || /^javascript:/i.test(trimmed)) {
      return null;
    }
    return trimmed;
  };

  const cvUrl = sanitizeLink(user.cvUrl);
  const linkedinUrl = sanitizeLink(user.linkedinUrl);
  const portfolioLinks = (user.portfolioLinks ?? [])
    .map((link) => ({
      title: link.title?.trim() || undefined,
      url: sanitizeLink(link.url) || "",
    }))
    .filter((link) => link.url.length > 0);
  const hasProfessionalLinks =
    Boolean(cvUrl) || Boolean(linkedinUrl) || portfolioLinks.length > 0;

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
        <div className="flex items-center justify-center h-6 sm:h-7">
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
            {user.isVerified ? "KYC Verified" : "KYC Unverified"}
          </div>
        </div>
      </div>

      {isProfessionalRole ? (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Professional Profile
          </p>

          {hasProfessionalLinks ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {cvUrl ? (
                <a
                  href={cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <FileText className="h-3.5 w-3.5" />
                  View CV
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}

              {linkedinUrl ? (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  View LinkedIn
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}

              {portfolioLinks.map((link, index) => (
                <a
                  key={`${link.url}-${index}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100"
                >
                  <Globe className="h-3.5 w-3.5" />
                  View {link.title || `Portfolio ${index + 1}`}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-500">
              No public CV or profile links yet.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
