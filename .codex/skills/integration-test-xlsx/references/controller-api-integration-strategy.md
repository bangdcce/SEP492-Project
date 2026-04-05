# Controller/API Integration Strategy

Use this reference when the source material is about controllers, REST endpoints, guards, middleware, pipes, services, transactions, or API/database flows.

## Mindset

- Treat integration testing as checking whether components fit together, not whether one method works in isolation.
- For controller-driven APIs, model the flow as `HTTP request -> middleware/guard/pipe -> controller -> service -> database` and any downstream boundary that is intentionally in scope.
- Avoid decomposing cases by helper method. Default to endpoint or user-flow boundaries.

## Case Selection

Default to `3-4` high-value cases per endpoint unless the user explicitly asks for exhaustive coverage:

- Happy path end to end.
- System constraint or transaction failure path, including rollback expectations when relevant.
- Security or authorization path where middleware or guard blocks the request before controller logic runs.
- Response or data-contract path confirming persisted data is returned in the JSON shape expected by the consumer.

Prefer risk-based selection. Critical paths such as authentication, payment, approval, and security-sensitive writes deserve the highest integration coverage.

If the user asks how to balance test types, prefer a modern testing-trophy style emphasis on integration confidence: keep fast unit tests for dense business logic, use a smaller but high-confidence set of integration tests for controller/service/database seams, and reserve end-to-end tests for only the most critical user journeys.

When the request is about frontend/backend compatibility or inter-service payload guarantees, treat contract validation as first-class. Add cases that confirm status code, field names, nullability, enum values, and error-envelope shape expected by the consumer.

## Must-Catch Scenarios

- Database constraints such as `UNIQUE`, foreign key, `NOT NULL`, and transaction rollback behavior.
- Type conversion across route params, query params, DTO transforms, and persistence types.
- Authentication and authorization with real token decoding or guard behavior when available.
- Error response format so failures return the approved API shape instead of leaking stack traces or raw database errors.

## Evidence Expectations

When execution evidence exists, prefer:

- Real HTTP invocation evidence such as `supertest`, `TestRestTemplate`, `requests`, or equivalent.
- Real test-database evidence such as seeded records, committed rows, rollback outcome, or post-condition queries.
- Response status, headers, and JSON body snapshots.
- Post-condition checks that prove the database changed, or did not change, as expected.
- Isolated real infrastructure such as Testcontainers-backed PostgreSQL, Redis, or MongoDB when containers are available.

Do not mark a controller integration case as `Pass` from mocked service behavior alone.

AI-assisted edge-case generation is acceptable for brainstorming additional scenarios, but generated cases still need real execution evidence before they can be marked `Pass`.

## Tooling Heuristics

- For NestJS or other Node.js APIs, prefer `supertest` against a real app instance plus a dedicated test database. Use Testcontainers when containerized infrastructure is available.
- For Spring Boot or Java APIs, prefer `TestRestTemplate`, `MockMvc`, or equivalent app-boundary tooling plus Testcontainers-backed infrastructure when possible.
- If the environment cannot run real infrastructure, still write the workbook with `Untested` or explicit evidence gaps instead of pretending mocked execution proved integration behavior.

## Workbook Mapping

When converting endpoint flows into the strict workbook JSON:

- Use `features[]` for a module or bounded feature area.
- Use `functions[]` for an endpoint capability or route-level function.
- Use `sections[]` to group cases for that endpoint capability.
- Put request setup, auth state, and seed data in `procedure` and `dependencies`.
- Put HTTP status, response JSON requirements, and database side effects in `expectedResults`.
- Put observed DB state, rollback result, and returned payload shape in `actualResults`.
- Use `note` for contract mismatches, flaky infrastructure, or partial evidence gaps.
