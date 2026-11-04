# Render Deployment Guide – AssistFlow AI

This repository is configured for automated, one-click deployment to [Render](https://render.com) using the included [`render.yaml`](../render.yaml) Blueprint.

---

## Architecture on Render

```
   ┌─────────────────────────────────────────────────────────────┐
   │                    Render Managed Cloud                     │
   │                                                             │
   │  ┌───────────────────────┐       ┌───────────────────────┐  │
   │  │    assistflow-web     │──────>│    assistflow-api     │  │
   │  │ (React SPA Static CDN)│       │  (Node.js Web App)    │  │
   │  └───────────────────────┘       └──────────┬────────────┘  │
   │                                             │               │
   │                                             ▼               │
   │                                  ┌───────────────────────┐  │
   │                                  │  assistflow-postgres  │  │
   │                                  │  (Managed PostgreSQL) │  │
   │                                  └───────────────────────┘  │
   └─────────────────────────────────────────────────────────────┘
```

1. **`assistflow-web`** (Static Site - Free):
   - Fast, global CDN serving the React/Vite dashboard.
   - Built-in SPA rewrite rule (`/* -> /index.html`).
   - Connects directly to `assistflow-api` via HTTPS.

2. **`assistflow-api`** (Web Service):
   - Node.js Express backend (`PORT: 3000`).
   - Automatically runs pending TypeORM migrations on boot.
   - Automatically seeds the admin user (`DEFAULT_USER_EMAIL`).
   - Runs automated background workers for Telegram reminders (every 10s) and daily briefing dispatches (every 30s).
   - Health check endpoint: `/health`.

3. **`assistflow-postgres`** (Managed Database):
   - Secure PostgreSQL 16 instance with automated daily backups and SSL encryption.

---

## Step-by-Step Deployment Instructions

### Step 1: Push Code to GitHub / GitLab
Ensure all commits on branch `the_ui` (or `main`) are pushed to your repository:
```bash
git push origin the_ui
```

### Step 2: Create a Blueprint on Render
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** in the top navigation bar and select **Blueprint**.
3. Connect your repository (`AssistFlow-AI-Prp`).
4. Select the branch (e.g. `the_ui` or `main`).
5. Render will automatically parse [`render.yaml`](../render.yaml) and display the three resources:
   - `assistflow-postgres` (Database)
   - `assistflow-api` (Web Service)
   - `assistflow-web` (Static Site)

### Step 3: Fill in Secret Environment Variables
Render will prompt you for the variables configured with `sync: false`:

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `DEFAULT_USER_EMAIL` | `ermiasteklemarkos@gmail.com` | Primary user login email |
| `DEFAULT_USER_PASSWORD` | *(Choose a strong password)* | Initial admin login password |
| `GEMINI_API_KEY` | `AQ.Ab8RN6I3...` | Google Gemini AI Studio API key |
| `TELEGRAM_BOT_TOKEN` | `8924342610:AAHEe25...` | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | `638640025` | Your personal Telegram chat ID |
| `GOOGLE_CLIENT_ID` | `178874312368-...apps.googleusercontent.com` | Google Cloud OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | `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` | Google Cloud OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | *(Fill in Step 4 below)* | OAuth callback URL |

> [!NOTE]
> `DATABASE_URL`, `JWT_SECRET`, `N8N_WORKFLOW_SECRET`, and `FRONTEND_URL` are **automatically generated and linked** by Render. You do not need to enter them manually.

Click **Apply** to start provisioning.

---

### Step 4: Configure Google Cloud OAuth Redirect URI
Once `assistflow-api` begins provisioning, Render assigns it a public HTTPS URL (e.g. `https://assistflow-api-xxxx.onrender.com`).

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Select your OAuth 2.0 Client ID.
3. Under **Authorized redirect URIs**, add your live production callback URL:
   ```
   https://<your-backend-service-name>.onrender.com/api/calendar/auth/callback
   ```
4. In Render's dashboard for `assistflow-api`, go to **Environment** and set `GOOGLE_REDIRECT_URI` to that exact same URL.
5. Save changes (Render will automatically redeploy the backend in ~30 seconds).

---

### Step 5: Verification & Launch
1. Open your frontend URL: `https://<your-frontend-service-name>.onrender.com`.
2. Log in using `DEFAULT_USER_EMAIL` and `DEFAULT_USER_PASSWORD`.
3. In the sidebar or top banner, click **Connect Google Calendar** to authorize your account.
4. Test scheduling a meeting or asking for a daily briefing in the chat!
