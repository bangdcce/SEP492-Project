title Staff Screenflow - Frontend (Action-Based)

// --- CLIENT PAGES (Flat) ---
Landing [shape: rectangle, label: "Landing (/)" ]
Login [shape: rectangle, label: "Login" ]
StaffDashboard [shape: rectangle, label: "Staff Dashboard" ]
DisputeQueue [shape: rectangle, label: "Dispute Queue (Triage)" ]
DisputeHub [shape: rectangle, label: "Dispute Hub\n(Timeline | Hearings | Evidence | Discussion | Verdict)" ]
CalendarPage [shape: rectangle, label: "Hearing Calendar" ]
WorkloadPage [shape: rectangle, label: "Workload (Phase 2)" ]

// --- MODALS ---
RejectModal [shape: oval, label: "Reject Dialog" ]
RequestInfoModal [shape: oval, label: "Request Info Dialog" ]
HearingModal [shape: oval, label: "Reschedule / End Hearing" ]

// --- LEGEND ---
Legend_Page [shape: rectangle, label: "Flat Page" ]
Legend_Modal [shape: oval, label: "Modal / Popup" ]

// --- FLOWS (User Actions) ---
Landing > Login: Auto redirect to /login
Login > StaffDashboard: Click "Sign in" (staff credentials)

StaffDashboard > DisputeQueue: Click sidebar "Dispute Queue"
StaffDashboard > DisputeHub: Click sidebar "My Caseload"
StaffDashboard > CalendarPage: Click sidebar "Calendar"
StaffDashboard > WorkloadPage: Click sidebar "Workload"

DisputeQueue > DisputeHub: Click "Quick Look" (eye icon)
DisputeQueue > RejectModal: Click "Reject"
RejectModal > DisputeQueue: Confirm/Cancel
DisputeQueue > RequestInfoModal: Click "Request Info"
RequestInfoModal > DisputeQueue: Confirm/Cancel

DisputeHub > HearingModal: Click "Reschedule" / "End"
HearingModal > DisputeHub: Confirm/Cancel
DisputeHub > DisputeQueue: Click "Back to queue"

CalendarPage > StaffDashboard: Click sidebar "Dashboard"
WorkloadPage > StaffDashboard: Click sidebar "Dashboard"
