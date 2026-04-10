import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui";
import { RequestAttachmentGallery } from "./RequestAttachmentGallery";
import { Check, FileText, HelpCircle, Info, Loader2, Sparkles, Star, UserPlus, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildTrustProfilePath } from "@/features/trust-profile/routes";
import { RequestStatus, type BrokerApplicationItem, type ProjectRequest, type RequestMatchCandidate, type RequestSlotSummary } from "../types";
import { extractCandidateReasoning } from "../matchReasoning";

const toNumeric = (value: number | string | null | undefined): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type RequestBrokerMarketPanelProps = {
  request: ProjectRequest;
  currentPhase: number;
  isUpdatingStatus: boolean;
  brokerSlotSummary: RequestSlotSummary | null;
  pendingBrokerApplications: BrokerApplicationItem[];
  nonPendingBrokerApplications: BrokerApplicationItem[];
  matches: RequestMatchCandidate[];
  brokerMatchesLoading: boolean;
  onChangeVisibility: (status: RequestStatus) => void;
  onAcceptBroker: (brokerId: string) => void;
  onReleaseBrokerSlot: (proposalId: string) => void;
  onInviteBroker: (brokerId: string, brokerName: string) => void;
  onOpenProfile: (candidate: RequestMatchCandidate) => void;
  onPhaseAdvance: () => void;
  onOpenAssignedBrokerProfile?: (() => void) | null;
  onOpenScoreExplanation: () => void;
  onSearchMarketplace: () => void;
  onGetAiSuggestions: () => void;
  formatDate: (value: string | null | undefined, format: string) => string;
};

