from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.shared import Inches, Pt


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "docs" / "usecase des" / "Doc Interdev - Updated Use Cases.docx"
GENERATED_DATE = "27/03/2026"


def set_cell_text(cell, text: str, *, bold: bool = False, align="left") -> None:
    cell.text = ""
    paragraph = cell.paragraphs[0]
    paragraph.alignment = {
        "left": WD_PARAGRAPH_ALIGNMENT.LEFT,
        "center": WD_PARAGRAPH_ALIGNMENT.CENTER,
    }[align]
    run = paragraph.add_run(text)
    run.bold = bold
    run.font.name = "Times New Roman"
    run.font.size = Pt(11)


def add_labeled_list(cell, prefix: str, values: list[str]) -> None:
    cell.text = ""
    for index, value in enumerate(values, start=1):
        paragraph = cell.paragraphs[0] if index == 1 else cell.add_paragraph()
        paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT
        label_run = paragraph.add_run(f"{prefix}-{index}: ")
        label_run.bold = True
        label_run.font.name = "Times New Roman"
        label_run.font.size = Pt(11)
        text_run = paragraph.add_run(value)
        text_run.font.name = "Times New Roman"
        text_run.font.size = Pt(11)


def add_sections(cell, sections: list[dict[str, object]]) -> None:
    cell.text = ""
    first_paragraph = True
    for section in sections:
        paragraph = cell.paragraphs[0] if first_paragraph else cell.add_paragraph()
        paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT
        run = paragraph.add_run(str(section["heading"]))
        run.bold = True
        run.font.name = "Times New Roman"
        run.font.size = Pt(11)
        first_paragraph = False
        for step in section["steps"]:
            step_paragraph = cell.add_paragraph()
            step_paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT
            step_run = step_paragraph.add_run(str(step))
            step_run.font.name = "Times New Roman"
            step_run.font.size = Pt(11)


def expand_alternative_sections(sections: list[dict[str, object]]) -> list[dict[str, object]]:
    expanded: list[dict[str, object]] = []
    for section in sections:
        heading = str(section["heading"])
        match = re.match(r"^([A-Z]\d+(?:/[A-Z]\d+)*)\.\s+(.*)$", heading)
        if not match or "/" not in match.group(1):
            expanded.append(section)
            continue

        anchors = match.group(1).split("/")
        title = match.group(2)
        for anchor in anchors:
            expanded.append(
                {
                    "heading": f"{anchor}. {title}",
                    "steps": list(section["steps"]),
                }
            )
    return expanded


def add_plain_lines(cell, lines: list[str]) -> None:
    cell.text = ""
    for index, line in enumerate(lines):
        paragraph = cell.paragraphs[0] if index == 0 else cell.add_paragraph()
        paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT
        run = paragraph.add_run(line)
        run.font.name = "Times New Roman"
        run.font.size = Pt(11)


def base_use_case(
    uc_id: str,
    name: str,
    primary_actor: str,
    secondary_actor: str,
    trigger: str,
    description: str,
    preconditions: list[str],
    postconditions: list[str],
    normal_flow: list[dict[str, object]],
    alternative_flow: list[dict[str, object]],
    exceptions: list[str],
    priority: str = "High",
    frequency: str = "Daily",
    business_rules: list[str] | None = None,
    other_information: list[str] | None = None,
    assumptions: list[str] | None = None,
) -> dict[str, object]:
    return {
        "id": uc_id,
        "name": name,
        "created_by": "Codex",
        "date_created": GENERATED_DATE,
        "primary_actor": primary_actor,
        "secondary_actor": secondary_actor,
        "trigger": trigger,
        "description": description,
        "preconditions": preconditions,
        "postconditions": postconditions,
        "normal_flow": normal_flow,
        "alternative_flow": alternative_flow,
        "exceptions": exceptions,
        "priority": priority,
        "frequency": frequency,
        "business_rules": business_rules or ["Follow the current backend validation and authorization rules."],
        "other_information": other_information or ["Rewritten from the old format and aligned to the current codebase flow."],
        "assumptions": assumptions or ["The user is authenticated and uses the current web application flow."],
    }


USE_CASES: list[dict[str, object]] = []

