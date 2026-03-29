# Controller Coverage

## Scenario Mapping

| Scenario group | UTC type | Expected evidence |
| --- | --- | --- |
| Happy Path | `N` | Controller returns expected payload or forwards expected service result |
| Edge Case | `B` | Defaults, caps, dedupe, optional query, max/min inputs, or safe fallbacks |
| Validation & Error Handling | `A` | DTO validation, `ParseUUIDPipe`, `BadRequestException`, `NotFoundException`, propagated `422` |
| Security & Permissions | `A` | Guard/role metadata or explicit `ForbiddenException` / unauthorized flow |

## Naming

- Jest title: `EP-XXX-TYY concise intent`
- `EP-XXX`: function code from `docs/Test-Unit-task.txt`
- `T`: `N`, `B`, or `A`
- `YY`: two-digit sequence for that type

Examples:
- `EP-055-N01 forwards admin filters unchanged`
- `EP-055-B01 scopes staff queue requests to their own caseload`
- `EP-055-A01 rejects assignedStaffId from another staff member`
- `EP-055-A02 exposes GET /disputes with JwtAuthGuard, RolesGuard, and ADMIN/STAFF roles`

## Artifact Layout

- Tests: `server/src/agent-unit-tests/<batch-name>/`
- Manifest JSON: `docs/unit/<batch-version>/first-20-manifest.json`
- Jest JSON: `docs/unit/<batch-version>/jest-results.json`
- Workbooks: `docs/unit/<batch-version>/Report5_Unit Test Case_vX.Y_EP-XXX_<author>.xlsx`

## Evidence Rules

- Match workbook status from Jest JSON by case title.
- If no matching Jest assertion exists, mark the UTC row as `Untested`.
- Use the executed Jest title as the workbook `logs` row when no domain log is asserted.
- Do not mark a case `Passed` from manual reasoning alone.
