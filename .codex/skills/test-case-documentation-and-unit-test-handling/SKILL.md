---
name: test-case-documentation-and-unit-test-handling
description: Generate comprehensive unit tests and traceability documentation from either provided code or a user requirement / use case. Use when the user wants Codex to find the related implementation, trace the full code path, test all relevant functions and methods, document Normal/Abnormal/Boundary coverage, and create a real Excel workbook output.
---

# Test Case Documentation and Unit Test Handling
- Use xlsx file in D:\GradProject\SEP492-Project\docs\template\unit-test for reference, this file is from another project, but we could use it as a referene point to our doc
## Core behavior
- Support two starting points: direct code input or requirement / use-case input.
- Treat provided code as the source of truth when the user gives code directly.
- Discover the relevant code path first when the user gives only a requirement or use case.
- For requirement-first tasks, scan the full relevant flow instead of stopping at the first matching file.
- Test every directly relevant logic-bearing unit in scope, not just the top-level endpoint or single function.
- Default documentation split is `by function`, not `by use case`, unless the user provides a concrete consolidated matrix example/template and wants the workbook to match that layout.
- A single workbook may cover many use cases from the same feature, but each logic-bearing function should normally have its own sheet or matrix.
- Use the user's developer name when present. Leave `Created By` blank when it is not provided.
- Acknowledge briefly when the user is still defining the workflow and has not supplied code or a requirement yet.

## Requirement-first workflow
1. Extract identifiers, actors, actions, entities, state transitions, validations, and important observable outcomes from the requirement or use case.
2. Search the codebase for routes, controllers, services, DTOs, enums, status constants, repository methods, events, logs, UI labels, and text that match the requirement.
3. Trace the full relevant flow from the entry point to downstream collaborators. Do not stop at the first file match.
4. Build a scoped inventory of directly relevant units: controller methods, service methods, validators, guards, helpers, mappers, repository/query methods, UI handlers, and other functions with business logic.
5. Include subordinate methods and side-path logic that materially affect the use case, such as permission checks, validation helpers, state-transition branches, duplicate detection, repository lookups, logging, audit trails, notifications, and quota or usage tracking.
6. Test every directly relevant function or method that contains branching, validation, permission checks, state changes, calculations, mapping, or other observable business outcomes.
7. Explicitly note thin wrappers or purely declarative code that were scanned but intentionally skipped.
8. State the assumption and continue when multiple plausible implementations exist instead of stalling.

## Unit test workflow
1. Analyze behavior, branches, preconditions, edge cases, exceptions, state changes, and boundaries for each in-scope function.
2. Match the existing project test framework when it is discoverable. Otherwise choose a conventional default for the language and note the assumption briefly.
3. Cover Normal (`N`), Abnormal (`A`), and Boundary (`B`) scenarios for each directly relevant function or method.
4. Mock downstream dependencies so the tests isolate the unit under test.
5. Assert returns, exceptions, state transitions, repository writes, emitted events, logs, visibility changes, notifications, permission outcomes, and other observable effects when relevant.
6. Distinguish between test assertions and traceability-matrix content: mocked method calls and internal collaboration checks may be asserted in tests, but they should not be listed in the Excel matrix unless the user explicitly asks for internal side-effect mapping.
7. Group the output by function or file when the request started from a use case so the coverage stays readable.
8. For use-case requests, split coverage by function rather than collapsing the entire use case into one default matrix.
9. For use-case requests, prefer a deep suite that covers the full in-scope chain rather than a shallow single-method sample.
10. Output raw unit test code only when the user explicitly asks for it.
11. When matching automated tests already exist in the repository, run them before finalizing the workbook instead of defaulting to `Untested`.
12. Prefer real execution evidence from the nearest relevant test files so the workbook can show `Passed` or `Failed` rows whenever the repository already proves the behavior.
13. Never mark a UTCID as `Passed` or `Failed` without executed evidence that reasonably maps to that case; do not fabricate a best-case `100% pass`.

## Documentation workflow
- After writing or locating the tests, create the traceability documentation as a real `.xlsx` workbook by default.
- Do not create companion Markdown, JSON, TXT, or other note files unless the user explicitly asks for them.
- If a helper JSON file is needed to build the workbook, treat it as temporary and delete it after generation.
- When the user provides a matrix example/template, match that structure and wording as closely as possible, even if it implies a single consolidated use-case sheet instead of one sheet per function.
- For unit-test traceability matrices, keep the workbook content limited to the matrix itself plus the normal header/summary rows.
- Only output raw unit test code, discovery summaries, assumptions, or implementation-gap prose when the user explicitly asks for them.

## Function-first rules
- When the user gives a feature or a use case, first identify how many directly relevant logic-bearing functions implement it.
- Create test cases per function.
- Do not assume `1 sheet = 1 use case`.
- Default to `1 sheet = 1 function`.
- It is acceptable for one workbook to contain many functions from multiple use cases when they belong to the same feature or requested scope.
- Thin wrappers with no meaningful business logic may be documented as scanned and skipped instead of getting a dedicated sheet.

