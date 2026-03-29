#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[4]
DOCS_DIR = REPO_ROOT / "docs" / "Unit Testing Excel"
ISSUE_DATE = "2026-03-29"


def case(
    test_key: str,
    case_type: str,
    preconditions: List[str],
    inputs: Dict[str, Any],
    returns: List[str] | None = None,
    exceptions: List[str] | None = None,
) -> Dict[str, Any]:
    return {
        "test_key": test_key,
        "type": case_type,
        "preconditions": preconditions,
        "inputs": inputs,
        "returns": returns or [],
        "exceptions": exceptions or [],
    }


FUNCTION_ROWS = [
    {"no": 1, "class_name": "AdminDashboardController", "function_name": "Get Overview", "function_code": "EP-003", "sheet_name": "Get Overview", "description": "Retrieve admin dashboard overview statistics.", "precondition": "Login as ADMIN account"},
    {"no": 2, "class_name": "AuditLogsController", "function_name": "List Audit Logs", "function_code": "EP-004", "sheet_name": "List Audit Logs", "description": "View paginated audit logs with query filters.", "precondition": "Login as ADMIN account"},
    {"no": 3, "class_name": "AuditLogsController", "function_name": "Export Audit Logs", "function_code": "EP-005", "sheet_name": "Export Audit Logs", "description": "Export filtered audit logs as JSON, CSV, or XLSX.", "precondition": "Login as ADMIN account"},
    {"no": 4, "class_name": "AuditLogsController", "function_name": "Get Timeline", "function_code": "EP-007", "sheet_name": "Get Audit Timeline", "description": "View the correlated timeline for an audit log entry.", "precondition": "Login as ADMIN account"},
    {"no": 5, "class_name": "AuditLogsController", "function_name": "View Audit Log Detail", "function_code": "EP-008", "sheet_name": "View Audit Log Detail", "description": "View detail information for a specific audit log.", "precondition": "Login as ADMIN account"},
    {"no": 6, "class_name": "CalendarController", "function_name": "Create Event", "function_code": "EP-031", "sheet_name": "Create Event", "description": "Create a calendar event or auto-schedule it.", "precondition": "Login as authenticated user"},
    {"no": 7, "class_name": "CalendarController", "function_name": "List Events", "function_code": "EP-032", "sheet_name": "List Events", "description": "List calendar events with user-scoped filters.", "precondition": "Login as authenticated user"},
    {"no": 8, "class_name": "CalendarController", "function_name": "Update Event", "function_code": "EP-033", "sheet_name": "Update Event", "description": "Update a calendar event and sync availability.", "precondition": "Login as event owner, STAFF, or ADMIN"},
    {"no": 9, "class_name": "CalendarController", "function_name": "Request Reschedule", "function_code": "EP-034", "sheet_name": "Request Reschedule", "description": "Submit or auto-process a reschedule request.", "precondition": "Login as organizer/participant, STAFF, or ADMIN"},
    {"no": 10, "class_name": "CalendarController", "function_name": "List Reschedule Requests", "function_code": "EP-035", "sheet_name": "List Reschedule Requests", "description": "List reschedule requests for STAFF and ADMIN.", "precondition": "Login as STAFF or ADMIN account"},
    {"no": 11, "class_name": "CalendarController", "function_name": "Process Reschedule Request", "function_code": "EP-036", "sheet_name": "Process Reschedule Req", "description": "Approve or reject a reschedule request.", "precondition": "Login as STAFF or ADMIN account"},
    {"no": 12, "class_name": "CalendarController", "function_name": "Respond Invite", "function_code": "EP-037", "sheet_name": "Respond Invite", "description": "Record a participant response to an event invitation.", "precondition": "Login as invited participant, STAFF, or ADMIN"},
]


