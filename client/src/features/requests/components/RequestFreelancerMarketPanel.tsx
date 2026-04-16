import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
} from "@/shared/components/ui";
import { HelpCircle, Loader2, Sparkles, Star, UserPlus } from "lucide-react";
import type { FreelancerProposalItem, RequestMatchCandidate } from "../types";
import {
  formatSkillChip,
  getCandidateCurrentSkills,
  roundScore,
  toTrustNormalized100,
  toTrustRaw5,
} from "../matchDisplay";

type RequestFreelancerMarketPanelProps = {
  currentPhase: number;
  hasAcceptedFreelancer: boolean;
  selectedFreelancerProposal: FreelancerProposalItem | null;
  recommendedFreelancers: FreelancerProposalItem[];
  freelancerMatchesLoading: boolean;
  freelancerMatches: RequestMatchCandidate[];
  onPhaseAdvance: () => void;
  onQuickMatch: () => void;
  onAiMatch: () => void;
  onOpenScoreExplanation: () => void;
  onSearchMarketplace: () => void;
  onOpenProfile: (candidate: RequestMatchCandidate) => void;
  onInviteFreelancer: (freelancerId: string, freelancerName: string) => void;
  onLoadMore: () => void;
  canLoadMore: boolean;
  isLoadingMore: boolean;
};

