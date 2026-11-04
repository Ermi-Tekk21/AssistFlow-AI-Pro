import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Server } from "node:http";
import { app } from "../src/app";
import { AppDataSource } from "../src/config/database";
import { User } from "../src/entities/User";
import { Task } from "../src/entities/Task";
import { Reminder } from "../src/entities/Reminder";
import { PendingAction } from "../src/entities/PendingAction";
import { CalendarEvent } from "../src/entities/CalendarEvent";
import { DailyBriefingRecord } from "../src/entities/DailyBriefingRecord";
import { geminiClient } from "../src/modules/ai/gemini.client";
import { telegramClient } from "../src/modules/integrations/telegram/telegram.client";
import { googleCalendarClient } from "../src/modules/integrations/google/googleCalendar.client";
import { briefingService } from "../src/modules/briefing/briefing.service";

describe("Phase 10 — Release Readiness & End-to-End Journeys", () => {
  let server: Server;
  let baseUrl: string;
  let testUser: User;
  let testUserB: User;

  before(async () => {
    // Start ephemeral HTTP server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const userRepo = AppDataSource.getRepository(User);
    testUser = await userRepo.save(
      userRepo.create({
        email: `e2e_user_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
        dailyBriefingEnabled: true,
        dailyBriefingTime: "08:00",
      })
    );

    testUserB = await userRepo.save(
      userRepo.create({
        email: `e2e_user_b_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
        dailyBriefingEnabled: true,
        dailyBriefingTime: "08:00",
      })
    );
  });

  after(async () => {
    geminiClient.setTransport(undefined);
    telegramClient.setTransport(globalThis.fetch);
    googleCalendarClient.setTransport(undefined);

    const userRepo = AppDataSource.getRepository(User);
    if (testUser?.id) {
      await userRepo.delete(testUser.id);
    }
    if (testUserB?.id) {
      await userRepo.delete(testUserB.id);
    }

    if (server) {
      if (typeof (server as any).closeAllConnections === "function") {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  beforeEach(async () => {
    await AppDataSource.getRepository(DailyBriefingRecord).createQueryBuilder().delete().execute();
    await AppDataSource.getRepository(PendingAction).createQueryBuilder().delete().execute();
    await AppDataSource.getRepository(Reminder).createQueryBuilder().delete().execute();
    await AppDataSource.getRepository(CalendarEvent).createQueryBuilder().delete().execute();
    await AppDataSource.getRepository(Task).createQueryBuilder().delete().execute();
  });

  // -------------------------------------------------------------
  // Journey 1: Core Task Lifecycle
  // -------------------------------------------------------------
  describe("Journey 1: Task Management Lifecycle", () => {
    it("should create, read, update, complete, and delete a task through the API", async () => {
      // 1. Create task
      const createRes = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUser.id,
        },
        body: JSON.stringify({
          title: "Prepare Board Deck",
          description: "Compile Q4 metrics",
          priority: "high",
          dueAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      });

      assert.strictEqual(createRes.status, 201);
      const createBody = (await createRes.json()) as any;
      const taskId = createBody.data.id;
      assert.strictEqual(createBody.data.title, "Prepare Board Deck");
      assert.strictEqual(createBody.data.status, "pending");

      // 2. Fetch task by ID
      const getRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        headers: { "x-user-id": testUser.id },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = (await getRes.json()) as any;
      assert.strictEqual(getBody.data.id, taskId);

      // 3. Update task
      const updateRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUser.id,
        },
        body: JSON.stringify({
          title: "Prepare Board Deck v2",
          priority: "medium",
        }),
      });
      assert.strictEqual(updateRes.status, 200);
      const updateBody = (await updateRes.json()) as any;
      assert.strictEqual(updateBody.data.title, "Prepare Board Deck v2");
      assert.strictEqual(updateBody.data.priority, "medium");

      // 4. Complete task
      const completeRes = await fetch(`${baseUrl}/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "x-user-id": testUser.id },
      });
      assert.strictEqual(completeRes.status, 200);
      const completeBody = (await completeRes.json()) as any;
      assert.strictEqual(completeBody.data.status, "completed");
      assert.ok(completeBody.data.completedAt);

      // 5. Delete task
      const deleteRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { "x-user-id": testUser.id },
      });
      assert.strictEqual(deleteRes.status, 200);

      // 6. Verify 404 on subsequent get
      const notFoundRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        headers: { "x-user-id": testUser.id },
      });
      assert.strictEqual(notFoundRes.status, 404);
    });
  });

  // -------------------------------------------------------------
  // Journey 2: Propose Reminder -> Confirm -> Telegram Delivery
  // -------------------------------------------------------------
  describe("Journey 2: Reminder Proposal, Confirmation, and Telegram Delivery", () => {
    it("should interpret prompt via AI, create pending proposal, execute on confirm, and deliver via workflow", async () => {
      const scheduledTime = new Date(Date.now() - 1000).toISOString();

      // Mock Gemini intent interpretation
      geminiClient.setTransport(async () =>
        JSON.stringify({
          intent: "reminder_create",
          params: {
            title: "Submit corporate taxes",
            scheduledAt: scheduledTime,
          },
        })
      );

      // 1. Natural language chat input
      const chatRes = await fetch(`${baseUrl}/api/assistant/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUser.id,
        },
        body: JSON.stringify({ message: "Remind me to submit corporate taxes" }),
      });

      assert.strictEqual(chatRes.status, 200);
      const chatBody = (await chatRes.json()) as any;
      assert.strictEqual(chatBody.data.intent, "reminder_create");
      assert.ok(chatBody.data.pendingAction);
      const actionId = chatBody.data.pendingAction.id;

      // 2. Confirm the pending action
      const confirmRes = await fetch(`${baseUrl}/api/confirmations/${actionId}/confirm`, {
        method: "POST",
        headers: { "x-user-id": testUser.id },
      });

      assert.strictEqual(confirmRes.status, 200);
      const confirmBody = (await confirmRes.json()) as any;
      assert.strictEqual(confirmBody.data.action.status, "executed");
      const reminderId = confirmBody.data.result.id;
      assert.ok(reminderId);

      // Verify reminder exists in database with status scheduled
      const reminderRepo = AppDataSource.getRepository(Reminder);
      let reminder = await reminderRepo.findOne({ where: { id: reminderId } });
      assert.ok(reminder);
      assert.strictEqual(reminder.status, "scheduled");

      // 3. Mock Telegram transport
      let telegramDelivered = false;
      let deliveredText = "";
      telegramClient.setTransport(async (_url, init) => {
        telegramDelivered = true;
        const body = JSON.parse(init?.body as string);
        deliveredText = body.text;
        return new Response(
          JSON.stringify({ ok: true, result: { message_id: 888777 } }),
          { status: 200 }
        );
      });

      // 4. Trigger scheduled workflow (as n8n does)
      const workflowSecret = process.env.N8N_WORKFLOW_SECRET || "assistflow_n8n_secret_token";
      const workflowRes = await fetch(`${baseUrl}/api/workflows/reminders/delivery`, {
        method: "POST",
        headers: { "x-workflow-secret": workflowSecret },
      });

      assert.strictEqual(workflowRes.status, 200);
      assert.ok(telegramDelivered, "Telegram transport should have been called");
      assert.ok(deliveredText.includes("Submit corporate taxes"));

      // 5. Verify reminder status transitioned to sent in database
      reminder = await reminderRepo.findOne({ where: { id: reminderId } });
      assert.strictEqual(reminder?.status, "sent");
      assert.ok(reminder?.sentAt);
    });
  });

  // -------------------------------------------------------------
  // Journey 3: Snooze Reminder & Unclaimed Old Schedule
  // -------------------------------------------------------------
  describe("Journey 3: Snooze Reminder Workflow", () => {
    it("should snooze a reminder to future time and prevent immediate delivery", async () => {
      const reminderRepo = AppDataSource.getRepository(Reminder);

      // Create reminder scheduled in the past
      const reminder = await reminderRepo.save(
        reminderRepo.create({
          userId: testUser.id,
          title: "Follow up with client",
          scheduledAt: new Date(Date.now() - 5000),
          timezone: "Africa/Addis_Ababa",
          status: "scheduled",
        })
      );

      // Snooze it to 2 hours in future
      const futureTime = new Date(Date.now() + 7200000).toISOString();
      const snoozeRes = await fetch(`${baseUrl}/api/reminders/${reminder.id}/snooze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUser.id,
        },
        body: JSON.stringify({ scheduledAt: futureTime }),
      });

      assert.strictEqual(snoozeRes.status, 200);
      const snoozeBody = (await snoozeRes.json()) as any;
      assert.strictEqual(snoozeBody.data.status, "scheduled");

      // Trigger workflow execution now
      let delivered = false;
      telegramClient.setTransport(async () => {
        delivered = true;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 111 } }));
      });

      const workflowSecret = process.env.N8N_WORKFLOW_SECRET || "assistflow_n8n_secret_token";
      const workflowRes = await fetch(`${baseUrl}/api/workflows/reminders/delivery`, {
        method: "POST",
        headers: { "x-workflow-secret": workflowSecret },
      });

      assert.strictEqual(workflowRes.status, 200);
      const workflowBody = (await workflowRes.json()) as any;
      assert.strictEqual(workflowBody.data.result.claimedCount, 0);
      assert.strictEqual(delivered, false, "Snoozed reminder should not be delivered");
    });
  });

  // -------------------------------------------------------------
  // Journey 4: Multi-Turn Slot Filling Meeting -> Google Meet Saved
  // -------------------------------------------------------------
  describe("Journey 4: Multi-Turn Meeting Booking with Google Meet Integration", () => {
    it("should fill missing slots over multiple turns, create event with Google Meet link, and schedule 10m reminder", async () => {
      // Turn 1: User gives partial information ("Schedule a meeting")
      geminiClient.setTransport(async () =>
        JSON.stringify({
          intent: "clarification_needed",
          params: {
            question: "What time would you like to schedule the meeting, and what is the summary?",
            missingFields: ["summary", "startAt", "endAt"],
            partialIntent: "calendar_create",
            partialParams: {},
          },
        })
      );

      const turn1Res = await fetch(`${baseUrl}/api/assistant/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUser.id,
        },
        body: JSON.stringify({ message: "Schedule a meeting please" }),
      });

      assert.strictEqual(turn1Res.status, 200);
      const turn1Body = (await turn1Res.json()) as any;
      assert.strictEqual(turn1Body.data.intent, "clarification_needed");
      assert.ok(turn1Body.data.response.includes("What time"));

      // Turn 2: User supplies full details, Gemini returns completed calendar_create
      const startAt = new Date(Date.now() + 86400000).toISOString();
      const endAt = new Date(Date.now() + 90000000).toISOString();

      geminiClient.setTransport(async () =>
        JSON.stringify({
          intent: "calendar_create",
          params: {
            summary: "Sprint Architecture Review",
            description: "Discuss system scaling",
            startAt,
            endAt,
            attendees: ["engineer@example.com"],
          },
        })
      );

      const turn2Res = await fetch(`${baseUrl}/api/assistant/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUser.id,
        },
        body: JSON.stringify({ message: "Tomorrow from 2pm to 3pm with engineer@example.com" }),
      });

      assert.strictEqual(turn2Res.status, 200);
      const turn2Body = (await turn2Res.json()) as any;
      assert.strictEqual(turn2Body.data.intent, "calendar_create");
      assert.ok(turn2Body.data.pendingAction);

      // Mock Google Calendar transport to return Google Meet link
      googleCalendarClient.setTransport({
        async listEvents() {
          return [];
        },
        async createEvent(_token, payload) {
          return {
            id: `google-meet-evt-${Date.now()}`,
            summary: payload.summary,
            description: payload.description,
            start: { dateTime: payload.start.dateTime },
            end: { dateTime: payload.end.dateTime },
            hangoutLink: "https://meet.google.com/xyz-uvw-rst",
            status: "confirmed",
          };
        },
        async updateEvent(_token, eventId, payload) {
          return {
            id: eventId,
            summary: payload.summary || "",
            start: { dateTime: payload.start?.dateTime },
            end: { dateTime: payload.end?.dateTime },
          };
        },
        async deleteEvent() {},
      });

      // Confirm proposal
      const confirmRes = await fetch(
        `${baseUrl}/api/confirmations/${turn2Body.data.pendingAction.id}/confirm`,
        {
          method: "POST",
          headers: { "x-user-id": testUser.id },
        }
      );

      assert.strictEqual(confirmRes.status, 200);
      const confirmBody = (await confirmRes.json()) as any;
      assert.strictEqual(confirmBody.data.action.status, "executed");
      const eventData = confirmBody.data.result.event;
      assert.ok(eventData);
      assert.strictEqual(eventData.title, "Sprint Architecture Review");
      assert.strictEqual(eventData.meetUrl, "https://meet.google.com/xyz-uvw-rst");

      // Verify automatic 10-minute reminder was created and linked
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const prepReminder = await reminderRepo.findOne({
        where: { calendarEventId: eventData.id },
      });
      assert.ok(prepReminder);
      assert.strictEqual(prepReminder.status, "scheduled");
      assert.ok(prepReminder.title.includes("Sprint Architecture Review"));
    });
  });

  // -------------------------------------------------------------
  // Journey 5: Reschedule / Cancel Meeting & Cascade to Reminder
  // -------------------------------------------------------------
  describe("Journey 5: Cancel Meeting & Linked Reminder Cascading", () => {
    it("should cancel meeting and automatically cancel its linked 10-minute prep reminder", async () => {
      // 1. Create meeting directly via calendar API
      const startAt = new Date(Date.now() + 10000000).toISOString();
      const endAt = new Date(Date.now() + 13600000).toISOString();

      let googleDeleteCalled = false;
      googleCalendarClient.setTransport({
        async listEvents() {
          return [];
        },
        async createEvent() {
          return {
            id: "goog-evt-cancel-test",
            summary: "Product Sync",
            start: { dateTime: startAt },
            end: { dateTime: endAt },
            hangoutLink: "https://meet.google.com/prod-sync-test",
          };
        },
        async updateEvent() {
          return {} as any;
        },
        async deleteEvent() {
          googleDeleteCalled = true;
        },
      });

      const createRes = await fetch(`${baseUrl}/api/calendar/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUser.id,
        },
        body: JSON.stringify({
          summary: "Product Sync",
          startAt,
          endAt,
        }),
      });

      assert.strictEqual(createRes.status, 201);
      const createBody = (await createRes.json()) as any;
      const eventId = createBody.data.event.id;
      const reminderId = createBody.data.reminder.id;

      // 2. Cancel the calendar event
      const cancelRes = await fetch(`${baseUrl}/api/calendar/events/${eventId}/cancel`, {
        method: "POST",
        headers: { "x-user-id": testUser.id },
      });

      assert.strictEqual(cancelRes.status, 200);
      const cancelBody = (await cancelRes.json()) as any;
      assert.strictEqual(cancelBody.data.status, "cancelled");
      assert.ok(googleDeleteCalled, "Google delete API should be called");

      // 3. Verify linked reminder is also cancelled
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const reminder = await reminderRepo.findOne({ where: { id: reminderId } });
      assert.ok(reminder);
      assert.strictEqual(reminder.status, "cancelled");
    });
  });

  // -------------------------------------------------------------
  // Journey 6: Daily Briefing (Empty-Day & Populated)
  // -------------------------------------------------------------
  describe("Journey 6: Daily Morning Briefing Lifecycle", () => {
    it("should return clean empty-day briefing when user has no schedule", async () => {
      const previewRes = await fetch(`${baseUrl}/api/briefing/preview`, {
        headers: { "x-user-id": testUser.id },
      });

      assert.strictEqual(previewRes.status, 200);
      const previewBody = (await previewRes.json()) as any;
      assert.strictEqual(previewBody.data.counts.events, 0);
      assert.strictEqual(previewBody.data.counts.reminders, 0);
      assert.strictEqual(previewBody.data.counts.tasks, 0);
      assert.ok(
        previewBody.data.html.includes("completely clear today") ||
          previewBody.data.html.includes("No pending tasks")
      );
    });

    it("should compile populated briefing and dispatch to Telegram with duplicate protection", async () => {
      const { startUtc } = briefingService.getLocalDayBounds("Africa/Addis_Ababa");

      // Seed a task due today
      const taskRepo = AppDataSource.getRepository(Task);
      await taskRepo.save(
        taskRepo.create({
          userId: testUser.id,
          title: "Executive Roadmap Review",
          priority: "high",
          status: "pending",
          dueAt: new Date(startUtc.getTime() + 14 * 3600000),
        })
      );

      // Seed a meeting today with Google Meet link
      const calRepo = AppDataSource.getRepository(CalendarEvent);
      await calRepo.save(
        calRepo.create({
          userId: testUser.id,
          googleCalendarId: "primary",
          googleEventId: `test-goog-${Date.now()}`,
          title: "Strategy Session",
          startAt: new Date(startUtc.getTime() + 15 * 3600000),
          endAt: new Date(startUtc.getTime() + 16 * 3600000),
          timezone: "Africa/Addis_Ababa",
          meetUrl: "https://meet.google.com/strat-sync-123",
          status: "confirmed" as any,
        })
      );

      // Verify preview
      const previewRes = await fetch(`${baseUrl}/api/briefing/preview`, {
        headers: { "x-user-id": testUser.id },
      });

      assert.strictEqual(previewRes.status, 200);
      const previewBody = (await previewRes.json()) as any;
      assert.strictEqual(previewBody.data.counts.tasks, 1);
      assert.strictEqual(previewBody.data.counts.events, 1);
      assert.ok(previewBody.data.html.includes("Executive Roadmap Review"));
      assert.ok(
        previewBody.data.html.includes(
          "https://meet.google.com/strat-sync-123"
        )
      );

      // Send to Telegram
      let delivered = false;
      telegramClient.setTransport(async () => {
        delivered = true;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 999111 } }));
      });

      const sendRes = await fetch(`${baseUrl}/api/briefing/send`, {
        method: "POST",
        headers: { "x-user-id": testUser.id },
      });

      assert.strictEqual(sendRes.status, 200);
      const sendBody = (await sendRes.json()) as any;
      assert.ok(delivered);
      assert.strictEqual(sendBody.data.success, true);
      assert.ok(sendBody.data.messageId);

      // Verify duplicate protection prevents sending again today without force
      const dupRes = await fetch(`${baseUrl}/api/briefing/send`, {
        method: "POST",
        headers: { "x-user-id": testUser.id },
      });

      assert.strictEqual(dupRes.status, 200);
      const dupBody = (await dupRes.json()) as any;
      assert.strictEqual(dupBody.data.skipped, true);
      assert.ok(dupBody.data.reason.includes("already sent"));
    });
  });

  // -------------------------------------------------------------
  // Journey 7: Security, CORS & Invariant Enforcement
  // -------------------------------------------------------------
  describe("Journey 7: Security, CORS, and Database Invariant Hardening", () => {
    it("should respond to CORS preflight OPTIONS request with 204 and correct headers", async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "POST",
        },
      });

      assert.strictEqual(res.status, 204);
      assert.strictEqual(res.headers.get("access-control-allow-origin"), "*");
      assert.ok(res.headers.get("access-control-allow-methods")?.includes("POST"));
      assert.ok(res.headers.get("access-control-allow-headers")?.includes("x-user-id"));
    });

    it("should enforce tenant isolation (User B cannot modify or read User A resources)", async () => {
      // Create task for User A
      const taskRepo = AppDataSource.getRepository(Task);
      const taskA = await taskRepo.save(
        taskRepo.create({
          userId: testUser.id,
          title: "Confidential Project Plan",
          priority: "high",
          status: "pending",
        })
      );

      // User B tries to read User A's task
      const getRes = await fetch(`${baseUrl}/api/tasks/${taskA.id}`, {
        headers: { "x-user-id": testUserB.id },
      });
      assert.strictEqual(getRes.status, 404);

      // User B tries to complete User A's task
      const completeRes = await fetch(`${baseUrl}/api/tasks/${taskA.id}/complete`, {
        method: "POST",
        headers: { "x-user-id": testUserB.id },
      });
      assert.strictEqual(completeRes.status, 404);
    });

    it("should reject creating a reminder with both task_id and calendar_event_id via check constraint", async () => {
      const taskRepo = AppDataSource.getRepository(Task);
      const calRepo = AppDataSource.getRepository(CalendarEvent);
      const reminderRepo = AppDataSource.getRepository(Reminder);

      const task = await taskRepo.save(
        taskRepo.create({
          userId: testUser.id,
          title: "Constraint Task",
          priority: "low",
          status: "pending",
        })
      );

      const event = await calRepo.save(
        calRepo.create({
          userId: testUser.id,
          googleCalendarId: "primary",
          googleEventId: `constraint-goog-${Date.now()}`,
          title: "Constraint Meeting",
          startAt: new Date(),
          endAt: new Date(Date.now() + 3600000),
          timezone: "Africa/Addis_Ababa",
        })
      );

      // Attempt inserting reminder violating chk_reminder_target_exclusive
      await assert.rejects(
        async () => {
          await reminderRepo.save(
            reminderRepo.create({
              userId: testUser.id,
              taskId: task.id,
              calendarEventId: event.id,
              title: "Illegal Dual Link Reminder",
              scheduledAt: new Date(),
              timezone: "Africa/Addis_Ababa",
            })
          );
        },
        (err: any) => {
          return (
            err.message.includes("chk_reminder_target_exclusive") ||
            err.code === "23514" // PostgreSQL check_violation code
          );
        }
      );
    });
  });
});
