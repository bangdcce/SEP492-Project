# InterDev Boilerplate

This is a client-server boilerplate for InterDev using NestJS, React, and PostgreSQL.

## Project Structure

- `client`: React frontend (Vite + TypeScript)
- `server`: NestJS backend (TypeScript + TypeORM)

## Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)

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

3.  **Database Setup**

    Ensure PostgreSQL is running and create a database named `interdev`.

    ```bash
    # Start PostgreSQL (if using Homebrew)
    brew services start postgresql@14

    # Create Database
    createdb interdev
    ```

4.  **Environment Variables**

    The project uses a `.env` file in the root directory.
    A default `.env` file is provided. You can modify it if needed.

    ```env
    DB_USER=maxwell
    DB_PASSWORD=
    DB_NAME=interdev
    DB_PORT=5432
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
