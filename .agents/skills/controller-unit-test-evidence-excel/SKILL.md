---
name: controller-unit-test-evidence-excel
description: Evidence-driven NestJS controller unit testing and Excel UTC generation. Use when Codex needs to cover controller routing, DTO input handling, permission checks, or mocked controller logic first, then run Jest and generate a single multi-tab Excel UTC workbook for the requested scope from executed evidence instead of guessed results.
---

# Controller Unit Test Evidence Excel

Use this skill for controller-focused unit test batches where the deliverables are:
- Jest specs under `server/src/agent-unit-tests/...`
- Real Jest execution evidence
- One Excel workbook for the requested batch/scope, with multiple function tabs when needed

## Workflow

1. Read the requested function list.
   - Prefer `docs/Test-Unit-task.txt` when the user references it.
   - Group endpoints by the user's requested cluster boundary.
   - Default to `1 requested scope = 1 workbook`, not `1 endpoint = 1 workbook`.
   - Use multiple tabs inside that workbook for the grouped functions/modules/endpoints the user asked for.

2. Write tests before touching Excel.
   - Put generated specs and helpers in a dedicated folder under `server/src/agent-unit-tests/`.
   - Reuse shared helpers for route metadata, DTO validation, `ParseUUIDPipe`, and mocked repositories/services.
   - Avoid hand-writing the same repository/query-builder scaffolding in every spec.

3. Cover the four controller scenario groups.
   - `Happy Path`: map to UTC type `N`.
   - `Edge Case`: map to UTC type `B`.
   - `Validation & Error Handling`: map to UTC type `A`.
   - `Security & Permissions`: also map to UTC type `A`, because the UTC template only supports `N/A/B`.

4. Treat controller security as two layers.
   - Verify route metadata: controller path, HTTP method, guards, and roles.
   - Verify inline permission branches with direct controller calls when the controller itself throws `ForbiddenException`, `BadRequestException`, `NotFoundException`, or similar.

5. Treat controller input handling as two layers.
   - Validate DTO/query/body rules with `plainToInstance(...)` + `validateSync(...)`.
   - Validate path UUID handling with `ParseUUIDPipe` when the endpoint uses UUID params.
   - In unit-test mode, treat the "request" as the concrete method inputs (`id`, `requestId`, `clientId`, DTO fields, query values), not as the HTTP route string.
   - Prefer direct controller-method calls with mocked services. Use route metadata checks for guards/roles, not full HTTP harnesses, unless the user explicitly asks for routing or integration coverage.

6. Run Jest and capture machine-readable evidence.
   - Prefer the smallest relevant scope first.
   - Use `--json --outputFile <path>` so Excel status comes from executed assertions.
   - Never mark `Passed` in Excel unless the matching Jest case exists and passed.

7. Generate Excel only after tests pass.
   - Use the workbook generator to create one workbook containing `Cover`, `Function List`, `Test Report`, and the generated function tabs for the current scope.
   - Feed it a workbook spec plus the Jest JSON result file.
   - Keep template structure and preserve helper sheets.
   - Do not create cumulative version chains or multiple incremental files unless the user explicitly asks for that old workflow.
   - Inspect the closest existing test tab in the template workbook before writing any new sheet. Preserve its column widths, hidden columns, row heights, merged cells, print area, page margins, and orientation exactly unless the user explicitly asks for a layout change.
   - Prefer one workbook because it is easier for the user to import all tabs into an existing Google Sheet with `Insert new sheet(s)`.

## Precondition Writing Rules

- Write `Precondition` rows in a granular matrix style. Do not compress multiple setup facts into one vague sentence.
- Prefer one row per concrete state fact, ownership fact, assignment fact, or authentication fact.
- Use exact business identifiers and exact business states when they are known from the test, for example:
  - `Authenticated client owns request "req-1"`
  - `Request "req-1" is currently "DRAFT"`
  - `No broker is assigned to the request`
  - `Request "req-1" is currently "PRIVATE_DRAFT"`
  - `Broker "broker-1" is already assigned`
