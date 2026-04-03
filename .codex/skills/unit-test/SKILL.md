---
name: unit-test
description: Scan backend (NestJS) code to design and implement Jest unit tests, then generate Unit Test Case (UTC) traceability documentation (Normal/Abnormal/Boundary) and an Excel UTC matrix using the repo template in docs/template/unit-test. Use when the user asks for unit test traceability, a UTC matrix in Markdown/Excel, or documentation focused on inputs/outputs/exceptions.
---

# Unit Test (UTC Matrix)

- Use the workbook template in `docs/template/unit-test/` as the output format reference. In this repo the current file is `Report5_Unit Test Case_v1.3.xlsx`.
- Primary deliverables:
  - Passing unit tests under `server/src/**/*.spec.ts`
  - One `.xlsx` UTC matrix workbook under `docs/unit/` with exactly one visible worksheet
  - A UTC Matrix as a Markdown table (for quick review)

## Workflow

1. **Discover scope**
   - Start from a requirement/use case or an entrypoint (controller/route) and trace the flow through services, guards, DTO validation, and repository calls.
   - Build an inventory of logic-bearing units (methods/functions) that have branching, validation, permission checks, state transitions, or non-trivial mapping.
   - Aggregate those traced paths back into the single requested business function/use case. Do **not** split one requested function into separate controller/service/helper worksheets.
   - If the user requests multiple business functions in one turn, generate **one workbook per requested function/use case**. Do not combine unrelated functions into one workbook unless the user explicitly asks for that.
   - Keep the scope anchored to the requested backend business flow. Do not expand into neighboring features or frontend-only behavior unless it is necessary to prove the requested output.
   - A single business function may map to multiple methods (for example `create` plus `publish`, or `publish` plus `update`). Keep those rows together in one worksheet when they support the same requested use case.

2. **Design test cases (N/A/B)**
   - Normal (`N`): valid inputs, success path.
   - Abnormal (`A`): validation failures, unauthorized/forbidden, missing data, not found.
   - Boundary (`B`): duplicates, idempotent actions, min/max limits, empty lists, extreme sizes.
- Default target: aim for roughly **6-8 executed UTC cases per requested business flow** when the code has enough real branching to support it. More is welcome when each case is distinct and correct.
- For genuinely branch-heavy workflows (multi-role decisions, stateful approval flows, billing-cycle variants, invite/respond lifecycles, create/update/publish chains), it is good to push toward **9-12 executed UTC cases** when the code and passing Jest evidence support it.
- For very simple read-only endpoints (`GET` list/detail/status endpoints with little branching), **3-4 strong cases** is acceptable. Prefer solid coverage of success, empty result, not found/forbidden, and one useful edge case over padding the sheet with fake scenarios.
   - When deciding whether to stop, bias toward adding one more **specific** case if the code has another meaningful branch (different role, different billing cycle, optional field omitted, duplicate/conflict, already-cancelled, already-accepted, etc.).
   - Keep cases focused on **Input -> Output / Exception** (avoid internal-only assertions unless needed to prove output behavior).
   - Prefer existing passing Jest coverage as evidence when it already matches the requested UTC rows. Add or refine tests only for missing coverage.
   - The UTC sheet should be directly traceable to executed Jest cases. Prefer one `it(...)` block per UTC row or another obvious 1:1 mapping.
   - Match the function-sheet style in the UTC template: each UTC case should be an atomic combination of concrete preconditions, explicit input parameter values, and explicit confirmations.
   - Do **not** use shorthand input buckets such as `updateFields`, `validationSummary`, `requestState`, or other abstract labels when the real function inputs can be listed directly.
   - Do **not** invent synthetic worksheet sections such as `Action`, `Request status`, `Current status`, `Workflow state`, `State transition`, or similar labels as input rows. Keep only real call inputs and small amounts of necessary viewer/context input.
   - If one case edits multiple fields, list each edited parameter as its own input key with the exact value used in the test.
   - Use concrete values whenever possible (`requestId=req-1`, `status=PRIVATE_DRAFT`, `wizardProgressStep=3`) instead of prose summaries like "valid request" or "edited fields".
   - Show string input values with quotes in the UTC sheet (for example `"Marketplace request"`), while keeping numbers, booleans, and `null` unquoted.
   - For complex arrays/objects, prefer one readable summary row such as `attachments = "3 upload items (2 valid, 1 blank filename ignored)"` instead of exploding them into `attachments[0]`, `attachments[1]`, etc., unless the user explicitly wants per-element rows.
   - Use `null` or a matching precondition like "omitted by caller" for omitted optional fields instead of vague values such as `"not provided"`.
   - For core business-payload fields in the requested use case, do **not** leave active UTC columns blank. Either give that field a concrete test value in the case and mark it with `O`, or explicitly model `null` / omitted input as the thing being tested.
   - Add boundary UTC cases only when the code actually defines a boundary (for example `@Min`, `@Max`, `@Length`, enum limits, or explicit service branching). Do not invent min/max string-length cases when the code has no such rule.
