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

---

## Task Management API (Phase 1)

All endpoints under `/api/tasks` require user authentication passed via the `x-user-id` header (or `Authorization: Bearer <user_id>`).

### Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/tasks` | Create a new task |
| `GET` | `/api/tasks` | List/filter tasks with deterministic ordering |
| `GET` | `/api/tasks/:id` | Retrieve task details by ID |
| `PATCH` | `/api/tasks/:id` | Update task fields (title, description, priority, dueAt, status) |
| `POST` | `/api/tasks/:id/complete` | Mark task as completed |
| `DELETE` | `/api/tasks/:id` | Delete task |

### API Usage Examples

#### 1. Create a Task
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "x-user-id: 32628984-366b-4c22-8995-3222734d51bf" \
  -d '{
    "title": "Prepare quarterly budget report",
    "description": "Consolidate expense sheets from finance",
    "priority": "high",
    "dueAt": "2026-11-15T18:00:00.000Z"
  }'
```

Response (`201 Created`):
```json
{
  "data": {
    "id": "e2d9787e-34d0-44c5-b644-2e783365b6d4",
    "userId": "32628984-366b-4c22-8995-3222734d51bf",
    "title": "Prepare quarterly budget report",
    "description": "Consolidate expense sheets from finance",
    "priority": "high",
    "status": "pending",
    "dueAt": "2026-11-15T18:00:00.000Z",
    "completedAt": null,
    "createdAt": "2026-11-01T14:14:00.000Z",
    "updatedAt": "2026-11-01T14:14:00.000Z"
  }
}
```

#### 2. List & Filter Tasks
```bash
curl -X GET "http://localhost:3000/api/tasks?status=pending&priority=high&sortBy=dueAt&sortOrder=ASC&limit=10" \
  -H "x-user-id: 32628984-366b-4c22-8995-3222734d51bf"
