import { Link, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
import { HearingRoom } from "@/features/hearings/components/HearingRoom";

export const AdminHearingRoomPage = () => {
  const { hearingId } = useParams<{ hearingId: string }>();

  if (!hearingId) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Invalid hearing</h2>
        <p className="text-sm text-gray-500">
          The hearing room link is missing an ID.
        </p>
        <Link
          to={ROUTES.ADMIN_HEARINGS}
          className="text-sm font-medium text-teal-600 hover:text-teal-700"
        >
          Back to hearings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to={ROUTES.ADMIN_HEARINGS}
        className="text-sm font-medium text-teal-600 hover:text-teal-700"
      >
        Back to hearings
      </Link>
      <HearingRoom hearingId={hearingId} />
    </div>
  );
};
