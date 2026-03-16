import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  FileCheck2,
  FileSearch,
  FileText,
  Gavel,
  HelpCircle,
  History,
  Loader2,
  MessageSquare,
  Reply,
  Save,
  Scale,
  Send,
  Shield,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/Input";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/components/ui/utils";
import type {
  HearingStatementContentBlock,
  HearingStatementSummary,
  HearingStatementType,
} from "@/features/hearings/types";

type StatementSectionKey =
  | "summary"
  | "facts"
  | "evidenceBasis"
  | "analysis"
  | "remedy"
  | "addendum";

type StatementSections = Record<StatementSectionKey, string>;

interface StatementTypeMeta {
  value: HearingStatementType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

const STATEMENT_TYPES: StatementTypeMeta[] = [
  {
    value: "OPENING",
    label: "Opening",
    icon: Gavel,
    description: "State your position and what relief you are asking for.",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    value: "EVIDENCE",
    label: "Evidence",
    icon: FileText,
    description: "Tie documents and uploads to the record with a clear explanation.",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    value: "REBUTTAL",
    label: "Rebuttal",
    icon: Shield,
    description: "Answer the other side's points with specific facts and citations.",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    value: "CLOSING",
    label: "Closing",
    icon: Scale,
    description: "Summarize the record and the final remedy you want the moderator to adopt.",
    color: "bg-violet-100 text-violet-700 border-violet-200",
  },
  {
    value: "QUESTION",
    label: "Question",
    icon: HelpCircle,
    description: "Moderator-only formal question for the record.",
    color: "bg-sky-100 text-sky-700 border-sky-200",
  },
  {
    value: "ANSWER",
    label: "Answer",
    icon: Reply,
    description: "Formal answer to a pending question on the record.",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
  {
    value: "WITNESS_TESTIMONY",
    label: "Witness",
    icon: Users,
    description: "Witness testimony tied to the hearing record.",
    color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  },
  {
    value: "OBJECTION",
    label: "Objection",
    icon: FileSearch,
    description: "Raise a specific objection tied to a prior statement.",
    color: "bg-rose-100 text-rose-700 border-rose-200",
  },
  {
    value: "SURREBUTTAL",
    label: "Surrebuttal",
    icon: MessageSquare,
    description: "Provide a tightly scoped second response to a rebuttal.",
    color: "bg-orange-100 text-orange-700 border-orange-200",
  },
];

const EMPTY_SECTIONS: StatementSections = {
  summary: "",
  facts: "",
  evidenceBasis: "",
  analysis: "",
  remedy: "",
  addendum: "",
};

const SECTION_META: Array<{
  key: StatementSectionKey;
  label: string;
  placeholder: string;
}> = [
  {
    key: "summary",
    label: "Executive Summary",
    placeholder: "State the point of this filing in 2-4 sentences.",
  },
  {
    key: "facts",
    label: "Factual Narrative",
    placeholder: "Describe the key events in time order and keep them verifiable.",
  },
  {
    key: "evidenceBasis",
    label: "Evidence Basis",
    placeholder: "Explain which uploads, links, or records support your statement.",
  },
  {
    key: "analysis",
    label: "Analysis",
    placeholder: "Explain why the facts and evidence support your position.",
  },
  {
    key: "remedy",
    label: "Requested Remedy",
    placeholder: "State what action or outcome you want from this hearing record.",
  },
  {
    key: "addendum",
    label: "Addendum",
    placeholder: "Optional extra context that should stay on the record.",
  },
];

const SECTION_KIND_MAP: Record<
  Exclude<StatementSectionKey, "addendum">,
  HearingStatementContentBlock["kind"]
> = {
  summary: "SUMMARY",
  facts: "FACTS",
  evidenceBasis: "EVIDENCE_BASIS",
  analysis: "ANALYSIS",
  remedy: "REMEDY",
};

const buildBlocks = (sections: StatementSections): HearingStatementContentBlock[] => {
  const blocks: HearingStatementContentBlock[] = [];

  (Object.keys(SECTION_KIND_MAP) as Array<keyof typeof SECTION_KIND_MAP>).forEach(
    (key) => {
      const body = sections[key].trim();
      if (!body) return;
      const meta = SECTION_META.find((section) => section.key === key);
      blocks.push({
        id: `${SECTION_KIND_MAP[key].toLowerCase()}-${blocks.length + 1}`,
        kind: SECTION_KIND_MAP[key],
        heading: meta?.label ?? null,
        body,
      });
    },
  );

  if (sections.addendum.trim()) {
    blocks.push({
      id: `custom-${blocks.length + 1}`,
      kind: "CUSTOM",
      heading: "Addendum",
      body: sections.addendum.trim(),
    });
  }

  return blocks;
};

const compileStatementText = (blocks: HearingStatementContentBlock[]) =>
  blocks
    .map((block) =>
      block.heading?.trim() ? `${block.heading.trim()}\n${block.body.trim()}` : block.body.trim(),
    )
    .join("\n\n")
    .trim();

const blocksToSections = (draft?: HearingStatementSummary | null): StatementSections => {
  if (!draft) return { ...EMPTY_SECTIONS };

  const next: StatementSections = { ...EMPTY_SECTIONS };
  const blocks = draft.structuredContent ?? [];

  for (const block of blocks) {
    if (block.kind === "SUMMARY") next.summary = block.body;
    else if (block.kind === "FACTS") next.facts = block.body;
    else if (block.kind === "EVIDENCE_BASIS") next.evidenceBasis = block.body;
    else if (block.kind === "ANALYSIS") next.analysis = block.body;
    else if (block.kind === "REMEDY") next.remedy = block.body;
    else next.addendum = `${next.addendum}${next.addendum ? "\n\n" : ""}${block.body}`;
  }

  if (!blocks.length && draft.content?.trim()) {
    next.summary = draft.content.trim();
  }

  return next;
};

const getTypeRestriction = (
  type: HearingStatementType,
  role?: string | null,
  phase?: string,
): string | null => {
  if (role === "OBSERVER") return "Observers cannot submit statements";

  if (type === "QUESTION" && role !== "MODERATOR") {
    return "Only moderators can place formal questions on the record";
  }

  if (type === "ANSWER" && phase !== "INTERROGATION") {
    return "Answers belong to the interrogation phase";
  }

  if (phase === "PRESENTATION") {
    if (["REBUTTAL", "OBJECTION", "SURREBUTTAL"].includes(type)) {
      return "This filing type opens during cross examination";
    }
    if (type === "CLOSING") return "Closing statements belong in deliberation";
  }

  if (phase === "EVIDENCE_SUBMISSION") {
    if (type === "OPENING") return "Opening statements belong in presentation";
    if (type === "CLOSING") return "Closing statements belong in deliberation";
  }

  if (phase === "CROSS_EXAMINATION") {
    if (type === "OPENING") return "Opening statements belong in presentation";
    if (type === "CLOSING") return "Closing statements belong in deliberation";
  }

  if (phase === "DELIBERATION") {
    if (["OPENING", "EVIDENCE", "WITNESS_TESTIMONY"].includes(type)) {
      return "New evidentiary pleadings are closed during deliberation";
    }
  }

  if (type === "WITNESS_TESTIMONY" && role !== "WITNESS") {
    return "Only witnesses can file witness testimony";
  }

  return null;
};

interface StatementSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    type: HearingStatementType;
    title?: string;
    content: string;
    contentBlocks: HearingStatementContentBlock[];
    citedEvidenceIds?: string[];
    platformDeclarationAccepted?: boolean;
    changeSummary?: string;
    draftId?: string;
    isDraft?: boolean;
  }) => Promise<void>;
  currentPhase?: string;
  participantRole?: string | null;
  draftStatements?: HearingStatementSummary[];
}

