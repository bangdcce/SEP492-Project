---
name: unit-test
description: Scan backend (NestJS) code to design and implement Jest unit tests, then generate Unit Test Case (UTC) traceability documentation (Normal/Abnormal/Boundary) and an Excel UTC matrix using the repo template in docs/template/unit-test. Use when the user asks for unit test traceability, a UTC matrix in Markdown/Excel, or documentation focused on inputs/outputs/exceptions.
---

# Unit Test (UTC Matrix)

- Use the workbook template in `docs/template/unit-test/` as the output format reference. In this repo the current file is `Report5_Unit Test Case_v1.3.xlsx`.
- Primary deliverables:
  - Passing unit tests under `server/src/**/*.spec.ts`
  - One `.xlsx` UTC workbook under `docs/unit/` for the whole requested scope
  - A UTC Matrix as a Markdown table (for quick review)

## Workflow

1. **Discover scope**
   - Start from a requirement/use case or an entrypoint (controller/route) and trace the flow through services, guards, DTO validation, and repository calls.
   - Build an inventory of logic-bearing units (methods/functions) that have branching, validation, permission checks, state transitions, or non-trivial mapping.
   - Aggregate those traced paths back into the single requested business function/use case. Do **not** split one requested function into separate controller/service/helper worksheets.
   - If the user requests multiple business functions in one turn, default to **one workbook for the whole requested batch/scope** and place the functions on separate tabs unless the user explicitly asks for separate files.
   - Keep the scope anchored to the requested backend business flow. Do not expand into neighboring features or frontend-only behavior unless it is necessary to prove the requested output.
   - A single business function may map to multiple methods (for example `create` plus `publish`, or `publish` plus `update`). Keep those rows together in one worksheet when they support the same requested use case.

2. **Design test cases (N/A/B)**
   - Normal (`N`): valid inputs, success path.
   - Abnormal (`A`): validation failures, unauthorized/forbidden, missing data, not found.
   - Boundary (`B`): duplicates, idempotent actions, min/max limits, empty lists, extreme sizes.
   - Keep cases focused on **Input -> Output / Exception** (avoid internal-only assertions unless needed to prove output behavior).
   - Prefer existing passing Jest coverage as evidence when it already matches the requested UTC rows. Add or refine tests only for missing coverage.
   - The UTC sheet should be directly traceable to executed Jest cases. Prefer one `it(...)` block per UTC row or another obvious 1:1 mapping.
   - Match the function-sheet style in the UTC template: each UTC case should be an atomic combination of concrete preconditions, explicit input parameter values, and explicit confirmations.
   - Do **not** use shorthand input buckets such as `updateFields`, `validationSummary`, `requestState`, or other abstract labels when the real function inputs can be listed directly.
   - Do **not** invent synthetic worksheet sections such as `Action`, `Request status`, `Current status`, `Workflow state`, `State transition`, or similar labels as input rows. Keep only real call inputs and small amounts of necessary viewer/context input.
   - Do **not** treat the route path string as the request/input row. `PATCH /reviews/:id` is traceability context, not an input value. The input rows should be things like `id`, `rating`, `comment`, `requestId`, or `page`.
   - If one case edits multiple fields, list each edited parameter as its own input key with the exact value used in the test.
   - Use concrete values whenever possible (`requestId=req-1`, `status=PRIVATE_DRAFT`, `wizardProgressStep=3`) instead of prose summaries like "valid request" or "edited fields".
   - Show string input values with quotes in the UTC sheet (for example `"Marketplace request"`), while keeping numbers, booleans, and `null` unquoted.
   - For complex arrays/objects, prefer one readable summary row such as `attachments = "3 upload items (2 valid, 1 blank filename ignored)"` instead of exploding them into `attachments[0]`, `attachments[1]`, etc., unless the user explicitly wants per-element rows.
   - Use `null` or a matching precondition like "omitted by caller" for omitted optional fields instead of vague values such as `"not provided"`.
   - For core business-payload fields in the requested use case, do **not** leave active UTC columns blank. Either give that field a concrete test value in the case and mark it with `O`, or explicitly model `null` / omitted input as the thing being tested.
   - Add boundary UTC cases only when the code actually defines a boundary (for example `@Min`, `@Max`, `@Length`, enum limits, or explicit service branching). Do not invent min/max string-length cases when the code has no such rule.
   - Keep expected confirmations explicit as separate rows under `returns`, `exceptions`, and optional `logs` when the test asserts a log message.
   - Write `exceptions` with the actual business rule or validation reason, not only a transport label. Prefer rows such as `ConflictException: email "user@example.com" already exists` or `BadRequestException: requestId must be a UUID` over bare labels like `409 Conflict` or `400 Bad Request`.
   - When the same endpoint can fail for different reasons, keep each reason on its own exception row. Do not merge `not found`, `forbidden`, `duplicate`, and `invalid state` into a generic failure row.
   - For business-rule branches, prefer the rule wording that a reviewer can understand immediately, for example `request "req-1" cannot be published because no broker is assigned`.
   - When the user wants workbook-style output like the screenshot, treat `logs` as a first-class confirmation area, not an optional afterthought. Prefer at least one log message per UTC case.
   - Keep `returns` compact. If the method returns an object, summarize the externally visible result in one short row per distinct returned shape, such as `returns new request with status = PUBLIC_DRAFT`, `returns updated request`, or `returns auth response without password`. Do **not** turn internal sub-details like saved child-row counts into standalone return rows unless that detail is itself the user-visible output being tested.
   - Prefer output phrasing that reads like the method result, not low-level internals. Example: use `returns new request with status = DRAFT` instead of separate rows like `returns new request` + `returns status = DRAFT` unless the separation is truly necessary.
   - Put state/setup facts that are not literal request inputs into `preconditions`, not into `inputs`. Example: "request is currently `PRIVATE_DRAFT`" is a precondition, while `requestId="req-1"` is an input.
   - Write `preconditions` with fine-grained rows, not merged prose. Prefer separate rows such as `Authenticated client owns request "req-1"`, `Request "req-1" is currently "DRAFT"`, and `No broker is assigned to the request` instead of one summary like `client can edit own draft request`.
   - Keep authentication, ownership, lifecycle state, assignment state, and related-entity existence as separate precondition lines whenever they matter to the branch.
   - Use exact IDs, role names, and enum/state values in preconditions when those values are part of why the case exists.
   - Do not hide important setup in vague phrases like `valid setup`, `proper permissions`, `existing record`, or `editable state`.
   - Prefer user-meaningful flows over internal-only DTO validation. Do **not** add DTO-only boundary cases by default if they are not actions the user would realistically perform, unless the user explicitly asks for validation coverage.
   - For user-facing service/controller cases, shared inputs such as `requestId` should appear in every UTC column where that input is actually part of the call, so the worksheet does not leave obvious gaps in the mark matrix.
   - If the controller method receives `@Param('id')`, `@Query('page')`, or a DTO body, the worksheet should show those concrete input fields and tested values, not the URL template that carried them.
   - Omit workflow-only or internal helper fields such as `wizardProgressStep` unless the user explicitly asks for them or they are central to the requested behavior.
   - Include `logs` as real confirmation evidence, not filler. For this repo workflow, prefer at least one concise success/failure log per UTC case when the user asks for terminal evidence, and assert the exact same message in Jest.
   - If the target code does not already emit useful logs for the requested UTC cases, add concise logs to the unit under test where appropriate before documenting them.
   - For pure unit-test requests, prioritize direct method-level tests with mocked dependencies. Use route metadata or isolated pipe/DTO checks for auth/validation declarations instead of spinning up a full HTTP app unless the user explicitly wants routing/integration behavior.

