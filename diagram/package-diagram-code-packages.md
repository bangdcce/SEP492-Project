# 2.3 Package Diagram - Code Packages

This table matches the simplified layered diagram.

| No | Package | Description |
| --- | --- | --- |
| 01 | `Presentation Layer` | Contains all frontend packages responsible for user interaction and interface rendering. |
| 02 | `Pages & Shared UI` | Contains top-level pages, layouts, reusable UI components, hooks, and frontend helpers from `client/src/pages` and `client/src/shared`. |
| 03 | `Feature Modules` | Contains the main client-side feature implementations from `client/src/features`. |
| 04 | `Business Logic Layer` | Contains backend packages that process requests and apply business rules. |
| 05 | `Controllers` | Contains NestJS controllers that receive requests and return responses. |
| 06 | `Services` | Contains backend service classes for application logic such as authentication, matching, project processing, disputes, notifications, and review handling. |
| 07 | `Gateways` | Contains realtime communication logic such as workspace chat and event-driven WebSocket interactions. |
| 08 | `Data Access Layer` | Contains technical packages that support backend persistence and shared infrastructure access. |
| 09 | `Common & Config` | Contains shared backend utilities and configuration packages from `server/src/common` and `server/src/config`. |
| 10 | `TypeORM Access` | Contains TypeORM persistence support from `server/src/database`, including entities, migrations, and repository-level access. |
| 11 | `Data / External Layer` | Contains databases, object storage, cache services, and third-party integrations used by the system. |
| 12 | `Supabase PostgreSQL` | Stores relational application data. |
| 13 | `Supabase Storage` | Stores uploaded files such as KYC documents and dispute evidence. |
| 14 | `Redis` | Supports realtime event distribution and socket scaling. |
| 15 | `External Integrations` | Groups third-party integrations such as SMTP, Google services, and AI providers. |