- Keep mutable state rows separate from actor/permission rows. Ownership, authentication, current status, related-entity assignment, and feature flags should normally be different rows.
- Do not write fuzzy summaries such as `valid request exists`, `proper permissions`, `request is editable`, or `normal setup`.
- When a case depends on a sequence of states, list every required state explicitly instead of implying them.
- When a field value is the reason the branch changes, repeat the exact value in the precondition row rather than referring to it indirectly.
- Use preconditions only for setup facts that are true before the action starts. Put actual request inputs under `Input`, not under `Precondition`.
- Prefer reviewer-readable English phrases over internal shorthand. The matrix should be understandable without opening the test code.
- If two UTC columns share the same setup fact, reuse the exact same precondition row text so the `O` marks stay visually aligned and easy to compare.

## Input / Request Writing Rules

- In UTC-style sheets, `Request`, `Input`, or `Input Variable` means the concrete values passed into the function under test.
- Do **not** use the controller route path itself as an input row. For example, do not write `/reviews/:id` or `PATCH /calendar/events/:id` under request/input rows.
- Prefer scalar input rows such as `id`, `requestId`, `clientId`, `flagId`, `page`, `limit`, `range`, `reason`, and `status` when those are the real values passed to the method.
- For DTO/object inputs, list the meaningful fields from the executed test case instead of one vague row like `body` or `request payload`.
- For path parameters, show the parameter name and tested value, for example:
  - `id = "audit-1"`
  - `requestId = "req-1"`
  - `clientId = "client-1"`
- For query parameters, show the real query field names and values, for example:
  - `page = 2`
  - `limit = 20`
  - `range = "30d"`
- For body payloads, prefer one row per business-relevant field that affects the branch.
- Keep setup facts in `Precondition` and call-time values in `Input`. Do not move `requestId`, `id`, or DTO field values into `Precondition`.

## Function Name Rules

- `Function Name` should be the actual method name being tested, not the route label or use-case title.
- Keep the raw method name available for traceability, for example `getOverview`, `findAll`, `processRescheduleRequest`.
- When the sheet/header needs a reviewer-friendly display label, convert the method name to title case by splitting camelCase or PascalCase, for example:
  - `getOverview` -> `Get Overview`
  - `processRescheduleRequest` -> `Process Reschedule Request`
  - `findOne` -> `Find One`
- Do not substitute route text such as `GET /audit-logs` for the function name.

## Excel Template Fidelity Rules

- Treat the workbook template as a visual source of truth, not only as a content example.
- Copy the nearest matching test tab layout before filling values. Do not create fresh column-width schemes or ad hoc spacer columns.
- Preserve hidden spacer columns exactly as the template uses them. If the source tab hides a narrow spacer column, keep it hidden; do not turn it into a visible wide column that causes page overflow.
- Preserve `print_area`, page orientation, and page margins from the source tab so the sheet opens and prints within the expected page width.
- Do not auto-fit or globally resize the matrix columns after data fill. Wide text belongs in the description/value columns that already exist in the template.
- Do not apply fills, borders, or styles to whole columns/rows outside the real used range. That creates artificial blank areas and makes Excel think the sheet is much larger than it should be.
- Keep the used range compact. Only style/write the rows and columns that actually belong to the generated matrix.
- Do not introduce stray fill colors or orange-looking spacer cells unless the template already has them in the same location.
- When cloning styles, copy from the corresponding template cells instead of approximating by font name or color alone.

## Summary Cell Rules

