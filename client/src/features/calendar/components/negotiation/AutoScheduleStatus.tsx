import { Loader2, Sparkles } from "lucide-react";

export const AutoScheduleStatus = () => {
  return (
    <div className="bg-white p-8 rounded-xl border border-gray-200 text-center max-w-sm mx-auto">
      <div className="relative inline-block mb-4">
        <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center">
          <Sparkles className="w-8 h-8" />
        </div>
        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-900">
        Finding Best Time
      </h3>
      <p className="text-sm text-gray-500 mt-2">
        Analyzing calendars for 3 participants...
        <br />
        Avoiding "Dead Time" and conflicts.
      </p>

      <div className="mt-6 space-y-2">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            ✓
          </div>
          <span>Checking Raiser Availability</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            ✓
          </div>
          <span>Checking Defendant Availability</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600 font-medium animate-pulse">
          <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin"></div>
          <span>Cross-referencing Moderator slots...</span>
        </div>
      </div>
    </div>
  );
};
