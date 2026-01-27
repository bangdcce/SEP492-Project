import { Link, useParams } from "react-router-dom";
import { HearingRoom } from "@/features/hearings/components/HearingRoom";

export const StaffHearingRoomPage = () => {
  const { hearingId } = useParams<{ hearingId: string }>();

  if (!hearingId) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Invalid hearing</h2>
        <p className="text-sm text-gray-500">
          The hearing room link is missing an ID.
        </p>
        <Link
          to="/staff/hearings"
          className="text-sm text-teal-600 hover:text-teal-700 font-medium"
        >
          Back to hearings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to="/staff/hearings"
        className="text-sm text-teal-600 hover:text-teal-700 font-medium"
      >
        Back to hearings
      </Link>
      <HearingRoom hearingId={hearingId} />
    </div>
  );
};
