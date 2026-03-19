import React, { memo, useState, useCallback, useEffect } from "react";
import { UserPlus, Loader2, Search, Send, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/components/ui/utils";
import {
  getHearingSupportCandidates,
  inviteSupportStaff,
} from "@/features/hearings/api";
import type {
  SupportCandidate,
  HearingParticipantRole,
} from "@/features/hearings/types";
import { toast } from "sonner";

/* ─── Role options for assignment ─── */

const ASSIGNABLE_ROLES: {
  value: HearingParticipantRole;
  label: string;
  description: string;
}[] = [
  {
    value: "WITNESS",
    label: "Witness",
    description: "Can provide testimony",
  },
  {
    value: "OBSERVER",
    label: "Observer",
    description: "Can observe but not speak",
  },
];

/* ─── Props ─── */

interface InviteSupportStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hearingId: string;
  onInvited?: () => void;
}

export const InviteSupportStaffDialog = memo(function InviteSupportStaffDialog({
  open,
  onOpenChange,
  hearingId,
  onInvited,
}: InviteSupportStaffDialogProps) {
  const [candidates, setCandidates] = useState<SupportCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] =
    useState<HearingParticipantRole>("WITNESS");
  const [reason, setReason] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Load candidates when dialog opens */
  useEffect(() => {
    if (!open || !hearingId) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getHearingSupportCandidates(hearingId);
        if (!cancelled) setCandidates(data);
      } catch {
        if (!cancelled) setError("Could not load support candidates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, hearingId]);

  const filtered = candidates.filter(
    (c) =>
      !search.trim() ||
      c.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.role?.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedCandidate = candidates.find((c) => c.id === selectedUserId);

  const handleInvite = useCallback(async () => {
    if (!selectedUserId || !reason.trim()) return;
    try {
      setInviting(true);
      await inviteSupportStaff(hearingId, {
        hearingId,
        userId: selectedUserId,
        participantRole: selectedRole,
        reason: reason.trim(),
      });
      toast.success(
        `Invited ${selectedCandidate?.fullName ?? "staff"} as ${selectedRole.toLowerCase()}`,
      );
      onInvited?.();
      onOpenChange(false);
      /* Reset */
      setSelectedUserId(null);
      setReason("");
      setSearch("");
    } catch {
      toast.error("Could not invite support staff");
    } finally {
      setInviting(false);
    }
  }, [
    selectedUserId,
    selectedRole,
    reason,
    hearingId,
    selectedCandidate,
    onInvited,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 text-slate-700" />
            Invite Support Staff
          </DialogTitle>
          <DialogDescription>
            Add additional support staff to this hearing session.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9 text-sm"
            disabled={loading}
          />
        </div>

        {/* Candidate list */}
        <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">
              {search
                ? "No matching candidates"
                : "No support candidates available"}
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() =>
                  setSelectedUserId(c.id === selectedUserId ? null : c.id)
                }
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                  c.id === selectedUserId
                    ? "bg-slate-100 ring-1 ring-inset ring-slate-300"
                    : "hover:bg-slate-50",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    c.id === selectedUserId
                      ? "bg-slate-800 text-white"
                      : "bg-slate-200 text-slate-600",
                  )}
                >
                  {(c.fullName?.[0] ?? c.email?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">
                    {c.fullName || "Unknown"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {c.email}
                    {c.role ? ` · ${c.role}` : ""}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Role selector */}
        {selectedUserId && (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Assign Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ASSIGNABLE_ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setSelectedRole(r.value)}
                  className={cn(
                    "rounded-lg border p-2 text-xs text-center transition-all",
                    selectedRole === r.value
                      ? "border-slate-400 bg-slate-100 text-slate-800 ring-1 ring-slate-400"
                      : "border-slate-200 text-slate-500 hover:border-slate-300",
                  )}
                >
                  <span className="font-medium">{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reason */}
        {selectedUserId && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reason for Invitation <span className="text-rose-500">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this person should join the hearing…"
              rows={3}
              disabled={inviting}
              className="text-sm resize-none"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-md border border-slate-300 px-4 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleInvite()}
            disabled={inviting || !selectedUserId || !reason.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {inviting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {inviting ? "Inviting…" : "Send Invitation"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
