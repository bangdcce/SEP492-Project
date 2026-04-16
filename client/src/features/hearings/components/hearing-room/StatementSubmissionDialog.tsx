import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  FileCheck2,
  FileSearch,
  FileText,
  FlaskConical,
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
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/components/ui/utils";
import { toast } from "sonner";
import { getApiErrorDetails } from "@/shared/utils/apiError";
import { INTERNAL_DEV_TOOLS_ENABLED } from "@/shared/utils/internalTools";
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

const PARTY_ONLY_TYPES: HearingStatementType[] = [
  "OPENING",
  "CLOSING",
  "OBJECTION",
  "SURREBUTTAL",
];

const REPLY_REQUIRED_TYPES: HearingStatementType[] = [
  "ANSWER",
  "OBJECTION",
  "SURREBUTTAL",
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
        kind: SECTION_KIND_MAP[key],
        heading: meta?.label ?? null,
        body,
      });
    },
  );

  if (sections.addendum.trim()) {
    blocks.push({
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
  const normalizedPhase = phase?.trim().toUpperCase();
  const isPartyRole = role === "RAISER" || role === "DEFENDANT";

  if (role === "OBSERVER") {
    return "Observers cannot submit statements";
  }

  if (type === "QUESTION" && role !== "MODERATOR") {
    return "Only moderators can place formal questions on the record";
  }

  if (type === "WITNESS_TESTIMONY" && role !== "WITNESS") {
    return "Only witnesses can file witness testimony";
  }

  if (PARTY_ONLY_TYPES.includes(type) && !isPartyRole) {
    return "Only dispute parties (raiser/defendant) can file this statement type";
  }

  if (!normalizedPhase) {
    return null;
  }

  if (normalizedPhase === "PRESENTATION") {
    if (
      ["EVIDENCE", "REBUTTAL", "WITNESS_TESTIMONY", "OBJECTION", "SURREBUTTAL"].includes(
        type,
      )
    ) {
      return "This filing type opens in a later hearing phase";
    }
    if (type === "CLOSING") {
      return "Closing statements belong in deliberation";
    }
  }

  if (normalizedPhase === "EVIDENCE_SUBMISSION") {
    if (["OPENING", "CLOSING", "REBUTTAL", "OBJECTION", "SURREBUTTAL"].includes(type)) {
      return "This filing type is not open in evidence submission";
    }
  }

  if (normalizedPhase === "CROSS_EXAMINATION") {
    if (["OPENING", "CLOSING"].includes(type)) {
      return "This filing type is not open in cross examination";
    }
  }

  if (normalizedPhase === "DELIBERATION") {
    if (["OPENING", "EVIDENCE", "WITNESS_TESTIMONY"].includes(type)) {
      return "New evidentiary pleadings are closed during deliberation";
    }
    if (type === "OBJECTION") {
      return "Objections are only available during cross examination";
    }
  }

  return null;
};

const resolveSampleRoleLabel = (role?: string | null) => {
  switch (role) {
    case "RAISER":
      return "claimant";
    case "DEFENDANT":
      return "respondent";
    case "MODERATOR":
      return "moderator";
    case "WITNESS":
      return "witness";
    case "OBSERVER":
      return "observer";
    default:
      return "participant";
  }
};

const resolveSamplePhaseLabel = (phase?: string) =>
  phase?.trim().replaceAll("_", " ").toLowerCase() || "current hearing phase";

const buildSampleStatementPayload = (
  type: HearingStatementType,
  participantRole?: string | null,
  currentPhase?: string,
): {
  title: string;
  sections: StatementSections;
  citedEvidenceIds: string;
  replyToStatementId: string;
  changeSummary: string;
  declarationAccepted: boolean;
} => {
  const roleLabel = resolveSampleRoleLabel(participantRole);
  const phaseLabel = resolveSamplePhaseLabel(currentPhase);
  const commonAddendum =
    `Prepared as sample test content for UI validation in the ${phaseLabel}.`;

  switch (type) {
    case "EVIDENCE":
      return {
        title: "Evidence statement on disputed milestone record",
        sections: {
          summary:
            "I submit this evidence statement to connect the uploaded record with the disputed delivery outcome.",
          facts:
            "The milestone was marked as delivered, but the attached record shows unresolved defects, missing acceptance notes, and a mismatch between the approved scope and the final output.",
          evidenceBasis:
            "The key support is in the revision screenshots, signed scope summary, change log export, and the platform message thread confirming the expected deliverables.",
          analysis:
            "Taken together, these records support the position that the hearing should treat the disputed delivery as incomplete until the missing items are addressed or formally waived.",
          remedy:
            "Please keep the cited materials on the record and weigh them against any contrary statement before deciding payment release or remediation steps.",
          addendum: commonAddendum,
        },
        citedEvidenceIds: "evidence-ui-001, evidence-ui-002, evidence-ui-003",
        replyToStatementId: "",
        changeSummary: "Generated sample evidence statement",
        declarationAccepted: true,
      };
    case "REBUTTAL":
      return {
        title: "Rebuttal to the opposing delivery narrative",
        sections: {
          summary:
            "This rebuttal addresses the opposing account and explains why the delivery timeline and acceptance history do not support that position.",
          facts:
            "The prior statement omits the unresolved review comments, the delayed fixes, and the absence of a signed scope change approving the disputed work.",
          evidenceBasis:
            "This rebuttal relies on the milestone review thread, issue tracker snapshots, and the delivery comparison attached to the hearing record.",
          analysis:
            "Because the missing work remained open after review, the opposing statement should carry less weight than the contemporaneous platform records.",
          remedy:
            "I ask the moderator to reject the unsupported portions of the prior statement and rely on the documented review trail instead.",
          addendum: commonAddendum,
        },
        citedEvidenceIds: "evidence-ui-004, evidence-ui-005",
        replyToStatementId: "statement-prev-001",
        changeSummary: "Generated sample rebuttal",
        declarationAccepted: true,
      };
    case "CLOSING":
      return {
        title: "Closing statement on disputed milestone responsibility",
        sections: {
          summary:
            "This closing statement summarizes why the current record supports a finding in favor of the requested dispute remedy.",
          facts:
            "Across the hearing record, the same pattern appears: the baseline scope was confirmed, the delivery missed required elements, and the outstanding issues were never cured in a verified handoff.",
          evidenceBasis:
            "The strongest support remains the signed scope, milestone review notes, hearing statements, and linked evidence already cited into the record.",
          analysis:
            "The combined record is internally consistent and points to one conclusion: the disputed obligation was not satisfied within the accepted timeline.",
          remedy:
            "I request a final finding that preserves the hearing record, assigns responsibility consistently with the evidence, and directs the appropriate payment or corrective action.",
          addendum: commonAddendum,
        },
        citedEvidenceIds: "evidence-ui-001, evidence-ui-005, evidence-ui-006",
        replyToStatementId: "",
        changeSummary: "Generated sample closing statement",
        declarationAccepted: true,
      };
    case "QUESTION":
      return {
        title: "Formal moderator question on delivery acceptance",
        sections: {
          summary:
            "This question is placed on the hearing record to clarify a material gap in the delivery acceptance timeline.",
          facts:
            "The record contains conflicting descriptions of when the disputed work was reviewed and whether the final revision matched the approved scope.",
          evidenceBasis:
            "Relevant materials include the milestone approval log, chat confirmation timestamps, and the latest revision package.",
          analysis:
            "Without a direct answer on these points, the record remains incomplete for a reliable decision.",
          remedy:
            "Please answer precisely whether the disputed revision was accepted, by whom, and on what basis.",
          addendum: commonAddendum,
        },
        citedEvidenceIds: "evidence-ui-007",
        replyToStatementId: "",
        changeSummary: "Generated sample moderator question",
        declarationAccepted: true,
      };
    case "ANSWER":
      return {
        title: "Formal answer to moderator question",
        sections: {
          summary:
            "This answer responds directly to the pending question and clarifies the acceptance sequence reflected in the platform record.",
          facts:
            "The disputed revision was reviewed after the stated deadline, and no final acceptance was confirmed until the missing defects were addressed in a later follow-up.",
          evidenceBasis:
            "The response relies on the chat thread, revision timestamps, and the milestone review note captured in the hearing record.",
          analysis:
            "Those records show that any temporary acknowledgment should not be treated as final acceptance of the disputed deliverable.",
          remedy:
            "Please treat this answer as the authoritative clarification for the acceptance timeline issue raised in the question.",
          addendum: commonAddendum,
        },
        citedEvidenceIds: "evidence-ui-008",
        replyToStatementId: "statement-question-001",
        changeSummary: "Generated sample answer statement",
        declarationAccepted: true,
      };
    case "WITNESS_TESTIMONY":
      return {
        title: "Witness testimony on project coordination history",
        sections: {
          summary:
            `I provide this testimony as a ${roleLabel} with direct knowledge of the project coordination and dispute timeline.`,
          facts:
            "From my observation, the disputed work repeatedly returned for revision after review comments identified missing requirements and unresolved quality issues.",
          evidenceBasis:
            "My testimony is consistent with the message thread, review checklist, and revision history already placed in the hearing materials.",
          analysis:
            "That sequence supports the view that the final state of delivery remained contested for substantive reasons rather than minor formatting issues.",
          remedy:
            "Please consider this testimony as supporting context when evaluating whether the final deliverable met the agreed standard.",
          addendum: commonAddendum,
        },
        citedEvidenceIds: "evidence-ui-009, evidence-ui-010",
        replyToStatementId: "",
        changeSummary: "Generated sample witness testimony",
        declarationAccepted: true,
      };
    case "OBJECTION":
      return {
        title: "Objection to unsupported factual assertion",
        sections: {
          summary:
            "I object to the challenged statement because it introduces a factual claim that is not supported by the cited record.",
          facts:
            "The disputed assertion references acceptance and completion, but the linked materials do not show a verified handoff or a signed scope change authorizing the missing work.",
          evidenceBasis:
            "This objection is grounded in the cited platform log, milestone review notes, and the absence of any countervailing acceptance document.",
          analysis:
            "Allowing the unsupported assertion to stand without challenge would distort the record and weaken the evidentiary standard of the hearing.",
          remedy:
            "Please note this objection on the record and assign reduced weight to the unsupported factual assertion unless corroborating proof is produced.",
          addendum: commonAddendum,
        },
        citedEvidenceIds: "evidence-ui-011",
        replyToStatementId: "statement-prev-002",
        changeSummary: "Generated sample objection",
        declarationAccepted: true,
      };
    case "SURREBUTTAL":
      return {
        title: "Surrebuttal on scope-change characterization",
        sections: {
          summary:
            "This surrebuttal is limited to the scope-change point raised in the rebuttal and explains why that characterization is incomplete.",
          facts:
            "The cited conversation shows only exploratory discussion, not a final approval to reduce or alter the disputed deliverables.",
          evidenceBasis:
            "The record still lacks a signed revision approval, updated milestone definition, or a confirmed acceptance note reflecting the claimed scope change.",
          analysis:
            "Without those formal markers, the rebuttal overstates the effect of informal discussion and should not replace the signed baseline documents.",
          remedy:
            "Please treat the signed scope and acceptance record as controlling unless stronger contrary proof is added.",
          addendum: commonAddendum,
        },
        citedEvidenceIds: "evidence-ui-012",
        replyToStatementId: "statement-prev-003",
        changeSummary: "Generated sample surrebuttal",
        declarationAccepted: true,
      };
    case "OPENING":
    default:
      return {
        title: "Opening statement on disputed milestone delivery",
        sections: {
          summary:
            `I submit this opening statement as the ${roleLabel} to summarize the dispute position and the remedy sought from this hearing.`,
          facts:
            "The disputed milestone was presented as complete, yet the delivery history shows unresolved defects, outstanding comments, and no final acceptance confirming that the agreed scope was satisfied.",
          evidenceBasis:
            "This filing relies on the signed project scope, milestone review history, platform messages, and the uploaded comparison evidence tied to the record.",
          analysis:
            "Those materials support the position that the disputed deliverable fell short of the approved baseline and that the hearing should preserve that finding in the record.",
          remedy:
            "I request a hearing outcome that reflects the incomplete delivery status, keeps the cited evidence attached to the record, and directs the appropriate corrective action or payment adjustment.",
          addendum: commonAddendum,
        },
        citedEvidenceIds: "evidence-ui-001, evidence-ui-002",
        replyToStatementId: "",
        changeSummary: "Generated sample opening statement",
        declarationAccepted: true,
      };
  }
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
    replyToStatementId?: string;
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
  const [replyToStatementId, setReplyToStatementId] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const sampleToolsEnabled = INTERNAL_DEV_TOOLS_ENABLED;

  const restrictionsByType = useMemo(() => {
    const map = new Map<HearingStatementType, string | null>();
    STATEMENT_TYPES.forEach((statementType) => {
      map.set(
        statementType.value,
        getTypeRestriction(statementType.value, participantRole, currentPhase),
      );
    });
    return map;
  }, [participantRole, currentPhase]);

  const allowedTypes = useMemo(
    () =>
      STATEMENT_TYPES.filter(
        (statementType) => !restrictionsByType.get(statementType.value),
      ).map((statementType) => statementType.value),
    [restrictionsByType],
  );

  const selectedTypeRestriction = restrictionsByType.get(selectedType) ?? null;

  const selectedDraft = useMemo(
    () => draftStatements.find((draft) => draft.id === selectedDraftId) ?? null,
    [draftStatements, selectedDraftId],
  );

  const selectedMeta =
    STATEMENT_TYPES.find((statementType) => statementType.value === selectedType) ??
    STATEMENT_TYPES[0];

  const declarationRequired = participantRole !== "MODERATOR";

  const suggestedType = useMemo((): HearingStatementType | null => {
    const isPartyRole = participantRole === "RAISER" || participantRole === "DEFENDANT";
    const normalizedPhase = currentPhase?.trim().toUpperCase();

    let preferred: HearingStatementType | null = null;

    if (normalizedPhase === "PRESENTATION") {
      preferred = isPartyRole
        ? "OPENING"
        : participantRole === "MODERATOR"
          ? "QUESTION"
          : null;
    } else if (normalizedPhase === "EVIDENCE_SUBMISSION") {
      preferred = participantRole === "WITNESS" ? "WITNESS_TESTIMONY" : "EVIDENCE";
    } else if (normalizedPhase === "CROSS_EXAMINATION") {
      preferred = "REBUTTAL";
    } else if (normalizedPhase === "DELIBERATION") {
      preferred = isPartyRole ? "CLOSING" : "REBUTTAL";
    }

    if (preferred && allowedTypes.includes(preferred)) {
      return preferred;
    }

    return allowedTypes[0] ?? null;
  }, [currentPhase, participantRole, allowedTypes]);

  const resetComposer = useCallback(() => {
    setSelectedType(suggestedType ?? allowedTypes[0] ?? "OPENING");
    setSelectedDraftId("");
    setTitle("");
    setSections({ ...EMPTY_SECTIONS });
    setCitedEvidenceIds("");
    setReplyToStatementId("");
    setChangeSummary("");
    setDeclarationAccepted(false);
  }, [suggestedType, allowedTypes]);

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
    setReplyToStatementId(selectedDraft.replyToStatementId ?? "");
    setDeclarationAccepted(Boolean(selectedDraft.platformDeclarationAccepted));
    setChangeSummary("");
  }, [selectedDraft]);

  useEffect(() => {
    if (selectedDraft) {
      return;
    }

    if (!allowedTypes.includes(selectedType) && allowedTypes.length > 0) {
      setSelectedType(allowedTypes[0]);
    }
  }, [allowedTypes, selectedType, selectedDraft]);

  const handleSectionChange = useCallback(
    (key: StatementSectionKey, value: string) => {
      setSections((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const handleFillSample = useCallback(() => {
    const sample = buildSampleStatementPayload(
      selectedType,
      participantRole,
      currentPhase,
    );

    setTitle(sample.title);
    setSections(sample.sections);
    setCitedEvidenceIds(sample.citedEvidenceIds);
    setReplyToStatementId(sample.replyToStatementId);
    setChangeSummary(sample.changeSummary);
    if (declarationRequired) {
      setDeclarationAccepted(sample.declarationAccepted);
    }
    toast.success(`Sample ${selectedType.toLowerCase()} statement loaded`);
  }, [currentPhase, declarationRequired, participantRole, selectedType]);

  const totalContentLength = useMemo(
    () => Object.values(sections).reduce((sum, item) => sum + item.length, 0),
    [sections],
  );

  const draftHistory = selectedDraft?.versionHistory ?? [];

  const handleSubmit = useCallback(
    async (isDraft: boolean) => {
      if (selectedTypeRestriction) {
        toast.error(selectedTypeRestriction);
        return;
      }

      const contentBlocks = buildBlocks(sections);
      const content = compileStatementText(contentBlocks);
      if (!content.trim()) return;

      if (
        REPLY_REQUIRED_TYPES.includes(selectedType) &&
        replyToStatementId.trim().length === 0
      ) {
        toast.error("Please provide Reply-to statement ID for this statement type.");
        return;
      }

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
          replyToStatementId: replyToStatementId.trim() || undefined,
          platformDeclarationAccepted: declarationAccepted,
          changeSummary: changeSummary.trim() || undefined,
          draftId: selectedDraftId || undefined,
          isDraft,
        });
        if (!isDraft) {
          onOpenChange(false);
        }
        resetComposer();
      } catch (error) {
        const details = getApiErrorDetails(error, "Could not submit statement");
        toast.error(details.code ? `[${details.code}] ${details.message}` : details.message);
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
      replyToStatementId,
      declarationAccepted,
      changeSummary,
      selectedDraftId,
      onOpenChange,
      resetComposer,
      selectedTypeRestriction,
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
                <div className="flex min-w-60 flex-col gap-2">
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

            {sampleToolsEnabled && (
              <div className="rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,244,214,0.92))] p-4 shadow-[0_12px_28px_-24px_rgba(180,83,9,0.85)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="border border-amber-300 bg-white/80 text-amber-700">
                        Test Tools
                      </Badge>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                        Statement Samples
                      </span>
                    </div>
                    <p className="text-sm text-amber-900">
                      Prefill the current statement type with realistic sample sections for fast UI and workflow testing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFillSample}
                    disabled={busy || Boolean(selectedTypeRestriction)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-white/85 px-4 text-sm font-medium text-amber-900 transition-all hover:-translate-y-0.5 hover:bg-white disabled:opacity-50"
                  >
                    <FlaskConical className="h-4 w-4" />
                    Fill Sample Test
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Statement Type
              </label>
              <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
                {STATEMENT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = selectedType === type.value;
                  const restriction = restrictionsByType.get(type.value) ?? null;
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
              {selectedTypeRestriction && (
                <p className="text-xs text-rose-600">{selectedTypeRestriction}</p>
              )}
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

              {REPLY_REQUIRED_TYPES.includes(selectedType) && (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Reply To Statement ID
                  </label>
                  <Input
                    value={replyToStatementId}
                    onChange={(event) => setReplyToStatementId(event.target.value)}
                    placeholder="Paste the statement id this filing responds to"
                    disabled={busy}
                    className="text-sm"
                  />
                </div>
              )}

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
                  disabled={busy || totalContentLength === 0 || Boolean(selectedTypeRestriction)}
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
                  disabled={
                    busy ||
                    totalContentLength === 0 ||
                    (declarationRequired && !declarationAccepted) ||
                    Boolean(selectedTypeRestriction)
                  }
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