- Fill `Lines of code` and `Lack of test cases` on every generated function tab.
- `Lines of code` may be an approximate integer when exact counting is impractical, but it must not be left blank.
- Default `Lack of test cases` to `0` when the suite is intended to be complete; otherwise use the real remaining gap count.
- For `Passed`, `Failed`, `Untested`, `N/A/B`, and `Total Test Cases`, prefer Excel formulas instead of hardcoded values.
- Mirror the formula pattern from the template tab whenever possible, for example using `COUNTIF`, `COUNTA`, and `SUM` over the current sheet's result/type/header ranges.
- If the template links `Function Code` or `Function Name` back to `Function List`, preserve that reference style instead of flattening those cells to plain text.

## Log Message Rules

- Add a `Log message` confirmation section when generating UTC-style matrices.
- Every UTC case should have at least one concise log message candidate, even if the production code does not emit a real logger call yet.
- Prefer messages backed by executed evidence:
  - first choice: exact logger/console message asserted in Jest
  - second choice: deterministic test-case log derived from the executed Jest case title
- Write log messages as reviewer-readable quoted strings, for example:
  - `"Login successful."`
  - `"Unauthorized access blocked for report moderation."`
  - `"Validation failed because requestId is not a UUID."`
- Keep one log message row per distinct message. Do not merge unrelated success and failure text into one row.
- Messages should describe the observed outcome, not internal implementation trivia.
- Avoid vague text such as `"Process completed"` or `"An issue happened"` when the branch can be named precisely.
- Reuse identical log row text across UTC columns when the same outcome message applies.

## Exception Writing Rules

- Write `Exception` rows as concrete business outcomes, not only as HTTP buckets.
- When the branch is driven by business rules, prefer domain wording plus the thrown exception class or exact message when known, for example:
  - `ConflictException: Email "staff@company.test" already exists`
  - `UnprocessableEntityException: Dispute "dispute-1" cannot be closed while a hearing is still pending`
  - `ForbiddenException: Staff user cannot delete audit logs`
- Do not reduce business-rule failures to vague labels such as `400 Bad Request`, `403 Forbidden`, or `422 Unprocessable Entity` when the executed test proves the real rule behind the failure.
- Use generic transport/status wording only when the code path truly exposes only framework-level validation and no more specific business message exists.
- Keep different failure reasons on separate exception rows. Example: `requestId is not a UUID`, `request "req-1" was not found`, and `request "req-1" cannot be published without broker assignment` should not share one row.
- Prefer reviewer-readable phrases that explain why the action was blocked. The matrix should communicate the rule without forcing the reviewer to open the test code.
- If both the exception type and the exact message matter, include both in one row rather than dropping one of them.
- Map each exception row to executed Jest evidence. Do not invent more detailed business wording than the asserted code path actually proves.

## Coverage Rules

- Use at least one successful controller test per endpoint.
- Add 1 boundary/edge case when the endpoint has defaults, caps, dedupe rules, optional query params, or max/min constraints.
- Add 1 validation/error case from DTO rules, pipe rules, not-found branches, or propagated service exceptions.
- Add 1 security case from guard/role metadata or explicit permission checks in the controller body.
- Prefer one Jest `it(...)` block per UTC row so mapping stays obvious.

Read [`controller-coverage.md`](./references/controller-coverage.md) when you need the detailed case-mapping rules, naming rules, or artifact layout.

## Artifact Rules

- Name Jest cases with stable IDs like `EP-031-N01 ...`.
- Put the same case IDs into the manifest JSON.
- Use actual Jest titles as evidence logs in the workbook instead of invented log text.
- Default to one workbook filename for the whole requested scope.
- Keep all requested tabs inside that one file instead of spreading them across many files.
- Do not create cumulative `v2.4 -> v2.5 -> v2.6` output chains unless the user explicitly asks for cumulative versioning again.
- When the user asks for template-style naming, apply that naming to the single workbook file rather than generating multiple near-duplicate files.

## Token Optimization

- Keep invariant logic in shared helpers and reusable scripts.
- Keep per-batch variability in a manifest JSON, not in repeated prose.
- Reuse the same generator script for later versions; only patch tests or the manifest when behavior changes.
