# Local Docker Deploy

This compose setup runs the project like a local deployment:

- `interdev-web`: Vite production build served by nginx at `http://localhost:8080`
- `interdev-api`: NestJS production build at `http://localhost:3000`
- `interdev-redis`: optional Redis service for Socket.IO multi-instance mode

## Run

```bash
docker compose -f docker-compose.local.yml up -d --build
```

Open:

- App: `http://localhost:8080`
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api-docs`
- Liveness: `http://localhost:3000/health/live`

## Logs

```bash
docker compose -f docker-compose.local.yml logs -f interdev-api
docker compose -f docker-compose.local.yml logs -f interdev-web
```

## Stop

```bash
docker compose -f docker-compose.local.yml down
```

Use `-v` only when you also want to delete Docker volumes:

```bash
docker compose -f docker-compose.local.yml down -v
```

## Optional Redis

Redis is not required for the default local demo. The backend uses single-instance sockets when
`SOCKET_REDIS_ENABLED=false`.

To test Redis-backed sockets:

```bash
SOCKET_REDIS_ENABLED=true docker compose --profile redis -f docker-compose.local.yml up -d --build
```

## Notes

- Runtime secrets are read from `server/.env` through Compose `env_file`; they are not baked into the Docker image.
- The backend container intentionally does not copy `server/secrets`, so it serves HTTP locally instead of self-signed HTTPS.
- If the API exits with `password authentication failed for user "postgres"`, reset/update the Supabase database password in `server/.env`, then run the compose command again.