USE_CASES.extend(
    [
        base_use_case(
            "UC-13",
            "Create Request",
            "Client",
            "File Storage Service",
            "The Client starts the request wizard or chooses to create a new request from the dashboard.",
            "The Client creates a new project request and saves its initial data, answers, and uploaded-file references.",
            [
                "The Client is authenticated.",
                "The Client has not exceeded the active request quota.",
                "Any file attached to the request has been uploaded successfully before submission.",
            ],
            [
                "A new request record is created with owner, answers, attachments, and a scope baseline.",
                "The request status is saved as DRAFT, PUBLIC_DRAFT, or PRIVATE_DRAFT based on the submitted payload.",
                "Quota usage for request creation is updated after a successful save.",
            ],
            [
                {
                    "heading": "A. Create Request as Draft",
                    "steps": [
                        "1. The Client opens the request creation flow.",
                        "2. The Client enters request information such as title, description, budget range, timeline, and technical preferences.",
                        "3. The Client answers the structured request questions and attaches uploaded-file references if needed.",
                        "4. The Client chooses to save the request as draft.",
                        "5. The System validates the request quota and validates the deadline/timeline input.",
                        "6. The System creates the request with status DRAFT and stores the related answers.",
                        "7. The System builds the initial request scope baseline and returns the saved request.",
                    ],
                },
                {
                    "heading": "B. Create Request Directly for Broker Marketplace",
                    "steps": [
                        "1. The Client completes the request information.",
                        "2. The Client submits the request with marketplace visibility enabled.",
                        "3. The System validates the request quota and validates the deadline/timeline input.",
                        "4. The System creates the request with status PUBLIC_DRAFT and stores the related answers.",
                        "5. The System records quota usage and returns the saved request for marketplace review.",
                    ],
                },
                {
                    "heading": "C. Create Request as Private Invite-Only Draft",
                    "steps": [
                        "1. The Client completes the request information.",
                        "2. The Client submits the request with private visibility enabled.",
                        "3. The System validates the request quota and validates the deadline/timeline input.",
                        "4. The System creates the request with status PRIVATE_DRAFT and stores the related answers.",
                        "5. The System returns the saved request for later invitation-based broker selection.",
                    ],
                },
            ],
            [
                {
                    "heading": "A5/B3/C3. Active Request Quota Reached",
                    "steps": [
                        "1. The System detects that the Client has reached the allowed request-creation quota.",
                        "2. The System rejects the creation request and returns a quota error.",
                        "3. The Client must free capacity or upgrade the subscription before creating another request.",
                    ],
                },
                {
                    "heading": "A5/B3/C3. Invalid Deadline or Timeline",
                    "steps": [
                        "1. The System detects that the requested deadline is invalid or earlier than the current date.",
                        "2. The System rejects the submission and displays an error message.",
                        "3. The Client corrects the date input and retries.",
                    ],
                },
                {
                    "heading": "A3/B1/C1. Missing Required Request Content",
                    "steps": [
                        "1. The submitted payload is incomplete or fails DTO validation.",
                        "2. The System rejects the submission.",
                        "3. The Client updates the request content and submits again.",
                    ],
                },
            ],
            [
                "Database save fails while creating the request or answers.",
                "Audit logging fails after creation; the request may still be created successfully.",
                "File storage metadata is unavailable and the uploaded-file references cannot be resolved correctly.",
            ],
            business_rules=[
                "Creation consumes the CREATE_REQUEST quota only after the request is saved successfully.",
                "The current code allows the status to be supplied during creation, so the same endpoint can create draft, public draft, or private draft requests.",
                "Attachments are stored as previously uploaded metadata; the create endpoint itself does not upload files.",
            ],
            other_information=[
                "Related backend flow: POST /project-requests and POST /project-requests/upload.",
                "Allowed upload types currently include PDF, Office files, PNG, JPG, WEBP, TXT, and CSV.",
            ],
        ),
        base_use_case(
            "UC-14",
            "Post Request To Marketplace",
            "Client",
            "",
            "The Client has an existing draft or private request and chooses to publish it.",
            "The Client publishes an eligible request to the broker marketplace.",
            [
                "The Client is authenticated.",
                "The request exists and belongs to the Client.",
                "The request status is DRAFT, PRIVATE_DRAFT, or PUBLIC_DRAFT.",
                "The request does not already have an assigned broker.",
            ],
            [
                "The request status is PUBLIC_DRAFT.",
                "The request becomes visible to broker marketplace flows.",
            ],
            [
                {
                    "heading": "A. Publish an Eligible Request",
                    "steps": [
                        "1. The Client opens a request from the current-request list or request detail page.",
                        "2. The Client chooses the action to post the request to the marketplace.",
                        "3. The System verifies that the request belongs to the Client and is in a publishable status.",
                        "4. The System verifies that no broker is already assigned to the request.",
                        "5. The System updates the request status to PUBLIC_DRAFT.",
                        "6. The System returns the updated request to the Client.",
                    ],
                },
                {
                    "heading": "B. Publish a Request That Is Already Public",
                    "steps": [
                        "1. The Client opens a request that already has status PUBLIC_DRAFT.",
                        "2. The Client triggers the publish action again.",
                        "3. The System recognizes that the request is already public.",
                        "4. The System returns the current request without changing its status.",
                    ],
                },
            ],
            [
                {
                    "heading": "A3. Request Is Not in a Publishable Status",
                    "steps": [
                        "1. The request status is not DRAFT, PRIVATE_DRAFT, or PUBLIC_DRAFT.",
                        "2. The System rejects the publish action and explains that the current status cannot be published.",
                    ],
                },
                {
                    "heading": "A4. Broker Already Assigned",
                    "steps": [
                        "1. The System detects that the request already has a broker assigned.",
                        "2. The System rejects the publish action.",
                        "3. The Client keeps working with the assigned broker instead of reopening the request to the marketplace.",
                    ],
                },
                {
                    "heading": "A3. Client Does Not Own the Request",
                    "steps": [
                        "1. The request does not belong to the current Client.",
                        "2. The System denies access to the publish action.",
                    ],
                },
            ],
            [
                "Database update fails while changing the request status.",
                "Audit logging fails after the publish action.",
            ],
            business_rules=[
                "Publishing is idempotent when the request is already PUBLIC_DRAFT.",
                "Publishing is blocked once a broker is assigned.",
            ],
            other_information=[
                "Related backend flow: POST /project-requests/:id/publish.",
            ],
        ),
        base_use_case(
            "UC-15",
            "Make Request Private",
            "Client",
            "",
            "The Client wants to hide a marketplace-visible request and continue through invitation-based broker selection.",
            "The Client updates a request so it is no longer visible on the broker marketplace.",
            [
                "The Client is authenticated.",
                "The request exists and belongs to the Client.",
                "The request is still editable by the Client.",
            ],
            [
                "The request status is saved as PRIVATE_DRAFT when the Client changes it to private.",
                "Pending broker proposals are automatically rejected if the request was previously PUBLIC_DRAFT.",
                "The request is no longer open on the public broker marketplace.",
            ],
            [
                {
                    "heading": "A. Change a Public Request to Private",
                    "steps": [
                        "1. The Client opens an editable request.",
                        "2. The Client changes the marketplace visibility from public to private.",
                        "3. The Client saves the request update.",
                        "4. The System validates the update payload and ownership.",
                        "5. The System rejects all pending broker proposals for the request.",
                        "6. The System updates the request status to PRIVATE_DRAFT.",
                        "7. The System returns the updated request.",
                    ],
                },
                {
                    "heading": "B. Save a Request That Is Already Private",
                    "steps": [
                        "1. The Client opens a request already stored as PRIVATE_DRAFT.",
                        "2. The Client saves the request while keeping private visibility.",
                        "3. The System updates the request content and keeps the private status.",
                    ],
                },
            ],
            [
                {
                    "heading": "A4. Client Is Not Allowed to Update the Request",
                    "steps": [
                        "1. The current user is not allowed to update the request.",
                        "2. The System denies the update action.",
                    ],
                },
                {
                    "heading": "A4/B3. Invalid Request Data",
                    "steps": [
                        "1. The update contains an invalid deadline or another invalid field.",
                        "2. The System rejects the update and returns the validation error.",
                        "3. The Client corrects the data and retries.",
                    ],
                },
                {
                    "heading": "A5. No Pending Broker Proposals Exist",
                    "steps": [
                        "1. The request has no pending broker proposals to reject.",
                        "2. The System skips the proposal-rejection step and still updates the request to PRIVATE_DRAFT.",
                    ],
                },
            ],
            [
                "Database update fails while saving the new request status.",
                "Proposal rejection update fails while converting a public request to private.",
            ],
            business_rules=[
                "The current implementation performs this use case through PATCH /project-requests/:id with status=PRIVATE_DRAFT.",
                "Pending broker proposals are rejected automatically when the request moves from PUBLIC_DRAFT to PRIVATE_DRAFT.",
                "The current code does not send a dedicated notification for each auto-rejected pending broker proposal during this status change.",
            ],
            other_information=[
                "Related backend flow: PATCH /project-requests/:id.",
            ],
        ),
        base_use_case(
            "UC-16",
            "Delete Request",
            "Client",
            "",
            "The Client chooses to remove an unwanted request from the system.",
            "The Client deletes an eligible draft-stage request and its related proposal data.",
            [
                "The Client is authenticated.",
                "The request exists and belongs to the Client.",
                "The request status is DRAFT, PUBLIC_DRAFT, or PRIVATE_DRAFT.",
                "The request does not have an assigned broker or an accepted freelancer.",
            ],
            [
                "The request record is removed from the database.",
                "Related request answers, broker proposals, and freelancer proposals are deleted.",
            ],
            [
                {
                    "heading": "A. Delete an Eligible Request",
                    "steps": [
                        "1. The Client opens the current request list or request detail page.",
                        "2. The Client chooses the Delete action for a request.",
                        "3. The System verifies request ownership.",
                        "4. The System verifies that the request is still in a deletable status.",
                        "5. The System verifies that no broker is assigned and no freelancer has been accepted.",
                        "6. The System deletes related answers and proposal records.",
                        "7. The System deletes the request record.",
                        "8. The System returns a successful deletion response.",
                    ],
                },
            ],
            [
                {
                    "heading": "A3. Request Does Not Belong to the Client",
                    "steps": [
                        "1. The System detects that the current Client is not the request owner.",
                        "2. The System rejects the delete action.",
                    ],
                },
                {
                    "heading": "A4. Request Status Is Not Deletable",
                    "steps": [
                        "1. The request status is no longer DRAFT, PUBLIC_DRAFT, or PRIVATE_DRAFT.",
                        "2. The System rejects the delete action and explains that only draft-stage requests can be deleted.",
                    ],
                },
                {
                    "heading": "A5. Broker Already Assigned or Freelancer Already Accepted",
                    "steps": [
                        "1. The System detects that the request already has an assigned broker or an accepted freelancer.",
                        "2. The System blocks the deletion to preserve the active workflow.",
                    ],
                },
                {
                    "heading": "A3. Request Not Found",
                    "steps": [
                        "1. The target request no longer exists.",
                        "2. The System returns a not-found error.",
                    ],
                },
            ],
            [
                "Database delete fails for the request or one of its related child records.",
                "Audit logging fails after the request has already been deleted.",
            ],
            business_rules=[
                "The current implementation performs a hard delete, not a soft delete.",
                "Deletion is limited to draft-stage requests only.",
            ],
            other_information=[
                "Related backend flow: DELETE /project-requests/:id.",
            ],
        ),
        base_use_case(
            "UC-17",
            "View List Current Request",
            "Client, Broker, Freelancer",
            "",
            "The User opens a request-list page from the dashboard or marketplace area.",
            "The System displays the list of current requests relevant to the User's role and access rights.",
            [
                "The User is authenticated.",
                "The User has one of the supported roles for the request-list flow.",
            ],
            [
                "A role-appropriate request list is displayed.",
                "The User can continue to request-detail, invitation, or marketplace actions from the list.",
            ],
            [
                {
                    "heading": "A. Client Views Own Current Requests",
                    "steps": [
                        "1. The Client opens the My Requests page.",
                        "2. The System loads the Client-owned requests ordered by newest update.",
                        "3. The System displays each request with its current status and summary information.",
                    ],
                },
                {
                    "heading": "B. Broker Views Current Request Worklist",
                    "steps": [
                        "1. The Broker opens the broker project/request page.",
                        "2. The System loads request data available to broker-facing flows.",
                        "3. The UI filters and emphasizes requests where the Broker is assigned or already associated through proposal/invitation state.",
                    ],
                },
                {
                    "heading": "C. Freelancer Views Current Accessible Requests",
                    "steps": [
                        "1. The Freelancer opens the freelancer request page.",
                        "2. The System loads requests where the Freelancer has INVITED, PENDING, or ACCEPTED proposal access.",
                        "3. The System displays the accessible request list for follow-up review.",
                    ],
                },
            ],
            [
                {
                    "heading": "A2/B2/C2. No Current Requests Found",
                    "steps": [
                        "1. The System completes the list query but finds no matching request records.",
                        "2. The System displays an empty-state message.",
                    ],
                },
                {
                    "heading": "B2/C2. Role-Specific List Endpoint Returns No Accessible Records",
                    "steps": [
                        "1. The User has no currently assigned, invited, or accessible requests.",
                        "2. The System displays an empty worklist for that role.",
                    ],
                },
            ],
            [
                "Database query fails while loading the request list.",
                "Realtime refresh fails; the User may need to reload the page.",
            ],
            priority="High",
            frequency="Very High",
            business_rules=[
                "Client and broker list flows do not currently use the exact same backend filtering strategy.",
                "Freelancer current requests use a dedicated access-list endpoint separate from the general request list.",
            ],
            other_information=[
                "Related backend flows: GET /project-requests, GET /project-requests/freelancer/requests/my, GET /project-requests/drafts/mine.",
            ],
        ),
        base_use_case(
            "UC-18",
            "View Request Detail",
            "Client, Broker, Freelancer",
            "",
            "The User selects a request from a list, marketplace view, or invitation flow.",
            "The System displays the detailed request information allowed for the current User.",
            [
                "The User is authenticated.",
                "The request exists.",
                "The User has permission to view the request according to role-based access rules.",
            ],
            [
                "The request detail is displayed with role-appropriate data visibility.",
                "Sensitive client contact information remains masked when the viewer is not yet fully associated with the request.",
            ],
            [
                {
                    "heading": "A. Client Views Own Request Detail",
                    "steps": [
                        "1. The Client opens a request from the current-request list.",
                        "2. The System verifies that the request belongs to the Client.",
                        "3. The System loads the full request detail and related workflow data.",
                        "4. The System displays the request detail page.",
                    ],
                },
                {
                    "heading": "B. Broker Views Accessible Request Detail",
                    "steps": [
                        "1. The Broker opens a request from the marketplace, invitation list, or broker worklist.",
                        "2. The System checks whether the Broker is assigned, invited, has an active proposal, or is viewing an open marketplace request.",
                        "3. The System loads the request detail.",
                        "4. The System masks the Client's contact details if the Broker is not the assigned broker.",
                        "5. The System displays the request detail page.",
                    ],
                },
                {
                    "heading": "C. Freelancer Views Accessible Request Detail",
                    "steps": [
                        "1. The Freelancer opens a request from the invitation list, access list, or freelancer marketplace.",
                        "2. The System checks whether the Freelancer is invited/accepted or the request is an open phase-3 freelancer marketplace request.",
                        "3. The System loads the request detail.",
                        "4. The System masks the Client's contact details if the Freelancer is only a marketplace viewer.",
                        "5. The System displays the request detail page.",
                    ],
                },
            ],
            [
                {
                    "heading": "A2/B2/C2. User Does Not Have Access to the Request",
                    "steps": [
                        "1. The access rule check fails for the current role.",
                        "2. The System denies the request-detail access.",
                    ],
                },
                {
                    "heading": "A2/B2/C2. Request Not Found",
                    "steps": [
                        "1. The target request does not exist.",
                        "2. The System returns a not-found error.",
                    ],
                },
                {
                    "heading": "B4/C4. Contact Information Is Hidden",
                    "steps": [
                        "1. The viewer is allowed to review the request but is not yet the fully assigned participant.",
                        "2. The System masks client contact information instead of revealing it directly.",
                    ],
                },
            ],
            [
                "Database load fails while retrieving the request and related entities.",
            ],
            business_rules=[
                "Broker marketplace viewers can review PUBLIC_DRAFT or selected PENDING-stage opportunities without seeing full client contact data.",
                "Freelancer marketplace viewers can review open phase-3 requests when the request is SPEC_APPROVED, already has a broker, and has no active freelancer.",
            ],
            other_information=[
                "Related backend flow: GET /project-requests/:id.",
            ],
        ),
    ]
)

