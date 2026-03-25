---
name: codebase-sequence-diagram
description: Generate PlantUML sequence diagrams from a user use case or feature flow by scanning the repository, locating the real implementation, tracing the end-to-end call chain, and writing a fully numbered monochrome diagram with human-readable messages, balanced activate/deactivate blocks, and alt/else branches. Use when the user asks for a sequence diagram, flow trace, or code-backed interaction diagram from UI actions, controllers, services, repositories, databases, or external clients.
---

# Codebase Sequence Diagram

## Core behavior
- Start from the user's use case, screen action, or feature flow.
- Search the repository for the real implementation before drawing the diagram.
- Trace the end-to-end call chain instead of stopping at the first matching file.
- Prefer high-confidence implementation details from code over assumptions.
- Load [references/monochrome-sequence-template.md](references/monochrome-sequence-template.md) before drafting or checking the final diagram.

## Discovery workflow
1. Extract the actor, page or screen, user action, entities, validations, state changes, and expected outcomes from the request.
2. Search the codebase with `rg` for UI labels, page names, button text, controller methods, service names, DTOs, repository calls, status enums, and entities that match the use case.
3. Identify the true entry point in the UI or backend.
4. Trace downstream collaborators in execution order: controller or handler, services, repositories or ORM, database, and external clients.
5. Record the branches that materially change behavior, such as not found, validation failure, empty results, permission denial, or upstream API failure.
6. When multiple plausible implementations exist, choose the highest-confidence flow, say which file or method anchored the decision, and note the assumption briefly.

## Diagram authoring workflow
1. Start with `@startuml`, a clear `title`, and the exact monochrome skinparams from the reference file.
2. Declare participants with readable roles such as `actor`, `boundary`, `participant`, and `database`.
3. Number every single message sequentially as `1.`, `2.`, `3.`, and continue the numbering across `alt` and `else` branches.
4. Use human-readable interaction labels. Convert routes, SQL, and raw API paths into business-language descriptions.
5. Split UI behavior into separate chronological steps. Navigation, page load, field entry, and button click must be distinct messages when they are separate user actions.
6. Add `activate` immediately after a participant starts handling work and `deactivate` when that unit of work ends.
7. Use `alt` / `else` for meaningful branches and return the user-visible outcome back through the page to the actor.
8. Use self-calls sparingly for internal checks or transformations. When a participant calls itself, add a second nested activation bar by placing `activate <Participant>` immediately after the self-call and a matching `deactivate <Participant>` when that nested work finishes.

## Hard rules
- Keep the diagram entirely black and white. Do not add themes, colored skinparams, or decorative styling.
- Do not write raw API paths such as `PATCH /api/v1/resource` in message labels.
- Do not merge separate UI actions into one numbered step.
- Do not skip activation bars for participants that actively process work.
- Do not leave an `activate` without a matching `deactivate`.
- Do not draw a self-call without the extra nested activation bar it requires.
- Do not invent hidden branches unless they are explicit in code or clearly required by the request.

## Output defaults
- Return a brief discovery summary only when it helps explain the traced flow or any assumption.
- Then return one fenced `plantuml` block containing the final diagram.
- If the implementation cannot be found, report what was searched and provide only a clearly marked draft when the user still wants a best-effort diagram.
