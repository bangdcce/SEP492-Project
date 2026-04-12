---
name: sep492-class-diagram
description: Create or update class diagrams for SEP492-Project use cases using the repo's PlantUML -> compact -> draw.io pipeline. Use when Codex needs to add, fix, or regenerate class diagrams under diagram/class_diagrams, especially when the diagram must reflect real code flow, use real code symbols, stay minimal, pass audit_class_diagrams.mjs, and produce compact .drawio output.
---

# SEP492 Class Diagram

## Overview

Create class diagrams that match SEP492-Project code flow exactly, stay minimal, and pass the repository audit and generation pipeline.

## Workflow

1. Find the real use-case flow in code before drawing anything.
   - Search the page or component that starts the use case.
   - Trace the API helper or service call.
   - Trace the controller and service on the backend.
   - Only include classes that materially participate in the target use case.

2. Keep the diagram focused on one use case.
   - Do not mix adjacent flows such as invite, profile, modal, or review unless the requested use case actually depends on them.
   - If the UI reuses an existing list hook instead of a dedicated detail endpoint, reflect that honestly.

3. Use real code symbols.
   - Prefer exact class, module, and component names from code.
   - Avoid pseudo prefixes such as `pages.` or `figma.`.
   - Avoid invented facade names that do not exist in code unless the repo already uses that convention.

4. Omit unnecessary infrastructure.
   - Skip `App`, `ROUTES`, guards, socket classes, or wrapper components unless they are central to the use case.
   - Skip entities that do not help explain the flow.
   - Keep entities that materially shape the returned list or detail data.

5. Write the source diagram in `diagram/class_diagrams/<use_case>_class_diagram.puml`.

6. Regenerate the derived artifacts.
   - Run `make_compact_puml.mjs`.
   - Run `puml_to_drawio.mjs`.
   - Run `audit_class_diagrams.mjs`.

7. If `puml_to_drawio.mjs` throws `ENOENT` for a compact file that does exist, rerun it against the exact compact filename. In this repo, the second run often succeeds.

## Diagram Rules

- Title format: `<Use Case> - Class Diagram`
- Keep monochrome styling consistent with the existing repo diagrams.
- Use concise class members that explain the use case.
- If a class or module has fewer than 10 relevant members, list them all.
- If it has more than 10, list up to 10 and then add `...`.
- Prefer dependencies and associations that explain the flow; remove edges that only add clutter.
- If the layout splits into disconnected clusters, add the missing cross-layer dependency only if it reflects a real call path.

## Repo Paths

- Source diagrams: `diagram/class_diagrams`
- Compact draw.io output: `diagram/drawio-class-diagram-compact`
- Audit report: `diagram/class_diagrams/audit_class_diagrams_report.md`

Read [references/workflow.md](references/workflow.md) for exact commands and repo-specific cautions.
