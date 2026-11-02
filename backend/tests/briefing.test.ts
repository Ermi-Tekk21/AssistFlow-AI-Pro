import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Server } from "node:http";
import { app } from "../src/app";
import { AppDataSource } from "../src/config/database";
import { User } from "../src/entities/User";
import { Task, TaskPriority, TaskStatus } from "../src/entities/Task";
import { Reminder, ReminderStatus } from "../src/entities/Reminder";
import { CalendarEvent, CalendarEventStatus } from "../src/entities/CalendarEvent";
import {
  DailyBriefingRecord,
  DailyBriefingStatus,
} from "../src/entities/DailyBriefingRecord";
import { telegramClient } from "../src/modules/integrations/telegram/telegram.client";

describe("Phase 8 Daily Briefing Tests", () => {
  let server: Server;
  let baseUrl: string;
  let userA: User;
  let userB: User;
  const testWorkflowSecret = "test-n8n-briefing-secret-12345";
  const sentTelegramMessages: Array<{ chatId: string; text: string; parseMode?: string }> = [];

  const mockTelegramTransport = async (_url: string, init?: RequestInit): Promise<Response> => {
    if (init?.body) {
      const parsed = JSON.parse(init.body as string);
      sentTelegramMessages.push({
        chatId: parsed.chat_id,
        text: parsed.text,
        parseMode: parsed.parse_mode,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        result: {
          message_id: 8888 + sentTelegramMessages.length,
          chat: { id: 123456789 },
          date: Math.floor(Date.now() / 1000),
          text: "Mocked Telegram Message",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  before(async () => {
    process.env.N8N_WORKFLOW_SECRET = testWorkflowSecret;
    process.env.TELEGRAM_BOT_TOKEN = "mock-bot-token-briefing";
    process.env.TELEGRAM_CHAT_ID = "999888777";

    telegramClient.setBotToken("mock-bot-token-briefing");
    telegramClient.setTransport(mockTelegramTransport);

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
    userA = await userRepo.save(
      userRepo.create({
        email: `briefing_usera_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
        dailyBriefingTime: "08:00",
        dailyBriefingEnabled: true,
      })
    );

    userB = await userRepo.save(
      userRepo.create({
        email: `briefing_userb_${Date.now()}@example.com`,
        timezone: "America/New_York",
        dailyBriefingTime: "09:00",
        dailyBriefingEnabled: false, // Disabled
      })
    );
  });

  after(async () => {
    telegramClient.setTransport(globalThis.fetch);

    const userRepo = AppDataSource.getRepository(User);
    const briefingRepo = AppDataSource.getRepository(DailyBriefingRecord);
    const taskRepo = AppDataSource.getRepository(Task);
    const reminderRepo = AppDataSource.getRepository(Reminder);
    const eventRepo = AppDataSource.getRepository(CalendarEvent);

    await briefingRepo.createQueryBuilder().delete().execute();
    await taskRepo.createQueryBuilder().delete().execute();
    await reminderRepo.createQueryBuilder().delete().execute();
    await eventRepo.createQueryBuilder().delete().execute();

    if (userA?.id) await userRepo.delete({ id: userA.id });
    if (userB?.id) await userRepo.delete({ id: userB.id });

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
    sentTelegramMessages.length = 0;

    const briefingRepo = AppDataSource.getRepository(DailyBriefingRecord);
    const taskRepo = AppDataSource.getRepository(Task);
    const reminderRepo = AppDataSource.getRepository(Reminder);
    const eventRepo = AppDataSource.getRepository(CalendarEvent);

    await briefingRepo.createQueryBuilder().delete().execute();
    await taskRepo.createQueryBuilder().delete().execute();
    await reminderRepo.createQueryBuilder().delete().execute();
    await eventRepo.createQueryBuilder().delete().execute();
  });

  describe("Authentication & Protection", () => {
    it("should reject unauthenticated preview with 401", async () => {
      const res = await fetch(`${baseUrl}/api/briefing/preview`);
      assert.equal(res.status, 401);
    });

    it("should reject unauthenticated manual send with 401", async () => {
      const res = await fetch(`${baseUrl}/api/briefing/send`, { method: "POST" });
      assert.equal(res.status, 401);
    });

    it("should reject workflow dispatch-due without valid workflow secret with 401", async () => {
      const res = await fetch(`${baseUrl}/api/briefing/dispatch-due`, {
        method: "POST",
        headers: { "x-workflow-secret": "wrong-secret" },
      });
      assert.equal(res.status, 401);
    });
  });

  describe("Empty-Day Handling", () => {
    it("should provide an encouraging clear-schedule message when user has zero items today", async () => {
      const res = await fetch(`${baseUrl}/api/briefing/preview`, {
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.counts.tasks, 0);
      assert.equal(body.data.counts.reminders, 0);
      assert.equal(body.data.counts.events, 0);
      assert.match(body.data.html, /schedule is completely clear today/i);
    });
  });

  describe("Rich Content Compilation & Timezone Formatting", () => {
    it("should aggregate pending/overdue tasks, reminders, and calendar events with Google Meet links", async () => {
      const taskRepo = AppDataSource.getRepository(Task);
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const eventRepo = AppDataSource.getRepository(CalendarEvent);

      const now = new Date();

      // 1. High priority task & overdue task
      await taskRepo.save([
        taskRepo.create({
          userId: userA.id,
          title: "Quarterly Board Review",
          priority: TaskPriority.HIGH,
          status: TaskStatus.PENDING,
          dueAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // Overdue by 2 hours
        }),
        taskRepo.create({
          userId: userA.id,
          title: "Update documentation",
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.PENDING,
        }),
      ]);

      // 2. Today's reminder
      await reminderRepo.save(
        reminderRepo.create({
          userId: userA.id,
          title: "Submit team timesheets",
          scheduledAt: new Date(now.getTime() + 1 * 60 * 60 * 1000),
          timezone: userA.timezone,
          status: ReminderStatus.SCHEDULED,
        })
      );

      // 3. Today's calendar event with Google Meet link
      await eventRepo.save(
        eventRepo.create({
          userId: userA.id,
          googleCalendarId: "primary",
          googleEventId: "google-sync-test-1",
          title: "Product Roadmap Sync",
          startAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
          endAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
          timezone: userA.timezone,
          meetUrl: "https://meet.google.com/xyz-uvwx-rst",
          status: CalendarEventStatus.CONFIRMED,
        })
      );

      // Fetch preview
      const res = await fetch(`${baseUrl}/api/briefing/preview`, {
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.counts.tasks, 2);
      assert.equal(body.data.counts.reminders, 1);
      assert.equal(body.data.counts.events, 1);

      // Verify HTML content sections
      assert.match(body.data.html, /Product Roadmap Sync/);
      assert.match(body.data.html, /https:\/\/meet\.google\.com\/xyz-uvwx-rst/);
      assert.match(body.data.html, /Submit team timesheets/);
      assert.match(body.data.html, /Quarterly Board Review/);
      assert.match(body.data.html, /Overdue/);
    });
  });

  describe("Telegram Dispatch & Duplicate Prevention (Idempotency)", () => {
    it("should send briefing to Telegram and record sent status in daily_briefings", async () => {
      const res = await fetch(`${baseUrl}/api/briefing/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.success, true);
      assert.ok(body.data.briefingDate);
      assert.ok(body.data.messageId);

      // Verify Telegram client received message
      assert.equal(sentTelegramMessages.length, 1);
      assert.equal(sentTelegramMessages[0].chatId, "999888777");
      assert.match(sentTelegramMessages[0].text, /AssistFlow Daily Briefing/);

      // Verify database record
      const briefingRepo = AppDataSource.getRepository(DailyBriefingRecord);
      const record = await briefingRepo.findOneBy({
        userId: userA.id,
        briefingDate: body.data.briefingDate,
      });
      assert.ok(record);
      assert.equal(record.status, DailyBriefingStatus.SENT);
      assert.ok(record.sentAt);
      assert.equal(record.telegramMessageId, body.data.messageId);
    });

    it("should prevent duplicate briefings on subsequent calls for the same date unless forced", async () => {
      // First send
      await fetch(`${baseUrl}/api/briefing/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
      });
      assert.equal(sentTelegramMessages.length, 1);

      // Second send without force -> skipped
      const res2 = await fetch(`${baseUrl}/api/briefing/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
      });

      assert.equal(res2.status, 200);
      const body2 = (await res2.json()) as any;
      assert.equal(body2.data.skipped, true);
      assert.match(body2.data.reason, /already sent/i);
      // No additional Telegram message sent
      assert.equal(sentTelegramMessages.length, 1);

      // Third send WITH force = true -> sent
      const res3 = await fetch(`${baseUrl}/api/briefing/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ force: true }),
      });

      assert.equal(res3.status, 200);
      const body3 = (await res3.json()) as any;
      assert.equal(body3.data.success, true);
      assert.equal(body3.data.skipped, undefined);
      assert.equal(sentTelegramMessages.length, 2);
    });
  });

  describe("Disabled Setting & Scheduled Dispatch", () => {
    it("should skip briefing if dailyBriefingEnabled is false", async () => {
      const res = await fetch(`${baseUrl}/api/briefing/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userB.id,
        },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.skipped, true);
      assert.match(body.data.reason, /disabled/i);
      assert.equal(sentTelegramMessages.length, 0);
    });

    it("should process due briefings via POST /api/briefing/dispatch-due", async () => {
      const res = await fetch(`${baseUrl}/api/briefing/dispatch-due`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workflow-secret": testWorkflowSecret,
        },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.ok(body.data.processed >= 1);
      assert.ok(typeof body.data.sent === "number");
      assert.ok(typeof body.data.skipped === "number");
    });
  });
});
