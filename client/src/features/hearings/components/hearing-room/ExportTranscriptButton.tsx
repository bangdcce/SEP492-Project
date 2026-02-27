import React, { memo, useCallback, useState } from "react";
import { Download } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { DisputeMessage } from "@/features/disputes/types/dispute.types";
import type {
  DisputeHearingSummary,
  HearingStatementSummary,
  HearingQuestionSummary,
} from "@/features/hearings/types";

/* ─── Props ─── */
interface ExportTranscriptButtonProps {
  hearing: DisputeHearingSummary | undefined;
  messages: DisputeMessage[];
  statements: HearingStatementSummary[];
  questions: HearingQuestionSummary[];
}

/* ─── Helpers ─── */

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function senderName(msg: DisputeMessage): string {
  if (msg.sender?.fullName) return msg.sender.fullName;
  if (msg.senderHearingRole) return `[${msg.senderHearingRole}]`;
  if (msg.senderRole) return `[${msg.senderRole}]`;
  return msg.senderId ?? "Unknown";
}

function participantName(
  p?: { user?: { fullName?: string; email?: string }; role?: string } | null,
): string {
  if (p?.user?.fullName) return p.user.fullName;
  if (p?.user?.email) return p.user.email;
  return p?.role ?? "Unknown";
}

/* ─── Transcript Generator ─── */

function generateTranscript(
  hearing: DisputeHearingSummary,
  messages: DisputeMessage[],
  statements: HearingStatementSummary[],
  questions: HearingQuestionSummary[],
): string {
  const lines: string[] = [];
  const hr = "═".repeat(72);
  const sr = "─".repeat(72);

  /* Header */
  lines.push(hr);
  lines.push("  HEARING TRANSCRIPT");
  lines.push(hr);
  lines.push("");
  lines.push(`Hearing ID    : ${hearing.id}`);
  lines.push(`Dispute ID    : ${hearing.disputeId}`);
  lines.push(`Tier          : ${hearing.tier ?? "—"}`);
  lines.push(`Status        : ${hearing.status}`);
  lines.push(
    `Scheduled At  : ${hearing.scheduledAt ? fmtDate(hearing.scheduledAt) : "—"}`,
  );
  lines.push(
    `Started At    : ${hearing.startedAt ? fmtDate(hearing.startedAt) : "—"}`,
  );
  lines.push(
    `Ended At      : ${hearing.endedAt ? fmtDate(hearing.endedAt) : "—"}`,
  );
  lines.push(
    `Duration      : ${hearing.estimatedDurationMinutes ?? "—"} min (estimated)`,
  );
  lines.push("");

  /* Participants */
  if (hearing.participants?.length) {
    lines.push(sr);
    lines.push("  PARTICIPANTS");
    lines.push(sr);
    for (const p of hearing.participants) {
      const name = p.user?.fullName ?? p.user?.email ?? p.userId ?? "Unknown";
      lines.push(
        `  • ${name}  —  ${p.role}  (online: ${p.isOnline ? "yes" : "no"})`,
      );
    }
    lines.push("");
  }

  /* Statements */
  if (statements.length > 0) {
    lines.push(sr);
    lines.push("  FORMAL STATEMENTS");
    lines.push(sr);
    const sorted = [...statements].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    for (const s of sorted) {
      const who = participantName(s.participant);
      lines.push(`[${fmtDate(s.createdAt)}]  ${who} (${s.type})`);
      if (s.title) lines.push(`  Title: ${s.title}`);
      lines.push(`  ${s.content}`);
      if (s.isRedacted) lines.push(`  ⚠ REDACTED: ${s.redactedReason ?? ""}`);
      lines.push("");
    }
  }

  /* Questions */
  if (questions.length > 0) {
    lines.push(sr);
    lines.push("  FORMAL QUESTIONS");
    lines.push(sr);
    const sorted = [...questions].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    for (const q of sorted) {
      const asker = q.askedBy?.fullName ?? q.askedBy?.email ?? q.askedById;
      const target =
        q.targetUser?.fullName ?? q.targetUser?.email ?? q.targetUserId;
      lines.push(`[${fmtDate(q.createdAt)}]  ${asker}  →  ${target}`);
      lines.push(`  Q: ${q.question}`);
      if (q.answer) {
        lines.push(
          `  A: ${q.answer}  (answered ${q.answeredAt ? fmtDate(q.answeredAt) : ""})`,
        );
      } else {
        lines.push(`  Status: ${q.status}`);
      }
      lines.push("");
    }
  }

  /* Messages (chat log) */
  if (messages.length > 0) {
    lines.push(sr);
    lines.push("  CHAT LOG");
    lines.push(sr);
    const sorted = [...messages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    for (const m of sorted) {
      if (m.isHidden) {
        lines.push(
          `[${fmtDate(m.createdAt)}]  [HIDDEN${m.hiddenReason ? `: ${m.hiddenReason}` : ""}]`,
        );
        continue;
      }
      lines.push(`[${fmtDate(m.createdAt)}]  ${senderName(m)}`);
      if (m.content) lines.push(`  ${m.content}`);
      if (m.relatedEvidenceId)
        lines.push(`  📎 Evidence: ${m.relatedEvidenceId}`);
    }
    lines.push("");
  }

  /* Footer */
  lines.push(hr);
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push(hr);

  return lines.join("\n");
}

/* ─── Component ─── */

export const ExportTranscriptButton = memo(function ExportTranscriptButton({
  hearing,
  messages,
  statements,
  questions,
}: ExportTranscriptButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(() => {
    if (!hearing) return;
    setExporting(true);
    try {
      const text = generateTranscript(hearing, messages, statements, questions);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hearing-${hearing.id.slice(0, 8)}-transcript.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [hearing, messages, statements, questions]);

  if (!hearing) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
          aria-label="Export hearing transcript"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {exporting ? "Exporting…" : "Export"}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>Download hearing transcript as text file</TooltipContent>
    </Tooltip>
  );
});