export function RequestFreelancerMarketPanel({
  currentPhase,
  hasAcceptedFreelancer,
  selectedFreelancerProposal,
  recommendedFreelancers,
  freelancerMatchesLoading,
  freelancerMatches,
  onPhaseAdvance,
  onQuickMatch,
  onAiMatch,
  onOpenScoreExplanation,
  onSearchMarketplace,
  onOpenProfile,
  onInviteFreelancer,
  onLoadMore,
  canLoadMore,
  isLoadingMore,
}: RequestFreelancerMarketPanelProps) {
  const statusTone = (status?: string | null) => {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "ACCEPTED")
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (normalized === "INVITED")
      return "bg-blue-100 text-blue-800 border-blue-200";
    if (normalized === "PENDING_CLIENT_APPROVAL") {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }
    if (normalized === "REJECTED")
      return "bg-rose-100 text-rose-800 border-rose-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="h-5 w-5 text-indigo-500" /> Freelancer
            Recruitment
          </h2>
          {currentPhase >= 3 ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onQuickMatch}
                disabled={freelancerMatchesLoading}
              >
                {freelancerMatchesLoading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                Quick Match
              </Button>
              <Button
                size="sm"
                className="bg-linear-to-r from-indigo-500 to-purple-600 text-white shadow-md transition-all hover:scale-105 active:scale-95"
                onClick={onAiMatch}
                disabled={freelancerMatchesLoading}
              >
                {freelancerMatchesLoading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                Get AI Suggestion
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {currentPhase < 3 ? (
          <div className="rounded-lg border-2 border-dashed bg-muted/20 py-12 text-center">
            <p className="text-muted-foreground">
              Finalize specs to unlock freelancer recruitment.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {hasAcceptedFreelancer ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-green-900">
                      Freelancer selected
                    </h4>
                    <p className="text-sm text-green-700">
                      {selectedFreelancerProposal?.freelancer?.fullName ||
                        "A freelancer"}{" "}
                      is now the selected execution partner. Next step: broker
                      prepares Final Spec for 3-party review and sign-off.
                    </p>
                  </div>
                  <Button size="sm" onClick={onPhaseAdvance}>
                    Go to Final Spec Step
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/20 p-4">
              <div>
                <h4 className="flex items-center gap-2 font-semibold">
                  Find Freelancers
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-muted"
                    onClick={onOpenScoreExplanation}
                  >
                    <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </h4>
                <p className="text-sm text-muted-foreground">
                  Review ranked freelancers here without leaving the current
                  client request.
                </p>
              </div>
              <Button variant="outline" onClick={onSearchMarketplace}>
                Browse Marketplace
              </Button>
            </div>

            {freelancerMatchesLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-500" />
                <p className="text-muted-foreground">
                  Running matching pipeline...
                </p>
              </div>
            ) : freelancerMatches.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed bg-muted/10 py-8 text-center">
                <p className="text-muted-foreground">
                  No freelancer matches found. Click Quick Match or AI Match
                  above.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Showing {freelancerMatches.length} ranked candidate
                  {freelancerMatches.length === 1 ? "" : "s"}
                </p>
                <div className="space-y-4">
                  {freelancerMatches.map((match) => {
                    const matchId =
                      match.userId || match.candidateId || match.id;
                    const normalizedTrust = toTrustNormalized100(
                      match.normalizedTrust,
                      match.trustScore,
                    );
                    const rawTrust = toTrustRaw5(
                      match.trustScore,
                      match.normalizedTrust,
                    );
                    const topSkills = getCandidateCurrentSkills(match)
                      .slice(0, 4)
                      .map((skill) => formatSkillChip(skill));
                    return (
                      <div
                        key={matchId || match.fullName}
                        className="rounded-xl border bg-background p-4 shadow-sm transition-all hover:bg-muted/10"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex min-w-0 items-start gap-4">
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${
                                match.classificationLabel === "PERFECT_MATCH"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : match.classificationLabel === "POTENTIAL"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : match.classificationLabel === "HIGH_RISK"
                                      ? "border-red-200 bg-red-50 text-red-700"
                                      : "border-gray-200 bg-gray-50 text-gray-700"
                              }`}
                            >
                              {match.fullName?.charAt(0) || "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="mb-1 flex items-center gap-2">
                                <h4 className="text-lg font-semibold">
                                  {match.fullName}
                                </h4>
                                {match.classificationLabel ? (
                                  <Badge
                                    variant={
                                      match.classificationLabel ===
                                      "PERFECT_MATCH"
                                        ? "default"
                                        : "outline"
                                    }
                                    className={`text-[10px] ${
                                      match.classificationLabel ===
                                      "PERFECT_MATCH"
                                        ? "bg-emerald-600"
                                        : match.classificationLabel ===
                                            "POTENTIAL"
                                          ? "border-amber-400 text-amber-700"
                                          : match.classificationLabel ===
                                              "HIGH_RISK"
                                            ? "border-red-400 text-red-700"
                                            : ""
                                    }`}
                                  >
                                    {match.classificationLabel.replace(
                                      /_/g,
                                      " ",
                                    )}
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="mb-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Star className="h-3 w-3" /> Score:{" "}
                                  {roundScore(match.matchScore)}/100
                                </span>
                                {match.aiRelevanceScore !== null &&
                                match.aiRelevanceScore !== undefined ? (
                                  <span className="flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-indigo-500" />{" "}
                                    AI: {roundScore(match.aiRelevanceScore)}
                                    /100
                                  </span>
                                ) : null}
                                <span>
                                  Tech: {roundScore(match.tagOverlapScore)}
                                  /100
                                </span>
                                <span>
                                  Trust: {normalizedTrust ?? "N/A"}/100
                                  {rawTrust !== null
                                    ? ` (${rawTrust.toFixed(1)}/5)`
                                    : ""}
                                </span>
                              </div>
                              {match.matchedSkills?.length ? (
                                <div className="mb-2 flex flex-wrap gap-1">
                                  {match.matchedSkills.map((skill) => (
                                    <Badge
                                      key={skill}
                                      variant="secondary"
                                      className="px-2 py-0.5 text-[10px]"
                                    >
                                      {skill}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                              {topSkills.length ? (
                                <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
                                  Current skills: {topSkills.join(", ")}
                                </p>
                              ) : null}
                              {match.reasoning
                                ? (() => {
                                    let text = match.reasoning;
                                    try {
                                      if (
                                        typeof match.reasoning === "string" &&
                                        match.reasoning.trim().startsWith("[")
                                      ) {
                                        const arr = JSON.parse(match.reasoning);
                                        const matchUserId =
                                          match.userId ||
                                          match.candidateId ||
                                          match.id;
                                        const found = arr.find(
                                          (item: any) =>
                                            item.id === matchUserId,
                                        );
                                        if (found && found.reasoning) {
                                          text = found.reasoning;
                                        } else {
                                          text = "";
                                        }
                                      }
                                    } catch {
                                      text = match.reasoning;
                                    }

                                    return text ? (
                                      <p className="line-clamp-2 text-xs italic text-muted-foreground">
                                        {text}
                                      </p>
                                    ) : null;
                                  })()
                                : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2 self-start md:ml-4 md:self-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOpenProfile(match)}
                            >
                              Profile
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                matchId &&
                                onInviteFreelancer(
                                  matchId,
                                  match.fullName || "Freelancer",
                                )
                              }
                              disabled={!matchId}
                            >
                              <UserPlus className="mr-1 h-4 w-4" /> Invite
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {canLoadMore ? (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        onClick={onLoadMore}
                        disabled={isLoadingMore || freelancerMatchesLoading}
                      >
                        {isLoadingMore ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Load More Freelancers
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div className="space-y-4 rounded-xl border border-dashed bg-muted/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">
                    Freelancers You&apos;ve Recommended
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Track which recommendations are waiting on client review,
                    already invited, or selected.
                  </p>
                </div>
              </div>

              {recommendedFreelancers.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed bg-background py-8 text-center">
                  <p className="font-medium">No recommendations sent yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Invite a ranked freelancer above to start the client
                    approval step.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendedFreelancers.map((proposal) => (
                    <div
                      key={proposal.id}
                      className="rounded-xl border bg-background p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold">
                              {proposal.freelancer?.fullName ||
                                "Unknown freelancer"}
                            </p>
                            <Badge
                              variant="outline"
                              className={statusTone(proposal.status)}
                            >
                              {String(proposal.status || "UNKNOWN").replace(
                                /_/g,
                                " ",
                              )}
                            </Badge>
                          </div>
                          <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                            <p>
                              Trust:{" "}
                              {(() => {
                                const raw = toTrustRaw5(
                                  proposal.freelancer?.currentTrustScore,
                                  null,
                                );
                                const normalized =
                                  raw !== null ? roundScore(raw * 20) : null;
                                return `${normalized ?? "N/A"}/100${
                                  raw !== null ? ` (${raw.toFixed(1)}/5)` : ""
                                }`;
                              })()}
                            </p>
                            <p>
                              Completed projects:{" "}
                              {roundScore(
                                proposal.freelancer?.totalProjectsFinished,
                                0,
                              )}
                            </p>
                          </div>
                          {proposal.coverLetter ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                              Note: {proposal.coverLetter}
                            </p>
                          ) : null}
                          {proposal.freelancer?.recentProjects?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {proposal.freelancer.recentProjects
                                .slice(0, 3)
                                .map((project) => (
                                  <Badge
                                    key={project.id}
                                    variant="secondary"
                                    className="bg-slate-100 text-slate-700"
                                  >
                                    {project.title || "Recent project"}
                                  </Badge>
                                ))}
                            </div>
                          ) : null}
                        </div>
                        {proposal.status === "ACCEPTED" ? (
                          <Button size="sm" onClick={onPhaseAdvance}>
                            Continue to Final Spec
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
