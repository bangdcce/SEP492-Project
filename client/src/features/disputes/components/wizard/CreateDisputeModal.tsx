import { X } from "lucide-react";
import { CreateDisputeWizard } from "./CreateDisputeWizard";

interface CreateDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestoneId: string;
  projectId: string;
  milestoneTitle: string;
  milestoneStatus: string;
  projectTitle: string;
  currentUserId: string;
  projectMembers: Array<{
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
  }>; // Simplified User
}

export const CreateDisputeModal = ({
  isOpen,
  onClose,
  milestoneId,
  projectId,
  milestoneTitle,
  milestoneStatus,
  currentUserId,
  projectMembers,
}: CreateDisputeModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-slate-900/75 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div
            className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-b border-gray-200">
              <button
                type="button"
                className="inline-flex rounded-md p-2 text-gray-400 hover:text-gray-500 focus:outline-none"
                onClick={onClose}
              >
                <span className="sr-only">Close</span>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="w-full text-left">
                <h3 className="text-lg font-semibold leading-6 text-slate-900">
                  Open a Dispute
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Disputing Milestone:{" "}
                  <span className="font-medium text-slate-700">
                    {milestoneTitle}
                  </span>
                </p>
              </div>
            </div>

            {/* Content - The Wizard Logic */}
            <div className="px-4 py-5 sm:p-6">
              <CreateDisputeWizard
                onClose={onClose}
                milestoneId={milestoneId}
                projectId={projectId}
                milestoneStatus={milestoneStatus}
                currentUserId={currentUserId}
                projectMembers={projectMembers}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