ADMIN_DASHBOARD_FUNCTIONS = [
    {
        "function_code": "EP-003",
        "class_name": "AdminDashboardController",
        "function_name": "Get Overview",
        "sheet_name": "Get Overview",
        "description": "Retrieve admin dashboard overview statistics.",
        "precondition": "Login as ADMIN account",
        "loc": 5,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover overview routing, range normalization, exception propagation, and admin-only access.",
        "cases": [
            case("EP-003 UTC01", "N", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "range": '"7d"'}, ['returns overview payload for "7d"']),
            case("EP-003 UTC02", "B", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "range": "null"}, ['returns overview payload for "30d"']),
            case("EP-003 UTC03", "B", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "range": '"365d"'}, ['returns overview payload for "30d"']),
            case("EP-003 UTC04", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "range": '"90d"'}, exceptions=['BadRequestException: Unsupported dashboard range']),
            case("EP-003 UTC05", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "range": '"30d"'}, exceptions=['ServiceUnavailableException: Analytics cache unavailable']),
            case("EP-003 UTC06", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "range": '"7d"'}, exceptions=['Error: dashboard query failed']),
            case("EP-003 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null", "range": '"30d"'}, exceptions=['401 Unauthorized']),
            case("EP-003 UTC08", "A", ['Caller is authenticated as STAFF'], {"Authorization": '"Bearer staff-token"', "range": '"30d"'}, exceptions=['403 Forbidden']),
        ],
    }
]