export const StatementSubmissionDialog = memo(function StatementSubmissionDialog({
  open,
  onOpenChange,
  onSubmit,
  currentPhase,
  participantRole,
  draftStatements = [],
}: StatementSubmissionDialogProps) {
  const [selectedType, setSelectedType] = useState<HearingStatementType>("OPENING");
  const [selectedDraftId, setSelectedDraftId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<StatementSections>({ ...EMPTY_SECTIONS });
  const [citedEvidenceIds, setCitedEvidenceIds] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const selectedDraft = useMemo(
    () => draftStatements.find((draft) => draft.id === selectedDraftId) ?? null,
    [draftStatements, selectedDraftId],
  );

  const selectedMeta =
    STATEMENT_TYPES.find((statementType) => statementType.value === selectedType) ??
    STATEMENT_TYPES[0];

  const suggestedType: HearingStatementType | null =
    currentPhase === "PRESENTATION"
      ? "OPENING"
      : currentPhase === "EVIDENCE_SUBMISSION"
        ? "EVIDENCE"
        : currentPhase === "CROSS_EXAMINATION"
          ? "REBUTTAL"
          : currentPhase === "DELIBERATION"
            ? "CLOSING"
            : null;

  const resetComposer = useCallback(() => {
    setSelectedType(suggestedType ?? "OPENING");
    setSelectedDraftId("");
    setTitle("");
    setSections({ ...EMPTY_SECTIONS });
    setCitedEvidenceIds("");
    setChangeSummary("");
    setDeclarationAccepted(false);
  }, [suggestedType]);

  useEffect(() => {
    if (!open) return;
    resetComposer();
  }, [open, resetComposer]);

  useEffect(() => {
    if (!selectedDraft) return;
    setSelectedType(selectedDraft.type);
    setTitle(selectedDraft.title ?? "");
    setSections(blocksToSections(selectedDraft));
    setCitedEvidenceIds((selectedDraft.citedEvidenceIds ?? []).join(", "));
    setDeclarationAccepted(Boolean(selectedDraft.platformDeclarationAccepted));
    setChangeSummary("");
  }, [selectedDraft]);

  const handleSectionChange = useCallback(
    (key: StatementSectionKey, value: string) => {
      setSections((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const totalContentLength = useMemo(
    () => Object.values(sections).reduce((sum, item) => sum + item.length, 0),
    [sections],
  );

  const draftHistory = selectedDraft?.versionHistory ?? [];

  const handleSubmit = useCallback(
    async (isDraft: boolean) => {
      const contentBlocks = buildBlocks(sections);
      const content = compileStatementText(contentBlocks);
      if (!content.trim()) return;

      const setter = isDraft ? setSavingDraft : setSubmitting;
      try {
        setter(true);
        await onSubmit({
          type: selectedType,
          title: title.trim() || undefined,
          content,
          contentBlocks,
          citedEvidenceIds: citedEvidenceIds
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          platformDeclarationAccepted: declarationAccepted,
          changeSummary: changeSummary.trim() || undefined,
          draftId: selectedDraftId || undefined,
          isDraft,
        });
        if (!isDraft) {
          onOpenChange(false);
        }
        resetComposer();
      } finally {
        setter(false);
      }
    },
    [
      sections,
      onSubmit,
      selectedType,
      title,
      citedEvidenceIds,
      declarationAccepted,
      changeSummary,
      selectedDraftId,
      onOpenChange,
      resetComposer,
    ],
  );

  const busy = submitting || savingDraft;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5 text-slate-700" />
            Structured Statement Composer
          </DialogTitle>
          <DialogDescription>
            Draft or submit a pleading-style statement with structured sections,
            evidence citations, and revision history.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Composer Mode
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedDraft
                      ? `Continuing draft v${selectedDraft.versionNumber ?? 1}`
                      : "Starting a new structured statement"}
                  </p>
                </div>
                <div className="flex min-w-[240px] flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Continue Draft
                  </label>
                  <select
                    value={selectedDraftId}
                    onChange={(event) => setSelectedDraftId(event.target.value)}
                    disabled={busy}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none ring-0"
                  >
                    <option value="">Start fresh</option>
                    {draftStatements.map((draft) => (
                      <option key={draft.id} value={draft.id}>
                        {draft.title || draft.type} - v{draft.versionNumber ?? 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Statement Type
              </label>
              <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
                {STATEMENT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = selectedType === type.value;
                  const restriction = getTypeRestriction(
                    type.value,
                    participantRole,
                    currentPhase,
                  );
                  const isDisabled = busy || Boolean(restriction);

                  return (
                    <div key={type.value} className="relative group">
                      <button
                        type="button"
                        onClick={() => !restriction && setSelectedType(type.value)}
                        disabled={isDisabled}
                        className={cn(
                          "flex min-h-24 w-full flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-all",
                          isDisabled && "cursor-not-allowed opacity-45",
                          isSelected
                            ? cn(type.color, "ring-2 ring-slate-300 ring-offset-1")
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <div>
                          <p className="text-sm font-semibold">{type.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {type.description}
                          </p>
                        </div>
                      </button>
                      {restriction && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-center text-xs text-white shadow-xl group-hover:block">
                          {restriction}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge className={cn("border", selectedMeta.color)}>
                  {selectedMeta.label}
                </Badge>
                {suggestedType && <span>Suggested for this phase: {suggestedType}</span>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Title
                </label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Example: Response to milestone acceptance dispute"
                  disabled={busy}
                  className="text-sm"
                />
              </div>

              {SECTION_META.map((section) => (
                <div
                  key={section.key}
                  className={cn(
                    "space-y-1.5",
                    section.key === "summary" || section.key === "addendum"
                      ? "md:col-span-2"
                      : "",
                  )}
                >
                  <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {section.label}
                  </label>
                  <Textarea
                    value={sections[section.key]}
                    onChange={(event) => handleSectionChange(section.key, event.target.value)}
                    placeholder={section.placeholder}
                    rows={section.key === "summary" ? 3 : 5}
                    disabled={busy}
                    className="resize-none text-sm"
                  />
                </div>
              ))}

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Cited Evidence IDs
                </label>
                <Input
                  value={citedEvidenceIds}
                  onChange={(event) => setCitedEvidenceIds(event.target.value)}
                  placeholder="evidence-1, evidence-2, evidence-3"
                  disabled={busy}
                  className="text-sm"
                />
                <p className="text-xs text-slate-500">
                  Use comma-separated evidence ids so the moderator can map your
                  pleading to the record quickly.
                </p>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Change Summary
                </label>
                <Input
                  value={changeSummary}
                  onChange={(event) => setChangeSummary(event.target.value)}
                  placeholder="What changed since the last saved draft?"
                  disabled={busy}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={declarationAccepted}
                  onChange={(event) => setDeclarationAccepted(event.target.checked)}
                  disabled={busy}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm leading-6 text-slate-600">
                  I confirm this statement reflects my good-faith account of the
                  available facts and evidence for InterDev dispute review. This is a
                  platform declaration and not a legal oath.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Record Quality
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {totalContentLength} characters across structured sections.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSubmit(true)}
                  disabled={busy || totalContentLength === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  {savingDraft ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savingDraft ? "Saving..." : selectedDraft ? "Update Draft" : "Save Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit(false)}
                  disabled={busy || totalContentLength === 0 || !declarationAccepted}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {submitting ? "Submitting..." : "Submit to Hearing Record"}
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">Composer Guidance</h3>
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>Lead with a short summary so moderators can triage quickly.</li>
                <li>Keep facts separate from analysis; do not mix them into one block.</li>
                <li>Cite evidence ids directly so the record can be cross-checked.</li>
                <li>Once submitted, the statement remains part of the hearing record.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">Draft Revision Log</h3>
              </div>
              {selectedDraft ? (
                <>
                  <p className="mt-2 text-xs text-slate-500">
                    Current draft version: v{selectedDraft.versionNumber ?? 1}
                  </p>
                  <div className="mt-3 space-y-3">
                    {draftHistory.length > 0 ? (
                      draftHistory
                        .slice()
                        .reverse()
                        .map((version) => (
                          <div
                            key={`${version.versionNumber}-${version.savedAt}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-800">
                                v{version.versionNumber}
                              </p>
                              <Badge className="border-slate-200 bg-white text-slate-600">
                                {version.status}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{version.savedAt}</p>
                            {version.changeSummary && (
                              <p className="mt-2 text-sm text-slate-600">
                                {version.changeSummary}
                              </p>
                            )}
                          </div>
                        ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        No earlier revisions yet for this draft.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Select an existing draft to review its revision history.
                </p>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
});
