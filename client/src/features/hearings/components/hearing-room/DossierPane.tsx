import React, { memo, useState } from "react";
import {
  Gavel,
  ExternalLink,
  Timer,
  Users,
  Shield,
  UserCheck,
  FileText,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { cn } from "@/shared/components/ui/utils";
import {
  hearingStatusBadgeClass,
  formatDateTime,
  cardClass,
  sectionCardClass,
  panelTitleClass,
} from "./constants";
import { EvidenceGallery } from "./EvidenceGallery";
import type { HearingWorkspaceSummary } from "@/features/hearings/types";
import type { DisputeEvidence } from "@/features/disputes/types/dispute.types";

interface DossierPaneProps {
  workspace: HearingWorkspaceSummary | null;
  evidence?: DisputeEvidence[];
  previewEvidenceId?: string | null;
  onSelectEvidence?: (id: string) => void;
  disputeId?: string;
}

type DossierTab = "overview" | "spec" | "evidence" | "timeline";

export const DossierPane = memo(function DossierPane({
  workspace,
  evidence,
  previewEvidenceId,
  onSelectEvidence,
  disputeId,
}: DossierPaneProps) {
  const [tab, setTab] = useState<DossierTab>("overview");

  const timelineLog = React.useMemo(
    () =>
      [...(workspace?.timeline ?? [])].sort((a, b) => {
        const aMs = new Date(a.occurredAt).getTime();
        const bMs = new Date(b.occurredAt).getTime();
        return (
          (Number.isFinite(aMs) ? aMs : 0) - (Number.isFinite(bMs) ? bMs : 0)
        );
      }),
    [workspace?.timeline],
  );

  return (
    <div className={cn(cardClass, "p-4 overflow-x-hidden")}>
      <div className="flex items-center gap-2">
        <Gavel className="h-4 w-4 text-amber-600" />
        <h3 className={panelTitleClass}>Dispute Dossier</h3>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as DossierTab)}
        className="mt-3"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="spec">Spec</TabsTrigger>
          <TabsTrigger value="evidence">
            Evidence{evidence?.length ? ` (${evidence.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="timeline">Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge
              className={hearingStatusBadgeClass(
                workspace?.dossier?.dispute?.status,
              )}
            >
              {workspace?.dossier?.dispute?.status?.replace(/_/g, " ") ||
                "STATUS N/A"}
            </Badge>
            <Badge className="border-slate-300 bg-slate-100 text-slate-700 text-xs">
              {workspace?.dossier?.dispute?.phase?.replace(/_/g, " ") ||
                "PHASE N/A"}
            </Badge>
          </div>

          <div className="space-y-2">
            <InfoRow
              label="Project"
              value={workspace?.dossier?.project?.title}
            />
            <InfoRow
              label="Milestone"
              value={workspace?.dossier?.milestone?.milestoneTitle}
            />
            <InfoRow
              label="Disputed Amount"
              value={
                workspace?.dossier?.dispute?.disputedAmount
                  ? `${workspace.dossier.dispute.disputedAmount.toLocaleString()} VND`
                  : undefined
              }
            />
          </div>

          {/* Dispute Parties */}
          {workspace?.dossier?.dispute && (
            <div className={sectionCardClass}>
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Dispute Parties
                </p>
              </div>
              <div className="space-y-2">
                {/* Raiser */}
                {(workspace.dossier.dispute.raiser ||
                  workspace.dossier.dispute.raisedBy) && (
                  <div className="flex items-start gap-2">
                    <Shield className="h-3.5 w-3.5 text-sky-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-sky-700">
                        Raiser
                      </p>
                      <p className="text-sm text-slate-900 truncate">
                        {workspace.dossier.dispute.raiser?.name ||
                          workspace.dossier.dispute.raisedBy?.name ||
                          workspace.dossier.dispute.raiser?.email ||
                          workspace.dossier.dispute.raisedBy?.email ||
                          "Unknown"}
                      </p>
                      {(workspace.dossier.dispute.raiser?.role ||
                        workspace.dossier.dispute.raisedBy?.role) && (
                        <p className="text-xs text-slate-400">
                          {(
                            workspace.dossier.dispute.raiser?.role ||
                            workspace.dossier.dispute.raisedBy?.role
                          )?.replace(/_/g, " ")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {/* Defendant */}
                {workspace.dossier.dispute.defendant && (
                  <div className="flex items-start gap-2">
                    <Shield className="h-3.5 w-3.5 text-rose-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-rose-700">
                        Defendant
                      </p>
                      <p className="text-sm text-slate-900 truncate">
                        {workspace.dossier.dispute.defendant.name ||
                          workspace.dossier.dispute.defendant.email ||
                          "Unknown"}
                      </p>
                      {workspace.dossier.dispute.defendant.role && (
                        <p className="text-xs text-slate-400">
                          {workspace.dossier.dispute.defendant.role.replace(
                            /_/g,
                            " ",
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {/* Assigned Staff */}
                {workspace.dossier.dispute.assignedStaff && (
                  <div className="flex items-start gap-2">
                    <UserCheck className="h-3.5 w-3.5 text-slate-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-slate-600">
                        Assigned Staff
                      </p>
                      <p className="text-sm text-slate-900 truncate">
                        {workspace.dossier.dispute.assignedStaff.name ||
                          workspace.dossier.dispute.assignedStaff.email ||
                          "Unknown"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(workspace?.dossier?.issues ?? []).map((issue) => (
            <div key={issue.code} className={sectionCardClass}>
              <p className="text-sm font-medium text-slate-900">
                {issue.label}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {String(issue.value)}
              </p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="spec" className="mt-3 space-y-3">
          <div className={sectionCardClass}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Project Spec
            </p>
            {workspace?.dossier?.projectSpec ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {workspace.dossier.projectSpec.title || "N/A"}
                </p>
                <p className="text-xs text-slate-500">
                  {workspace.dossier.projectSpec.status?.replace(/_/g, " ") ||
                    "N/A"}
                </p>
                <p className="text-xs text-slate-500">
                  Updated:{" "}
                  {formatDateTime(workspace.dossier.projectSpec.updatedAt)}
                </p>
                {(workspace.dossier.projectSpec.referenceLinks ?? []).map(
                  (link, index) => (
                    <a
                      key={`${link.url}-${index}`}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky-800"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {link.label || `Reference ${index + 1}`}
                    </a>
                  ),
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No spec linked.</p>
            )}
          </div>

          <div className="space-y-2">
            {workspace?.dossier?.contracts?.length ? (
              workspace.dossier.contracts.map((contract) => (
                <div key={contract.id} className={sectionCardClass}>
                  <p className="text-sm font-medium text-slate-900 break-words">
                    {contract.title || contract.id}
                  </p>
                  <p className="text-xs text-slate-500">
                    {contract.status?.replace(/_/g, " ") || "Unknown"}
                  </p>
                  {contract.contractUrl ? (
                    <a
                      href={contract.contractUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky-800 mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open contract document
                    </a>
                  ) : null}
                  {contract.termsContent ? (
                    <details className="mt-1.5" open>
                      <summary className="text-xs font-medium text-slate-600 cursor-pointer hover:text-slate-800 select-none">
                        Contract terms
                      </summary>
                      <div className="mt-1 max-h-64 overflow-y-auto rounded border border-slate-200 bg-white p-2">
                        <p className="text-xs text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                          {contract.termsContent}
                        </p>
                      </div>
                    </details>
                  ) : contract.termsPreview ? (
                    <details className="mt-1.5">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 select-none">
                        View terms preview
                      </summary>
                      <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap break-words leading-relaxed border-t border-slate-200 pt-1.5">
                        {contract.termsPreview}
                      </p>
                    </details>
                  ) : !contract.contractUrl ? (
                    <p className="text-xs text-slate-400 mt-1 italic">
                      No contract content available
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No contracts.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="evidence" className="mt-3">
          {evidence && onSelectEvidence ? (
            <EvidenceGallery
              evidence={evidence}
              previewEvidenceId={previewEvidenceId ?? null}
              onSelectEvidence={onSelectEvidence}
              disputeId={disputeId}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-400">
                No evidence data available.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-3 space-y-2">
          {timelineLog.length ? (
            timelineLog.map((item) => (
              <div key={item.id} className={sectionCardClass}>
                <div className="flex items-start gap-2">
                  <Timer className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(item.occurredAt)}
                    </p>
                    {item.description && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">
              No dossier timeline events.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
});

/* ─── Helper ─── */

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 break-words text-right max-w-[60%]">
        {value || "N/A"}
      </span>
    </div>
  );
}
