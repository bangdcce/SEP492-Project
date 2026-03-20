# Package Diagram Redraw Guide

Use this version if you want something slightly more detailed than a very simple layered diagram, but still easy to redraw by hand.

## Draw 4 Main Layer Boxes

1. `Presentation Layer`
2. `Business Logic Layer`
3. `Data Access Layer`
4. `Data / External Layer`

## Put These Boxes Inside

Inside `Presentation Layer`:

- `Pages & Shared UI`
- `Feature Modules`

Use these notes inside the boxes:

- `Pages & Shared UI` = `client/src/pages`, `client/src/shared`
- `Feature Modules` = `client/src/features`

Inside `Business Logic Layer`:

- `Controllers`
- `Services`
- `Gateways`

Use these notes inside the boxes:

- `Controllers` = NestJS controllers
- `Services` = `auth`, `users`, `wizard`, `matching`, `projects`, `project-specs`, `contracts`, `tasks`, `disputes`, `calendar`, `notifications`, `review`
- `Gateways` = `workspace-chat`, realtime events

Inside `Data Access Layer`:

- `Common & Config`
- `TypeORM Access`

Use these notes inside the boxes:

- `Common & Config` = `server/src/common`, `server/src/config`
- `TypeORM Access` = `server/src/database`, entities, migrations, repository access

Inside `Data / External Layer`:

- `Supabase PostgreSQL`
- `Supabase Storage`
- `Redis`
- `External Integrations`

Use these notes inside the boxes:

- `External Integrations` = `SMTP`, `Google Services`, `AI Providers`

## Only Draw These Relationships

- `Pages & Shared UI` <-> `Feature Modules` : `Render / Reuse UI`
- `Feature Modules` <-> `Controllers` : `Request / Response`
- `Controllers` <-> `Services` : `Delegate / Return`
- `Services` <-> `Gateways` : `Realtime Events`
- `Services` <-> `Common & Config` : `Shared Utils / Config`
- `Services` <-> `TypeORM Access` : `Query / Update`
- `TypeORM Access` <-> `Supabase PostgreSQL` : `Read / Write`
- `Services` <-> `Supabase Storage` : `Upload / Fetch Files`
- `Gateways` <-> `Redis` : `Pub/Sub / Socket Scaling`
- `Services` <-> `External Integrations` : `Email / OAuth / AI`

## Short Report Description

`The system is organized into four layers: Presentation Layer, Business Logic Layer, Data Access Layer, and Data / External Layer. The Presentation Layer contains the frontend pages, shared UI, and feature modules. The Business Logic Layer contains controllers, services, and gateways that handle requests, business rules, and realtime communication. The Data Access Layer contains common configuration support and TypeORM-based persistence access. The Data / External Layer contains Supabase PostgreSQL, Supabase Storage, Redis, and external integrations such as SMTP, Google services, and AI providers.`