USE_CASES.extend(
    [
        base_use_case(
            "UC-21",
            "Edit Request",
            "Client",
            "",
            "The Client wants to revise an existing request after reviewing its current data.",
            "The Client updates request content, answers, attachments, workflow state, or wizard progress for an existing request.",
            [
                "The Client is authenticated.",
                "The request exists and belongs to the Client.",
            ],
            [
                "The request data is updated.",
                "Any submitted answers replace the prior answer set for that request.",
                "If the request is changed from PUBLIC_DRAFT to PRIVATE_DRAFT, pending broker proposals are rejected automatically.",
            ],
            [
                {
                    "heading": "A. Update Request Content",
                    "steps": [
                        "1. The Client opens the request edit page or wizard resume flow.",
                        "2. The Client modifies request fields such as title, description, budget range, deadline, answers, or attachments.",
                        "3. The Client saves the request.",
                        "4. The System verifies ownership and validates the updated input.",
                        "5. The System saves the updated request fields.",
                        "6. The System replaces the answer set if new answers were submitted.",
                        "7. The System rebuilds the request scope baseline and returns the updated request.",
                    ],
                },
                {
                    "heading": "B. Update Request and Make It Private",
                    "steps": [
                        "1. The Client edits a request that is currently PUBLIC_DRAFT.",
                        "2. The Client changes the status to PRIVATE_DRAFT and saves the request.",
                        "3. The System validates the update.",
                        "4. The System rejects all pending broker proposals for the request.",
                        "5. The System saves the request as PRIVATE_DRAFT and returns the updated detail.",
                    ],
                },
            ],
            [
                {
                    "heading": "A4/B3. Client Is Not Allowed to Update the Request",
                    "steps": [
                        "1. The current user is not the authorized request owner for this flow.",
                        "2. The System rejects the update.",
                    ],
                },
                {
                    "heading": "A4/B3. Invalid Deadline or Invalid Payload",
                    "steps": [
                        "1. The update contains an invalid requested deadline or another invalid field value.",
                        "2. The System rejects the update.",
                        "3. The Client corrects the data and retries.",
                    ],
                },
                {
                    "heading": "A6. New Answer Set Is Empty",
                    "steps": [
                        "1. The Client saves the update without submitting replacement answers.",
                        "2. The System keeps the previous answer set unchanged.",
                    ],
                },
            ],
            [
                "Database update fails while saving request fields or replacing answers.",
            ],
            business_rules=[
                "The current code allows updates to fields, answers, attachment metadata, status, and wizardProgressStep in one request.",
                "Pending broker proposals are auto-rejected only when status changes from PUBLIC_DRAFT to PRIVATE_DRAFT.",
            ],
            other_information=[
                "Related backend flow: PATCH /project-requests/:id.",
            ],
        ),
        base_use_case(
            "UC-22",
            "View Application",
            "Client",
            "",
            "The Client opens a request that is collecting broker interest.",
            "The Client reviews broker applications and sent invitations for a request before selecting or rejecting a broker.",
            [
                "The Client is authenticated.",
                "The request exists and belongs to the Client.",
                "The request is still in a broker-selection stage.",
            ],
            [
                "The Client can see pending broker applications and non-pending broker invitation records for the request.",
            ],
            [
                {
                    "heading": "A. View Pending Broker Applications",
                    "steps": [
                        "1. The Client opens a request detail page in the broker-selection stage.",
                        "2. The System loads the request together with broker proposal data.",
                        "3. The System groups or displays the pending broker applications for review.",
                        "4. The Client reviews cover letters, trust signals, and recent project information.",
                    ],
                },
                {
                    "heading": "B. View Sent or Resolved Broker Invitation Records",
                    "steps": [
                        "1. The Client stays on the same broker-selection panel.",
                        "2. The System shows invited or accepted broker proposal records separately from pending applications.",
                        "3. The Client reviews the current state of each invitation.",
                    ],
                },
            ],
            [
                {
                    "heading": "A2. Request Is Not Accessible to the Client",
                    "steps": [
                        "1. The request does not belong to the current Client or does not exist.",
                        "2. The System denies access to the application list.",
                    ],
                },
                {
                    "heading": "A3/B2. No Broker Applications or Invitations Yet",
                    "steps": [
                        "1. The System loads the request successfully but finds no broker proposal records.",
                        "2. The System shows an empty-state message for the application panel.",
                    ],
                },
            ],
            [
                "Database load fails while retrieving broker proposal data.",
            ],
            business_rules=[
                "In the current codebase, this use case is specifically about broker applications and invitations, not freelancer applications.",
                "Pending applications and non-pending invitation records are displayed differently in the current UI.",
            ],
            other_information=[
                "Related frontend flow: RequestBrokerMarketPanel on the request detail screen.",
            ],
        ),
        base_use_case(
            "UC-23",
            "Approve/Reject Application",
            "Client",
            "",
            "The Client has reviewed broker applications and decides how to resolve a broker slot.",
            "The Client accepts a broker application or releases/rejects an active broker slot for the request.",
            [
                "The Client is authenticated.",
                "The request exists and belongs to the Client.",
                "The target broker proposal exists for the request.",
            ],
            [
                "If approved, the selected broker becomes the assigned broker and competing active broker proposals are rejected.",
                "If rejected or released, the selected broker proposal is marked as REJECTED.",
            ],
            [
                {
                    "heading": "A. Approve a Broker Application",
                    "steps": [
                        "1. The Client opens the request application panel.",
                        "2. The Client chooses a broker application to approve.",
                        "3. The System verifies that the request is still in a valid broker-selection state.",
                        "4. The System assigns the selected broker to the request.",
                        "5. The System updates the request status to BROKER_ASSIGNED.",
                        "6. The System marks the selected broker proposal as ACCEPTED.",
                        "7. The System rejects other pending broker proposals for the same request.",
                        "8. The System returns the updated request state.",
                    ],
                },
                {
                    "heading": "B. Reject or Release an Active Broker Slot",
                    "steps": [
                        "1. The Client opens the request application panel.",
                        "2. The Client chooses to release a pending or invited broker slot.",
                        "3. The System verifies that no broker has been assigned yet.",
                        "4. The System verifies that the targeted proposal is still in an active status.",
                        "5. The System marks the targeted proposal as REJECTED.",
                        "6. The System returns the updated request state.",
                    ],
                },
            ],
            [
                {
                    "heading": "A3. Request Is Not in a Valid State for Broker Approval",
                    "steps": [
                        "1. The request status is not PUBLIC_DRAFT, PRIVATE_DRAFT, or PENDING_SPECS.",
                        "2. The System rejects the approval action.",
                    ],
                },
                {
                    "heading": "B3. Broker Already Assigned",
                    "steps": [
                        "1. The System detects that the request already has a broker assigned.",
                        "2. The System blocks the release action.",
                    ],
                },
                {
                    "heading": "B4. Proposal Not Found or Not Active",
                    "steps": [
                        "1. The selected proposal does not exist or is no longer INVITED/PENDING.",
                        "2. The System rejects the release action.",
                    ],
                },
            ],
            [
                "Database update fails while changing the request or proposal states.",
                "Notification send fails after the state transition is already completed.",
            ],
            business_rules=[
                "Broker approval accepts the chosen proposal and rejects competing pending broker proposals.",
                "Broker-slot release can only happen before a broker is assigned.",
            ],
            other_information=[
                "Related backend flows: POST /project-requests/:id/accept-broker and POST /project-requests/:id/release-broker-slot.",
            ],
        ),
        base_use_case(
            "UC-26",
            "View List Available Broker",
            "Client",
            "AI Matching Service",
            "The Client wants to discover brokers for a request or browse broker candidates.",
            "The System shows verified broker candidates through direct discovery search or request-based matching.",
            [
                "The Client is authenticated.",
                "If request-based matching is used, the request exists.",
            ],
            [
                "A broker candidate list is displayed.",
                "The Client can continue to profile review or invitation.",
            ],
            [
                {
                    "heading": "A. Browse Available Brokers Through Discovery",
                    "steps": [
                        "1. The Client opens the discovery page and selects broker search.",
                        "2. The System searches verified, non-banned broker accounts.",
                        "3. The System displays the broker list ordered by trust score and search relevance.",
                    ],
                },
                {
                    "heading": "B. Load Request-Based Broker Recommendations",
                    "steps": [
                        "1. The Client opens a request detail page and chooses a matching action.",
                        "2. The System loads the request context and prepares the matching input.",
                        "3. The System excludes brokers already associated with that request.",
                        "4. The System runs quick matching or AI-assisted ranking based on configuration.",
                        "5. The System displays the ranked broker candidates.",
                    ],
                },
            ],
            [
                {
                    "heading": "A2/B5. No Broker Candidates Found",
                    "steps": [
                        "1. The System completes the search or matching flow but finds no eligible brokers.",
                        "2. The System displays an empty-state result.",
                    ],
                },
                {
                    "heading": "B2. Request Not Found",
                    "steps": [
                        "1. The target request no longer exists.",
                        "2. The System stops the recommendation flow.",
                    ],
                },
                {
                    "heading": "B4. AI Match Quota Reached",
                    "steps": [
                        "1. The System detects that the Client has reached the AI match quota.",
                        "2. The System rejects the AI-assisted matching action.",
                    ],
                },
            ],
            [
                "The external AI ranking step times out or is unavailable.",
                "Database query fails while loading discovery candidates or request context.",
            ],
            business_rules=[
                "Discovery search returns only verified and non-banned users.",
                "Request-based matching excludes brokers already associated with the request.",
                "AI ranking is optional and depends on the matching configuration.",
            ],
            other_information=[
                "Related backend flows: GET /discovery/users?role=BROKER, GET /project-requests/:id/matches, and GET /matching/:requestId?role=BROKER.",
            ],
        ),
        base_use_case(
            "UC-27",
            "View Profile Detail",
            "Client, Broker",
            "",
            "The User selects a partner profile from discovery, a request, or an invitation context.",
            "The System displays the detailed profile or trust-profile information for the selected user.",
            [
                "The User is authenticated.",
                "The target profile exists and is accessible.",
            ],
            [
                "The selected profile detail is displayed.",
            ],
            [
                {
                    "heading": "A. Client Views Broker or Freelancer Profile Detail",
                    "steps": [
                        "1. The Client selects a broker or freelancer profile from discovery or request-related UI.",
                        "2. The System loads the public profile data for the selected user.",
                        "3. The System displays the profile detail page.",
                    ],
                },
                {
                    "heading": "B. Broker Views Client Trust/Profile Detail",
                    "steps": [
                        "1. The Broker opens a client-related profile from request or invitation context.",
                        "2. The System loads the available trust-profile or public-profile data.",
                        "3. The System displays the profile detail page.",
                    ],
                },
            ],
            [
                {
                    "heading": "A2/B2. Profile Not Found",
                    "steps": [
                        "1. The target user profile cannot be found.",
                        "2. The System returns a not-found result.",
                    ],
                },
                {
                    "heading": "A2/B2. Profile Is Not Available for Public Discovery",
                    "steps": [
                        "1. The profile is banned or otherwise unavailable.",
                        "2. The System hides the profile from normal detail viewing.",
                    ],
                },
            ],
            [
                "Database query fails while loading public-profile or trust-profile data.",
            ],
            business_rules=[
                "Discovery/public-profile and trust-profile flows are not exactly the same endpoint.",
                "Profile data exposure should remain limited to safe public fields in user-facing views.",
            ],
            other_information=[
                "Related backend flows: GET /discovery/profile/:id and GET /trust-profiles/:userId.",
            ],
        ),
        base_use_case(
            "UC-28",
            "Invite To Request",
            "Client, Broker",
            "",
            "The User has identified a partner and chooses to connect that partner to a request.",
            "The System records a broker invitation or a freelancer recommendation/invitation path for a specific request.",
            [
                "The User is authenticated.",
                "The request exists.",
                "The User has permission to invite for that request.",
                "The target partner is not already associated with the request in an active way.",
            ],
            [
                "A broker proposal with status INVITED or a freelancer recommendation with status PENDING_CLIENT_APPROVAL is created.",
                "The next actor in the flow is notified or can continue the approval process.",
            ],
            [
                {
                    "heading": "A. Client Invites a Broker to a Request",
                    "steps": [
                        "1. The Client opens a broker profile or request detail page.",
                        "2. The Client selects a request and chooses to invite the broker.",
                        "3. The System verifies that the request has no assigned broker.",
                        "4. The System verifies that the broker is not already invited or applied to the request.",
                        "5. The System creates a broker proposal with status INVITED.",
                        "6. The System notifies the broker.",
                    ],
                },
                {
                    "heading": "B. Assigned Broker Recommends a Freelancer to a Request",
                    "steps": [
                        "1. The assigned Broker opens a request in the freelancer-selection phase.",
                        "2. The Broker selects a freelancer candidate.",
                        "3. The System verifies that the broker is authorized for the request.",
                        "4. The System verifies that the client-approved spec baseline already exists.",
                        "5. The System verifies that no active freelancer is currently associated with the request.",
                        "6. The System creates a freelancer proposal with status PENDING_CLIENT_APPROVAL.",
                        "7. The System notifies the Client to review the recommendation.",
                    ],
                },
            ],
            [
                {
                    "heading": "A3. Request Already Has an Assigned Broker",
                    "steps": [
                        "1. The System detects that the request already has a broker assigned.",
                        "2. The System rejects the broker invitation.",
                    ],
                },
                {
                    "heading": "A4. Broker Already Invited or Already Applied",
                    "steps": [
                        "1. The System finds an existing broker proposal for the same request and broker.",
                        "2. The System rejects the duplicate invitation.",
                    ],
                },
                {
                    "heading": "B4. Client-Approved Spec Baseline Not Ready",
                    "steps": [
                        "1. The request has not yet reached the client-approved spec stage.",
                        "2. The System rejects the freelancer recommendation attempt.",
                    ],
                },
                {
                    "heading": "B5. Another Active Freelancer Path Already Exists",
                    "steps": [
                        "1. The System detects an active freelancer recommendation, invitation, or accepted freelancer.",
                        "2. The System rejects the new freelancer recommendation attempt.",
                    ],
                },
            ],
            [
                "Database save fails while creating the broker proposal or freelancer proposal.",
                "Notification send fails after the proposal record has already been created.",
            ],
            business_rules=[
                "Broker invitations are client-led.",
                "Freelancer invitation/recommendation is broker-led in the current codebase, not client-led.",
                "Freelancer recommendation currently begins with PENDING_CLIENT_APPROVAL before the freelancer receives an INVITED status.",
            ],
            other_information=[
                "Related backend flows: POST /project-requests/:id/invite/broker and POST /project-requests/:id/invite/freelancer.",
            ],
        ),
        base_use_case(
            "UC-29",
            "View List Freelancer Recommendation",
            "Client, Broker",
            "AI Matching Service",
            "The request reaches freelancer-selection work and the User wants to review freelancer options.",
            "The System displays freelancer candidates or existing freelancer recommendations for the request.",
            [
                "The User is authenticated.",
                "The request exists.",
            ],
            [
                "The User can review freelancer candidates or existing recommendation records for the request.",
            ],
            [
                {
                    "heading": "A. Broker or Authorized User Loads Freelancer Match Candidates",
                    "steps": [
                        "1. The User opens the request's freelancer-selection panel.",
                        "2. The User triggers Quick Match or AI Match for freelancers.",
                        "3. The System loads the request context and excludes already-associated freelancers.",
                        "4. The System returns ranked freelancer candidates for review.",
                    ],
                },
                {
                    "heading": "B. Client Reviews Existing Freelancer Recommendations",
                    "steps": [
                        "1. The Client opens a request that already has freelancer recommendation records.",
                        "2. The System loads the recommendation list and current statuses.",
                        "3. The Client reviews which recommendation is pending client approval or already accepted/rejected.",
                    ],
                },
            ],
            [
                {
                    "heading": "A3. Request Is Not Yet Ready for Freelancer Recruitment",
                    "steps": [
                        "1. The request has not yet reached the client-approved spec phase for freelancer recruitment.",
                        "2. The System blocks the recommendation action or shows that the phase is not unlocked yet.",
                    ],
                },
                {
                    "heading": "A4/B2. No Freelancer Candidates or Recommendations Found",
                    "steps": [
                        "1. The System completes the load successfully but finds no matching candidates or existing recommendations.",
                        "2. The System shows an empty-state result.",
                    ],
                },
                {
                    "heading": "A2. AI Match Quota Reached",
                    "steps": [
                        "1. The System detects that the actor has reached the AI matching quota for that flow.",
                        "2. The System rejects the AI-assisted matching action.",
                    ],
                },
            ],
            [
                "The external AI ranking step times out or is unavailable.",
                "Database load fails while reading request data or freelancer proposal data.",
            ],
            business_rules=[
                "The current platform supports both quick matching and AI matching for freelancer candidates.",
                "Only one active freelancer path is allowed for a request at a time.",
            ],
            other_information=[
                "Related backend flow: GET /matching/:requestId?role=FREELANCER and request freelancer panel logic.",
            ],
        ),
    ]
)

