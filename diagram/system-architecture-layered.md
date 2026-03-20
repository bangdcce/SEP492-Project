# 2.2 System Architecture

This version follows the same layered idea as the sample diagram, but it is adapted to the InterDev application architecture.

## Suggested Layers

| No | Layer / Component | Description |
| --- | --- | --- |
| 01 | `Presentation Layer` | Contains the frontend user interface of the system. |
| 02 | `Front End` | Implemented in `client/src` using React and Vite. It handles user interaction, pages, features, and UI rendering. |
| 03 | `Business Logic Layer` | Contains backend logic that processes requests and coordinates application behavior. |
| 04 | `Controllers` | Implemented in NestJS modules under `server/src/modules`. Controllers receive HTTP requests from the frontend and return responses. |
| 05 | `Services` | Implemented as NestJS services. They contain the core business rules, processing logic, and workflow handling of the application. |
| 06 | `Gateways` | Handles realtime communication such as WebSocket events, chat updates, and dispute/hearing live interactions. |
| 07 | `Data Access Layer` | Contains the logic responsible for reading and writing application data. |
| 08 | `TypeORM Access` | Implemented in `server/src/database` with entities and repository-based database access. |
| 09 | `Data Layer` | Contains the actual data storage technologies used by the system. |
| 10 | `Supabase PostgreSQL` | Main relational database used to store system data such as users, projects, disputes, tasks, and subscriptions. |
| 11 | `Supabase Storage` | Stores uploaded files such as KYC documents and dispute evidence. |
| 12 | `Redis` | Supports realtime communication and scaling for socket-based features. |

## Relationship Explanation

- `Front End <-> Controllers`
  The frontend sends requests to backend controllers and receives responses.

- `Controllers <-> Services`
  Controllers delegate processing to services, and services return processed results.

- `Services <-> Gateways`
  Services coordinate realtime events with gateways for chat, hearing room updates, and live notifications.

- `Services <-> TypeORM Access`
  Services use the data access layer to query, insert, update, and manage persistent data.

- `TypeORM Access <-> Supabase PostgreSQL`
  The database access layer reads from and writes to the PostgreSQL database.

- `Services <-> Supabase Storage`
  Services upload, fetch, and manage files stored in Supabase Storage.

- `Gateways <-> Redis`
  Gateways use Redis for pub/sub and realtime socket scaling.

## Short Report Description

`The system architecture of InterDev follows a layered structure consisting of the Presentation Layer, Business Logic Layer, Data Access Layer, and Data Layer. The Presentation Layer contains the React-based frontend. The Business Logic Layer is implemented with NestJS controllers, services, and realtime gateways. The Data Access Layer is implemented using TypeORM entities and repository-based access under server/src/database. The Data Layer consists of Supabase PostgreSQL, Supabase Storage, and Redis, which support persistent storage, file handling, and realtime communication respectively.`
