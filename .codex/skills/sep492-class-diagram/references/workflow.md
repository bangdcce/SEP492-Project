# Workflow Reference

## Core command sequence

Run these commands from:

`C:\Users\ASUS\Desktop\InterDev\SEP492-Project\diagram\class_diagrams`

```powershell
node .\make_compact_puml.mjs . . --overwrite
node .\puml_to_drawio.mjs .\<use_case>_class_diagram_compact.puml --out-dir ..\drawio-class-diagram-compact --overwrite
node .\audit_class_diagrams.mjs
```

## If draw.io conversion fails with ENOENT

This repo occasionally reports a missing compact file even when the file exists. Check that the compact file is present, then rerun the conversion with the exact filename:

```powershell
Get-ChildItem -Filter '<use_case>*'
node .\puml_to_drawio.mjs .\<use_case>_class_diagram_compact.puml --out-dir ..\drawio-class-diagram-compact --overwrite
```

## Minimal class selection checklist

- Keep the initiating page or modal.
- Keep the API helper/service actually called by the UI.
- Keep the backend controller and service that handle the request.
- Keep only the entities that materially shape the use case data or decisions.
- Drop unrelated helpers, wrappers, and neighboring flows.

## Naming cautions

- Do not prefix class names with `pages.` or `figma.`.
- Do not add `App` or `ROUTES` unless the route container is essential to the use case.
- Prefer exact code names such as `ProjectRequestDetailsPage`, `wizardService`, `MatchingController`.

## Common SEP492 patterns

- Discovery/list/detail pages often reuse API hooks from other features; verify this before inventing a dedicated detail controller call.
- Many use cases in request management start in `client/src/features/project-requests` or `client/src/features/requests`.
- Matching flows for broker/freelancer recommendations often go through `wizardService` and `MatchingController`, not `ProjectRequestsController`.