3. **Implement unit tests (Jest + NestJS)**
   - Use `@nestjs/testing` and mock downstream dependencies (repositories, external services, event emitters).
   - Do not hit a real DB/network in unit tests.
   - Prefer direct invocation of the method under test (`controller.method(...)`, `service.method(...)`, helper function call) over `supertest` when the user asked for unit tests rather than integration tests.
   - Prefer explicit exception assertions (e.g., `await expect(...).rejects.toThrow(...)`).
   - Make the tests traceable to the UTC sheet. When adding new tests, prefer titles that make the UTC mapping obvious (for example include `UTCID01` or the exact case intent).
   - If the UTC sheet includes `logs`, assert the exact emitted log message in the Jest test with a logger/console spy.
   - The goal is not just to write documentation: the documentation must be backed by executable Jest evidence the user can run and screenshot from the terminal.

## Function Naming Rules

- Use the actual method/function name as the source of truth for `Function Name`.
- Keep the code-traceable raw name such as `getOverview`, `findAll`, `processRescheduleRequest`, or `respondInvite`.
- When the workbook/header needs reader-friendly text, convert that method name to title case by splitting camelCase or PascalCase:
  - `getOverview` -> `Get Overview`
  - `respondInvite` -> `Respond Invite`
  - `processRescheduleRequest` -> `Process Reschedule Request`
- Do not use the route text or endpoint label as the function name.

4. **Run tests and make them pass (hard gate)**
   - Detect the repo's actual test command from local package scripts or prior runs. Do not assume `yarn`.
   - Run the smallest relevant scope first, then the full suite:
     - Example for this repo: `npm.cmd test -- <pattern> --runInBand` from `server/`
     - Example for this repo: `npm.cmd test -- --runInBand` from `server/`
   - Do not generate the final UTC workbook until the tests **pass**.

