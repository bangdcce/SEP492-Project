# InterDev Boilerplate

This is a client-server boilerplate for InterDev using NestJS, React, and PostgreSQL.

## Project Structure

- `client`: React frontend (Vite + TypeScript)
- `server`: NestJS backend (TypeScript + TypeORM)
- `docker-compose.yml`: PostgreSQL and pgAdmin configuration

## Prerequisites

- Node.js (v18+)
- Docker & Docker Compose

## Setup

1.  **Clone the repository** (if you haven't already)

2.  **Install Dependencies**

    ```bash
    # Server
    cd server
    npm install

    # Client
    cd ../client
    npm install
    ```

3.  **Environment Variables**

    The project uses a `.env` file in the root directory for Docker Compose and the server.
    A default `.env` file is provided. You can modify it if needed.

    ```env
    DB_USER=postgres
    DB_PASSWORD=postgres
    DB_NAME=interdev
    DB_PORT=5432
    PGADMIN_EMAIL=admin@admin.com
    PGADMIN_PASSWORD=admin
    PGADMIN_PORT=5050
    ```

4.  **Start Database**

    ```bash
    docker-compose up -d
    ```

5.  **Start Server**

    ```bash
    cd server
    npm run start:dev
    ```

    The server will run on `http://localhost:3000`.

6.  **Start Client**

    ```bash
    cd client
    npm run dev
    ```

    The client will run on `http://localhost:5173`.

## Technologies

-   **Backend**: NestJS, TypeORM, PostgreSQL
-   **Frontend**: React, Vite, TypeScript, Axios
-   **DevOps**: Docker Compose
