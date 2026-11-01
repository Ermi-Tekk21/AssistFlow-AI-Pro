# AssistFlow AI

AssistFlow AI is a personal AI executive assistant that enables users to manage tasks and reminders using natural language, receive Telegram notifications and daily briefings, and manage Google Calendar meetings with Google Meet links.

## Prerequisites

- **Node.js**: v20.x or later
- **Docker & Docker Compose**: For local PostgreSQL, pgAdmin, and n8n services

## Project Structure

```
AssistFlow-AI-Prp/
├── backend/
│   ├── migrations/               # TypeORM schema migrations
│   ├── src/
│   │   ├── config/               # Environment & database configuration (env.ts, database.ts)
│   │   ├── entities/             # TypeORM database entities (User, Task, Reminder, CalendarEvent)
│   │   ├── app.ts                # Express application definition & middleware
│   │   └── server.ts             # Server entry point & DB connection initialization
│   ├── tests/                    # Unit and integration test suites
│   ├── .env.example              # Placeholder environment variables
│   ├── package.json
│   └── tsconfig.json
├── automation/                   # n8n workflows and configurations
├── frontend/                     # React + TypeScript frontend application
├── docs/                         # Specification and implementation briefs
├── docker-compose.yml            # PostgreSQL, pgAdmin, and n8n container definitions
└── README.md
```

## Getting Started

### 1. Start Infrastructure Services

Start the PostgreSQL, pgAdmin, and n8n containers:
```bash
docker compose up -d
```
Default PostgreSQL port mapped to host: `5435`.

### 2. Configure Environment Variables

Copy the example environment file and adjust variables if needed:
```bash
cp backend/.env.example backend/.env
```
Ensure your database credentials match `docker-compose.yml`:
- `DB_HOST`: `127.0.0.1`
- `DB_PORT`: `5435`
- `DB_USERNAME`: `assistflow_ai_pro_user`
- `DB_PASSWORD`: `1234567890`
- `DB_DATABASE`: `assistflow_ai_pro_db`

### 3. Run Database Migrations

Apply database migrations:
```bash
cd backend
npm run migration:run
```

Check migration status:
```bash
npm run migration:show
```

### 4. Run Tests

Execute unit and integration tests:
```bash
npm test
```

### 5. Build and Run Backend

To run in development mode with live reload:
```bash
npm run dev
```

To build TypeScript:
```bash
npm run build
```

To start the production build:
```bash
npm start
```

Health check verification:
```bash
curl http://localhost:3000/health
# {"status":"ok","service":"AssistFlow AI"}
```
