import { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  X,
  Layers,
  User,
  Link2,
  CheckCircle2,
  Send,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  ChevronDown,
  Plus,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority, KanbanColumnKey } from "../types";
import { MOCK_SPEC_FEATURES } from "./CreateTaskModal";
import { updateTask, updateTaskStatus, fetchTaskHistory } from "../api";

// Helper for robust date parsing (force UTC if naked ISO)
const normalizeToUTC = (d: string | Date | undefined): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  const s = String(d);
  // Simpler, more aggressive check: if no Z and no +, assume it's a naked UTC string
  const safeDate = s.endsWith('Z') || s.includes('+') ? s : s + 'Z';
  return new Date(safeDate);
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type TaskDetailModalProps = {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onUpdate?: (updatedTask: Task) => void;
  onSubmitTask?: (
    taskId: string,
    data: { submissionNote?: string; proofLink: string }
  ) => Promise<void>;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; icon: string }> = {
  LOW: { color: "text-blue-500", icon: "Low" },
  MEDIUM: { color: "text-amber-500", icon: "Medium" },
  HIGH: { color: "text-orange-500", icon: "High" },
  URGENT: { color: "text-red-500", icon: "Urgent" },
};

const STATUS_OPTIONS: { value: KanbanColumnKey; label: string; color: string }[] = [
  { value: "TODO", label: "To Do", color: "bg-slate-100 text-slate-700" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { value: "IN_REVIEW", label: "In Review", color: "bg-amber-100 text-amber-700" },
  { value: "DONE", label: "Done", color: "bg-emerald-100 text-emerald-700" },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
      {title}
    </h3>
  );
}

function EditableText({
  value,
  onSave,
  className,
  placeholder = "Click to edit...",
  multiline = false,
}: {
  value: string;
  onSave: (val: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== value) {
      onSave(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      handleBlur();
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className={cn(
            "w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-2 bg-white min-h-[100px]",
            className
          )}
          placeholder={placeholder}
        />
      );
    }
    return (
      <input
        autoFocus
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-1 bg-white",
          className
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        "cursor-text hover:bg-gray-100 rounded px-1 -ml-1 transition-colors min-h-[24px] empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400",
        className
      )}
      data-placeholder={placeholder}
    >
      {value}
    </div>
  );
}


