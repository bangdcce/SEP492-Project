import { Activity } from "lucide-react";

export const StaffWorkloadPage = () => {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-gray-300 min-h-[500px]">
      <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-4">
        <Activity className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">Workload Analytics</h2>
      <p className="text-gray-500 text-center max-w-md mt-2">
        Track team performance and case resolution metrics.
        <br />
        Coming in Phase 2.
      </p>
    </div>
  );
};