USE_CASES.extend(
    [
        base_use_case(
            "UC-30",
            "View Subscription",
            "Client, Broker, Freelancer",
            "",
            "The User opens the subscription page from the account or dashboard area.",
            "The System displays the User's current subscription status, perks, and usage summary.",
            [
                "The User is authenticated.",
            ],
            [
                "The User sees whether the account is premium or free-tier.",
                "The current subscription, perks, and quota usage summary are displayed.",
            ],
            [
                {
                    "heading": "A. View Active or Cancelled-But-Still-Usable Subscription",
                    "steps": [
                        "1. The User opens the subscription page.",
                        "2. The System loads the current subscription record for the User.",
                        "3. The System loads the current perks and quota usage summary.",
                        "4. The System displays the subscription details, payment summary, and usage data.",
                    ],
                },
                {
                    "heading": "B. View Free-Tier Subscription State",
                    "steps": [
                        "1. The User opens the subscription page without an active premium subscription.",
                        "2. The System loads the free-tier perks for the User's role.",
                        "3. The System displays the free-tier limits and usage summary.",
                    ],
                },
            ],
            [
                {
                    "heading": "A2/B2. User Not Found",
                    "steps": [
                        "1. The System cannot load the authenticated user's record.",
                        "2. The System returns a not-found error.",
                    ],
                },
            ],
            [
                "Database load fails while retrieving subscription or usage data.",
            ],
            priority="Medium",
            frequency="Medium",
            business_rules=[
                "Cancelled subscriptions may still count as premium until currentPeriodEnd passes.",
                "Usage summary is combined with subscription details in the controller response.",
            ],
            other_information=[
                "Related backend flow: GET /subscriptions/me.",
            ],
        ),
        base_use_case(
            "UC-31",
            "Register New Subscription",
            "Client, Broker, Freelancer",
            "PayPal",
            "The User reviews plans and chooses to activate a premium subscription.",
            "The User activates a role-compatible premium subscription through the PayPal checkout flow.",
            [
                "The User is authenticated.",
                "A role-compatible active subscription plan exists.",
                "The User does not already have an active subscription.",
                "The User has a PAYPAL_ACCOUNT payment method available.",
            ],
            [
                "A PayPal order is approved and captured successfully.",
                "A subscription record is stored with status ACTIVE and the selected billing cycle.",
                "The User's premium perks become available immediately after successful activation.",
            ],
            [
                {
                    "heading": "A. Load Plans and Start Subscription Checkout",
                    "steps": [
                        "1. The User opens the subscription page.",
                        "2. The System loads the active plans for the User's role.",
                        "3. The User selects a plan, billing cycle, and payment method.",
                        "4. The System loads the PayPal SDK configuration and quoted charge amount.",
                        "5. The User starts the PayPal checkout flow.",
                    ],
                },
                {
                    "heading": "B. Approve PayPal Order and Activate Subscription",
                    "steps": [
                        "1. The System creates a PayPal order for the selected plan.",
                        "2. The User approves the order in the PayPal checkout UI.",
                        "3. The System captures the approved PayPal order.",
                        "4. The System verifies the captured amount and order details.",
                        "5. The System creates or updates the user's subscription record with status ACTIVE.",
                        "6. The System returns the activated subscription result.",
                    ],
                },
            ],
            [
                {
                    "heading": "A2/A4. User Already Has an Active Subscription",
                    "steps": [
                        "1. The System detects an existing active subscription before checkout can proceed.",
                        "2. The System rejects the new subscription attempt.",
                    ],
                },
                {
                    "heading": "A3. Selected Plan Does Not Match the User Role",
                    "steps": [
                        "1. The selected plan is for a different role.",
                        "2. The System rejects the checkout request.",
                    ],
                },
                {
                    "heading": "A4. Payment Method Is Missing or Invalid",
                    "steps": [
                        "1. The User does not have the selected PAYPAL_ACCOUNT payment method.",
                        "2. The System rejects the checkout setup.",
                    ],
                },
                {
                    "heading": "B2. User Cancels PayPal Checkout",
                    "steps": [
                        "1. The User closes or cancels the PayPal approval flow before completion.",
                        "2. The subscription remains inactive.",
                    ],
                },
                {
                    "heading": "B4. PayPal Capture Does Not Match the Expected Charge",
                    "steps": [
                        "1. The captured order does not match the expected amount or currency validation.",
                        "2. The System rejects activation and does not create the premium subscription.",
                    ],
                },
            ],
            [
                "PayPal SDK configuration is unavailable.",
                "PayPal order creation or capture fails.",
                "Database transaction fails while saving the payment method or subscription record.",
            ],
            priority="High",
            frequency="Medium",
            business_rules=[
                "The current implementation uses PayPal order creation plus capture, not recurring PayPal Billing Subscriptions APIs.",
                "Only a PAYPAL_ACCOUNT payment method can be used for this flow.",
                "Plan role must match the user's role.",
            ],
            other_information=[
                "Related backend flows: GET /subscriptions/plans, GET /subscriptions/paypal/config, POST /subscriptions/paypal/order, POST /subscriptions/subscribe.",
            ],
        ),
        base_use_case(
            "UC-32",
            "Cancel Subscription",
            "Client, Broker, Freelancer",
            "",
            "The User decides to stop renewing the current premium subscription.",
            "The User cancels an active subscription at period end.",
            [
                "The User is authenticated.",
                "The User currently has an active subscription.",
                "The subscription is not already scheduled for cancellation at period end.",
            ],
            [
                "The subscription is marked with cancelAtPeriodEnd = true.",
                "The subscription status becomes CANCELLED in the current record.",
                "Premium benefits remain usable until currentPeriodEnd.",
            ],
            [
                {
                    "heading": "A. Cancel an Active Subscription",
                    "steps": [
                        "1. The User opens the subscription page.",
                        "2. The User chooses the cancel action and optionally enters a reason.",
                        "3. The System verifies that an active subscription exists.",
                        "4. The System marks the subscription as cancel-at-period-end.",
                        "5. The System saves the cancellation reason and cancellation timestamp.",
                        "6. The System returns the updated subscription status to the User.",
                    ],
                },
            ],
            [
                {
                    "heading": "A3. No Active Subscription Exists",
                    "steps": [
                        "1. The System cannot find an active subscription for the User.",
                        "2. The System rejects the cancel action and informs the User that the account is already on the free plan.",
                    ],
                },
                {
                    "heading": "A3. Subscription Already Scheduled for Cancellation",
                    "steps": [
                        "1. The System detects that cancelAtPeriodEnd is already true.",
                        "2. The System rejects the duplicate cancellation request.",
                    ],
                },
            ],
            [
                "Database update fails while saving the cancellation state.",
            ],
            priority="Medium",
            frequency="Low",
            business_rules=[
                "Cancellation is soft for the remaining paid period; access ends only after currentPeriodEnd passes and expiry processing runs.",
            ],
            other_information=[
                "Related backend flow: POST /subscriptions/cancel.",
            ],
        ),
        base_use_case(
            "UC-55",
            "View Request Invitation",
            "Broker, Freelancer",
            "",
            "The User opens the invitation area from the dashboard.",
            "The System displays request invitations relevant to the authenticated Broker or Freelancer.",
            [
                "The User is authenticated as Broker or Freelancer.",
            ],
            [
                "The invitation list is displayed for the User.",
            ],
            [
                {
                    "heading": "A. Broker Views Request Invitations",
                    "steps": [
                        "1. The Broker opens the My Invitations page.",
                        "2. The System loads broker proposal records for that Broker with status INVITED, PENDING, or ACCEPTED.",
                        "3. The System displays the invitation list.",
                    ],
                },
                {
                    "heading": "B. Freelancer Views Request Invitations",
                    "steps": [
                        "1. The Freelancer opens the My Invitations page.",
                        "2. The System loads freelancer proposal records with status INVITED.",
                        "3. The System displays the invitation list.",
                    ],
                },
            ],
            [
                {
                    "heading": "A2/B2. No Invitations Found",
                    "steps": [
                        "1. The System completes the query but finds no matching invitations.",
                        "2. The System displays an empty invitation state.",
                    ],
                },
            ],
            [
                "Database query fails while loading invitation records.",
                "Realtime refresh fails and the page may show stale invitation data until reload.",
            ],
            other_information=[
                "Related backend flow: GET /project-requests/invitations/my.",
            ],
        ),
        base_use_case(
            "UC-56",
            "View Invitation Detail",
            "Broker, Freelancer",
            "",
            "The User selects one invitation from the invitation list.",
            "The System displays the detail of a selected invitation and its related request context.",
            [
                "The User is authenticated as Broker or Freelancer.",
                "The invitation belongs to the User.",
            ],
            [
                "The invitation detail and related request context are displayed.",
            ],
            [
                {
                    "heading": "A. Broker Views Invitation Detail",
                    "steps": [
                        "1. The Broker selects an invitation from the invitation list.",
                        "2. The System loads the linked request context for that broker proposal.",
                        "3. The System displays the invitation detail view.",
                    ],
                },
                {
                    "heading": "B. Freelancer Views Invitation Detail",
                    "steps": [
                        "1. The Freelancer selects an invitation from the invitation list.",
                        "2. The System loads the linked request context for that freelancer proposal.",
                        "3. The System displays the invitation detail view.",
                    ],
                },
            ],
            [
                {
                    "heading": "A2/B2. Invitation No Longer Exists or Is Not Accessible",
                    "steps": [
                        "1. The selected invitation cannot be loaded for the current User.",
                        "2. The System stops the detail flow and returns an error or stale-state message.",
                    ],
                },
            ],
            [
                "Database load fails while retrieving the invitation or related request.",
            ],
            other_information=[
                "Current implementation mostly resolves invitation detail through request detail plus invitation list data rather than a dedicated standalone invitation-detail endpoint.",
            ],
        ),
        base_use_case(
            "UC-57",
            "Accept/Deny Invitation",
            "Broker, Freelancer",
            "",
            "The User reviews an invitation and decides whether to join or decline the request flow.",
            "The System records the User's response to a request invitation.",
            [
                "The User is authenticated as Broker or Freelancer.",
                "The invitation belongs to the User.",
                "The invitation status is INVITED.",
                "If the User accepts through the current UI, KYC approval is already completed.",
            ],
            [
                "If accepted by a Broker, the Broker may become assigned to the request and competing active broker proposals are rejected.",
                "If accepted by a Freelancer, the freelancer proposal becomes ACCEPTED and competing active freelancer proposals are rejected.",
                "If denied, the invitation status becomes REJECTED.",
            ],
            [
                {
                    "heading": "A. Broker Accepts an Invitation",
                    "steps": [
                        "1. The Broker opens an invitation.",
                        "2. The Broker chooses to accept it.",
                        "3. The System verifies that the invitation status is INVITED.",
                        "4. The System verifies that no other broker has already been assigned to the request.",
                        "5. The System updates the broker proposal to ACCEPTED.",
                        "6. The System assigns the Broker to the request and updates the request status to BROKER_ASSIGNED when applicable.",
                        "7. The System rejects competing active broker proposals for the same request.",
                        "8. The System returns the updated invitation state.",
                    ],
                },
                {
                    "heading": "B. Broker Denies an Invitation",
                    "steps": [
                        "1. The Broker opens an invitation.",
                        "2. The Broker chooses to deny it.",
                        "3. The System verifies that the invitation status is INVITED.",
                        "4. The System updates the broker proposal to REJECTED.",
                        "5. The System returns the updated invitation state.",
                    ],
                },
                {
                    "heading": "C. Freelancer Accepts an Invitation",
                    "steps": [
                        "1. The Freelancer opens an invitation.",
                        "2. The Freelancer chooses to accept it.",
                        "3. The System verifies that the invitation status is INVITED.",
                        "4. The System verifies that the client-approved spec phase is already reached for that request.",
                        "5. The System verifies that no other freelancer has already been accepted for the request.",
                        "6. The System updates the freelancer proposal to ACCEPTED.",
                        "7. The System rejects competing active freelancer proposals for the same request.",
                        "8. The System returns the updated invitation state.",
                    ],
                },
                {
                    "heading": "D. Freelancer Denies an Invitation",
                    "steps": [
                        "1. The Freelancer opens an invitation.",
                        "2. The Freelancer chooses to deny it.",
                        "3. The System verifies that the invitation status is INVITED.",
                        "4. The System updates the freelancer proposal to REJECTED.",
                        "5. The System returns the updated invitation state.",
                    ],
                },
            ],
            [
                {
                    "heading": "A3/B3/C3/D3. Invitation Is Not in INVITED Status",
                    "steps": [
                        "1. The System detects that the invitation is already PENDING, ACCEPTED, REJECTED, or otherwise resolved.",
                        "2. The System rejects the response action.",
                    ],
                },
                {
                    "heading": "A4. Another Broker Has Already Been Assigned",
                    "steps": [
                        "1. The System detects that another broker is already assigned to the request.",
                        "2. The System rejects the Broker acceptance.",
                    ],
                },
                {
                    "heading": "C4. Client-Approved Spec Phase Not Reached",
                    "steps": [
                        "1. The System detects that the request is not yet ready for freelancer acceptance.",
                        "2. The System rejects the Freelancer acceptance.",
                    ],
                },
                {
                    "heading": "C5. Another Freelancer Has Already Been Accepted",
                    "steps": [
                        "1. The System detects that another freelancer is already accepted for the request.",
                        "2. The System rejects the Freelancer acceptance.",
                    ],
                },
                {
                    "heading": "A2/C2. KYC Not Approved in the Current UI",
                    "steps": [
                        "1. The User attempts to accept an invitation before KYC approval.",
                        "2. The UI blocks the acceptance action before the API response flow continues.",
                    ],
                },
            ],
            [
                "Database update fails while saving the invitation response.",
                "Notification send fails after the invitation state is already updated.",
            ],
            other_information=[
                "Related backend flow: PATCH /project-requests/invitations/:id/respond.",
                "The current UI allows viewing invitations before KYC approval but blocks the accept action until KYC is approved.",
            ],
        ),
    ]
)

