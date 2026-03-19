# Monochrome PlantUML Sequence Template

## Required header

```plantuml
@startuml
title [Replace with use case title]

skinparam monochrome true
skinparam defaultFontColor black
skinparam ArrowColor black
skinparam sequence {
    ActorFontColor black
    ParticipantFontColor black
    TitleFontColor black
    GroupFontColor black
    GroupBorderColor black
}
```

## Authoring skeleton

```plantuml
actor "Client" as Actor
boundary "Page" as Page
participant "Controller" as Controller
participant "Service" as Service
database "Database" as DB

Actor -> Page : 1. Open [Page]
activate Actor
activate Page

Page --> Actor : 2. Display [Screen]
deactivate Page
deactivate Actor

Actor -> Page : 3. Click [Action]
activate Actor
activate Page

Page -> Controller : 4. Send request
activate Controller

Controller -> Service : 5. Process request
activate Service

Service -> DB : 6. Query data
activate DB
DB --> Service : 7. Return data
deactivate DB

alt [Success]
    Service --> Controller : 8. Return result
else [Failure]
    Service --> Controller : 9. Return error
end
deactivate Service

Controller --> Page : 10. Return response
deactivate Controller

Page --> Actor : 11. Show result
deactivate Page
deactivate Actor
@enduml
```

## Self-call pattern

```plantuml
Page -> Page : 29. Detect meaningful changes and prepare autosave draft
activate Page
deactivate Page
```

Use this when the participant is already active and performs nested internal work. The extra `activate` / `deactivate` pair creates the second activation bar for the self-call.

## Pre-flight checks
- Start every arrow label with a unique incremental number and never reset the counter inside `alt` / `else`.
- Use descriptive business-language labels such as `Submit request` or `Show validation error`, not raw endpoints.
- Split navigation, page display, typing, and clicking into distinct steps when they happen separately.
- Add `activate` when a participant begins work and `deactivate` when that work ends.
- For any self-call like `Page -> Page`, add a second nested `activate` / `deactivate` pair so the inner activation bar is visible.
- Check every participant for balanced activation bars, including self-calls and nested work.
- Use `alt` / `else` for meaningful branches such as not found, validation failure, empty result, or external-call failure.
- Keep the final diagram fully monochrome with no blue or other colored styling.
