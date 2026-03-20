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
- Use the user's developer name when present. Leave `Created By` blank when it is not provided.
- Acknowledge briefly when the user is still defining the workflow and has not supplied code or a requirement yet.

## Requirement-first workflow
1. Extract identifiers, actors, actions, entities, state transitions, validations, and side effects from the requirement or use case.
2. Search the codebase for routes, controllers, services, DTOs, enums, status constants, repository methods, events, logs, UI labels, and text that match the requirement.
3. Trace the full relevant flow from the entry point to downstream collaborators. Do not stop at the first file match.
4. Build a scoped inventory of directly relevant units: controller methods, service methods, validators, guards, helpers, mappers, repository/query methods, UI handlers, and other functions with business logic.
5. Include subordinate methods and side-path logic that materially affect the use case, such as permission checks, validation helpers, state-transition branches, duplicate detection, repository lookups, logging, audit trails, notifications, and quota or usage tracking.
6. Test every directly relevant function or method that contains branching, validation, permission checks, state changes, calculations, mapping, or observable side effects.
7. Explicitly note thin wrappers or purely declarative code that were scanned but intentionally skipped.
8. State the assumption and continue when multiple plausible implementations exist instead of stalling.

## Unit test workflow
1. Analyze behavior, branches, preconditions, edge cases, exceptions, side effects, and boundaries for each in-scope function.
2. Match the existing project test framework when it is discoverable. Otherwise choose a conventional default for the language and note the assumption briefly.
3. Cover Normal (`N`), Abnormal (`A`), and Boundary (`B`) scenarios for each directly relevant function or method.
4. Mock downstream dependencies so the tests isolate the unit under test.
5. Assert returns, exceptions, state transitions, repository writes, emitted events, logs, visibility changes, notifications, permission outcomes, and other observable effects when relevant.
6. Group the output by function or file when the request started from a use case so the coverage stays readable.
7. For use-case requests, prefer a deep suite that covers the full in-scope chain rather than a shallow single-method sample.
8. Output raw unit test code in fenced code blocks.

## Documentation workflow
- After writing the tests, output the traceability documentation.
- Prefer Excel-friendly CSV inside fenced `csv` blocks. Use Markdown tables only when the user explicitly asks for them.
- When the request started from a use case and multiple functions are in scope, output:
  1. a short `Code Discovery Summary`
  2. an `In-Scope Units` list that names the methods and files tested
  3. unit test code grouped by function or file
  4. one traceability matrix per function or cohesive module by default
  5. one consolidated use-case matrix when the user asks for a single output sheet or workbook
- When the user asks for a detailed output doc, include discovery context, assumptions, implementation gaps, execution status, and remaining risks after the matrices.

## Matrix rules
- Create one UTCID per test case: `UTCID01`, `UTCID02`, `UTCID03`, and so on.
- Use `O` to mark which conditions, confirms, and results apply to each UTCID.
- Keep the section order fixed: header section, summary section, matrix header, condition rows, confirm rows, result rows.
- Keep every CSV rectangular.
- Match the user's template ordering and wording as closely as possible when an example format is provided.

## Header section rules
- Include `Function Code`, `Function Name`, `Created By`, `Executed By`, `Lines of code`, `Lack of test cases`, and `Test requirement`.
- Use a provided function ID or requirement ID as `Function Code` when available. Otherwise reuse the function name.
- Use the actual function or method name for `Function Name`.
- Leave `Executed By` blank unless execution ownership is known.
- Count only the function or method under test for `Lines of code`.
- Default `Lack of test cases` to `0` when the suite is intended to be complete. If known gaps remain, use the number of missing cases.
- Write `Test requirement` as a concise function-specific description of what is verified.

## Summary section rules
- Include `Passed`, `Failed`, `Untested`, `N`, `A`, `B`, and `Total Test Cases`.
- If tests were not actually executed, set `Passed = 0`, `Failed = 0`, and `Untested = Total Test Cases`.
- Count `N`, `A`, and `B` from the generated tests for that function or module.

## Matrix rows
- Under `Condition`, include required preconditions and one row per distinct input value or state used in the tests.
- Under `Confirm`, include expected returns, exceptions, and relevant logs or side effects.
- Under `Result`, include `Type(N : Normal, A : Abnormal, B : Boundary)`, `Passed/Failed`, `Executed Date`, and `Defect ID`.
- Use `Untested` for `Passed/Failed` unless the tests were actually executed.
- Use `MM/DD` for `Executed Date` only when the date is known. Otherwise leave it blank.
- Leave `Defect ID` blank unless the user provides one or explicitly asks for mock IDs.

## Workbook workflow
- When the workspace is writable, create a real `.xlsx` workbook by default in addition to the text output whenever the user asks for documentation, a matrix, Excel output, or a template like an `.xlsx` screenshot.
- Use the bundled script at `scripts/generate_traceability_xlsx.ps1` to build the workbook from a rectangular row matrix serialized as JSON.
- Default workbook location:
  1. `<workspace>/docs/<function-code-or-usecase>-traceability.xlsx` when a `docs` folder exists
  2. otherwise `<workspace>/<function-code-or-usecase>-traceability.xlsx`
- Default workbook shape:
  1. one summary sheet for the overall use case or function, following the user's template
  2. extra sheets or extra files only when the user explicitly asks for per-function workbook outputs
- If PowerShell execution policy blocks the script, rerun it with `powershell -NoProfile -ExecutionPolicy Bypass -File ...`.
- Always mention the absolute workbook path in the final response.
- If workbook creation is impossible, explain why briefly and still provide the CSV or Markdown matrix in the response.

## Output defaults
- Honor requests for only tests or only documentation when the user explicitly asks for that.
- Otherwise return both.
- When the user gives a requirement or use case, do not ask for code first if the repository is available. Search the codebase, find the relevant implementation, scan the flow, and proceed.
- When the user gives a requirement or use case, default to deep coverage across all directly relevant methods and functions that implement the flow.
- When no implementation can be found, say what is missing and provide only the highest-confidence documentation draft instead of inventing runnable tests. If the user requested Excel output, create a clearly marked draft workbook only when the assumptions are explicit.