```

Response (`200 OK`):
```json
{
  "data": [ ... ],
  "meta": {
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}
```

#### 3. Mark Task as Completed
```bash
curl -X POST http://localhost:3000/api/tasks/e2d9787e-34d0-44c5-b644-2e783365b6d4/complete \
  -H "x-user-id: 32628984-366b-4c22-8995-3222734d51bf"
```

Response (`200 OK`):
```json
{
  "data": {
    "id": "e2d9787e-34d0-44c5-b644-2e783365b6d4",
    "status": "completed",
    "completedAt": "2026-11-01T14:15:30.000Z"
  }
}
```

---

## Reminder Management API (Phase 2)

All endpoints under `/api/reminders` require authentication via `x-user-id` header (or `Authorization: Bearer <user_id>`).

### Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/reminders` | Create standalone or task/calendar-linked reminder |
| `GET` | `/api/reminders` | List/filter reminders chronologically |
| `GET` | `/api/reminders/:id` | Get reminder by ID with relations |
| `PATCH` | `/api/reminders/:id` | Reschedule or update reminder details |
| `POST` | `/api/reminders/:id/snooze` | Snooze reminder (reschedule by minutes or explicit time) |
| `POST` | `/api/reminders/:id/cancel` | Cancel reminder |

### Domain Rules & Invariants

1. **Future Scheduling**: `scheduledAt` must be a future instant. Past dates are rejected with `400 Bad Request`.
2. **Timezone Correctness**: Validates IANA timezone (defaults to `Africa/Addis_Ababa`).
3. **Mutual Exclusivity**: A reminder may link to a `taskId` OR a `calendarEventId`, but **never both simultaneously** (enforced by Zod schema and PostgreSQL `CHECK` constraint).
4. **Snooze as Rescheduling**: Snoozing updates `scheduledAt` and ensures status is reset to `scheduled` without creating duplicate records.
5. **Terminal State Protection**: Cancelled or already Sent reminders cannot be rescheduled or modified.

### API Usage Examples

#### 1. Create a Standalone Reminder
```bash
curl -X POST http://localhost:3000/api/reminders \
  -H "Content-Type: application/json" \
  -H "x-user-id: 32628984-366b-4c22-8995-3222734d51bf" \
  -d '{
    "title": "Call accountant regarding tax declaration",
    "scheduledAt": "2026-11-05T14:00:00.000Z",
    "timezone": "Africa/Addis_Ababa"
  }'
```

#### 2. Snooze a Reminder
```bash
curl -X POST http://localhost:3000/api/reminders/REMINDER_UUID/snooze \
  -H "Content-Type: application/json" \
  -H "x-user-id: 32628984-366b-4c22-8995-3222734d51bf" \
  -d '{
    "snoozeMinutes": 15
  }'
```

#### 3. Cancel a Reminder
```bash
curl -X POST http://localhost:3000/api/reminders/REMINDER_UUID/cancel \
  -H "x-user-id: 32628984-366b-4c22-8995-3222734d51bf"
```

---

## Confirmation Workflow API (Phase 3)

The Confirmation subsystem enforces the non-negotiable rule: **every state-changing mutation must be proposed and explicitly confirmed before execution**.

All endpoints under `/api/confirmations` require authentication via `x-user-id` header (or `Authorization: Bearer <user_id>`).

### Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/confirmations/propose` | Propose a mutation without executing it |
| `GET` | `/api/confirmations` | List pending actions (supports `?activeOnly=true`) |
| `GET` | `/api/confirmations/:id` | Retrieve proposal details by ID |
| `POST` | `/api/confirmations/:id/confirm` | Concurrency-safe, single-use confirmation & execution |
| `POST` | `/api/confirmations/:id/reject` | Reject/cancel proposal |
| `POST` | `/api/confirmations/reply` | Quick reply ("yes"/"no") with unambiguous resolution |

### Domain Rules & Invariants

1. **Zero Premature Mutation**: Proposing an action saves a `PendingAction` record in PostgreSQL. Absolutely no database entities (tasks, reminders, calendar events) are modified until confirmation is received.
2. **Single-Use & Concurrency-Safe**: Row-level pessimistic locking (`SELECT ... FOR UPDATE`) prevents concurrent execution or double-mutations. Re-confirming an executed action is rejected with `400 Bad Request`.
3. **Automatic Expiry**: Proposals expire after `expiresInMinutes` (default 10). Expired proposals cannot be confirmed.
4. **Natural Language / Quick Reply**:
   - `yes`, `y`, `confirm`, `proceed` -> Confirms.
   - `no`, `n`, `reject`, `cancel` -> Rejects.
   - If user has **multiple active pending actions**, replying without an `actionId` is rejected as **ambiguous** (`400 Bad Request`).
   - If user has **0 active pending actions**, replying is rejected (`400 Bad Request`).

### API Usage Examples

#### 1. Propose an Action
```bash
curl -X POST http://localhost:3000/api/confirmations/propose \
  -H "Content-Type: application/json" \
  -H "x-user-id: 32628984-366b-4c22-8995-3222734d51bf" \
  -d '{
    "actionType": "task_create",
    "proposal": "Create urgent task: Deploy security patch",
    "payload": {
      "title": "Deploy security patch",
      "priority": "urgent"
    },
    "expiresInMinutes": 10
  }'
```

#### 2. Confirm Proposal by ID
```bash
curl -X POST http://localhost:3000/api/confirmations/ACTION_UUID/confirm \
  -H "x-user-id: 32628984-366b-4c22-8995-3222734d51bf"
```

#### 3. Quick Reply Resolution
```bash
curl -X POST http://localhost:3000/api/confirmations/reply \
  -H "Content-Type: application/json" \
  -H "x-user-id: 32628984-366b-4c22-8995-3222734d51bf" \
  -d '{
    "reply": "yes"
  }'
```

---

## Telegram Integration & Reminder Delivery (Phase 4)

Phase 4 introduces scheduled reminder dispatch to Telegram with delivery attempt tracking, bounded retries, and strict secret protection.

### Configuration & Bot Setup

1. **Create Telegram Bot**: Use `@BotFather` on Telegram to create your bot and obtain a Bot Token.
2. **Find Your Chat ID**: Send `/start` to your bot, then send a message to `@userinfobot` to retrieve your personal numeric Telegram Chat ID.
3. **Configure Environment Variables** in `backend/.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   N8N_WORKFLOW_SECRET=your_workflow_secret_here
   ```
   > [!IMPORTANT]
   > Never commit `.env` or print tokens in log files. All Telegram errors are automatically sanitized by replacing tokens with `[REDACTED_BOT_TOKEN]`.

### Workflow Endpoint

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/reminders/process-due` | Protected endpoint for n8n/cron to claim and deliver due reminders |

#### Authentication
The endpoint requires the header `x-workflow-secret: <N8N_WORKFLOW_SECRET>` or `Authorization: Bearer <N8N_WORKFLOW_SECRET>`.

#### Example Request
```bash
curl -X POST http://localhost:3000/api/reminders/process-due \
  -H "Content-Type: application/json" \
  -H "x-workflow-secret: your_workflow_secret_here" \
  -d '{
    "limit": 50
  }'
