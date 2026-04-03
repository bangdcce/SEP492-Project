---
name: integration-test-xlsx
description: Generate integration or system test Excel workbooks from feature specs, function-level test-case tables, and completed execution evidence. Use when Codex needs to turn a requirement sheet or pasted test-case table into a real `.xlsx` workbook that follows the repository's strict Test Case Document template with no testing-round matrix, especially when the workbook must be organized by feature and function instead of by use case.
---

# Integration Test XLSX

Use the bundled strict workbook template at `assets/test-case-document-template.xlsx` as the default layout.

Default information model:

- `1 sheet = 1 feature/module`, not `1 sheet = 1 use case`
- Inside each feature sheet, group test cases by `function`
- A function may trace to one or many UC IDs
- UC IDs stay as traceability metadata only; they are not the default sheet boundary

## Core behavior

- Normalize free-form user input into the strict JSON shape in `references/input-shape.md` **in-memory**.
- Default to the strict `Cover`, `Test case List`, `FeatureN`, and `Test Report` workbook layout.
- Treat each `FeatureN` sheet as a feature-level document that may contain multiple UC flows.
- Prefer `sections[]` as function groups inside a feature sheet. In most cases, use one section per function.
- Preserve the template sheet structure and overwrite workbook values deterministically with the bundled script.
- Generate a single real `.xlsx` file (no companion JSON artifacts).
- Fill concrete result columns directly on each case: `Actual Results`, `Result`, `Test date`, and `Tester`.
- Default the tester name to `SonNT` when a case omits `tester` or still uses the placeholder `Codex`.
- Use `Pass`, `Fail`, `Untested`, or `N/A` for strict-template case results.
- Prefer thorough Normal/Alternative/Boundary/Exception coverage, but only mark `Pass` when it is supported by verified evidence or explicit user-provided execution results.
- Preserve UC traceability with `functions[].relatedUseCases` and/or `testCases[].useCaseRefs` instead of splitting sheets per UC.
- Support the legacy round-based template only when the user explicitly provides that older workbook layout.

## Workflow

1. Extract project metadata, feature/module boundaries, functions inside each feature, and detailed test cases from the user input.
2. Re-group the source material into `feature -> function -> test cases`, even when the source artifacts are written by use case.
3. Convert the extracted content into JSON that matches `references/input-shape.md` (do not write it to `docs/`).
4. Put each feature/module into one `FeatureN` sheet and each function into one `sections[]` group unless the user explicitly asks for another layout.
5. Keep UC references only as traceability tags in the function or case metadata.
6. Choose an output path under `docs/interation/`:
   - `docs/interation/fn-XX-<function-slug>-integration-test.xlsx` for function-scoped work
   - `docs/interation/<feature-slug>-integration-test.xlsx` for feature-scoped work
7. Run (prefer stdin input so no `*-input.json` is created):

```powershell
@'
{ ...payload matching references/input-shape.md... }
'@ | node .codex/skills/integration-test-xlsx/scripts/generate_integration_test_xlsx.cjs --input - --output <output.xlsx>
```

8. If the user explicitly wants the older round-based report, pass the older template with `--template`.
9. Verify the workbook by reopening it with `xlsx` and confirming the expected sheet names, feature count, and filled required cells.
10. **Pass stage (completion gate):** the final answer returns only the absolute path to the `.xlsx` workbook, and no helper files (JSON inputs, scratch notes) are left in `docs/`.

## Limits

- The bundled strict template currently includes `2` visible `FeatureN` sheets.
- Do not use testing rounds unless the user explicitly asks for the legacy layout.
- Do not default to `1 UC = 1 sheet`; collapse related UCs into their owning feature and function groups.
- If the request exceeds the template capacity, extend the template or split the workbook instead of silently dropping data.

## References

- Read `references/input-shape.md` for the strict JSON contract.
- Read `references/example-user-authentication-input.json` for a concrete feature/function-based payload sample.
- Read `docs/interation/` (integration) and `docs/unit/` (unit) for existing workbooks that can be reused or aligned to the relevant feature/module.