## Matrix rules
- Create one UTCID per test case: `UTCID01`, `UTCID02`, `UTCID03`, and so on.
- Use `O` to mark which conditions, confirms, and results apply to each UTCID.
- Keep the section order fixed: header section, summary section, matrix header, condition rows, confirm rows, result rows.
- Keep every CSV rectangular.
- Match the user's template ordering and wording as closely as possible when an example format is provided.

## Header section rules
- Include `Function Code`, `Function Name`, `Created By`, `Executed By`, `Lines of code`, `Lack of test cases`, and `Test requirement`.
- When documenting by function, use the actual function identifier as `Function Code`. If there is also a UC ID, keep that in the requirement text, feature context, or workbook grouping instead of replacing the function identity.
- Use the actual function or method name for `Function Name`.
- Leave `Executed By` blank unless execution ownership is known.
- Count only the function or method under test for `Lines of code`.
- Default `Lack of test cases` to `0` when the suite is intended to be complete. If known gaps remain, use the number of missing cases.
- Write `Test requirement` as a concise function-specific description of what is verified.

## Summary section rules
- Include `Passed`, `Failed`, `Untested`, `N`, `A`, `B`, and `Total Test Cases`.
- Prefer populated execution counts from real test runs whenever matching tests are available locally.
- If tests were not actually executed, set `Passed = 0`, `Failed = 0`, and `Untested = Total Test Cases`.
- Count `N`, `A`, and `B` from the generated tests for that function or module.

## Matrix rows
- Under `Condition`, include required preconditions and one row per distinct input value or state used in the tests.
- Under `Condition`, prefer only `Precondition`, `Action`, `Request status` or `State`, and `Input Variable`.
- Under `Confirm`, include only expected returns and exceptions.
- Do not add `Side effect`, `Message`, `Log`, `Audit`, `Quota`, `Notification`, or other collaborator/internal rows unless the user explicitly asks for them.
- Put failure outcomes under `Exception`, not under `Return`.
- Use `Return` only for successful or direct returned values and primary state outputs. When a use case mainly changes status, values like `status = PUBLIC_DRAFT` are valid `Return` rows.
- Under `Result`, include `Type(N : Normal, A : Abnormal, B : Boundary)`, `Passed/Failed`, `Executed Date`, and `Defect ID`.
- When a UTCID can be traced to an executed repository test, mark it `Passed` or `Failed` based on that real result instead of leaving it `Untested`.
- Use `Untested` for `Passed/Failed` unless the tests were actually executed.
- Use `MM/DD` for `Executed Date` only when the date is known. Otherwise leave it blank.
- Leave `Defect ID` blank unless the user provides one or explicitly asks for mock IDs.

## Workbook workflow
- When the workspace is writable, create a real `.xlsx` workbook as the primary output whenever the user asks for documentation, a matrix, Excel output, or a template like an `.xlsx` screenshot.
- Use the bundled script at `scripts/generate_traceability_xlsx.ps1` to build the workbook from a rectangular row matrix serialized as JSON.
- Default workbook location:
  1. `<workspace>/docs/<function-code-or-usecase>-traceability.xlsx` when a `docs` folder exists
  2. otherwise `<workspace>/<function-code-or-usecase>-traceability.xlsx`
- Default workbook shape:
  1. one workbook for the requested feature or scope when multiple functions are involved
  2. one sheet per function by default
  3. use one-sheet-per-use-case when the user explicitly asks for that layout or provides a concrete single-sheet example/template to follow
  4. extra workbooks are only needed when the user explicitly asks for separate files
- Do not leave helper build artifacts or companion explanation files in the workspace unless the user explicitly asks for them.
- If PowerShell execution policy blocks the script, rerun it with `powershell -NoProfile -ExecutionPolicy Bypass -File ...`.
- Always mention the absolute workbook path in the final response.
- If workbook creation is impossible, explain why briefly and still provide the CSV or Markdown matrix in the response.

## Output defaults
- Honor requests for only tests or only documentation when the user explicitly asks for that.
- When the user asks for documentation or a workbook, default to the `.xlsx` workbook only.
- Otherwise return both.
- When the user gives a requirement or use case, do not ask for code first if the repository is available. Search the codebase, find the relevant implementation, scan the flow, and proceed.
- When the user gives a requirement or use case and relevant test files already exist, run the closest matching test scope before finalizing the workbook so the result rows reflect actual execution.
- When the user gives a requirement or use case, default to deep coverage across all directly relevant methods and functions that implement the flow, then document them function by function.
- When no implementation can be found, say what is missing and provide only the highest-confidence documentation draft instead of inventing runnable tests. If the user requested Excel output, create a clearly marked draft workbook only when the assumptions are explicit.
