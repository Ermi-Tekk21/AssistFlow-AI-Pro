# AssistFlow AI - n8n Scheduled Workflows

This directory contains the exported workflow configurations for **n8n** that orchestrate scheduled tasks for AssistFlow AI.

## Architectural Principles

1. **Orchestration Only, No Business Logic in n8n**:
   - n8n acts strictly as a scheduler / timer trigger.
   - n8n **never connects directly to PostgreSQL tables** and never bypasses backend validations.
   - All state transitions, locks, and idempotency guarantees reside in the Express backend.
2. **Credentials Isolation**:
   - Workflow files contain **no secrets, API keys, or database credentials**.
   - The shared secret is referenced dynamically via `{{ $env.N8N_WORKFLOW_SECRET }}`.

## Available Workflows

| File | Schedule | Target Endpoint | Description |
| :--- | :--- | :--- | :--- |
| `workflows/reminder-delivery.json` | Every 1 minute | `POST /api/workflows/reminders/delivery` | Claims due reminders using `FOR UPDATE SKIP LOCKED` and delivers them to Telegram. |
| `workflows/daily-briefing.json` | Every 15 minutes | `POST /api/workflows/briefing/trigger` | Triggers morning briefings for users who have reached their configured briefing time. |

## How to Import Workflows into n8n

1. **Access n8n Web UI**:
   - Navigate to `http://localhost:5678` in your browser.
2. **Import Workflow**:
   - Click **Workflows** in the left sidebar.
   - Click the **...** menu in the top right -> **Import from File**.
   - Select either `reminder-delivery.json` or `daily-briefing.json`.
3. **Configure Environment Variables in n8n**:
   - Ensure the n8n container in `docker-compose.yml` has access to `N8N_WORKFLOW_SECRET` matching your `backend/.env`.
4. **Test & Activate**:
   - Click **Test step** on the HTTP Request node to verify the connection.
   - Toggle the switch from **Inactive** to **Active** to start the automatic cron schedule.