export function RequestBrokerMarketPanel({
  request,
  currentPhase,
  isUpdatingStatus,
  brokerSlotSummary,
  pendingBrokerApplications,
  nonPendingBrokerApplications,
  matches,
  brokerMatchesLoading,
  onChangeVisibility,
  onAcceptBroker,
  onReleaseBrokerSlot,
  onInviteBroker,
  onOpenProfile,
  onPhaseAdvance,
  onOpenAssignedBrokerProfile,
  onOpenScoreExplanation,
  onSearchMarketplace,
  onGetAiSuggestions,
  formatDate,
}: RequestBrokerMarketPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDraftVisibilityStatus =
    request.status === RequestStatus.PUBLIC_DRAFT || request.status === RequestStatus.PRIVATE_DRAFT;

  const openBrokerTrustProfile = (brokerId?: string) => {
    if (!brokerId) {
      return;
    }

    navigate(
      buildTrustProfilePath(brokerId, {
        pathname: location.pathname,
        role: "CLIENT",
      }),
    );
  };

  const getBrokerReasoning = (candidate: RequestMatchCandidate) => {
    return extractCandidateReasoning(candidate.reasoning, [
      candidate.id,
      candidate.candidateId,
      candidate.userId,
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Broker Recruitment</h2>
      </CardHeader>
      <CardContent>
        <div className="mb-6 rounded-lg border bg-muted/20 p-4">
          <h3 className="mb-2 font-semibold">Project Brief</h3>
          <p className="line-clamp-3 text-sm text-muted-foreground">{request.description}</p>
        </div>

        {currentPhase >= 2 ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-green-800">Broker Hired</h3>
            <p className="mx-auto mb-6 max-w-md text-green-700">
              You have successfully hired <strong>{request.broker?.fullName || "a Broker"}</strong> for this project.
              Proceed to the next phase to finalize specifications.
            </p>
            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                className="border-green-600 bg-white text-green-600 hover:bg-green-100"
                onClick={onOpenAssignedBrokerProfile ?? undefined}
                disabled={!onOpenAssignedBrokerProfile}
              >
                View Broker Profile
              </Button>
              <Button onClick={onPhaseAdvance}>Go to Finalize Specs</Button>
            </div>
          </div>
        ) : (
          <>
            {isDraftVisibilityStatus && (
              <div className="mb-6 rounded-lg border bg-background p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                        Current Visibility
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            request.status === RequestStatus.PUBLIC_DRAFT ? "bg-green-500" : "bg-amber-500"
                          }`}
                        />
                        <span className="text-lg font-bold">
                          {request.status === RequestStatus.PUBLIC_DRAFT ? "Public (Open to All)" : "Private (Invite Only)"}
                        </span>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary">
                          <Info className="h-5 w-5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Public vs. Private Requests</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <div className="border-l-4 border-green-500 py-1 pl-4">
                            <h4 className="font-bold text-green-700">Public Request</h4>
                            <p className="text-sm text-muted-foreground">
                              Visible to all brokers on the marketplace. Any broker can submit a proposal.
                            </p>
                          </div>
                          <div className="border-l-4 border-amber-500 py-1 pl-4">
                            <h4 className="font-bold text-amber-700">Private Request</h4>
                            <p className="text-sm text-muted-foreground">
                              Hidden from the marketplace. Only brokers you explicitly invite can see and apply.
                            </p>
                          </div>
                          <div className="rounded bg-muted p-3 text-xs">
                            <strong>Note:</strong> Switching from Public to Private automatically rejects pending proposals.
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Button
                    variant={request.status === RequestStatus.PUBLIC_DRAFT ? "outline" : "default"}
                    onClick={() =>
                      onChangeVisibility(
                        request.status === RequestStatus.PUBLIC_DRAFT
                          ? RequestStatus.PRIVATE_DRAFT
                          : RequestStatus.PUBLIC_DRAFT,
                      )
                    }
                    disabled={isUpdatingStatus}
                  >
                    {request.status === RequestStatus.PUBLIC_DRAFT ? "Make Project Private" : "Make Project Public"}
                  </Button>
                </div>
              </div>
            )}

            {((request.attachments?.length ?? 0) > 0 || brokerSlotSummary) && (
              <div className="mb-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <FileText className="h-4 w-4" />
                    Attachments
                  </div>
                  {request.attachments?.length ? (
                    <RequestAttachmentGallery attachments={request.attachments} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No attachment uploaded yet.</p>
                  )}
                </div>

                {brokerSlotSummary && (
                  <div className="rounded-lg border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Users className="h-4 w-4" />
                      Broker Slot Window
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-md bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Active</div>
                        <div className="text-lg font-semibold text-slate-900">{brokerSlotSummary.activeApplications}</div>
                      </div>
                      <div className="rounded-md bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Remaining</div>
                        <div className="text-lg font-semibold text-slate-900">{brokerSlotSummary.remainingSlots}</div>
                      </div>
                      <div className="rounded-md bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Window</div>
                        <div className="text-lg font-semibold text-slate-900">{brokerSlotSummary.windowHours}h</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {request.status === RequestStatus.PUBLIC_DRAFT && (
              <div className="mb-8 space-y-8">
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <FileText className="h-5 w-5" /> Incoming Applications
                    <Badge variant="secondary">{pendingBrokerApplications.length}</Badge>
                  </h3>

                  {pendingBrokerApplications.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed bg-muted/10 py-6 text-center">
                      <p className="text-muted-foreground">No applications received yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingBrokerApplications.map((proposal) => {
                        const brokerId = proposal.brokerId || proposal.broker?.id;
                        return (
                          <div
                            key={proposal.id}
                            className="flex items-start justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted/10"
                          >
                            <div>
                              <div className="mb-1 flex items-center gap-2">
                                <h4 className="text-lg font-bold">{proposal.broker?.fullName || "Unknown Broker"}</h4>
                                <Badge>{proposal.status}</Badge>
                              </div>
                              <p className="mb-2 text-sm text-muted-foreground">
                                Applied on {formatDate(proposal.createdAt, "MMM d, yyyy")}
                              </p>
                              <div className="rounded-md bg-muted p-3 text-sm italic">
                                "{proposal.coverLetter || "No cover letter provided."}"
                              </div>
                              {proposal.broker?.recentProjects?.length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {proposal.broker.recentProjects.map((project) => (
                                    <Badge key={project.id} variant="outline" className="text-[11px]">
                                      {project.title} · {project.status}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="outline"
                                onClick={() => openBrokerTrustProfile(brokerId)}
                                disabled={!brokerId}
                              >
                                View Trust Profile
                              </Button>
                              <Button onClick={() => brokerId && onAcceptBroker(brokerId)} disabled={!brokerId}>
                                Hire Broker
                              </Button>
                              {request.viewerPermissions?.canReleaseBrokerSlot && (
                                <Button variant="outline" onClick={() => onReleaseBrokerSlot(proposal.id)}>
                                  Release Slot
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <UserPlus className="h-5 w-5" /> Sent Invitations
                    <Badge variant="secondary">{nonPendingBrokerApplications.length}</Badge>
                  </h3>

                  {nonPendingBrokerApplications.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed bg-muted/10 py-6 text-center">
                      <p className="text-muted-foreground">No invitations sent yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {nonPendingBrokerApplications.map((proposal) => {
                        const brokerId = proposal.brokerId || proposal.broker?.id;
                        return (
                          <div key={proposal.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
                            <div>
                              <div className="mb-1 flex items-center gap-2">
                                <h4 className="font-semibold">{proposal.broker?.fullName || "Unknown Broker"}</h4>
                                <Badge variant="outline">{proposal.status}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Invited on {formatDate(proposal.createdAt, "MMM d, yyyy")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openBrokerTrustProfile(brokerId)}
                                disabled={!brokerId}
                              >
                                View Trust Profile
                              </Button>
                              {String(proposal.status).toUpperCase() === "ACCEPTED" ? (
                                <Button onClick={() => brokerId && onAcceptBroker(brokerId)} size="sm" disabled={!brokerId}>
                                  Hire Candidate
                                </Button>
                              ) : String(proposal.status).toUpperCase() === "INVITED" ? (
                                <span className="text-sm italic text-muted-foreground">Waiting for response...</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isDraftVisibilityStatus && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <UserPlus className="h-5 w-5" /> Find & Invite Brokers
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
                      {matches.length} Matches
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={onOpenScoreExplanation}>
                        <HelpCircle className="h-5 w-5 text-muted-foreground" />
                      </Button>
                    </span>
                    <Button size="sm" variant="outline" onClick={onSearchMarketplace}>
                      Search
                    </Button>
                    <Button
                      size="sm"
                      className="bg-linear-to-r from-indigo-500 to-purple-600 text-white shadow-sm"
                      onClick={onGetAiSuggestions}
                      disabled={brokerMatchesLoading}
                    >
                      {brokerMatchesLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                      Get AI Suggestion
                    </Button>
                  </div>
                </div>

                {matches.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No brokers found matching your criteria.</p>
                ) : (
                  matches.map((broker) => {
                    const brokerId = broker.id || broker.candidateId || broker.userId;
                    const reasoning = getBrokerReasoning(broker);
                    const normalizedTrust = (() => {
                      const normalized = toNumeric(broker.normalizedTrust);
                      if (normalized !== null) {
                        return Math.round(clamp(normalized, 0, 100) * 10) / 10;
                      }
                      const raw = toNumeric(broker.trustScore);
                      return raw !== null ? Math.round(clamp(raw * 20, 0, 100) * 10) / 10 : null;
                    })();
                    const rawTrust = (() => {
                      const raw = toNumeric(broker.trustScore);
                      if (raw !== null) {
                        return Math.round(clamp(raw, 0, 5) * 10) / 10;
                      }
                      return normalizedTrust !== null ? Math.round((normalizedTrust / 20) * 10) / 10 : null;
                    })();
                    return (
                      <div
                        key={brokerId || broker.fullName}
                        className="flex items-center justify-between rounded-lg border bg-background p-4 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold ${
                              broker.classificationLabel === "PERFECT_MATCH"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : broker.classificationLabel === "POTENTIAL"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : broker.classificationLabel === "HIGH_RISK"
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : "border-gray-200 bg-gray-50 text-gray-700"
                            }`}
                          >
                            {broker.fullName?.charAt(0) || "?"}
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold">{broker.fullName || "Unknown Broker"}</h4>
                            <div className="mb-1 mt-1 flex items-center gap-2">
                              {broker.classificationLabel ? (
                                <Badge
                                  variant={broker.classificationLabel === "PERFECT_MATCH" ? "default" : "outline"}
                                  className={`text-[10px] ${
                                    broker.classificationLabel === "PERFECT_MATCH"
                                      ? "bg-emerald-600"
                                      : broker.classificationLabel === "POTENTIAL"
                                        ? "border-amber-400 text-amber-700"
                                        : broker.classificationLabel === "HIGH_RISK"
                                          ? "border-red-400 text-red-700"
                                          : ""
                                  }`}
                                >
                                  {broker.classificationLabel.replace(/_/g, " ")}
                                </Badge>
                              ) : null}

                              {broker.matchScore !== undefined && broker.matchScore !== null ? (
                                <div className="flex gap-3 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Star className="h-3 w-3" /> Score: {broker.matchScore}/100
                                  </span>
                                  {broker.aiRelevanceScore !== null && broker.aiRelevanceScore !== undefined ? (
                                    <span className="flex items-center gap-1">
                                      <Sparkles className="h-3 w-3 text-indigo-500" /> AI: {broker.aiRelevanceScore}/100
                                    </span>
                                  ) : null}
                                  <span>Tag: {broker.tagOverlapScore ?? "N/A"}/100</span>
                                  <span>
                                    Trust: {normalizedTrust ?? "N/A"}/100
                                    {rawTrust !== null ? ` (${rawTrust.toFixed(1)}/5)` : ""}
                                  </span>
                                </div>
                              ) : null}
                            </div>

                            {broker.matchedSkills?.length ? (
                              <div className="mb-1 flex flex-wrap gap-1">
                                {broker.matchedSkills.map((skill) => (
                                  <Badge key={skill} variant="secondary" className="px-2 py-0.5 text-[10px]">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}

                            {reasoning ? (
                              <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">{reasoning}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => onOpenProfile(broker)}>
                            Profile
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => brokerId && onInviteBroker(brokerId, broker.fullName || "Broker")}
                            disabled={!brokerId}
                          >
                            <UserPlus className="mr-2 h-4 w-4" /> Invite
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
