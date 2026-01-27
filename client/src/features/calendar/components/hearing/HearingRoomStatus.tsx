import { Mic, MicOff, Clock } from "lucide-react";

export const HearingRoomStatus = () => {
  // Mock Participant Data
  const participants = [
    {
      id: 1,
      name: "Alice",
      role: "Raiser",
      isOnline: true,
      minutesPresent: 15,
      isMuted: false,
    },
    {
      id: 2,
      name: "Bob",
      role: "Defendant",
      isOnline: true,
      minutesPresent: 14,
      isMuted: true,
    },
    {
      id: 3,
      name: "Staff Admin",
      role: "Moderator",
      isOnline: true,
      minutesPresent: 15,
      isMuted: false,
    },
  ];



  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 px-4 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-medium text-sm">Hearing in Progress</span>
        </div>
        <div className="flex items-center gap-1 text-sm font-mono text-slate-300">
          <Clock className="w-4 h-4" />
          <span>00:45:00</span>
        </div>
      </div>

      <div className="p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
          Attendance Tracker
        </h4>
        <div className="space-y-3">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold text-xs text-gray-600">
                    {p.name[0]}
                  </div>
                  {p.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-700">
                    {p.minutesPresent}m
                  </p>
                  <div className="w-16 h-1 bg-gray-100 rounded-full mt-1">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${(p.minutesPresent / 60) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <button
                  className={`p-1.5 rounded-md ${p.isMuted ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-500"}`}
                >
                  {p.isMuted ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 flex gap-2">
          <button className="flex-1 bg-red-50 text-red-600 text-xs font-medium py-2 rounded-lg hover:bg-red-100">
            Mute All
          </button>
          <button className="flex-1 bg-slate-900 text-white text-xs font-medium py-2 rounded-lg hover:bg-slate-800">
            Grant Floor
          </button>
        </div>
      </div>
    </div>
  );
};
