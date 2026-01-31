import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Send, Lock, StickyNote, Link2, FileText, ListChecks, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  addDisputeNote,
  getDisputeNotes,
  getProjectBoard,
  sendDisputeMessage,
  updateDisputePhase,
} from "../../api";
import type { DisputeNote, DisputeSummary } from "../../types/dispute.types";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { DisputePhase, UserRole } from "../../../staff/types/staff.types";
import { projectSpecsApi } from "@/features/project-specs/api";
import type { ProjectSpec } from "@/features/project-specs/types";
import type { Milestone, Task } from "@/features/project-workspace/types";

type EvidenceReferenceType = "TASK" | "MILESTONE" | "SPEC";

interface EvidenceReference {
  type: EvidenceReferenceType;
  id: string;
  label: string;
}

interface LocalMessage {
  id: string;
  content: string;
  createdAt: string;
  references?: EvidenceReference[];
}

interface DiscussionPanelProps {
  disputeId: string;
  dispute?: DisputeSummary | null;
  onPhaseUpdated?: (phase: DisputePhase) => void;
}

export const DiscussionPanel = ({
  disputeId,
  dispute,
  onPhaseUpdated,
}: DiscussionPanelProps) => {
  const [notes, setNotes] = useState<DisputeNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [phaseUpdating, setPhaseUpdating] = useState(false);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [projectMilestones, setProjectMilestones] = useState<Milestone[]>([]);
  const [projectSpec, setProjectSpec] = useState<ProjectSpec | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [specLoading, setSpecLoading] = useState(false);
  const [referenceType, setReferenceType] =
    useState<EvidenceReferenceType>("TASK");
  const [referenceId, setReferenceId] = useState("");
  const [draftReferences, setDraftReferences] = useState<EvidenceReference[]>([]);
  const [activeReference, setActiveReference] = useState<EvidenceReference | null>(
    null,
  );

  const currentUser = useMemo(() => {
    return getStoredJson<{ id?: string; role?: UserRole }>(STORAGE_KEYS.USER);
  }, []);

  const currentUserRole = currentUser?.role ?? null;
  const currentUserId = currentUser?.id ?? null;

  const canViewInternal =
    currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.STAFF;

  const currentPhase = dispute?.phase ?? DisputePhase.PRESENTATION;
  const isStaffOrAdmin =
    currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.STAFF;
  const isRaiser = Boolean(currentUserId && dispute?.raisedById === currentUserId);
  const isDefendant = Boolean(currentUserId && dispute?.defendantId === currentUserId);

  const phaseOptions = useMemo(
    () => [
      { value: DisputePhase.PRESENTATION, label: "Presentation" },
      { value: DisputePhase.CROSS_EXAMINATION, label: "Cross-examination" },
      { value: DisputePhase.INTERROGATION, label: "Interrogation" },
      { value: DisputePhase.DELIBERATION, label: "Deliberation" },
    ],
    []
  );

  const currentPhaseLabel =
    phaseOptions.find((item) => item.value === currentPhase)?.label ?? "Presentation";

  const phaseAccess = useMemo(() => {
    if (!dispute) {
      return { allowed: false, reason: "Loading dispute details..." };
    }
    if (currentPhase === DisputePhase.DELIBERATION) {
      return { allowed: false, reason: "Chat is locked during deliberation." };
    }
    if (isStaffOrAdmin) {
      return { allowed: true };
    }
    switch (currentPhase) {
      case DisputePhase.PRESENTATION:
        return isRaiser
          ? { allowed: true }
          : { allowed: false, reason: "Only the raiser can speak in this phase." };
      case DisputePhase.CROSS_EXAMINATION:
        return isDefendant
          ? { allowed: true }
          : { allowed: false, reason: "Only the defendant can speak in this phase." };
      case DisputePhase.INTERROGATION:
        return { allowed: false, reason: "Only staff or admin can speak in this phase." };
      default:
        return { allowed: true };
    }
  }, [currentPhase, dispute, isStaffOrAdmin, isRaiser, isDefendant]);

  const isLocked = !phaseAccess.allowed;

  const milestoneForDispute = useMemo(
    () => projectMilestones.find((milestone) => milestone.id === dispute?.milestoneId),
    [projectMilestones, dispute?.milestoneId],
  );

  useEffect(() => {
    if (!dispute?.projectId) return;
    let cancelled = false;

    const loadBoard = async () => {
      try {
        setBoardLoading(true);
        const board = await getProjectBoard(dispute.projectId);
        if (cancelled) return;
        const taskColumns = Object.values(board.tasks);
        const flattened = taskColumns.flat();
        setProjectTasks(flattened);
        setProjectMilestones(board.milestones);
      } catch (error) {
        console.error("Failed to load project board:", error);
        toast.error("Could not load project tasks and milestones.");
      } finally {
        if (!cancelled) {
          setBoardLoading(false);
        }
      }
    };

    loadBoard();

    return () => {
      cancelled = true;
    };
  }, [dispute?.projectId]);

  useEffect(() => {
    const specId = milestoneForDispute?.projectSpecId;
    if (!specId) {
      setProjectSpec(null);
      return;
    }
    let cancelled = false;

    const loadSpec = async () => {
      try {
        setSpecLoading(true);
        const spec = await projectSpecsApi.getSpec(specId);
        if (cancelled) return;
        setProjectSpec(spec);
      } catch (error) {
        console.error("Failed to load project spec:", error);
        if (!cancelled) {
          setProjectSpec(null);
        }
      } finally {
        if (!cancelled) {
          setSpecLoading(false);
        }
      }
    };

    loadSpec();

    return () => {
      cancelled = true;
    };
  }, [milestoneForDispute?.projectSpecId]);

  const taskOptions = useMemo(
    () =>
      projectTasks.map((task) => ({
        id: task.id,
        label: `${task.title} (${task.status.replace(/_/g, " ")})`,
      })),
    [projectTasks],
  );

  const milestoneOptions = useMemo(
    () =>
      projectMilestones.map((milestone) => ({
        id: milestone.id,
        label: milestone.title,
      })),
    [projectMilestones],
  );

  const specOptions = useMemo(
    () => (projectSpec ? [{ id: projectSpec.id, label: projectSpec.title }] : []),
    [projectSpec],
  );

  const referenceOptions = useMemo(() => {
    switch (referenceType) {
      case "TASK":
        return taskOptions;
      case "MILESTONE":
        return milestoneOptions;
      case "SPEC":
        return specOptions;
      default:
        return [];
    }
  }, [referenceType, taskOptions, milestoneOptions, specOptions]);

  useEffect(() => {
    setReferenceId(referenceOptions[0]?.id ?? "");
  }, [referenceOptions]);

  const tasksById = useMemo(
    () => new Map(projectTasks.map((task) => [task.id, task])),
    [projectTasks],
  );

  const milestonesById = useMemo(
    () => new Map(projectMilestones.map((milestone) => [milestone.id, milestone])),
    [projectMilestones],
  );

  const loadNotes = useCallback(async () => {
    try {
      setNotesLoading(true);
      const data = await getDisputeNotes(disputeId, canViewInternal);
      setNotes(data ?? []);
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setNotesLoading(false);
    }
  }, [disputeId, canViewInternal]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const referenceTypeLabels: Record<EvidenceReferenceType, string> = {
    TASK: "Task",
    MILESTONE: "Milestone",
    SPEC: "Spec",
  };

  const resolveReferenceLabel = useCallback(
    (type: EvidenceReferenceType, id: string) => {
      if (type === "TASK") {
        return tasksById.get(id)?.title ?? "";
      }
      if (type === "MILESTONE") {
        return milestonesById.get(id)?.title ?? "";
      }
      if (type === "SPEC") {
        return projectSpec?.title ?? "";
      }
      return "";
    },
    [tasksById, milestonesById, projectSpec],
  );

  const handleAddReference = () => {
    if (!referenceId) {
      toast.error("Select an item to tag.");
      return;
    }

    const label =
      resolveReferenceLabel(referenceType, referenceId) ||
      `${referenceTypeLabels[referenceType]} ${referenceId.slice(0, 8)}`;
    const next: EvidenceReference = {
      type: referenceType,
      id: referenceId,
      label,
    };

    setDraftReferences((prev) => {
      const exists = prev.some(
        (item) => item.id === next.id && item.type === next.type,
      );
      if (exists) {
        setActiveReference(next);
        return prev;
      }
      setActiveReference(next);
      return [...prev, next];
    });
  };

  const handleRemoveReference = (reference: EvidenceReference) => {
    setDraftReferences((prev) =>
      prev.filter(
        (item) => !(item.id === reference.id && item.type === reference.type),
      ),
    );
    if (
      activeReference?.id === reference.id &&
      activeReference.type === reference.type
    ) {
      setActiveReference(null);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "Not set";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Invalid date";
    return format(parsed, "MMM d, yyyy");
  };

  const renderComparePanel = () => {
    if (!activeReference) {
      return (
        <div className="text-sm text-gray-500">
          Select a tagged item to compare details here.
        </div>
      );
    }

    if (activeReference.type === "TASK") {
      const task = tasksById.get(activeReference.id);
      if (!task) {
        return <div className="text-sm text-gray-500">Task not found.</div>;
      }
      return (
        <div className="space-y-2 text-sm text-slate-700">
          <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
            <ListChecks className="w-4 h-4" />
            Task Reference
          </div>
          <h4 className="text-base font-semibold text-slate-900">{task.title}</h4>
          {task.description && <p className="text-sm">{task.description}</p>}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Status</span>
              <div className="font-medium">{task.status.replace(/_/g, " ")}</div>
            </div>
            <div>
              <span className="text-slate-500">Priority</span>
              <div className="font-medium">{task.priority ?? "N/A"}</div>
            </div>
            <div>
              <span className="text-slate-500">Due</span>
              <div className="font-medium">{formatDate(task.dueDate)}</div>
            </div>
            <div>
              <span className="text-slate-500">Milestone</span>
              <div className="font-medium">
                {task.milestoneId ? task.milestoneId.slice(0, 8) : "N/A"}
              </div>
            </div>
          </div>
          {task.proofLink && (
            <div className="text-xs">
              <span className="text-slate-500">Proof</span>
              <div className="font-medium break-all">{task.proofLink}</div>
            </div>
          )}
          {task.submissionNote && (
            <div className="text-xs">
              <span className="text-slate-500">Submission Note</span>
              <div className="font-medium">{task.submissionNote}</div>
            </div>
          )}
        </div>
      );
    }

    if (activeReference.type === "MILESTONE") {
      const milestone = milestonesById.get(activeReference.id);
      if (!milestone) {
        return <div className="text-sm text-gray-500">Milestone not found.</div>;
      }
      return (
        <div className="space-y-2 text-sm text-slate-700">
          <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
            <FileText className="w-4 h-4" />
            Milestone Reference
          </div>
          <h4 className="text-base font-semibold text-slate-900">{milestone.title}</h4>
          {milestone.description && <p className="text-sm">{milestone.description}</p>}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Status</span>
              <div className="font-medium">{milestone.status}</div>
            </div>
            <div>
              <span className="text-slate-500">Amount</span>
              <div className="font-medium">${Number(milestone.amount).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-slate-500">Start</span>
              <div className="font-medium">{formatDate(milestone.startDate)}</div>
            </div>
            <div>
              <span className="text-slate-500">Due</span>
              <div className="font-medium">{formatDate(milestone.dueDate)}</div>
            </div>
          </div>
        </div>
      );
    }

    if (activeReference.type === "SPEC") {
      if (!projectSpec) {
        return (
          <div className="text-sm text-gray-500">Project spec not loaded.</div>
        );
      }
      return (
        <div className="space-y-3 text-sm text-slate-700">
          <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
            <FileText className="w-4 h-4" />
            Spec Reference
          </div>
          <h4 className="text-base font-semibold text-slate-900">{projectSpec.title}</h4>
          <p className="text-sm">{projectSpec.description}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Budget</span>
              <div className="font-medium">
                ${Number(projectSpec.totalBudget).toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-slate-500">Status</span>
              <div className="font-medium">{projectSpec.status}</div>
            </div>
          </div>
          {projectSpec.techStack && (
            <div className="text-xs">
              <span className="text-slate-500">Tech stack</span>
              <div className="font-medium">{projectSpec.techStack}</div>
            </div>
          )}
          {projectSpec.features && projectSpec.features.length > 0 && (
            <div className="text-xs">
              <span className="text-slate-500">Key features</span>
              <ul className="list-disc list-inside space-y-1 mt-1">
                {projectSpec.features.map((feature) => (
                  <li key={feature.title}>{feature.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const handlePhaseChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    if (!dispute) return;
    const nextPhase = event.target.value as DisputePhase;
    if (nextPhase === currentPhase) return;

    try {
      setPhaseUpdating(true);
      await updateDisputePhase(dispute.id, nextPhase);
      onPhaseUpdated?.(nextPhase);
      const label =
        phaseOptions.find((item) => item.value === nextPhase)?.label ?? "new phase";
      toast.success(`Phase updated to ${label}.`);
    } catch (error) {
      console.error("Failed to update phase:", error);
      toast.error("Could not update phase.");
    } finally {
      setPhaseUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteInput.trim()) {
      toast.error("Please write a note.");
      return;
    }

    try {
      setAddingNote(true);
      const saved = await addDisputeNote(disputeId, {
        content: noteInput.trim(),
        isInternal: true,
        noteType: "GENERAL",
      });
      setNotes((prev) => [saved, ...prev]);
      setNoteInput("");
      toast.success("Note added.");
    } catch (error) {
      console.error("Failed to add note:", error);
      toast.error("Could not add note.");
    } finally {
      setAddingNote(false);
    }
  };

  const handleSendMessage = async () => {
    if (isLocked) {
      toast.error(phaseAccess.reason ?? "Chat is locked.");
      return;
    }
    if (!messageInput.trim()) {
      toast.error("Please enter a message.");
      return;
    }

    try {
      setSendingMessage(true);
      const referencesPayload =
        draftReferences.length > 0 ? { references: draftReferences } : undefined;
      await sendDisputeMessage(disputeId, {
        content: messageInput.trim(),
        metadata: referencesPayload,
      });
      setLocalMessages((prev) => [
        {
          id: `local-${Date.now()}`,
          content: messageInput.trim(),
          createdAt: new Date().toISOString(),
          references: draftReferences.length > 0 ? [...draftReferences] : undefined,
        },
        ...prev,
      ]);
      setMessageInput("");
      setDraftReferences([]);
      toast.success("Message sent.");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Could not send message.");
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Moderation phase
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Current: <span className="font-medium">{currentPhaseLabel}</span>
            </p>
          </div>
          {isStaffOrAdmin ? (
            <div className="flex items-center gap-2">
              <label htmlFor="phase-select" className="text-xs text-gray-500">
                Update phase
              </label>
              <select
                id="phase-select"
                value={currentPhase}
                onChange={handlePhaseChange}
                disabled={phaseUpdating}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-60"
              >
                {phaseOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {currentPhaseLabel}
            </span>
          )}
        </div>
        {isLocked && (
          <p className="text-xs text-amber-700 mt-3">
            {phaseAccess.reason ?? "Chat is locked for your role in this phase."}
          </p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-teal-600" />
            Internal Notes
          </h3>
        </div>
        <div className="mt-4 space-y-3">
          {notesLoading ? (
            <p className="text-sm text-gray-500">Loading notes...</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-gray-500">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="border border-gray-100 bg-gray-50 rounded-lg p-3"
              >
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{note.author?.fullName || note.authorId}</span>
                  <span>
                    {note.createdAt
                      ? format(new Date(note.createdAt), "MMM d, yyyy h:mm a")
                      : "Unknown"}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-2">{note.content}</p>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 border-t border-gray-100 pt-3">
          <textarea
            rows={3}
            value={noteInput}
            onChange={(event) => setNoteInput(event.target.value)}
            placeholder="Add an internal note for staff..."
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-teal-500 focus:border-teal-500"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleAddNote}
              disabled={addingNote}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {addingNote ? "Saving..." : "Add note"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-teal-600" />
              Evidence references
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Tag tasks, milestones, or specs to compare evidence side by side.
            </p>
          </div>
          <button
            onClick={() => {
              setDraftReferences([]);
              setActiveReference(null);
            }}
            disabled={draftReferences.length === 0}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:text-slate-900 hover:border-slate-300 disabled:opacity-50"
          >
            Clear tags
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[140px]">
                <label className="text-xs text-gray-500">Type</label>
                <select
                  value={referenceType}
                  onChange={(event) =>
                    setReferenceType(event.target.value as EvidenceReferenceType)
                  }
                  className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="TASK">Task</option>
                  <option value="MILESTONE">Milestone</option>
                  <option value="SPEC">Spec</option>
                </select>
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="text-xs text-gray-500">Item</label>
                <select
                  value={referenceId}
                  onChange={(event) => setReferenceId(event.target.value)}
                  disabled={referenceOptions.length === 0}
                  className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-60"
                >
                  {referenceOptions.length === 0 ? (
                    <option value="">No items available</option>
                  ) : (
                    referenceOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button
                onClick={handleAddReference}
                disabled={!referenceId}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
              >
                Add tag
              </button>
            </div>

            {boardLoading && (
              <p className="text-xs text-gray-500">Loading project items...</p>
            )}

            <div className="flex flex-wrap gap-2">
              {draftReferences.length === 0 ? (
                <p className="text-xs text-gray-500">No tags added yet.</p>
              ) : (
                draftReferences.map((reference) => (
                  <div
                    key={`${reference.type}-${reference.id}`}
                    className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveReference(reference)}
                      className="flex items-center gap-1 text-slate-700 hover:text-slate-900"
                    >
                      {reference.type === "TASK" ? (
                        <ListChecks className="w-3 h-3" />
                      ) : (
                        <FileText className="w-3 h-3" />
                      )}
                      <span>{reference.label}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveReference(reference)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 min-h-[180px]">
            {specLoading && referenceType === "SPEC" ? (
              <p className="text-xs text-gray-500">Loading spec details...</p>
            ) : (
              renderComparePanel()
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col h-[520px] bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50">
          {localMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">
              Message history is available via realtime events.
            </div>
          ) : (
            localMessages.map((message) => (
              <div key={message.id} className="flex gap-3 flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold shrink-0">
                  Y
                </div>
                <div className="bg-teal-50 p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[80%] border border-teal-100">
                  <p className="text-sm text-gray-800">{message.content}</p>
                  {message.references && message.references.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.references.map((reference) => (
                        <button
                          key={`${message.id}-${reference.type}-${reference.id}`}
                          type="button"
                          onClick={() => setActiveReference(reference)}
                          className="px-2 py-1 rounded-full text-xs bg-white border border-teal-200 text-teal-700 hover:bg-teal-50"
                        >
                          {referenceTypeLabels[reference.type]}: {reference.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="text-xs text-teal-600/60 mt-1 block">
                    {format(new Date(message.createdAt), "h:mm a")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {isLocked && (
          <div className="bg-amber-50 border-y border-amber-200 p-3 flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 text-amber-600" />
            <p className="text-sm text-amber-800 font-medium">
              {phaseAccess.reason ?? "Chat is locked."}
            </p>
          </div>
        )}

        <div className="p-4 bg-white relative">
          <div className="relative">
            <input
              type="text"
              placeholder={
                isLocked ? phaseAccess.reason ?? "Chat is locked." : "Type your message..."
              }
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              disabled={isLocked || sendingMessage}
              className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSendMessage}
              disabled={isLocked || sendingMessage}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:bg-gray-400 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
