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
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { extractCandidateReasoning } from "../matchReasoning";
import {
  formatSkillChip,
  getCandidateCurrentSkills,
  getCandidateDomains,
  getCandidateProfileTags,
  getCandidateTargetId,
  getPrimarySkillCount,
  getVerifiedSkillCount,
  roundScore,
  toTrustNormalized100,
  toTrustRaw5,
} from "../matchDisplay";
import type { RequestMatchCandidate } from "../types";

interface CandidateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: RequestMatchCandidate | null;
  profileBasePath?: string | null;
}

const labelConfig: Record<string, { color: string; text: string }> = {
  PERFECT_MATCH: {
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    text: "Perfect Match",
  },
  POTENTIAL: {
    color: "bg-amber-100 text-amber-800 border-amber-300",
    text: "Potential Fit",
  },
  HIGH_RISK: {
    color: "bg-red-100 text-red-800 border-red-300",
    text: "High Risk",
  },
  NORMAL: {
    color: "bg-slate-100 text-slate-700 border-slate-300",
    text: "Normal",
  },
};

type ScoreSection = {
  label: string;
  raw: number;
  weightLabel: string;
  contribution: number;
  summary: string;
  detailRows?: Array<{ label: string; value: string }>;
  chips?: string[];
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

  const totalScore = roundScore(candidate.matchScore);
  const techScore = roundScore(candidate.tagOverlapScore);
  const trustNormalized =
    toTrustNormalized100(candidate.normalizedTrust, candidate.trustScore) ?? 0;
  const trustRaw =
    toTrustRaw5(candidate.trustScore, candidate.normalizedTrust) ?? 0;
  const aiScore =
    candidate.aiRelevanceScore !== null &&
    candidate.aiRelevanceScore !== undefined
      ? roundScore(candidate.aiRelevanceScore)
      : null;
  const usesAiScoring = aiScore !== null;
  const currentSkills = getCandidateCurrentSkills(candidate);
  const displayedSkills = currentSkills.slice(0, 8);
  const profileTags = getCandidateProfileTags(candidate).slice(0, 8);
  const domains = getCandidateDomains(candidate);
  const completedProjects = roundScore(candidate.completedProjects, 0);
  const primarySkillCount = getPrimarySkillCount(candidate);
  const verifiedSkillCount = getVerifiedSkillCount(candidate);
  const matchedSignals = (candidate.matchedSkills || []).slice(0, 8);
  const candidateReasoning = extractCandidateReasoning(candidate.reasoning, [
    candidate.userId,
    candidate.candidateId,
    candidate.id,
  ]);
  const targetId = getCandidateTargetId(candidate);
  const canOpenFullProfile = Boolean(targetId && profileBasePath);
  const labelData =
    (candidate.classificationLabel &&
      labelConfig[candidate.classificationLabel]) ||
    labelConfig.NORMAL;

  const techSummary =
    techScore === 0
      ? "No required tech, domain, or profile signals were detected, so tech contributes 0."
      : matchedSignals.length > 0
        ? `Matched signals were detected from the candidate's current skill set and profile tags: ${matchedSignals.join(
            ", ",
          )}.`
        : "The candidate's current skill set and profile signals contributed to the technical score.";

  const trustSummary =
    trustNormalized >= 80
      ? "Strong trust score and execution history kept the candidate competitive."
      : trustNormalized >= 50
        ? "Trust and experience provided a moderate boost."
        : "Trust and experience added only a small boost.";

  const techSection: ScoreSection = {
    label: "Tech match",
    raw: techScore,
    weightLabel: usesAiScoring ? "30%" : "70%",
    contribution: usesAiScoring
      ? Math.round(techScore * 0.3)
      : Math.round(techScore * 0.7),
    summary: techSummary,
    detailRows: [
      {
        label: "Matched signals",
        value: matchedSignals.length
          ? matchedSignals.join(", ")
          : "None detected",
      },
      {
        label: "Current skills",
        value: displayedSkills.length
          ? `${displayedSkills.length} skill${
              displayedSkills.length > 1 ? "s" : ""
            } on profile`
          : "No structured skills listed",
      },
      {
        label: "Profile tags",
        value: profileTags.length
          ? `${profileTags.length} profile tags`
          : "No extra tags listed",
      },
      {
        label: "Domains",
        value: domains.length ? domains.join(", ") : "No domains listed",
      },
    ],
    chips: [
      ...matchedSignals,
      ...displayedSkills.map((skill) => formatSkillChip(skill)),
      ...profileTags,
    ].slice(0, 12),
  };

  const trustSection: ScoreSection = {
    label: "Trust & XP",
    raw: trustNormalized,
    weightLabel: usesAiScoring ? "20%" : "30%",
    contribution: usesAiScoring
      ? Math.round(trustNormalized * 0.2)
      : Math.round(trustNormalized * 0.3),
    summary: trustSummary,
    detailRows: [
      {
        label: "Profile trust",
        value: `${trustRaw.toFixed(1)}/5`,
      },
      {
        label: "Normalized trust",
        value: `${trustNormalized}/100`,
      },
      {
        label: "Completed projects",
        value: `${completedProjects}`,
      },
      {
        label: "Primary skills",
        value: `${primarySkillCount}`,
      },
      {
        label: "Verified skills",
        value: `${verifiedSkillCount}`,
      },
      {
        label: "Experience domains",
        value: domains.length ? domains.join(", ") : "No domain history listed",
      },
    ],
    chips: currentSkills
      .filter((skill) => (skill.yearsExp || 0) > 0)
      .slice(0, 6)
      .map((skill) => formatSkillChip(skill)),
  };

  const scoreBreakdown: ScoreSection[] = usesAiScoring
    ? [
        {
          label: "AI relevance",
          raw: aiScore,
          weightLabel: "50%",
          contribution: Math.round(aiScore * 0.5),
          summary:
            aiScore >= 80
              ? "AI sees a strong contextual fit with the project description."
              : aiScore >= 50
                ? "AI sees some fit, but not a highly confident one."
                : "AI found weak contextual alignment with the project description.",
        },
        techSection,
        trustSection,
      ]
    : [techSection, trustSection];

  const formulaText = usesAiScoring
    ? `${aiScore} x 50% + ${techScore} x 30% + ${trustNormalized} x 20% = ${totalScore}`
    : `${techScore} x 70% + ${trustNormalized} x 30% = ${totalScore}`;
  const headlineExplanation = usesAiScoring
    ? "This score uses AI relevance, tech match, and trust weighting."
    : "This score came from Quick Match, so only tech match and trust were used. Run Get AI Suggestion to add contextual AI scoring.";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-4xl gap-0 overflow-hidden p-0">
        <div
          className={`overflow-y-auto p-5 ${
            canOpenFullProfile ? "max-h-[calc(90vh-5rem)]" : "max-h-[90vh]"
          }`}
        >
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                {candidate.fullName?.charAt(0) || "?"}
              </div>
              <div className="min-w-0">
                <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl">
                  <span className="break-words">
                    {candidate.fullName || "Unknown Candidate"}
                  </span>
                  <Badge
                    variant="outline"
                    className={`px-2 py-0.5 text-xs ${labelData.color}`}
                  >
                    {labelData.text}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="mt-1 flex flex-wrap gap-3 text-sm font-medium">
                  {candidate.candidateProfile?.companyName ? (
                    <span className="break-words text-muted-foreground">
                      {candidate.candidateProfile.companyName}
                    </span>
                  ) : null}
                  {domains.length ? (
                    <span className="break-words text-muted-foreground">
                      {domains.join(" / ")}
                    </span>
                  ) : null}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/20 p-3 text-center">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
                  <Star className="h-3 w-3" /> Total Score
                </span>
                <span className="mt-1 text-2xl font-bold text-primary">
                  {totalScore}/100
                </span>
              </div>

              <div
                className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center ${
                  aiScore !== null
                    ? "bg-indigo-50/60"
                    : "border-dashed bg-slate-50/80"
                }`}
              >
                <span
                  className={`flex items-center gap-1 text-xs font-semibold uppercase ${
                    aiScore !== null ? "text-indigo-600" : "text-slate-500"
                  }`}
                >
                  <Sparkles className="h-3 w-3" /> AI Analysis
                </span>
                {aiScore !== null ? (
                  <span className="mt-1 text-2xl font-bold text-indigo-700">
                    {aiScore}/100
                  </span>
                ) : (
                  <>
                    <span className="mt-1 text-lg font-semibold text-slate-700">
                      Enable AI
                    </span>
                    <span className="mt-1 text-xs text-slate-500">
                      Use Get AI Suggestion to score fit.
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-col items-center justify-center rounded-lg border bg-emerald-50/60 p-3 text-center">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Tech Match
                </span>
                <span className="mt-1 text-2xl font-bold text-emerald-700">
                  {techScore}/100
                </span>
              </div>

              <div className="flex flex-col items-center justify-center rounded-lg border bg-blue-50/60 p-3 text-center">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase text-blue-600">
                  <ShieldCheck className="h-3 w-3" /> Trust & XP
                </span>
                <span className="mt-1 text-2xl font-bold text-blue-700">
                  {trustNormalized}/100
                </span>
                <span className="mt-1 text-xs text-blue-600">
                  Raw profile: {trustRaw.toFixed(1)}/5
                </span>
              </div>
            </div>

            <div className="rounded-xl border bg-slate-50/80 p-4">
              <div className="mb-4">
                <h4 className="text-sm font-semibold uppercase text-slate-700">
                  Score Breakdown
                </h4>
                <p className="mt-1 text-sm text-slate-600">
                  {headlineExplanation}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Trust normalization: profile trust ({trustRaw.toFixed(1)}/5) x
                  20 = {trustNormalized}/100.
                </p>
                <p className="mt-2 rounded-md border bg-white px-3 py-2 font-mono text-sm text-slate-900">
                  {formulaText}
                </p>
              </div>

              <div className="space-y-3">
                {scoreBreakdown.map((section) => (
                  <div
                    key={section.label}
                    className="rounded-lg border bg-white p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">
                          {section.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          Raw: {section.raw} / Weight: {section.weightLabel}
                        </p>
                      </div>
                      <Badge variant="outline">
                        +{section.contribution} pts
                      </Badge>
                    </div>

                    <p className="mt-2 break-words text-sm text-slate-600">
                      {section.summary}
                    </p>

                    {section.detailRows?.length ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {section.detailRows.map((row) => (
                          <div
                            key={`${section.label}-${row.label}`}
                            className="min-w-0 rounded-md bg-slate-50 px-3 py-2"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {row.label}
                            </p>
                            <p className="mt-1 break-words text-sm leading-relaxed text-slate-700">
                              {row.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {section.chips?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {section.chips.map((chip) => (
                          <Badge
                            key={`${section.label}-${chip}`}
                            variant="secondary"
                            className="max-w-full justify-start whitespace-normal break-words bg-slate-100 px-2 py-1 text-left leading-4 text-slate-700"
                          >
                            {chip}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <h4 className="text-sm font-semibold uppercase text-muted-foreground">
                About Candidate
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {candidate.candidateProfile?.bio || (
                  <span className="italic text-muted-foreground">
                    No bio provided.
                  </span>
                )}
              </p>
            </div>

            {candidateReasoning ? (
              <div className="rounded-xl border border-primary/15 bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  AI Recommendation
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {candidateReasoning}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {canOpenFullProfile ? (
          <div className="flex shrink-0 justify-end border-t bg-background p-4">
            <Button
              onClick={() => {
                onClose();
                navigate(`${profileBasePath}/discovery/profile/${targetId}`);
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Full Profile
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