AUDIT_LOG_FUNCTIONS = [
    {
        "function_code": "EP-004",
        "class_name": "AuditLogsController",
        "function_name": "List Audit Logs",
        "sheet_name": "List Audit Logs",
        "description": "View paginated audit logs with query filters.",
        "precondition": "Login as ADMIN account",
        "loc": 3,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover audit-log listing query transformation, validation, pagination defaults, and admin-only access.",
        "cases": [
            case("EP-004 UTC01", "N", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "page": 2, "limit": 5, "action": '"EXPORT"', "errorOnly": True}, ['returns paginated audit log list']),
            case("EP-004 UTC02", "B", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "page": "null", "limit": "null"}, ['returns paginated audit log list with default page/limit']),
            case("EP-004 UTC03", "B", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "limit": 1, "statusCode": 500, "eventCategory": '"ERROR"'}, ['returns filtered audit log list']),
            case("EP-004 UTC04", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "page": 0}, exceptions=['400 Bad Request']),
            case("EP-004 UTC05", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "riskLevel": '"CRITICAL"'}, exceptions=['400 Bad Request']),
            case("EP-004 UTC06", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "source": '"MOBILE"'}, exceptions=['400 Bad Request']),
            case("EP-004 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null"}, exceptions=['401 Unauthorized']),
            case("EP-004 UTC08", "A", ['Caller is authenticated as STAFF'], {"Authorization": '"Bearer staff-token"'}, exceptions=['403 Forbidden']),
        ],
    },
    {
        "function_code": "EP-005",
        "class_name": "AuditLogsController",
        "function_name": "Export Audit Logs",
        "sheet_name": "Export Audit Logs",
        "description": "Export filtered audit logs as JSON, CSV, or XLSX.",
        "precondition": "Login as ADMIN account",
        "loc": 26,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover audit-log export formats, validation, response headers, audit recording, and admin-only access.",
        "cases": [
            case("EP-005 UTC01", "N", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "format": '"json"'}, ['returns JSON export attachment']),
            case("EP-005 UTC02", "B", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "format": '"csv"'}, ['returns CSV export attachment']),
            case("EP-005 UTC03", "B", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "format": '"xlsx"'}, ['returns XLSX export attachment']),
            case("EP-005 UTC04", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "format": '"pdf"'}, exceptions=['400 Bad Request']),
            case("EP-005 UTC05", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "limit": 0}, exceptions=['400 Bad Request']),
            case("EP-005 UTC06", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "format": '"json"'}, exceptions=['Error: export serialization failed']),
            case("EP-005 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null"}, exceptions=['401 Unauthorized']),
            case("EP-005 UTC08", "A", ['Caller is authenticated as STAFF'], {"Authorization": '"Bearer staff-token"'}, exceptions=['403 Forbidden']),
        ],
    },
    {
        "function_code": "EP-007",
        "class_name": "AuditLogsController",
        "function_name": "Get Timeline",
        "sheet_name": "Get Audit Timeline",
        "description": "View the correlated timeline for an audit log entry.",
        "precondition": "Login as ADMIN account",
        "loc": 3,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover timeline retrieval, request/actor correlation outputs, exception propagation, and admin-only access.",
        "cases": [
            case("EP-007 UTC01", "N", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"audit-1"'}, ['returns correlated audit timeline']),
            case("EP-007 UTC02", "B", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"audit-request"'}, ['returns single-entry request correlation timeline']),
            case("EP-007 UTC03", "B", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"audit-actor"'}, ['returns actor-scoped timeline']),
            case("EP-007 UTC04", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"missing-log"'}, exceptions=['NotFoundException: Audit log not found']),
            case("EP-007 UTC05", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"bad-id"'}, exceptions=['BadRequestException: Malformed audit correlation id']),
            case("EP-007 UTC06", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"audit-500"'}, exceptions=['Error: timeline query failed']),
            case("EP-007 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null", "id": '"audit-1"'}, exceptions=['401 Unauthorized']),
            case("EP-007 UTC08", "A", ['Caller is authenticated as STAFF'], {"Authorization": '"Bearer staff-token"', "id": '"audit-1"'}, exceptions=['403 Forbidden']),
        ],
    },
    {
        "function_code": "EP-008",
        "class_name": "AuditLogsController",
        "function_name": "View Audit Log Detail",
        "sheet_name": "View Audit Log Detail",
        "description": "View detail information for a specific audit log.",
        "precondition": "Login as ADMIN account",
        "loc": 3,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover detail retrieval, edge payloads, exception propagation, and admin-only access.",
        "cases": [
            case("EP-008 UTC01", "N", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"audit-1"'}, ['returns audit log detail']),
            case("EP-008 UTC02", "B", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"audit-high"'}, ['returns high-risk audit log detail']),
            case("EP-008 UTC03", "B", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"audit-anon"'}, ['returns anonymous-actor audit detail']),
            case("EP-008 UTC04", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"missing-log"'}, exceptions=['NotFoundException: Audit log not found']),
            case("EP-008 UTC05", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"bad-id"'}, exceptions=['BadRequestException: Malformed audit log id']),
            case("EP-008 UTC06", "A", ['Admin user is authenticated'], {"Authorization": '"Bearer admin-token"', "id": '"audit-500"'}, exceptions=['Error: detail query failed']),
            case("EP-008 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null", "id": '"audit-1"'}, exceptions=['401 Unauthorized']),
            case("EP-008 UTC08", "A", ['Caller is authenticated as STAFF'], {"Authorization": '"Bearer staff-token"', "id": '"audit-1"'}, exceptions=['403 Forbidden']),
        ],
    },
]


CALENDAR_FUNCTIONS = [
    {
        "function_code": "EP-031",
        "class_name": "CalendarController",
        "function_name": "Create Event",
        "sheet_name": "Create Event",
        "description": "Create a calendar event or auto-schedule it.",
        "precondition": "Login as authenticated user",
        "loc": 103,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover event creation, auto schedule, availability conflict checks, validation, and permission enforcement.",
        "cases": [
            case("EP-031 UTC01", "N", ['Authenticated ADMIN user'], {"Authorization": '"Bearer admin-token"', "type": '"PROJECT_MEETING"', "startTime": '"2026-04-01T09:00:00.000Z"', "endTime": '"2026-04-01T10:00:00.000Z"', "participantUserIds": '"[otherUser, otherUser, currentUser]"'}, ['returns created event with deduplicated participants']),
            case("EP-031 UTC02", "B", ['Authenticated STAFF user'], {"Authorization": '"Bearer staff-token"', "type": '"PROJECT_MEETING"', "useAutoSchedule": True, "startTime": '"2026-04-01T09:00:00.000Z"', "endTime": '"2026-04-01T10:00:00.000Z"'}, ['returns auto-scheduled event result']),
            case("EP-031 UTC03", "B", ['Authenticated ADMIN user'], {"Authorization": '"Bearer admin-token"', "type": '"INTERNAL_MEETING"', "startTime": '"2026-04-01T09:00:00.000Z"', "endTime": '"2026-04-01T10:00:00.000Z"', "participantUserIds": "null"}, ['returns organizer-only event']),
            case("EP-031 UTC04", "A", ['Authenticated user'], {"Authorization": '"Bearer user-token"', "type": '"INVALID_TYPE"', "startTime": '"2026-04-01T09:00:00.000Z"', "endTime": '"2026-04-01T10:00:00.000Z"'}, exceptions=['400 Bad Request']),
            case("EP-031 UTC05", "A", ['Authenticated ADMIN user'], {"Authorization": '"Bearer admin-token"', "type": '"PROJECT_MEETING"', "startTime": '"2026-04-01T10:00:00.000Z"', "endTime": '"2026-04-01T09:00:00.000Z"'}, exceptions=['BadRequestException: startTime must be before endTime']),
            case("EP-031 UTC06", "A", ['Authenticated ADMIN user'], {"Authorization": '"Bearer admin-token"', "type": '"PROJECT_MEETING"', "startTime": '"2026-04-01T09:00:00.000Z"', "endTime": '"2026-04-01T10:00:00.000Z"', "participantUserIds": '"[otherUser]"'}, exceptions=['BadRequestException: Selected time conflicts with availability']),
            case("EP-031 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null", "type": '"PROJECT_MEETING"'}, exceptions=['401 Unauthorized']),
            case("EP-031 UTC08", "A", ['Authenticated CLIENT user'], {"Authorization": '"Bearer client-token"', "type": '"DISPUTE_HEARING"', "startTime": '"2026-04-01T09:00:00.000Z"', "endTime": '"2026-04-01T10:00:00.000Z"'}, exceptions=['403 Forbidden']),
        ],
    },
    {
        "function_code": "EP-032",
        "class_name": "CalendarController",
        "function_name": "List Events",
        "sheet_name": "List Events",
        "description": "List calendar events with user-scoped filters.",
        "precondition": "Login as authenticated user",
        "loc": 49,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover event listing, pagination boundaries, query validation, and current-user scoping.",
        "cases": [
            case("EP-032 UTC01", "N", ['Authenticated CLIENT user'], {"Authorization": '"Bearer client-token"', "participantId": '"currentUser"', "page": 1, "limit": 20}, ['returns paginated event list']),
            case("EP-032 UTC02", "B", ['Authenticated CLIENT user'], {"Authorization": '"Bearer client-token"', "page": "null", "limit": "null"}, ['returns event list with default page/limit']),
            case("EP-032 UTC03", "B", ['Authenticated CLIENT user'], {"Authorization": '"Bearer client-token"', "limit": 999}, ['returns event list with limit capped at 200']),
            case("EP-032 UTC04", "A", ['Authenticated user'], {"Authorization": '"Bearer user-token"', "organizerId": '"bad-id"'}, exceptions=['400 Bad Request']),
            case("EP-032 UTC05", "A", ['Authenticated user'], {"Authorization": '"Bearer user-token"', "startDate": '"not-a-date"'}, exceptions=['400 Bad Request']),
            case("EP-032 UTC06", "A", ['Authenticated user'], {"Authorization": '"Bearer user-token"', "limit": 0}, exceptions=['400 Bad Request']),
            case("EP-032 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null"}, exceptions=['401 Unauthorized']),
            case("EP-032 UTC08", "A", ['Authenticated CLIENT user'], {"Authorization": '"Bearer client-token"', "organizerId": "null", "participantId": "null"}, ['applies current-user scope filter before returning events']),
        ],
    },
    {
        "function_code": "EP-033",
        "class_name": "CalendarController",
        "function_name": "Update Event",
        "sheet_name": "Update Event",
        "description": "Update a calendar event and sync availability.",
        "precondition": "Login as event owner, STAFF, or ADMIN",
        "loc": 65,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover event update success, partial update, path validation, state validation, and ownership checks.",
        "cases": [
            case("EP-033 UTC01", "N", ['Authenticated event owner'], {"Authorization": '"Bearer owner-token"', "id": '"eventId"', "title": '"Updated title"', "startTime": '"2026-04-01T11:00:00.000Z"', "endTime": '"2026-04-01T12:00:00.000Z"'}, ['returns updated event']),
            case("EP-033 UTC02", "B", ['Authenticated event owner'], {"Authorization": '"Bearer owner-token"', "id": '"eventId"', "title": '"Retitled"', "startTime": "null", "endTime": "null"}, ['returns partially updated event']),
            case("EP-033 UTC03", "B", ['Authenticated STAFF user'], {"Authorization": '"Bearer staff-token"', "id": '"eventId"', "title": '"Managed event"'}, ['returns updated event for staff override']),
            case("EP-033 UTC04", "A", ['Authenticated user'], {"Authorization": '"Bearer user-token"', "id": '"bad-id"'}, exceptions=['400 Bad Request']),
            case("EP-033 UTC05", "A", ['Authenticated user'], {"Authorization": '"Bearer user-token"', "id": '"eventId"'}, exceptions=['NotFoundException: Event not found']),
            case("EP-033 UTC06", "A", ['Authenticated event owner', 'Event status is CANCELLED'], {"Authorization": '"Bearer owner-token"', "id": '"eventId"', "title": '"Nope"'}, exceptions=['BadRequestException: Event is CANCELLED, cannot update']),
            case("EP-033 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null", "id": '"eventId"'}, exceptions=['401 Unauthorized']),
            case("EP-033 UTC08", "A", ['Authenticated CLIENT user is not the organizer'], {"Authorization": '"Bearer client-token"', "id": '"eventId"'}, exceptions=['403 Forbidden']),
        ],
    },
    {
        "function_code": "EP-034",
        "class_name": "CalendarController",
        "function_name": "Request Reschedule",
        "sheet_name": "Request Reschedule",
        "description": "Submit or auto-process a reschedule request.",
        "precondition": "Login as organizer/participant, STAFF, or ADMIN",
        "loc": 66,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover reschedule request creation, auto handling, path/body validation, and participant permissions.",
        "cases": [
            case("EP-034 UTC01", "N", ['Authenticated participant'], {"Authorization": '"Bearer participant-token"', "id": '"eventId"', "eventId": '"eventId"', "reason": '"Need a later slot"', "proposedTimeSlots": '"1 time slot"'}, ['returns submitted reschedule request']),
            case("EP-034 UTC02", "B", ['Authenticated organizer'], {"Authorization": '"Bearer organizer-token"', "id": '"eventId"', "eventId": '"eventId"', "reason": '"Auto resolve"', "useAutoSchedule": True}, ['returns auto-processed reschedule result']),
            case("EP-034 UTC03", "B", ['Authenticated organizer'], {"Authorization": '"Bearer organizer-token"', "id": '"eventId"', "eventId": '"eventId"', "reason": '"Organizer request"', "proposedTimeSlots": '"1 time slot"'}, ['returns submitted reschedule request for organizer']),
            case("EP-034 UTC04", "A", ['Authenticated user'], {"Authorization": '"Bearer user-token"', "id": '"bad-id"'}, exceptions=['400 Bad Request']),
            case("EP-034 UTC05", "A", ['Authenticated user'], {"Authorization": '"Bearer user-token"', "id": '"eventId"', "eventId": '"otherEventId"'}, exceptions=['BadRequestException: eventId in body does not match URL']),
            case("EP-034 UTC06", "A", ['Authenticated user'], {"Authorization": '"Bearer user-token"', "id": '"eventId"', "eventId": '"eventId"', "proposedTimeSlots": '"4 time slots"'}, exceptions=['BadRequestException: Maximum 3 proposed time slots allowed']),
            case("EP-034 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null", "id": '"eventId"'}, exceptions=['401 Unauthorized']),
            case("EP-034 UTC08", "A", ['Authenticated CLIENT user is not organizer or participant'], {"Authorization": '"Bearer client-token"', "id": '"eventId"'}, exceptions=['403 Forbidden']),
        ],
    },
    {
        "function_code": "EP-035",
        "class_name": "CalendarController",
        "function_name": "List Reschedule Requests",
        "sheet_name": "List Reschedule Requests",
        "description": "List reschedule requests for STAFF and ADMIN.",
        "precondition": "Login as STAFF or ADMIN account",
        "loc": 81,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover reschedule request listing, safe pagination normalization, status validation, and STAFF/ADMIN access.",
        "cases": [
            case("EP-035 UTC01", "N", ['Authenticated STAFF user'], {"Authorization": '"Bearer staff-token"', "status": '"PENDING"', "page": 1, "limit": 10}, ['returns paginated reschedule request list']),
            case("EP-035 UTC02", "B", ['Authenticated STAFF user'], {"Authorization": '"Bearer staff-token"', "page": '"abc"', "limit": '"0"'}, ['returns request list with default page/limit']),
            case("EP-035 UTC03", "B", ['Authenticated STAFF user'], {"Authorization": '"Bearer staff-token"', "status": "null"}, ['returns empty request list when no rows match']),
            case("EP-035 UTC04", "A", ['Authenticated STAFF user'], {"Authorization": '"Bearer staff-token"', "status": '"DONE"'}, exceptions=['BadRequestException: Invalid reschedule request status']),
            case("EP-035 UTC05", "A", ['Authenticated STAFF user'], {"Authorization": '"Bearer staff-token"', "status": '"pending"'}, exceptions=['BadRequestException: Invalid reschedule request status']),
            case("EP-035 UTC06", "A", ['Authenticated STAFF user'], {"Authorization": '"Bearer staff-token"', "status": "null"}, exceptions=['Error: reschedule list failed']),
            case("EP-035 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null"}, exceptions=['401 Unauthorized']),
            case("EP-035 UTC08", "A", ['Caller is authenticated as CLIENT'], {"Authorization": '"Bearer client-token"'}, exceptions=['403 Forbidden']),
        ],
    },
    {
        "function_code": "EP-036",
        "class_name": "CalendarController",
        "function_name": "Process Reschedule Request",
        "sheet_name": "Process Reschedule Req",
        "description": "Approve or reject a reschedule request.",
        "precondition": "Login as STAFF or ADMIN account",
        "loc": 60,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover approve/reject flows, manual selection, payload validation, and STAFF/ADMIN access.",
        "cases": [
            case("EP-036 UTC01", "N", ['Authenticated STAFF user', 'Request status is PENDING'], {"Authorization": '"Bearer staff-token"', "requestId": '"requestId"', "action": '"approve"'}, ['returns approved reschedule result']),
            case("EP-036 UTC02", "B", ['Authenticated ADMIN user', 'Request status is PENDING'], {"Authorization": '"Bearer admin-token"', "requestId": '"requestId"', "action": '"reject"', "processNote": '"Not enough participants"'}, ['returns rejected reschedule result']),
            case("EP-036 UTC03", "B", ['Authenticated ADMIN user', 'Request status is PENDING'], {"Authorization": '"Bearer admin-token"', "requestId": '"requestId"', "action": '"approve"', "selectedNewStartTime": '"2026-04-01T09:00:00.000Z"'}, ['returns manually approved reschedule result']),
            case("EP-036 UTC04", "A", ['Authenticated ADMIN user'], {"Authorization": '"Bearer admin-token"', "requestId": '"bad-id"', "action": '"approve"'}, exceptions=['400 Bad Request']),
            case("EP-036 UTC05", "A", ['Authenticated STAFF user'], {"Authorization": '"Bearer staff-token"', "requestId": '"requestId"', "action": '"approve"'}, exceptions=['NotFoundException: Reschedule request not found']),
            case("EP-036 UTC06", "A", ['Authenticated STAFF user', 'Request status is REJECTED'], {"Authorization": '"Bearer staff-token"', "requestId": '"requestId"', "action": '"approve"'}, exceptions=['BadRequestException: Reschedule request already processed']),
            case("EP-036 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null"}, exceptions=['401 Unauthorized']),
            case("EP-036 UTC08", "A", ['Caller is authenticated as CLIENT'], {"Authorization": '"Bearer client-token"', "requestId": '"requestId"', "action": '"approve"'}, exceptions=['403 Forbidden']),
        ],
    },
    {
        "function_code": "EP-037",
        "class_name": "CalendarController",
        "function_name": "Respond Invite",
        "sheet_name": "Respond Invite",
        "description": "Record a participant response to an event invitation.",
        "precondition": "Login as invited participant, STAFF, or ADMIN",
        "loc": 38,
        "created_by": "Đặng Chí Bằng",
        "executed_by": "Đặng Chí Bằng",
        "test_requirement": "Cover invite response success, delegated ADMIN/STAFF handling, payload validation, and participant permissions.",
        "cases": [
            case("EP-037 UTC01", "N", ['Authenticated invited participant'], {"Authorization": '"Bearer participant-token"', "id": '"eventId"', "participantId": '"participantId"', "response": '"accept"'}, ['returns recorded invite response']),
            case("EP-037 UTC02", "B", ['Authenticated ADMIN user'], {"Authorization": '"Bearer admin-token"', "id": '"eventId"', "participantId": '"participantId"', "response": '"decline"'}, ['returns recorded invite response for admin override']),
            case("EP-037 UTC03", "B", ['Authenticated STAFF user'], {"Authorization": '"Bearer staff-token"', "id": '"eventId"', "participantId": '"participantId"', "response": '"tentative"'}, ['returns recorded invite response for staff override']),
            case("EP-037 UTC04", "A", ['Authenticated user'], {"Authorization": '"Bearer user-token"', "id": '"bad-id"', "participantId": '"participantId"'}, exceptions=['400 Bad Request']),
            case("EP-037 UTC05", "A", ['Authenticated participant'], {"Authorization": '"Bearer participant-token"', "id": '"eventId"', "participantId": '"participantId"'}, exceptions=['NotFoundException: Participant not found']),
            case("EP-037 UTC06", "A", ['Authenticated participant'], {"Authorization": '"Bearer participant-token"', "id": '"eventId"', "participantId": '"participantId-for-other-event"'}, exceptions=['BadRequestException: participantId does not belong to this event']),
            case("EP-037 UTC07", "A", ['Caller is not authenticated'], {"Authorization": "null", "id": '"eventId"'}, exceptions=['401 Unauthorized']),
            case("EP-037 UTC08", "A", ['Authenticated CLIENT user is not the invited participant'], {"Authorization": '"Bearer client-token"', "id": '"eventId"', "participantId": '"participantId"'}, exceptions=['403 Forbidden']),
        ],
    },
]


def workbook(version: str, function_list_count: int, functions: List[Dict[str, Any]], change_log: List[Dict[str, str]]) -> Dict[str, Any]:
    return {
        "version": version,
        "issue_date": ISSUE_DATE,
        "output_file": str(DOCS_DIR / f"Report5_Unit Test Case_v{version}.xlsx"),
        "function_list": FUNCTION_ROWS[:function_list_count],
        "functions": functions,
        "change_log": change_log,
    }


def build_spec() -> Dict[str, Any]:
    v24_change = {
        "effective_date": ISSUE_DATE,
        "version": "2.4",
        "change_item": "FE-20 Admin Dashboard & System Configuration",
        "mode": "A",
        "change_description": "Add Test Cases for Admin Dashboard",
        "reference": "Report5_Unit Test Case_v2.4",
    }
    v25_change = {
        "effective_date": ISSUE_DATE,
        "version": "2.5",
        "change_item": "FE-20 Admin Dashboard & System Configuration",
        "mode": "A",
        "change_description": "Add Test Cases for Audit Logs",
        "reference": "Report5_Unit Test Case_v2.5",
    }
    v26_change = {
        "effective_date": ISSUE_DATE,
        "version": "2.6",
        "change_item": "FE-17 Dispute Resolution System",
        "mode": "A",
        "change_description": "Add Test Cases for Calendar",
        "reference": "Report5_Unit Test Case_v2.6",
    }

    return {
        "meta": {
            "project_name": "FPT University Social",
            "project_code": "SEP490_17",
            "creator": "Đặng Chí Bằng",
            "reviewer": "Ngô Thái Sơn",
            "executed_date": ISSUE_DATE,
            "issue_date": ISSUE_DATE,
        },
        "workbooks": [
            workbook("2.4", 1, ADMIN_DASHBOARD_FUNCTIONS, [v24_change]),
            workbook("2.5", 5, AUDIT_LOG_FUNCTIONS, [v24_change, v25_change]),
            workbook("2.6", 12, CALENDAR_FUNCTIONS, [v24_change, v25_change, v26_change]),
        ],
    }


if __name__ == "__main__":
    print(json.dumps(build_spec(), ensure_ascii=False, indent=2))