USE_CASES.extend(
    [
        base_use_case(
            "UC-64",
            "View Public Request",
            "Broker, Freelancer",
            "",
            "The User opens a role-specific marketplace page.",
            "The System displays public marketplace requests available to the current role.",
            [
                "The User is authenticated as Broker or Freelancer.",
            ],
            [
                "The User sees a marketplace list of currently open requests for that role.",
            ],
            [
                {
                    "heading": "A. Broker Views Broker Marketplace Requests",
                    "steps": [
                        "1. The Broker opens the broker marketplace page.",
                        "2. The System loads request data available to broker marketplace browsing.",
                        "3. The UI focuses on requests in PUBLIC_DRAFT that do not yet have an assigned broker.",
                    ],
                },
                {
                    "heading": "B. Freelancer Views Freelancer Marketplace Requests",
                    "steps": [
                        "1. The Freelancer opens the freelancer marketplace page.",
                        "2. The System loads requests in SPEC_APPROVED status.",
                        "3. The System keeps only requests that already have a broker and do not yet have an active freelancer.",
                        "4. The System masks client contact details and displays the marketplace list.",
                    ],
                },
            ],
            [
                {
                    "heading": "A2/B2. No Public Requests Available",
                    "steps": [
                        "1. The System completes the marketplace query but finds no open requests for that role.",
                        "2. The System displays an empty marketplace state.",
                    ],
                },
            ],
            [
                "Database query fails while loading marketplace requests.",
            ],
            business_rules=[
                "The current codebase effectively has two different marketplace definitions: broker marketplace and freelancer phase-3 marketplace.",
                "Freelancer marketplace requests are not the same status or workflow as broker marketplace requests.",
            ],
            other_information=[
                "Related backend flows: GET /project-requests and GET /project-requests/freelancer/marketplace.",
            ],
        ),
        base_use_case(
            "UC-65",
            "View Public Request Detail",
            "Broker, Freelancer",
            "",
            "The User selects one request from a marketplace list.",
            "The System displays the detail of a marketplace-visible request according to the current role.",
            [
                "The User is authenticated as Broker or Freelancer.",
                "The request is currently visible in the User's applicable marketplace flow.",
            ],
            [
                "The public request detail is displayed with role-appropriate data masking.",
            ],
            [
                {
                    "heading": "A. Broker Views Broker Marketplace Request Detail",
                    "steps": [
                        "1. The Broker selects a request from the broker marketplace.",
                        "2. The System verifies that the request is an open marketplace or otherwise accessible broker-side request.",
                        "3. The System loads the request detail.",
                        "4. The System masks client contact information if the Broker is not assigned.",
                        "5. The System displays the request detail page.",
                    ],
                },
                {
                    "heading": "B. Freelancer Views Freelancer Marketplace Request Detail",
                    "steps": [
                        "1. The Freelancer selects a request from the freelancer marketplace.",
                        "2. The System verifies that the request is an open phase-3 freelancer marketplace request.",
                        "3. The System loads the request detail.",
                        "4. The System masks client contact information because the Freelancer is still only a marketplace viewer.",
                        "5. The System displays the request detail page.",
                    ],
                },
            ],
            [
                {
                    "heading": "A2/B2. Request Is No Longer Open or Accessible",
                    "steps": [
                        "1. The System detects that the request no longer matches marketplace access rules.",
                        "2. The System denies the detail access or returns an updated state.",
                    ],
                },
                {
                    "heading": "A2/B2. Request Not Found",
                    "steps": [
                        "1. The request no longer exists.",
                        "2. The System returns a not-found error.",
                    ],
                },
            ],
            [
                "Database load fails while retrieving the request detail.",
            ],
            other_information=[
                "Related backend flow: GET /project-requests/:id with role-based access rules.",
            ],
        ),
        base_use_case(
            "UC-66",
            "Apply To Public Request",
            "Broker",
            "",
            "The Broker decides to submit interest in a public broker-marketplace request.",
            "The Broker submits an application to an eligible public request.",
            [
                "The Broker is authenticated.",
                "The target request exists and is in PUBLIC_DRAFT status.",
                "The request does not already have an assigned broker.",
                "The Broker has no existing proposal record for that request.",
                "The Broker still has application capacity and quota.",
            ],
            [
                "A broker proposal with status PENDING is created.",
                "The Client is notified that a broker applied to the request.",
            ],
            [
                {
                    "heading": "A. Broker Applies to an Eligible Public Request",
                    "steps": [
                        "1. The Broker opens a public request detail page.",
                        "2. The Broker enters an optional cover letter and chooses to apply.",
                        "3. The System verifies that the request is still PUBLIC_DRAFT.",
                        "4. The System verifies that the request does not already have an assigned broker.",
                        "5. The System verifies that the broker has not already applied or been invited for the same request.",
                        "6. The System verifies that the broker has application-slot capacity for the 72-hour window and passes quota validation.",
                        "7. The System creates a broker proposal with status PENDING.",
                        "8. The System notifies the Client and returns the saved proposal.",
                    ],
                },
            ],
            [
                {
                    "heading": "A3. Request Is Not Open for Broker Marketplace Applications",
                    "steps": [
                        "1. The request status is no longer PUBLIC_DRAFT.",
                        "2. The System rejects the application.",
                    ],
                },
                {
                    "heading": "A4. Broker Already Assigned",
                    "steps": [
                        "1. The System detects that a broker is already assigned to the request.",
                        "2. The System rejects the application.",
                    ],
                },
                {
                    "heading": "A5. Duplicate Application or Invitation Exists",
                    "steps": [
                        "1. The System finds an existing proposal record for the same Broker and request.",
                        "2. The System rejects the duplicate application.",
                    ],
                },
                {
                    "heading": "A6. Broker Application Capacity or Quota Reached",
                    "steps": [
                        "1. The System detects that the Broker has reached the active application slot limit or quota limit.",
                        "2. The System rejects the application.",
                    ],
                },
            ],
            [
                "Database save fails while creating the broker proposal.",
                "Notification send fails after the broker proposal is already created.",
            ],
            business_rules=[
                "Current implementation supports direct application only for brokers.",
                "Broker active application capacity is limited in a 72-hour window.",
                "Freelancers currently browse a different marketplace and do not directly apply through this endpoint.",
            ],
            other_information=[
                "Related backend flow: POST /project-requests/:id/apply.",
            ],
        ),
    ]
)


