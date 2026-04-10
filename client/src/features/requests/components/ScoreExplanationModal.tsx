import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
  Badge
} from "@/shared/components/ui";
import { Star, Sparkles, CheckCircle2, ShieldCheck, HelpCircle } from "lucide-react";

interface ScoreExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScoreExplanationModal({ isOpen, onClose }: ScoreExplanationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] md:w-[85vw] lg:w-[75vw] max-w-4xl max-h-[85vh] flex flex-col p-1">
        <ScrollArea className="flex-1 p-6 rounded-lg overflow-x-hidden">
          <DialogHeader className="mb-4 border-b pb-4">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              AI Matching Engine: Score & Classification Guide
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 text-foreground">
            {/* Section 1 */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-primary flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> 1. The 4-Layer Funnel
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                To ensure speed, accuracy, and fairness, matching happens in 4 distinct steps:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                <li><strong>Hard Filter (Deterministic Sieve):</strong> Drops candidates who are banned, unverified, or have too many active projects.</li>
                <li><strong>Tag Scorer (Deterministic Base):</strong> Calculates strict overlap between the Candidate's skills and the Project Request's Tech Stack.</li>
                <li><strong>AI Ranker (LLM Analysis):</strong> Reads human-written Bios, past experience, and the Project Description to judge <em>contextual fit</em>.</li>
                <li><strong>Classifier (Final Weighted Score):</strong> Blends the Tag Score, AI Score, and Trust Score into a final number and label.</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-primary flex items-center gap-2">
                <Star className="w-5 h-5 drop-shadow-sm text-yellow-500" /> 2. Reading the Final Score
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                The score displayed is out of <strong>100</strong>. Here's how it is calculated when AI is enabled:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg text-center">
                  <div className="text-xl font-bold text-indigo-600 mb-1">50%</div>
                  <div className="text-xs font-semibold uppercase text-indigo-800">AI Relevance</div>
                  <p className="text-xs text-muted-foreground mt-1">How well the AI thinks their experience aligns with your project.</p>
                </div>
                 <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg text-center">
                  <div className="text-xl font-bold text-emerald-600 mb-1">30%</div>
                  <div className="text-xs font-semibold uppercase text-emerald-800">Tag Overlap</div>
                  <p className="text-xs text-muted-foreground mt-1">How many required skills they explicitly possess on their profile.</p>
                </div>
                 <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg text-center">
                  <div className="text-xl font-bold text-blue-600 mb-1">20%</div>
                  <div className="text-xs font-semibold uppercase text-blue-800">Trust Score</div>
                  <p className="text-xs text-muted-foreground mt-1">Platform reliability, KYC status, and dispute history.</p>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3 text-xs text-blue-900">
                <strong>Scale normalization rule:</strong> profile trust is stored on a 0-5 scale, then converted for matching with
                <span className="mx-1 font-mono">normalizedTrust = clamp(profileTrust x 20, 0, 100)</span>.
                This keeps all matching factors in the same 0-100 system.
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs">
                <div className="rounded-md border bg-white p-3">
                  <div className="font-semibold text-slate-800">AI enabled</div>
                  <div className="mt-1 font-mono text-slate-700">final = AI x 0.5 + Tag x 0.3 + Trust100 x 0.2</div>
                </div>
                <div className="rounded-md border bg-white p-3">
                  <div className="font-semibold text-slate-800">Quick Match (AI disabled)</div>
                  <div className="mt-1 font-mono text-slate-700">final = Tag x 0.7 + Trust100 x 0.3</div>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-primary flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" /> 3. Classification Labels
              </h3>
              <div className="space-y-3">
                <div className="flex gap-4 p-3 border rounded-lg bg-card items-start">
                   <div className="shrink-0">
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">🟢 PERFECT MATCH</Badge>
                   </div>
                   <div>
                     <p className="text-sm font-semibold">Score &gt; 85 and AI Score &gt; 80</p>
                   </div>
                </div>
                <div className="flex gap-4 p-3 border rounded-lg bg-card items-start">
                   <div className="shrink-0">
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300">🟡 POTENTIAL</Badge>
                   </div>
                   <div>
                     <p className="text-sm font-semibold">Score &gt; 50</p>
                   </div>
                </div>
                <div className="flex gap-4 p-3 border rounded-lg bg-card items-start">
                   <div className="shrink-0">
                      <Badge className="bg-red-100 text-red-800 border-red-300">🔴 HIGH RISK</Badge>
                   </div>
                   <div>
                     <p className="text-sm font-semibold">Score &lt; 50 or AI Score &lt; 40</p>
                   </div>
                </div>
                 <div className="flex gap-4 p-3 border rounded-lg bg-card items-start">
                   <div className="shrink-0">
                      <Badge className="bg-gray-100 text-gray-800 border-gray-300">⚪ NORMAL</Badge>
                   </div>
                   <div>
                     <p className="text-sm font-semibold">AI Disabled (Score &gt; 50)</p>
                   </div>
                </div>
              </div>
            </section>

             {/* Section 4 */}
             <section className="bg-muted/30 p-5 rounded-xl border border-muted/50 w-full overflow-hidden">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                   <HelpCircle className="w-4 h-4 text-primary" /> Why AI Reasoning Matters
                </h3>
                <div className="text-sm text-muted-foreground leading-relaxed space-y-3 wrap-break-word">
                   <p>
                     Sometimes a candidate has a <strong>100/100 Tag Score</strong> (they clicked every skill check box) but they get a <strong>🔴 HIGH RISK</strong> label. Why?
                   </p>
                   <p>
                     If you read the AI Reasoning text on their profile, you might see something like:
                   </p>
                   <blockquote className="italic border-l-4 border-primary pl-4 py-2 bg-background/50 rounded-r-md text-foreground wrap-break-word whitespace-normal">
                     "The candidate claims to know React and Node, but their bio states they are strictly a Project Manager. Furthermore, they have 0 completed projects. Their stated experience does not align with their selected skills for this technical requirement."
                   </blockquote>
                   <p>
                     The AI layer catches discrepancies that a simple database query would miss!
                   </p>
                </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
