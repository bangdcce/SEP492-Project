import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui";
import {
  Star,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { RequestMatchCandidate } from "../types";
import { extractCandidateReasoning } from "../matchReasoning";

interface CandidateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: RequestMatchCandidate | null;
  profileBasePath?: string | null;
}

const roundToOne = (value: number) => Math.round(value * 10) / 10;

const formatDecimal = (value: number) => {
  const rounded = roundToOne(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export function CandidateProfileModal({
  isOpen,
  onClose,
  candidate,
  profileBasePath = "/client",
}: CandidateProfileModalProps) {
  const navigate = useNavigate();

  if (!candidate) {
    return null;
  }

  const {
    userId,
    candidateId,
    fullName,
    classificationLabel,
    matchScore,
    aiRelevanceScore,
    tagOverlapScore,
    normalizedTrust,
    matchedSkills,
    reasoning,
    candidateProfile,
  } = candidate;

  const toNumericScore = (value: number | string | null | undefined) => {
    const parsed =
      typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatScoreOutOf100 = (value: number) => `${formatDecimal(value)}/100`;

  const formatContribution = (value: number) => roundToOne(value);

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const totalScoreValue = roundToOne(toNumericScore(matchScore));
  const techScoreValue = roundToOne(toNumericScore(tagOverlapScore));
  const trustNormalizedValue = roundToOne(
    (() => {
      const normalizedParsed =
        typeof normalizedTrust === "number"
          ? normalizedTrust
          : typeof normalizedTrust === "string"
            ? Number(normalizedTrust)
            : Number.NaN;

      if (Number.isFinite(normalizedParsed)) {
        return clamp(normalizedParsed, 0, 100);
      }

      const raw = candidate?.trustScore;
      const rawParsed =
        typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
      if (Number.isFinite(rawParsed)) {
        return clamp(rawParsed * 20, 0, 100);
      }

      return 0;
    })(),
  );
  const trustRawValue = roundToOne(
    (() => {
      const raw = candidate?.trustScore;
      const parsed =
        typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
      if (Number.isFinite(parsed)) {
        return clamp(parsed, 0, 5);
      }
      return clamp(trustNormalizedValue / 20, 0, 5);
    })(),
  );
  const aiScoreValue =
    aiRelevanceScore !== null && aiRelevanceScore !== undefined
      ? roundToOne(toNumericScore(aiRelevanceScore))
      : null;
  const usesAiScoring = aiScoreValue !== null;
  const aiScoreForBreakdown = aiScoreValue ?? 0;
  const safeMatchedSkills = (matchedSkills || []).filter((skill): skill is string => Boolean(skill));
  const skillPreview = safeMatchedSkills.slice(0, 10);
  const hiddenSkillCount = Math.max(safeMatchedSkills.length - skillPreview.length, 0);
  const matchedSignalsPreview = safeMatchedSkills.slice(0, 6);
  const matchedSignalsText = matchedSignalsPreview.length
    ? `${matchedSignalsPreview.join(", ")}${safeMatchedSkills.length > matchedSignalsPreview.length ? `, +${safeMatchedSkills.length - matchedSignalsPreview.length} more` : ""}`
    : null;

  const scoreBreakdown: Array<{
    label: string;
    raw: number;
    weightLabel: string;
    contribution: number;
    summary: string;
  }> = usesAiScoring
    ? [
        {
          label: "AI relevance",
          raw: aiScoreForBreakdown,
          weightLabel: "50%",
          contribution: formatContribution(aiScoreForBreakdown * 0.5),
          summary:
            aiScoreForBreakdown >= 80
              ? "AI sees a strong contextual fit with the project description."
              : aiScoreForBreakdown >= 50
                ? "AI sees some fit, but not a highly confident one."
                : "AI found weak contextual alignment with the project description.",
        },
        {
          label: "Tech match",
          raw: techScoreValue,
          weightLabel: "30%",
          contribution: formatContribution(techScoreValue * 0.3),
          summary:
            techScoreValue === 0
              ? "No required tech, domain, or profile signals were detected, so this contributes 0."
              : matchedSignalsText
                ? `Matched signals: ${matchedSignalsText}.`
                : "Structured skill and profile overlap contributed to the technical score.",
        },
        {
          label: "Trust & XP",
          raw: trustNormalizedValue,
          weightLabel: "20%",
          contribution: formatContribution(trustNormalizedValue * 0.2),
          summary:
            trustNormalizedValue >= 80
              ? "Strong trust score and completion history lifted the result."
              : trustNormalizedValue >= 50
                ? "Trust and experience helped, but were not enough to dominate the score."
                : "Trust and experience added only a limited boost.",
        },
      ]
    : [
        {
          label: "Tech match",
          raw: techScoreValue,
          weightLabel: "70%",
          contribution: formatContribution(techScoreValue * 0.7),
          summary:
            techScoreValue === 0
              ? "No required tech, domain, or profile signals were detected, so tech contributes 0."
              : matchedSignalsText
                ? `Matched signals: ${matchedSignalsText}.`
                : "Structured skill and profile overlap drove the technical score.",
        },
        {
          label: "Trust & XP",
          raw: trustNormalizedValue,
          weightLabel: "30%",
          contribution: formatContribution(trustNormalizedValue * 0.3),
          summary:
            trustNormalizedValue >= 80
              ? "Strong trust score and experience kept the candidate competitive."
              : trustNormalizedValue >= 50
                ? "Trust and experience provided a moderate lift."
                : "Trust and experience added only a small lift.",
        },
      ];

  const formulaText = usesAiScoring
    ? `${formatDecimal(aiScoreForBreakdown)} x 50% + ${formatDecimal(techScoreValue)} x 30% + ${formatDecimal(trustNormalizedValue)} x 20% = ${formatDecimal(totalScoreValue)}`
    : `${formatDecimal(techScoreValue)} x 70% + ${formatDecimal(trustNormalizedValue)} x 30% = ${formatDecimal(totalScoreValue)}`;
  const headlineExplanation = usesAiScoring
    ? "This score uses AI relevance, tech match, and trust weighting."
    : "This score came from Quick Match, so only tech match and trust were used.";

  const labelConfig: Record<string, { color: string; text: string }> = {
    PERFECT_MATCH: {
      color: "border-emerald-200 bg-emerald-50 text-emerald-700",
      text: "Perfect Match",
    },
    POTENTIAL: {
      color: "border-amber-200 bg-amber-50 text-amber-700",
      text: "Potential Fit",
    },
    HIGH_RISK: {
      color: "border-red-200 bg-red-50 text-red-700",
      text: "High Risk",
    },
    NORMAL: {
      color: "border-slate-200 bg-slate-100 text-slate-700",
      text: "Normal",
    },
  };

  const labelData = classificationLabel ? labelConfig[classificationLabel] || labelConfig.NORMAL : labelConfig.NORMAL;

  const scoreCards: Array<{
    key: string;
    label: string;
    value: string;
    caption?: string;
    icon: LucideIcon;
    tone: string;
  }> = [
    {
      key: "total",
      label: "Total score",
      value: formatScoreOutOf100(totalScoreValue),
      icon: Star,
      tone: "border-slate-200 bg-slate-50 text-slate-800",
    },
    {
      key: "tech",
      label: "Tech match",
      value: formatScoreOutOf100(techScoreValue),
      icon: CheckCircle2,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
    {
      key: "trust",
      label: "Trust and XP",
      value: formatScoreOutOf100(trustNormalizedValue),
      caption: `Raw profile ${formatDecimal(trustRawValue)}/5`,
      icon: ShieldCheck,
      tone: "border-blue-200 bg-blue-50 text-blue-800",
    },
  ];

  if (usesAiScoring) {
    scoreCards.splice(1, 0, {
      key: "ai",
      label: "AI relevance",
      value: formatScoreOutOf100(aiScoreForBreakdown),
      icon: Sparkles,
      tone: "border-indigo-200 bg-indigo-50 text-indigo-800",
    });
  }

  const targetId = userId || candidateId;
  const candidateReasoning = extractCandidateReasoning(reasoning, [userId, candidateId]);
  const displayName = fullName || "Unknown Candidate";
  const avatarFallback = displayName.charAt(0).toUpperCase() || "?";
  const totalScoreBadge = `${formatDecimal(totalScoreValue)} final score`;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="!flex max-h-[88vh] max-w-[min(96vw,960px)] flex-col overflow-hidden p-0">
        <div className="border-b bg-linear-to-r from-slate-50 via-white to-slate-50 px-5 py-4 sm:px-6 sm:py-5">
          <DialogHeader className="gap-4 text-left">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xl font-bold text-primary sm:h-16 sm:w-16 sm:text-2xl">
                  {avatarFallback}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="flex flex-wrap items-center gap-2 text-xl leading-tight sm:text-2xl">
                    <span className="wrap-anywhere">{displayName}</span>
                    <Badge variant="outline" className={`px-2 py-0.5 text-xs ${labelData.color}`}>
                      {labelData.text}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm">
                    {candidateProfile?.companyName ? (
                      <span className="wrap-anywhere">{candidateProfile.companyName}</span>
                    ) : (
                      "Candidate profile overview"
                    )}
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="h-fit bg-white text-slate-700">
                {totalScoreBadge}
              </Badge>
            </div>

            <div className="rounded-lg border bg-white/80 px-3 py-2 text-xs text-slate-600">
              <p className="font-semibold uppercase tracking-wide text-slate-700">Scoring formula</p>
              <p className="mt-1 font-mono text-[12px] leading-relaxed text-slate-800 wrap-anywhere break-all">
                {formulaText}
              </p>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-6 px-5 py-5 pb-8 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {scoreCards.map((card) => (
                <div key={card.key} className={`rounded-xl border p-3 ${card.tone}`}>
                  <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                    <card.icon className="h-3.5 w-3.5" />
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold leading-none tabular-nums">{card.value}</p>
                  {card.caption ? <p className="mt-1 text-xs opacity-90 tabular-nums">{card.caption}</p> : null}
                </div>
              ))}
            </div>

            <div className="rounded-xl border bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-2xl">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Score Breakdown
                  </h4>
                  <p className="mt-1 text-sm text-slate-600">{headlineExplanation}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Trust normalization: profile trust ({formatDecimal(trustRawValue)}/5) x 20 = {formatDecimal(trustNormalizedValue)}/100.
                  </p>
                </div>
                <Badge variant="outline" className="bg-white text-slate-700 tabular-nums">
                  {totalScoreBadge}
                </Badge>
              </div>

              <div className={`mt-4 grid gap-3 ${usesAiScoring ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                {scoreBreakdown.map((item) => (
                  <div key={item.label} className="rounded-lg border bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          Raw: {formatDecimal(item.raw)} • Weight: {item.weightLabel}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-slate-100 text-slate-700 tabular-nums">
                        +{formatDecimal(item.contribution)} pts
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 wrap-anywhere">
                      {item.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {candidateReasoning ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-indigo-700">
                  <Sparkles className="h-4 w-4" />
                  AI Recommendation
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 wrap-anywhere">
                  {candidateReasoning}
                </p>
              </div>
            ) : null}

            <div className="rounded-xl border bg-white p-4">
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                About Candidate
              </h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 wrap-anywhere">
                {candidateProfile?.bio || (
                  <span className="italic text-muted-foreground">No bio provided.</span>
                )}
              </p>
            </div>

            {skillPreview.length > 0 ? (
              <div className="rounded-xl border bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Relevant Skills
                  </h4>
                  <Badge variant="outline" className="bg-slate-50 text-slate-700 tabular-nums">
                    {safeMatchedSkills.length} matched
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skillPreview.map((skill, index) => (
                    <Badge key={`${skill}-${index}`} variant="secondary" className="max-w-full px-2 py-1">
                      <CheckCircle2 className="mr-1 h-3 w-3 shrink-0 text-emerald-500" />
                      <span className="max-w-56 truncate">{skill}</span>
                    </Badge>
                  ))}
                  {hiddenSkillCount > 0 ? (
                    <Badge variant="outline" className="px-2 py-1 text-slate-600 tabular-nums">
                      +{hiddenSkillCount} more
                    </Badge>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground">
            Review score signals before inviting or shortlisting this candidate.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {targetId && profileBasePath ? (
              <Button
                onClick={() => {
                  onClose();
                  navigate(`${profileBasePath}/discovery/profile/${targetId}`);
                }}
                className="shadow-sm"
              >
                <ExternalLink className="mr-2 h-4 w-4" /> View Full Profile
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