ALIGNMENT_NOTES = [
    "UC-22 (View Application) is currently a Client-side broker-application review flow in code, so the old actor labeling for Broker/Freelancer is stale.",
    "UC-28 (Invite To Request) changed significantly: Client invites Broker, but Freelancer invitation/recommendation is Broker-led after client spec approval.",
    "UC-64 to UC-66 mix two different marketplace concepts. Brokers can directly apply to PUBLIC_DRAFT requests, while freelancers currently browse phase-3 marketplace requests and wait for invitation instead of directly applying.",
    "UC-16 (Delete Request) is hard delete only in the current service. The old soft-delete style wording should not be reused.",
    "POST /project-requests and POST /project-requests/upload do not currently have explicit @Roles(UserRole.CLIENT) guards even though the product flow is Client-only. That is a code-level authorization gap worth reviewing.",
    "InviteModal.tsx loads all /project-requests and only loosely filters eligible requests on the client side, so some invalid invite targets may still appear and then fail on the server.",
    "UsersSearchService.getPublicProfile() currently returns the raw user entity. Because that entity still includes email, it is a privacy-risk area even if the UI does not intentionally render every field.",
]


def add_use_case_table(document: Document, use_case: dict[str, object]) -> None:
    heading = document.add_paragraph()
    heading_run = heading.add_run(f'{use_case["id"]} - {use_case["name"]}')
    heading_run.bold = True
    heading_run.font.name = "Times New Roman"
    heading_run.font.size = Pt(13)

    table = document.add_table(rows=14, cols=4)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True

    for row in table.rows:
        for cell in row.cells:
            cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP

    rows = [
        ("Use Case ID", use_case["id"], "Use Case Name", use_case["name"]),
        ("Created By", use_case["created_by"], "Date Created", use_case["date_created"]),
        ("Primary Actor", use_case["primary_actor"], "Secondary Actor", use_case["secondary_actor"] or "None"),
        ("Trigger", use_case["trigger"]),
        ("Description", use_case["description"]),
        ("Preconditions", use_case["preconditions"]),
        ("Postconditions", use_case["postconditions"]),
        ("Normal Flow", use_case["normal_flow"]),
        ("Alternative Flows", use_case["alternative_flow"]),
        ("Exceptions", use_case["exceptions"]),
        ("Priority", use_case["priority"], "Frequency of Use", use_case["frequency"]),
        ("Business Rules", use_case["business_rules"]),
        ("Other Information", use_case["other_information"]),
        ("Assumptions", use_case["assumptions"]),
    ]

    for row_index, row_data in enumerate(rows):
        row = table.rows[row_index]
        set_cell_text(row.cells[0], str(row_data[0]), bold=True)
        if len(row_data) == 4:
            set_cell_text(row.cells[1], str(row_data[1]))
            set_cell_text(row.cells[2], str(row_data[2]), bold=True)
            set_cell_text(row.cells[3], str(row_data[3]))
            continue

        merged = row.cells[1].merge(row.cells[3])
        value = row_data[1]
        if row_index == 5:
            add_labeled_list(merged, "PRE", list(value))
        elif row_index == 6:
            add_labeled_list(merged, "POST", list(value))
        elif row_index == 7:
            add_sections(merged, list(value))
        elif row_index == 8:
            add_sections(merged, expand_alternative_sections(list(value)))
        else:
            lines = [f"{idx}. {line}" for idx, line in enumerate(value, start=1)] if isinstance(value, list) else [str(value)]
            add_plain_lines(merged, lines)

    footer = document.add_paragraph()
    footer_run = footer.add_run("Source basis: current backend and frontend request, invitation, discovery, matching, and subscription flows.")
    footer_run.italic = True
    footer_run.font.name = "Times New Roman"
    footer_run.font.size = Pt(9)


