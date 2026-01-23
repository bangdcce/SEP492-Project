import { StaffDisputeBoard } from "@/features/disputes/components/dashboard/StaffDisputeBoard";

export const StaffQueuePage = () => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dispute Queue</h2>
          <p className="text-gray-500">Triage incoming reports effectively.</p>
        </div>
      </div>
      <StaffDisputeBoard />
    </div>
  );
};