```

Response (`200 OK`):
```json
{
  "data": {
    "claimedCount": 1,
    "sentCount": 1,
    "failedCount": 0,
    "skippedCount": 0,
    "details": [
      {
        "reminderId": "91f93ee9-d0a6-4a1f-acf1-f945283b45e8",
        "status": "sent",
        "messageId": "12345"
      }
    ]
  }
}
```

### Delivery Guarantees & Resilience

1. **Atomic Claim (`FOR UPDATE SKIP LOCKED`)**: Concurrent executions skip claimed rows, preventing duplicate notifications.
2. **Immediate Recheck**: The runner rechecks reminder status immediately before dispatch. Cancelled or rescheduled reminders are aborted.
3. **Bounded Retries with Backoff**: Failed sends are retried up to 3 times with progressive backoff delays (2 mins * attempt). Reminders that exceed 3 failed attempts are marked `failed` permanently.
4. **Audit Trail**: Every send attempt is recorded in PostgreSQL table `notification_attempts` with status, timestamp, attempt number, and Telegram provider message ID.

---

## Scheduled Workflows via n8n (Phase 5)

Phase 5 introduces scheduled workflow orchestration via n8n, exposing secured backend trigger endpoints with full execution auditing in the `workflow_executions` table.

### Architecture & Security

- **n8n Container**: Managed via `docker-compose.yml` on port `5678`. Configured with `extra_hosts: host.docker.internal:host-gateway` to communicate with the host Express backend at `http://host.docker.internal:3000`.
- **Secret Authentication**: All `/api/workflows/*` endpoints enforce `x-workflow-secret: <N8N_WORKFLOW_SECRET>` or `Authorization: Bearer <N8N_WORKFLOW_SECRET>`.
- **Audit Logging**: Every workflow execution is recorded in PostgreSQL `workflow_executions` with execution status (`running`, `completed`, `failed`), start time, finish time, trigger source, and JSON results/error details.

### Workflow Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/workflows/reminders/delivery` | Trigger reminder delivery run with execution tracking |
| `POST` | `/api/workflows/briefing/trigger` | Trigger daily briefing compilation for eligible users |
| `GET` | `/api/workflows/executions` | List recent workflow execution audit logs |

#### 1. Trigger Reminder Delivery
```bash
curl -X POST http://localhost:3000/api/workflows/reminders/delivery \
  -H "Content-Type: application/json" \
  -H "x-workflow-secret: your_n8n_secret_token_here" \
  -d '{ "triggeredBy": "n8n_cron" }'
```

#### 2. Trigger Daily Briefing
```bash
curl -X POST http://localhost:3000/api/workflows/briefing/trigger \
  -H "Content-Type: application/json" \
  -H "x-workflow-secret: your_n8n_secret_token_here" \
  -d '{ "triggeredBy": "n8n_hourly" }'
```

#### 3. View Workflow Execution History
```bash
curl -X GET http://localhost:3000/api/workflows/executions \
  -H "x-workflow-secret: your_n8n_secret_token_here"
```

### Pre-Built n8n Workflows

Workflow JSON files are located in `automation/workflows/`:
- `reminder-delivery.json`: Scheduled trigger every 1 minute calling `POST /api/workflows/reminders/delivery`.
- `daily-briefing.json`: Scheduled trigger hourly calling `POST /api/workflows/briefing/trigger`.

#### Importing Workflows into n8n:
1. Open n8n in your browser at [http://localhost:5678](http://localhost:5678).
2. Set up owner account credentials if launching for the first time.
3. In the Workflows menu, click **Add Workflow** -> **Import from File...** and select `automation/workflows/reminder-delivery.json` and `automation/workflows/daily-briefing.json`.
4. Ensure the `x-workflow-secret` header in the HTTP Request node matches your `N8N_WORKFLOW_SECRET` in `.env`.
5. Toggle the workflows to **Active**.





