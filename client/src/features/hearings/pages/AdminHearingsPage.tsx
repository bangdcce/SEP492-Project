import { StaffHearingsPage } from "@/features/staff/pages/StaffHearingsPage";

export const AdminHearingsPage = () => {
  return (
    <StaffHearingsPage
      routeBase="/admin"
      title="Hearings"
      description="Monitor live, upcoming, and follow-up hearings across dispute operations."
    />
  );
};
