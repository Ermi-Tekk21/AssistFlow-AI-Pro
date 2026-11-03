import "../src/config/env";

const API_BASE = "http://localhost:3000";

async function runDemos() {
  console.log("=======================================================");
  console.log("   AssistFlow AI – Live Demo Input Verification Suite   ");
  console.log("=======================================================\n");

  // 1. Authenticate as default user
  const email = process.env.DEFAULT_USER_EMAIL || "ermiasteklemarkos@gmail.com";
  const password = process.env.DEFAULT_USER_PASSWORD || "password123";
  console.log(`Step 0: Authenticating as default user (${email})...`);
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${await loginRes.text()}`);
  }

  const loginData = (await loginRes.json()) as any;
  const token = loginData.data.token;
  const user = loginData.data.user;
  console.log(`✓ Authenticated: ${user.firstName} ${user.lastName} (${user.email})`);
  console.log(`  User ID: ${user.id}\n`);

  let sessionId: string | undefined = undefined;

  async function sendMessage(msg: string): Promise<any> {
    console.log(`[USER]: "${msg}"`);
    const res = await fetch(`${API_BASE}/api/assistant/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: msg, sessionId }),
    });

    if (!res.ok) {
      throw new Error(`Message failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    sessionId = data.data.sessionId;
    console.log(`[ASSISTANT]:`);
    console.log(data.data.response);
    if (data.data.pendingAction) {
      console.log(`  [PendingAction Propose]: ${data.data.pendingAction.proposal}`);
    }
    console.log("-------------------------------------------------------");
    return data.data;
  }

  // Demo 1 – Google Calendar & Meet
  console.log("\n>>> DEMO 1: Meeting Scheduling (Google Calendar & Meet) <<<");
  await sendMessage(
    "Schedule a project review meeting with Sami tomorrow at 10 AM for one hour. Add his email sami@example.com and generate a Google Meet link."
  );
  await sendMessage("yes");

  // Demo 2 – Intelligent Clarification
  console.log("\n>>> DEMO 2: Intelligent Clarification (Multi-Turn Slot Filling) <<<");
  await sendMessage("Remind me to call the finance manager tomorrow.");
  await sendMessage("At 4 PM.");
  await sendMessage("yes");

  // Demo 3 – Task Management
  console.log("\n>>> DEMO 3: Task Automation (Priority & Due Date) <<<");
  await sendMessage("Create a high-priority task to finish the quarterly performance report by Friday.");
  await sendMessage("yes");

  // Demo 4 – Reminder Management
  console.log("\n>>> DEMO 4: Smart Reminders (Recurring Schedule) <<<");
  await sendMessage("Remind me every Monday at 8 AM to review my weekly goals.");
  await sendMessage("yes");

  // Demo 5 – Meeting Updates
  console.log("\n>>> DEMO 5: Schedule Coordination (Meeting Update) <<<");
  await sendMessage("Move my project review meeting with Sami from 10 AM to 2 PM tomorrow.");
  await sendMessage("yes");

  // Demo 6 – Daily Briefing
  console.log("\n>>> DEMO 6: Executive Daily Briefing <<<");
  await sendMessage("Give me my daily briefing.");

  // Demo 7 – Querying Information
  console.log("\n>>> DEMO 7: Personal Assistant Multi-Entity Query <<<");
  await sendMessage("What meetings do I have this week, and which tasks are still pending?");

  // Demo 8 – Cancel an Activity
  console.log("\n>>> DEMO 8: Action Management (Meeting Cancellation) <<<");
  await sendMessage("Cancel my project review meeting with Sami.");
  await sendMessage("yes");

  console.log("\n=======================================================");
  console.log("✓ All 8 Live Demo Scenarios Executed Successfully!");
  console.log("=======================================================\n");
}

runDemos().catch((err) => {
  console.error("Demo suite error:", err);
  process.exit(1);
});