- Keep expected confirmations explicit as separate rows under `returns`, `exceptions`, and optional `logs` when the test asserts a log message.
- Keep `returns` compact. If the method returns an object, summarize the externally visible result in one short row per distinct returned shape, such as `returns new request with status = PUBLIC_DRAFT`, `returns updated request`, or `returns auth response without password`. Do **not** turn internal sub-details like saved child-row counts into standalone return rows unless that detail is itself the user-visible output being tested.
- When the workbook template row limit becomes the bottleneck, keep the **case count high** but merge repeated confirmations. Example: if three success cases all return the same kind of subscription object, reuse one compact `returns ...` row across those UTC columns instead of creating one return row per billing cycle.
   - Prefer output phrasing that reads like the method result, not low-level internals. Example: use `returns new request with status = DRAFT` instead of separate rows like `returns new request` + `returns status = DRAFT` unless the separation is truly necessary.
   - Prefer user-facing domain terms over internal repository/entity names in the UTC sheet. Example: use `broker application`, `broker invitation`, or `freelancer recommendation` instead of internal storage wording like `proposal` when the web/business flow does not expose that term.
   - If the HTTP handler or service uses an internal parameter name such as `proposalId`, you may rename the UTC sheet input to a user-facing alias like `brokerApplicationId` or `freelancerRecommendationId` as long as the described case still maps cleanly to the executed Jest test.
   - Put state/setup facts that are not literal request inputs into `preconditions`, not into `inputs`. Example: "request is currently `PRIVATE_DRAFT`" is a precondition, while `requestId="req-1"` is an input.
   - Prefer user-meaningful flows over internal-only DTO validation. Do **not** add DTO-only boundary cases by default if they are not actions the user would realistically perform, unless the user explicitly asks for validation coverage.
   - For user-facing service/controller cases, shared inputs such as `requestId` should appear in every UTC column where that input is actually part of the call, so the worksheet does not leave obvious gaps in the mark matrix.
   - Omit workflow-only or internal helper fields such as `wizardProgressStep` unless the user explicitly asks for them or they are central to the requested behavior.
   - Include `logs` as real confirmation evidence, not filler. For this repo workflow, prefer at least one concise success/failure log per UTC case when the user asks for terminal evidence, and assert the exact same message in Jest.
   - In JSON payloads, `logs` should be written as the plain final message text. Do **not** wrap the whole log line in an extra pair of quotes. Example: use `Accept Broker Successful: "req-1" -> "broker-1"` instead of `"Accept Broker Successful: \"req-1\" -> \"broker-1\""`.
   - If the target code does not already emit useful logs for the requested UTC cases, add concise logs to the unit under test where appropriate before documenting them.

3. **Implement unit tests (Jest + NestJS)**
   - Use `@nestjs/testing` and mock downstream dependencies (repositories, external services, event emitters).
   - Do not hit a real DB/network in unit tests.
   - Prefer explicit exception assertions (e.g., `await expect(...).rejects.toThrow(...)`).
   - Make the tests traceable to the UTC sheet. When adding new tests, prefer titles that make the UTC mapping obvious (for example include `UTCID01` or the exact case intent).
   - If the UTC sheet includes `logs`, assert the exact emitted log message in the Jest test with a logger/console spy.
   - The goal is not just to write documentation: the documentation must be backed by executable Jest evidence the user can run and screenshot from the terminal.

4. **Run tests and make them pass (hard gate)**
   - Detect the repo's actual test command from local package scripts or prior runs. Do not assume `yarn`.
   - Run the smallest relevant scope first, then the full suite:
     - Example for this repo: `npm.cmd test -- <pattern> --runInBand` from `server/`
     - Example for this repo: `npm.cmd test -- --runInBand` from `server/`
   - Do not generate the final UTC workbook until the tests **pass**.

5. **Generate the UTC Matrix (Markdown + XLSX)**
   - Create one UTC matrix for the requested business function/use case:
     - Markdown table: one row per UTCID
     - XLSX: template-style matrix (marks + result rows) on a single worksheet only
   - Remove helper/template sheets such as `Guideline`, `Cover`, `Function List`, and `Test Report` from the generated workbook.
   - If the target function has multiple subflows (for example login, logout, refresh), keep them as UTC rows in one sheet instead of creating one sheet per subflow.
   - Mark `Passed/Failed` only with executed evidence (a real test run). The default for this skill is to produce a **complete** workbook with **no `Untested`** rows.
   - If the target workbook is temporarily locked, generate a sibling workbook copy, report that clearly, and overwrite the requested filename once the file is closed.

## XLSX generation

- Use `scripts/generate_unit_test_workbook.py` or `scripts/generate_unit_test_workbook.cjs` (reads JSON from stdin) and write the workbook to `docs/unit/`.
- The Python generator can now auto-expand condition/confirm sections when the stock template spacing is too small. Do **not** drop real cases just to stay under the old fixed row cap.
- The payload must contain exactly one `functions[]` item. Put every UTC case for the requested business function into that single item.
- Case payload guidance:
  - `preconditions`: concrete environmental/setup conditions
  - `inputs`: object where each key is a real input parameter or a truly necessary viewer/context field and each value is the exact value used in the test
  - `returns`: compact expected return/output confirmations written the way a reviewer would read the method result
  - `exceptions`: explicit expected exception messages/types
  - `logs`: exact log messages asserted by the Jest test; when the user wants terminal log evidence, include at least one relevant log row per UTC case
  - Never use synthetic input keys such as `Action`, `Request status`, `Current status`, or similar worksheet-only grouping labels.
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
          "logs": ["Register Successful: user@example.com"]
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
