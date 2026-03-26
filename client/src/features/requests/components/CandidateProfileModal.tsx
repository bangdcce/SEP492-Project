import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Badge,
  ScrollArea,
  Button
} from "@/shared/components/ui";
import { Star, Sparkles, CheckCircle2, ShieldCheck, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { RequestMatchCandidate } from "../types";
import { extractCandidateReasoning } from "../matchReasoning";

interface CandidateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: RequestMatchCandidate | null;
  profileBasePath?: string | null;
}

export function CandidateProfileModal({
  isOpen,
  onClose,
  candidate,
  profileBasePath = "/client",
}: CandidateProfileModalProps) {
  const navigate = useNavigate();
  if (!candidate) return null;

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
    candidateProfile
  } = candidate;

  const toNumericScore = (value: number | string | null | undefined) => {
    const parsed =
      typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const totalScoreValue = toNumericScore(matchScore);
  const techScoreValue = toNumericScore(tagOverlapScore);
  const trustScoreValue = toNumericScore(normalizedTrust);
  const aiScoreValue =
    aiRelevanceScore !== null && aiRelevanceScore !== undefined
      ? toNumericScore(aiRelevanceScore)
      : null;
  const usesAiScoring = aiScoreValue !== null;

  const scoreBreakdown = usesAiScoring
    ? [
        {
          label: "AI relevance",
          raw: aiScoreValue,
          weightLabel: "50%",
          contribution: Math.round(aiScoreValue * 0.5 * 10) / 10,
          summary:
            aiScoreValue >= 80
              ? "AI sees a strong contextual fit with the project description."
              : aiScoreValue >= 50
                ? "AI sees some fit, but not a highly confident one."
                : "AI found weak contextual alignment with the project description.",
        },
        {
          label: "Tech match",
          raw: techScoreValue,
          weightLabel: "30%",
          contribution: Math.round(techScoreValue * 0.3 * 10) / 10,
          summary:
            techScoreValue === 0
              ? "No required tech, domain, or profile signals were detected, so this contributes 0."
              : matchedSkills?.length
                ? `Matched signals: ${matchedSkills.join(", ")}.`
                : "Structured skill and profile overlap contributed to the technical score.",
        },
        {
          label: "Trust & XP",
          raw: trustScoreValue,
          weightLabel: "20%",
          contribution: Math.round(trustScoreValue * 0.2 * 10) / 10,
          summary:
            trustScoreValue >= 80
              ? "Strong trust score and completion history lifted the result."
              : trustScoreValue >= 50
                ? "Trust and experience helped, but were not enough to dominate the score."
                : "Trust and experience added only a limited boost.",
        },
      ]
    : [
        {
          label: "Tech match",
          raw: techScoreValue,
          weightLabel: "70%",
          contribution: Math.round(techScoreValue * 0.7 * 10) / 10,
          summary:
            techScoreValue === 0
              ? "No required tech, domain, or profile signals were detected, so tech contributes 0."
              : matchedSkills?.length
                ? `Matched signals: ${matchedSkills.join(", ")}.`
                : "Structured skill and profile overlap drove the technical score.",
        },
        {
          label: "Trust & XP",
          raw: trustScoreValue,
          weightLabel: "30%",
          contribution: Math.round(trustScoreValue * 0.3 * 10) / 10,
          summary:
            trustScoreValue >= 80
              ? "Strong trust score and experience kept the candidate competitive."
              : trustScoreValue >= 50
                ? "Trust and experience provided a moderate lift."
                : "Trust and experience added only a small lift.",
        },
      ];

  const formulaText = usesAiScoring
    ? `${aiScoreValue} x 50% + ${techScoreValue} x 30% + ${trustScoreValue} x 20% = ${totalScoreValue}`
    : `${techScoreValue} x 70% + ${trustScoreValue} x 30% = ${totalScoreValue}`;
  const headlineExplanation = usesAiScoring
    ? "This score uses AI relevance, tech match, and trust weighting."
    : "This score came from Quick Match, so only tech match and trust were used.";

  const labelConfig: Record<string, { color: string; icon: string; text: string }> = {
    PERFECT_MATCH: { color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "🟢", text: "Perfect Match" },
    POTENTIAL: { color: "bg-amber-100 text-amber-800 border-amber-300", icon: "🟡", text: "Potential Fit" },
    HIGH_RISK: { color: "bg-red-100 text-red-800 border-red-300", icon: "🔴", text: "High Risk" },
    NORMAL: { color: "bg-gray-100 text-gray-800 border-gray-300", icon: "⚪", text: "Normal" }
  };

  const labelData = classificationLabel ? labelConfig[classificationLabel] || labelConfig.NORMAL : labelConfig.NORMAL;
  
  const targetId = userId || candidateId;
  const candidateReasoning = extractCandidateReasoning(reasoning, [userId, candidateId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-1">
        <ScrollArea className="flex-1 p-5 rounded-lg">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                {fullName?.charAt(0) || "?"}
              </div>
              <div>
                <DialogTitle className="text-2xl flex items-center gap-3">
                  {fullName || "Unknown Candidate"}
                  <Badge variant="outline" className={`px-2 py-0.5 text-xs ${labelData.color}`}>
                    {labelData.icon} {labelData.text}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="mt-1 flex gap-4 text-sm font-medium">
                  {candidateProfile?.companyName && (
                    <span className="text-muted-foreground">{candidateProfile.companyName}</span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Scores Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
               <div className="border rounded-lg p-3 bg-muted/20 flex flex-col items-center justify-center text-center">
                 <span className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1"><Star className="w-3 h-3" /> Total Score</span>
                 <span className="text-2xl font-bold mt-1 text-primary">{matchScore ?? 'N/A'}</span>
               </div>
               {aiRelevanceScore !== null && aiRelevanceScore !== undefined && (
                 <div className="border rounded-lg p-3 bg-indigo-50/50 flex flex-col items-center justify-center text-center">
                    <span className="text-xs text-indigo-600 uppercase font-semibold flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Analysis</span>
                    <span className="text-2xl font-bold mt-1 text-indigo-700">{aiRelevanceScore}</span>
                 </div>
               )}
               <div className="border rounded-lg p-3 bg-emerald-50/50 flex flex-col items-center justify-center text-center">
                 <span className="text-xs text-emerald-600 uppercase font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Tech Match</span>
                 <span className="text-2xl font-bold mt-1 text-emerald-700">{tagOverlapScore ?? 'N/A'}</span>
               </div>
               <div className="border rounded-lg p-3 bg-blue-50/50 flex flex-col items-center justify-center text-center">
                 <span className="text-xs text-blue-600 uppercase font-semibold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Trust & XP</span>
                 <span className="text-2xl font-bold mt-1 text-blue-700">{normalizedTrust ?? 'N/A'}</span>
               </div>
            </div>

            <div className="rounded-xl border bg-slate-50/80 p-4">
              <div className="mb-3">
                <h4 className="text-sm font-semibold uppercase text-slate-700">Score Breakdown</h4>
                <p className="mt-1 text-sm text-slate-600">{headlineExplanation}</p>
                <p className="mt-2 rounded-md border bg-white px-3 py-2 font-mono text-sm text-slate-900">
                  {formulaText}
                </p>
              </div>

              <div className="space-y-3">
                {scoreBreakdown.map((item) => (
                  <div key={item.label} className="rounded-lg border bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-500">
                          Raw: {item.raw} • Weight: {item.weightLabel}
                        </p>
                      </div>
                      <Badge variant="outline">+{item.contribution} pts</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{item.summary}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Reasoning */}
            {candidateReasoning && (
                <div className="bg-muted/30 p-4 rounded-xl border border-muted/50">
                    <div className="flex items-center gap-2 mb-2 text-primary font-semibold">
                      <Sparkles className="w-4 h-4" /> 
                      AI Recommendation
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {candidateReasoning}
                    </p>
                </div>
            )}

            {/* Candidate Bio */}
            <div>
              <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">About Candidate</h4>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {candidateProfile?.bio || <span className="text-muted-foreground italic">No bio provided.</span>}
              </p>
            </div>

            {/* Matched Skills */}
            {matchedSkills && matchedSkills.length > 0 && (
                <div>
                   <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Relevant Skills</h4>
                   <div className="flex flex-wrap gap-2">
                       {matchedSkills.map((skill: string) => (
                          <Badge key={skill} variant="secondary" className="px-2 py-1">
                             <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> {skill}
                          </Badge>
                       ))}
                   </div>
                </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t bg-muted/10 flex justify-end">
          {targetId && profileBasePath ? (
            <Button
              onClick={() => {
                onClose();
                navigate(`${profileBasePath}/discovery/profile/${targetId}`);
              }}
              className="shadow-sm"
            >
              <ExternalLink className="w-4 h-4 mr-2" /> View Full Profile
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