def create_document() -> Document:
    document = Document()
    normal_style = document.styles["Normal"]
    normal_style.font.name = "Times New Roman"
    normal_style.font.size = Pt(11)

    section = document.sections[0]
    section.top_margin = Inches(0.6)
    section.bottom_margin = Inches(0.6)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.7)

    title = document.add_paragraph()
    title.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
    title_run = title.add_run("Updated Use Case Description")
    title_run.bold = True
    title_run.font.name = "Times New Roman"
    title_run.font.size = Pt(16)

    subtitle = document.add_paragraph()
    subtitle.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
    subtitle_run = subtitle.add_run(
        "Rewritten from Doc Interdev (2) and aligned to the current SEP492 codebase flow"
    )
    subtitle_run.font.name = "Times New Roman"
    subtitle_run.font.size = Pt(11)

    meta = document.add_paragraph()
    meta.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
    meta_run = meta.add_run(f"Generated on {GENERATED_DATE}")
    meta_run.italic = True
    meta_run.font.name = "Times New Roman"
    meta_run.font.size = Pt(10)

    for index, use_case in enumerate(USE_CASES):
        if index > 0:
            document.add_page_break()
        add_use_case_table(document, use_case)

    document.add_page_break()
    heading = document.add_paragraph()
    heading_run = heading.add_run("Codebase Alignment Notes")
    heading_run.bold = True
    heading_run.font.name = "Times New Roman"
    heading_run.font.size = Pt(14)

    for index, note in enumerate(ALIGNMENT_NOTES, start=1):
        paragraph = document.add_paragraph()
        run = paragraph.add_run(f"{index}. {note}")
        run.font.name = "Times New Roman"
        run.font.size = Pt(11)

    return document


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    document = create_document()
    try:
        document.save(OUTPUT_PATH)
        print(OUTPUT_PATH)
    except PermissionError:
        fallback_path = OUTPUT_PATH.with_name(
            f"{OUTPUT_PATH.stem} - Regenerated{OUTPUT_PATH.suffix}"
        )
        document.save(fallback_path)
        print(fallback_path)


if __name__ == "__main__":
    main()