5. **Generate the UTC Matrix (Markdown + XLSX)**
   - Create one workbook for the requested scope:
     - Markdown table: one row per UTCID
     - XLSX: template-style workbook with `Cover`, `Function List`, `Test Report`, and one or more function tabs
   - Keep helper/template sheets such as `Cover`, `Function List`, and `Test Report` in the workbook unless the user explicitly asks for a stripped-down one-sheet export.
   - If the target function has multiple subflows (for example login, logout, refresh), keep them as UTC rows in one function tab instead of creating one sheet per subflow.
   - Mark `Passed/Failed` only with executed evidence (a real test run). The default for this skill is to produce a **complete** workbook with **no `Untested`** rows.
   - If the target workbook is temporarily locked, generate a sibling workbook copy, report that clearly, and overwrite the requested filename once the file is closed.
   - Before writing the sheet, inspect a real sample tab from the workbook/template and preserve its print area, page setup, column widths, hidden columns, merged cells, and row heights. Do not let the generated tab drift wider than the sample.
   - Do not split one requested batch into cumulative version files unless the user explicitly asks for that older workflow.

## XLSX generation

- Use `scripts/generate_unit_test_workbook.py` or `scripts/generate_unit_test_workbook.cjs` (reads JSON from stdin) and write the workbook to `docs/unit/`.
- The payload should normally describe one workbook with one or more `functions[]` items, where each item maps to one function tab inside the same file.
- Case payload guidance:
  - `preconditions`: concrete environmental/setup conditions written as granular row-ready facts, one fact per line when possible
  - `inputs`: object where each key is a real input parameter or a truly necessary viewer/context field and each value is the exact value used in the test; prefer `id`, `requestId`, `page`, `limit`, DTO field names, and body field names over URL templates
  - `returns`: compact expected return/output confirmations written the way a reviewer would read the method result
  - `exceptions`: explicit expected exception messages/types with business-rule detail when applicable; prefer `Entity + reason + exception class/message` over bare HTTP status labels
  - `logs`: exact log messages asserted by the Jest test when available; otherwise use deterministic case log messages derived from the executed UTC case so every column can map to concrete `Log message` rows
  - Never use synthetic input keys such as `Action`, `Request status`, `Current status`, or similar worksheet-only grouping labels.
- Formatting rules for UTC-like tabs:
  - Preserve the source tab's column widths and hidden spacer columns exactly.
  - Preserve `print_area`, page orientation, and page margins from the source tab.
  - Do not auto-fit all columns after fill. Keep long text inside the template's designated description/value columns.
  - Do not style unused rows or columns outside the real matrix range.
  - Avoid stray fill colors or blank spacer blocks that do not exist in the sample tab.
- Summary/header rules:
  - Always populate `Lines of code` and `Lack of test cases`.
  - `Lines of code` may be an approximate integer if exact counting is too expensive, but it must not be blank.
  - Prefer Excel formulas for `Passed`, `Failed`, `Untested`, `N`, `A`, `B`, and `Total Test Cases` using the same `COUNTIF` / `COUNTA` / `SUM` pattern as the sample tab.
  - If the template links `Function Code` or `Function Name` back to `Function List`, preserve that reference style.
 - Workbook-shape rules:
   - Default to one workbook file for the whole requested scope.
   - Keep all requested function tabs in that one file.
   - Keep `Cover`, `Function List`, and `Test Report` in the same file by default.
   - Do not create cumulative version chains unless the user explicitly asks for cumulative files again.
- Minimal payload shape:

```json
{
  "meta": { "project_name": "SEP492-Project", "project_code": "SEP492" },
  "functions": [
    {
      "function_code": "FN-01",
      "class_name": "AuthController/AuthService",
      "function_name": "Register Account",
      "sheet_name": "Register Account",
      "test_requirement": "Cover the full Register Account business flow in one UTC sheet.",
      "loc": 120,
      "created_by": "Your Name",
      "executed_by": "Your Name",
      "cases": [
        {
          "type": "N",
          "status": "P",
          "executed_date": "2026-03-26",
          "preconditions": ["No existing user matches the email"],
          "inputs": { "email": "user@example.com", "role": "CLIENT" },
          "returns": ["returns auth response for new client account"],
          "exceptions": [],
          "logs": ["\"Register Successful: user@example.com\""]
        }
      ]
    }
  ]
}
```

- Example invocation (PowerShell, no sidecar JSON files):

```powershell
$json = @'
{
  "meta": { "project_name": "SEP492-Project" },
  "functions": [
    {
      "function_code": "FN-01",
      "function_name": "Register Account",
      "sheet_name": "Register Account",
      "cases": []
    }
  ]
}
'@
$json | node .codex/skills/unit-test/scripts/generate_unit_test_workbook.cjs --output docs/unit/unit-test-utc.xlsx
```