// Helper for "All" tab sorting
type TimelineItem =
  | { type: "history"; data: import("../types").TaskHistory; date: Date }
  | { type: "comment"; date: Date }; // Placeholder for comment type until real comments exist

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function TaskDetailModal({
  isOpen,
  task: initialTask,
  onClose,
  onUpdate,
  onSubmitTask,
}: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(initialTask);
  const [activeTab, setActiveTab] = useState<"all" | "comments" | "history">("all");
  
  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionNote, setSubmissionNote] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<import("../types").TaskHistory[]>([]);
  const [comments, setComments] = useState<import("../types").TaskComment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

  // Load History & Comments when tab changes
  useEffect(() => {
    if (task) {
        if (activeTab === 'history' || activeTab === 'all') {
            setLoadingHistory(true);
            fetchTaskHistory(task.id)
                .then(setHistory)
                .catch(console.error)
                .finally(() => setLoadingHistory(false));
        }
        if (activeTab === 'comments' || activeTab === 'all') {
            import("../api").then(api => {
                api.fetchTaskComments(task.id)
                    .then(setComments)
                    .catch(console.error);
            });
        }
    }
  }, [activeTab, task?.id]);

  // Combine and Sort for "All" Tab
  const getAllTimelineItems = (): TimelineItem[] => {
      const historyItems: TimelineItem[] = history.map(h => ({
          type: 'history', 
          data: h, 
          date: normalizeToUTC(h.createdAt)
      }));
      
      const commentItems: TimelineItem[] = comments.map(c => ({
          type: 'comment', 
          data: c, 
          date: normalizeToUTC(c.createdAt)
      }));

      return [...historyItems, ...commentItems].sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const timelineItems = getAllTimelineItems();

  if (!isOpen || !task) return null;

  const linkedFeature = task.specFeatureId
    ? MOCK_SPEC_FEATURES.find((f) => f.id === task.specFeatureId)
    : null;

  // HANDLERS
  const handleUpdate = async (patch: Partial<Task>) => {
    if (!task) return;
    try {
      const updated = await updateTask(task.id, patch);
      setTask({ ...task, ...updated });
      onUpdate?.({ ...task, ...updated }); // Notify parent
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleStatusChange = async (newStatus: KanbanColumnKey) => {
    if (!task) return;
    try {
      const result = await updateTaskStatus(task.id, newStatus);
      setTask({ ...task, status: newStatus });
      onUpdate?.({ ...task, status: newStatus }); // Notify parent
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleSubmitWork = async () => {
    if (!proofLink.trim()) {
      setSubmitError("Please provide a proof link.");
      return;
    }
    if (!onSubmitTask) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmitTask(task.id, {
        submissionNote: submissionNote.trim() || undefined,
        proofLink: proofLink.trim(),
      });
      setSubmissionNote("");
      setProofLink("");
      // Ideally re-fetch or update task provided by parent
      onClose(); // Close modal or refresh check
    } catch (err) {
        setSubmitError("Submission failed. check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-8 overflow-hidden">
      <div className="bg-white w-full h-full md:h-[90vh] md:max-w-6xl md:rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER (BREADCRUMB & ACTIONS) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Layers className="w-4 h-4" />
            <span>Project</span>
            <span>/</span>
            <span className="uppercase">{task.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded">
              <MoreHorizontal className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-full">
            
            {/* LEFT COLUMN: MAIN CONTENT (8 cols) */}
            <div className="md:col-span-8 p-6 md:pr-8 border-r border-gray-200 space-y-8">
              
              {/* TITLE */}
              <div>
                <EditableText
                  value={task.title}
                  onSave={(val) => handleUpdate({ title: val })}
                  className="text-2xl font-semibold text-gray-900 leading-tight"
                />
              </div>
              
              {/* ACTION BAR (Buttons) */}
              <div className="flex items-center gap-2">
                 <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition-colors">
                    <Link2 className="w-4 h-4" />
                    Copy Link
                 </button>
                 <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition-colors">
                    <Flag className="w-4 h-4" />
                    Report
                 </button>
              </div>

              {/* DESCRIPTION */}
              <div>
                <SectionHeader title="Description" />
                <EditableText
                  value={task.description || ""}
                  onSave={(val) => handleUpdate({ description: val })}
                  multiline
                  placeholder="Add a description..."
                  className="text-gray-700 leading-relaxed text-sm min-h-[120px]"
                />
              </div>

              {/* SPEC FEATURE LINK */}
              {linkedFeature && (
                 <div className="bg-teal-50 border border-teal-200 rounded-md p-3">
                     <div className="flex items-center gap-2 mb-1">
                        <Layers className="w-4 h-4 text-teal-600" />
                        <span className="text-xs font-bold text-teal-700 uppercase">Feature Spec Compliance</span>
                     </div>
                     <p className="text-sm text-teal-900 font-medium">{linkedFeature.name}</p>
                     <p className="text-xs text-teal-600 mt-0.5">{linkedFeature.category}</p>
                 </div>
              )}

              {/* PROOF OF WORK DISPLAY */}
              {task.status === "DONE" && task.proofLink && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4">
                      <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <h4 className="text-sm font-bold text-emerald-800">Work Submitted</h4>
                      </div>
                      {task.submissionNote && <p className="text-sm text-emerald-900 mb-2">{task.submissionNote}</p>}
                      <a href={task.proofLink} target="_blank" rel="noreferrer" className="text-sm text-emerald-700 hover:underline flex items-center gap-1 font-medium">
                          <ExternalLink className="w-3 h-3" />
                          View Proof of Work
                      </a>
                  </div>
              )}

              {/* ACTIVITY TABS */}
              <div className="mt-8">
                 <div className="flex items-center gap-6 border-b border-gray-200 mb-4">
                     <button onClick={() => setActiveTab("all")} className={cn("pb-2 text-sm font-medium border-b-2 transition-colors", activeTab === "all" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}>All</button>
                     <button onClick={() => setActiveTab("comments")} className={cn("pb-2 text-sm font-medium border-b-2 transition-colors", activeTab === "comments" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}>Comments</button>
                     <button onClick={() => setActiveTab("history")} className={cn("pb-2 text-sm font-medium border-b-2 transition-colors", activeTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}>History</button>
                 </div>
              </div>
              
              {/* TAB CONTENT */}
              <div className="min-h-[200px]">
                  {/* ALL TAB (Merged View) */}
                  {activeTab === 'all' && (
                     <div className="space-y-4">
                         {loadingHistory ? (
                             <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" /></div>
                         ) : timelineItems.length === 0 ? (
                             <p className="text-sm text-gray-500 text-center py-4">No recent activity.</p>
                         ) : (
                             timelineItems.map((item, idx) => {
                                 if (item.type === 'history') {
                                     const record = item.data;
                                     return (
                                         <div key={`hist-${record.id}`} className="flex gap-3 text-sm">
                                             <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                  {record.actor?.avatarUrl ? (
                                                      <img src={record.actor.avatarUrl} className="w-full h-full rounded-full" />
                                                  ) : (
                                                      <User className="w-4 h-4 text-gray-500" />
                                                  )}
                                             </div>
                                             <div>
                                                 <div className="text-gray-900">
                                                     <span className="font-semibold">{record.actor?.fullName || "System"}</span>
                                                     <span className="text-gray-500 mx-1">updated</span>
                                                     <span className="font-medium text-gray-700">{record.fieldChanged}</span>
                                                 </div>
                                                 <div className="flex items-center gap-2 text-xs mt-1">
                                                      {record.oldValue && <span className="text-red-500 line-through bg-red-50 px-1 rounded">{record.oldValue}</span>}
                                                      {record.oldValue && <span className="text-gray-400">→</span>}
                                                      <span className="text-green-600 bg-green-50 px-1 rounded font-medium">{record.newValue}</span>
                                                 </div>
                                                 <p className="text-xs text-gray-400 mt-1" title={item.date.toLocaleString()}>
                                                     {formatDistanceToNow(item.date, { addSuffix: true })}
                                                 </p>
                                             </div>
                                         </div>
                                     );
                                 }
                                 // Handle comments here in future
                                 return null;
                             })
                         )}
                     </div>
                  )}

                  {activeTab === 'comments' && (
                 <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                         You
                     </div>
                     <div className="flex-1">
                         <div className="border border-gray-200 rounded-md shadow-sm mb-4">
                             <textarea 
                                placeholder="Add a comment..."
                                className="w-full p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-t-md resize-none min-h-[60px]"
                                id="new-comment-textarea"
                             ></textarea>
                             <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 flex justify-end gap-2 rounded-b-md">
                                 <button 
                                    className="text-xs bg-blue-600 text-white font-medium px-3 py-1.5 rounded hover:bg-blue-700 shadow-sm"
                                    onClick={() => {
                                        const area = document.getElementById('new-comment-textarea') as HTMLTextAreaElement;
                                        if (area && area.value.trim()) {
                                            import("../api").then(api => {
                                                api.createComment(task.id, area.value).then(newComment => {
                                                    setComments([newComment, ...comments]);
                                                    area.value = '';
                                                });
                                            });
                                        }
                                    }}
                                 >
                                     Save
                                 </button>
                             </div>
                         </div>

                         {/* Comment List */}
                         <div className="space-y-4">
                            {comments.map(comment => (
                                <div key={comment.id} className="flex gap-3 text-sm group">
                                     <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                          {comment.actor?.avatarUrl ? <img src={comment.actor.avatarUrl} className="w-full h-full rounded-full" /> : <User className="w-4 h-4 text-gray-500" />}
                                     </div>
                                     <div>
                                         <div className="flex items-center gap-2">
                                             <span className="font-semibold text-gray-900">{comment.actor?.fullName || "System"}</span>
                                             <span className="text-xs text-gray-400">
                                                 {formatDistanceToNow(normalizeToUTC(comment.createdAt), { addSuffix: true })}
                                             </span>
                                         </div>
                                         <p className="text-gray-700 mt-1">{comment.content}</p>
                                     </div>
                                </div>
                            ))}
                         </div>
                     </div>
                 </div>
                 )}

                  {activeTab === 'history' && (
                      <div className="space-y-4">
                           {loadingHistory ? (
                               <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" /></div>
                           ) : history.length === 0 ? (
                               <p className="text-sm text-gray-500 text-center py-4">No recent activity.</p>
                           ) : (
                               history.map((record) => (
                                   <div key={record.id} className="flex gap-3 text-sm">
                                       <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                            {record.actor?.avatarUrl ? (
                                                <img src={record.actor.avatarUrl} className="w-full h-full rounded-full" />
                                            ) : (
                                                <User className="w-4 h-4 text-gray-500" />
                                            )}
                                       </div>
                                       <div>
                                           <div className="text-gray-900">
                                               <span className="font-semibold">{record.actor?.fullName || "System"}</span>
                                               <span className="text-gray-500 mx-1">updated</span>
                                               <span className="font-medium text-gray-700">{record.fieldChanged}</span>
                                           </div>
                                           <div className="flex items-center gap-2 text-xs mt-1">
                                                {record.oldValue && <span className="text-red-500 line-through bg-red-50 px-1 rounded">{record.oldValue}</span>}
                                                {record.oldValue && <span className="text-gray-400">→</span>}
                                                <span className="text-green-600 bg-green-50 px-1 rounded font-medium">{record.newValue}</span>
                                           </div>
                                           <p className="text-xs text-gray-400 mt-1" title={normalizeToUTC(record.createdAt).toLocaleString()}>
                                               {formatDistanceToNow(normalizeToUTC(record.createdAt), { addSuffix: true })}
                                           </p>
                                       </div>
                                   </div>
                               ))
                           )}
                      </div>
                  )}
              </div>

              </div>

            {/* RIGHT COLUMN: SIDEBAR (4 cols) */}
            <div className="md:col-span-4 p-6 space-y-6 bg-gray-50/50">
              
              {/* STATUS SELECTOR */}
              <div>
                <SectionHeader title="Status" />
                <div className="relative">
                   <select 
                      value={task.status}
                      onChange={(e) => handleStatusChange(e.target.value as KanbanColumnKey)}
                      className={cn(
                          "w-full appearance-none px-3 py-2 rounded-md font-semibold text-sm border-0 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-500 cursor-pointer",
                          STATUS_OPTIONS.find(o => o.value === task.status)?.color
                      )}
                   >
                       {STATUS_OPTIONS.map(opt => (
                           <option key={opt.value} value={opt.value}>{opt.label}</option>
                       ))}
                   </select>
                   <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>

              {/* DETAILS PANEL */}
              <div className="border border-gray-200 rounded-md bg-white p-4 shadow-sm space-y-4">
                  <SectionHeader title="Details" />
                  
                  {/* Assignee */}
                  <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">Assignee</span>
                      <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors group">
                           {task.assignee ? (
                              <>
                                <img src={task.assignee.avatarUrl || `https://ui-avatars.com/api/?name=${task.assignee.fullName}`} alt="" className="w-5 h-5 rounded-full" />
                                <span className="text-sm text-blue-700">{task.assignee.fullName}</span>
                              </>
                           ) : (
                               <span className="text-sm text-gray-400 italic">Unassigned</span>
                           )}
                           <User className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                      </div>
                  </div>

                   {/* Reporter */}
                   <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">Reporter</span>
                      <div className="flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-[10px] text-green-700 font-bold">R</div>
                           {/* Using mock reporter for now if not in task object yet */}
                           <span className="text-sm text-gray-900">{task.reporterId ? "Project Admin" : "System"}</span> 
                      </div>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">Priority</span>
                      <div className="relative group">
                           <select
                              value={task.priority || "MEDIUM"}
                              onChange={(e) => handleUpdate({ priority: e.target.value as TaskPriority })}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                           >
                               {Object.keys(PRIORITY_CONFIG).map(p => (
                                   <option key={p} value={p}>{p}</option>
                               ))}
                           </select>
                           <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 pr-2 rounded transition-colors border border-transparent hover:border-gray-200">
                               <Flag className={cn("w-3.5 h-3.5", PRIORITY_CONFIG[task.priority || "MEDIUM"].color)} />
                               <span className={cn("text-sm font-medium", PRIORITY_CONFIG[task.priority || "MEDIUM"].color)}>
                                   {task.priority || "MEDIUM"}
                               </span>
                               <ChevronDown className="w-3 h-3 text-gray-400" />
                           </div>
                      </div>
                  </div>

                  {/* Story Points */}
                  <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">Story Points</span>
                      <input 
                         type="number" 
                         value={task.storyPoints || ""} 
                         onChange={(e) => handleUpdate({ storyPoints: parseInt(e.target.value) || 0 })}
                         placeholder="-"
                         className="w-16 text-right text-sm border-gray-200 rounded p-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                  </div>

                  {/* Labels */}
                  <div className="space-y-2">
                       <span className="text-sm text-gray-600 font-medium block">Labels</span>
                       <div className="flex flex-wrap gap-2">
                           {task.labels?.map(label => (
                               <span key={label} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                   {label}
                               </span>
                           ))}
                           <button 
                                onClick={() => {
                                    const newLabel = prompt("Enter label:");
                                    if(newLabel) handleUpdate({ labels: [...(task.labels || []), newLabel] })
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                            >
                               <Plus className="w-3 h-3" />
                               Add
                           </button>
                       </div>
                  </div>

                   {/* Start Date */}
                   <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">Start Date</span>
                      <div className="relative">
                          {/* Simplistic Date Input for demo */}
                          <input 
                             type="date" 
                             value={task.startDate ? format(new Date(task.startDate), 'yyyy-MM-dd') : ""}
                             onChange={(e) => handleUpdate({ startDate: e.target.value })}
                             className="text-xs border-0 p-0 text-slate-600 focus:ring-0 text-right w-24 bg-transparent cursor-pointer"
                          />
                      </div>
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">Due Date</span>
                      <div className="relative">
                          <input 
                             type="date" 
                             value={task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : ""}
                             onChange={(e) => handleUpdate({ dueDate: e.target.value })}
                             className="text-xs border-0 p-0 text-slate-600 focus:ring-0 text-right w-24 bg-transparent cursor-pointer"
                          />
                      </div>
                  </div>
              </div>

              {/* SUBMIT WORK ACTION */}
              {!task.proofLink && task.status !== "DONE" && onSubmitTask && (
                 <div className="mt-6 border border-teal-200 rounded-md bg-teal-50 p-4 space-y-3">
                     <SectionHeader title="Submit Work" />
                     <p className="text-xs text-teal-800 mb-2">Ready to mark this done? Provide proof below.</p>
                     
                     <div className="space-y-2">
                         <input 
                             placeholder="Proof URL (GitHub PR, Loom...)" 
                             value={proofLink}
                             onChange={(e) => setProofLink(e.target.value)}
                             className="w-full text-sm border-teal-200 rounded focus:border-teal-500 focus:ring-teal-500"
                         />
                         <textarea 
                             placeholder="Completion note (optional)" 
                             value={submissionNote}
                             onChange={(e) => setSubmissionNote(e.target.value)}
                             className="w-full text-sm border-teal-200 rounded focus:border-teal-500 focus:ring-teal-500 resize-none h-16"
                         />
                     </div>
                     
                     <button 
                        onClick={handleSubmitWork}
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 rounded transition-colors text-sm shadow-sm disabled:opacity-50"
                     >
                         {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit & Mark Done"}
                     </button>
                     
                     {submitError && <p className="text-xs text-red-600">{submitError}</p>}
                 </div>
              )}
              
              <div className="text-xs text-gray-400 pt-4 flex justify-between">
                  <span>Created {task.id ? format(new Date(), "MMM d, yyyy") : "-"}</span>
                  <span>Updated {format(new Date(), "MMM d, yyyy")}</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default TaskDetailModal;
