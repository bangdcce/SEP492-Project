import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Badge,
  ScrollArea
} from "@/shared/components/ui";
import { Star, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

interface CandidateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: any | null; // MatchResult
}

export function CandidateProfileModal({ isOpen, onClose, candidate }: CandidateProfileModalProps) {
  if (!candidate) return null;

  const {
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

  const labelConfig: Record<string, { color: string; icon: string; text: string }> = {
    PERFECT_MATCH: { color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "🟢", text: "Perfect Match" },
    POTENTIAL: { color: "bg-amber-100 text-amber-800 border-amber-300", icon: "🟡", text: "Potential Fit" },
    HIGH_RISK: { color: "bg-red-100 text-red-800 border-red-300", icon: "🔴", text: "High Risk" },
    NORMAL: { color: "bg-gray-100 text-gray-800 border-gray-300", icon: "⚪", text: "Normal" }
  };

  const labelData = classificationLabel ? labelConfig[classificationLabel] || labelConfig.NORMAL : labelConfig.NORMAL;

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

            {/* AI Reasoning */}
            {reasoning && (
                <div className="bg-muted/30 p-4 rounded-xl border border-muted/50">
                    <div className="flex items-center gap-2 mb-2 text-primary font-semibold">
                      <Sparkles className="w-4 h-4" /> 
                      AI Recommendation
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {reasoning}
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

            {/* Other Profile Specifics */}
            {candidateProfile?.portfolioLinks && candidateProfile.portfolioLinks.length > 0 && (
               <div>
                  <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Portfolio Details</h4>
                  <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                     {candidateProfile.portfolioLinks.map((link: any, idx: number) => (
                        <li key={idx}>
                          <a href={link.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            {link.title || link.url}
                          </a>
                        </li>
                     ))}
                  </ul>
               </div>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
