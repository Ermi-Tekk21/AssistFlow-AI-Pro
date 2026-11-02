import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Server } from "node:http";
import { app } from "../src/app";
import { AppDataSource } from "../src/config/database";
import { User } from "../src/entities/User";
import { Task } from "../src/entities/Task";
import { Reminder, ReminderStatus } from "../src/entities/Reminder";
import {
  NotificationAttempt,
  NotificationAttemptStatus,
} from "../src/entities/NotificationAttempt";
import { telegramClient } from "../src/modules/integrations/telegram/telegram.client";

describe("Phase 4 Telegram Integration and Reminder Delivery Tests", () => {
  let server: Server;
  let baseUrl: string;
  let testUser: User;
  let testTask: Task;

  const testWorkflowSecret = "test-n8n-workflow-secret-12345";
  const fakeBotToken = "999999999:AAFakeTelegramTokenSecretXYZ";
  const fakeChatId = "123456789";

  let sentMessages: Array<{ url: string; body: any }> = [];
  let shouldMockFail = false;

  before(async () => {
    process.env.N8N_WORKFLOW_SECRET = testWorkflowSecret;
    process.env.TELEGRAM_BOT_TOKEN = fakeBotToken;
    process.env.TELEGRAM_CHAT_ID = fakeChatId;

    // Inject mock transport into TelegramClient
    telegramClient.setBotToken(fakeBotToken);
    telegramClient.setTransport(async (url: string, init?: RequestInit) => {
      const parsedBody = init?.body ? JSON.parse(init.body as string) : {};
      sentMessages.push({ url, body: parsedBody });

      if (shouldMockFail) {
        return new Response(
          JSON.stringify({
            ok: false,
            description: "Bad Request: chat not found",
            error_code: 400,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            message_id: 888123,
            chat: { id: fakeChatId },
            text: parsedBody.text,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

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
    const taskRepo = AppDataSource.getRepository(Task);

    testUser = await userRepo.save(
      userRepo.create({
        email: `telegram_test_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
      })
    );

    testTask = await taskRepo.save(
      taskRepo.create({
        userId: testUser.id,
        title: "Review Q4 roadmap",
      })
    );
  });

  after(async () => {
    if (AppDataSource.isInitialized) {
      const attemptRepo = AppDataSource.getRepository(NotificationAttempt);
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const taskRepo = AppDataSource.getRepository(Task);
      const userRepo = AppDataSource.getRepository(User);

      await attemptRepo.createQueryBuilder().delete().execute();
      await reminderRepo.createQueryBuilder().delete().execute();
      await taskRepo.createQueryBuilder().delete().execute();
      if (testUser) await userRepo.delete(testUser.id);
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
    sentMessages = [];
    shouldMockFail = false;

    const attemptRepo = AppDataSource.getRepository(NotificationAttempt);
    const reminderRepo = AppDataSource.getRepository(Reminder);

    await attemptRepo.createQueryBuilder().delete().execute();
    await reminderRepo.createQueryBuilder().delete().execute();
  });

  describe("Workflow Endpoint Authentication", () => {
    it("should return 401 when x-workflow-secret header is missing", async () => {
      const res = await fetch(`${baseUrl}/api/reminders/process-due`, {
        method: "POST",
      });

      assert.equal(res.status, 401);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "UNAUTHORIZED");
    });

    it("should return 401 when x-workflow-secret header is invalid", async () => {
      const res = await fetch(`${baseUrl}/api/reminders/process-due`, {
        method: "POST",
        headers: { "x-workflow-secret": "wrong-secret-value" },
      });

      assert.equal(res.status, 401);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "UNAUTHORIZED");
    });

    it("should succeed with 200 when valid workflow secret is supplied", async () => {
      const res = await fetch(`${baseUrl}/api/reminders/process-due`, {
        method: "POST",
        headers: { "x-workflow-secret": testWorkflowSecret },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.claimedCount, 0);
      assert.equal(body.data.sentCount, 0);
    });
  });

  describe("Normal Path Due Reminder Delivery", () => {
    it("should process due reminder, send to Telegram, update status to sent, and record attempt", async () => {
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const attemptRepo = AppDataSource.getRepository(NotificationAttempt);

      // Create due reminder (due 10 seconds ago)
      const dueReminder = await reminderRepo.save(
        reminderRepo.create({
          userId: testUser.id,
          taskId: testTask.id,
          title: "Prepare sprint backlog review",
          description: "Check GitHub issues",
          scheduledAt: new Date(Date.now() - 10000),
          timezone: "Africa/Addis_Ababa",
          status: ReminderStatus.SCHEDULED,
        })
      );

      // Trigger delivery via workflow endpoint
      const res = await fetch(`${baseUrl}/api/reminders/process-due`, {
        method: "POST",
        headers: { "x-workflow-secret": testWorkflowSecret },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.claimedCount, 1);
      assert.equal(body.data.sentCount, 1);
      assert.equal(body.data.failedCount, 0);

      // Verify Telegram mock received the message with formatted text
      assert.equal(sentMessages.length, 1);
      assert.equal(sentMessages[0].body.chat_id, fakeChatId);
      assert.match(sentMessages[0].body.text, /Prepare sprint backlog review/);
      assert.match(sentMessages[0].body.text, /Linked Task:/);

      // Verify reminder state in DB
      const updatedReminder = await reminderRepo.findOneBy({ id: dueReminder.id });
      assert.ok(updatedReminder);
      assert.equal(updatedReminder.status, ReminderStatus.SENT);
      assert.ok(updatedReminder.sentAt);

      // Verify NotificationAttempt in DB
      const attempts = await attemptRepo.find({ where: { reminderId: dueReminder.id } });
      assert.equal(attempts.length, 1);
      assert.equal(attempts[0].status, NotificationAttemptStatus.SUCCESS);
      assert.equal(attempts[0].attemptNumber, 1);
      assert.equal(attempts[0].providerMessageId, "888123");
      assert.equal(attempts[0].errorDetails, null);
    });
  });

  describe("Recheck Mechanics: Cancelled and Rescheduled Reminders", () => {
    it("should not deliver reminders that were cancelled", async () => {
      const reminderRepo = AppDataSource.getRepository(Reminder);

      // Reminder was due, but cancelled
      await reminderRepo.save(
        reminderRepo.create({
          userId: testUser.id,
          title: "Cancelled meeting reminder",
          scheduledAt: new Date(Date.now() - 10000),
          timezone: "Africa/Addis_Ababa",
          status: ReminderStatus.CANCELLED,
        })
      );

      const res = await fetch(`${baseUrl}/api/reminders/process-due`, {
        method: "POST",
        headers: { "x-workflow-secret": testWorkflowSecret },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.claimedCount, 0); // Not claimed because status was cancelled
      assert.equal(sentMessages.length, 0);
    });

    it("should not deliver reminders that are scheduled in the future", async () => {
      const reminderRepo = AppDataSource.getRepository(Reminder);

      // Reminder scheduled 2 hours in the future
      await reminderRepo.save(
        reminderRepo.create({
          userId: testUser.id,
          title: "Future meeting reminder",
          scheduledAt: new Date(Date.now() + 7200000),
          timezone: "Africa/Addis_Ababa",
          status: ReminderStatus.SCHEDULED,
        })
      );

      const res = await fetch(`${baseUrl}/api/reminders/process-due`, {
        method: "POST",
        headers: { "x-workflow-secret": testWorkflowSecret },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.claimedCount, 0);
      assert.equal(sentMessages.length, 0);
    });
  });

  describe("Failure Handling & Bounded Retries", () => {
    it("should record failed attempt and schedule retry with backoff on failure", async () => {
      shouldMockFail = true; // Force Telegram client failure
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const attemptRepo = AppDataSource.getRepository(NotificationAttempt);

      const dueReminder = await reminderRepo.save(
        reminderRepo.create({
          userId: testUser.id,
          title: "Transient error test reminder",
          scheduledAt: new Date(Date.now() - 10000),
          timezone: "Africa/Addis_Ababa",
          status: ReminderStatus.SCHEDULED,
        })
      );

      const res = await fetch(`${baseUrl}/api/reminders/process-due`, {
        method: "POST",
        headers: { "x-workflow-secret": testWorkflowSecret },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.failedCount, 1);

      // Verify NotificationAttempt record
      const attempts = await attemptRepo.find({ where: { reminderId: dueReminder.id } });
      assert.equal(attempts.length, 1);
      assert.equal(attempts[0].status, NotificationAttemptStatus.FAILED);
      assert.match(attempts[0].errorDetails ?? "", /chat not found/);

      // SECRET HYGIENE VERIFICATION: Verify bot token was NOT printed in errorDetails
      assert.ok(!attempts[0].errorDetails?.includes(fakeBotToken));

      // Verify reminder state: reset to SCHEDULED with future backoff date
      const updatedReminder = await reminderRepo.findOneBy({ id: dueReminder.id });
      assert.ok(updatedReminder);
      assert.equal(updatedReminder.status, ReminderStatus.SCHEDULED);
      assert.ok(new Date(updatedReminder.scheduledAt).getTime() > Date.now());
    });

    it("should mark reminder permanently as FAILED after max attempts exceeded", async () => {
      shouldMockFail = true;
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const attemptRepo = AppDataSource.getRepository(NotificationAttempt);

      const dueReminder = await reminderRepo.save(
        reminderRepo.create({
          userId: testUser.id,
          title: "Max retry limit reminder",
          scheduledAt: new Date(Date.now() - 10000),
          timezone: "Africa/Addis_Ababa",
          status: ReminderStatus.SCHEDULED,
        })
      );

      // Pre-seed 2 prior failed attempts
      await attemptRepo.save([
        attemptRepo.create({
          reminderId: dueReminder.id,
          channel: "telegram",
          destination: fakeChatId,
          status: NotificationAttemptStatus.FAILED,
          attemptNumber: 1,
          errorDetails: "Network timeout 1",
        }),
        attemptRepo.create({
          reminderId: dueReminder.id,
          channel: "telegram",
          destination: fakeChatId,
          status: NotificationAttemptStatus.FAILED,
          attemptNumber: 2,
          errorDetails: "Network timeout 2",
        }),
      ]);

      // 3rd attempt runs
      const res = await fetch(`${baseUrl}/api/reminders/process-due`, {
        method: "POST",
        headers: { "x-workflow-secret": testWorkflowSecret },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.failedCount, 1);

      // Verify reminder is now permanently FAILED
      const finalReminder = await reminderRepo.findOneBy({ id: dueReminder.id });
      assert.ok(finalReminder);
      assert.equal(finalReminder.status, ReminderStatus.FAILED);
    });
  });

  describe("Duplicate & Concurrent Invocation Handling", () => {
    it("should prevent duplicate sends when two workflow calls run simultaneously", async () => {
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const attemptRepo = AppDataSource.getRepository(NotificationAttempt);

      // Create 1 due reminder
      const dueReminder = await reminderRepo.save(
        reminderRepo.create({
          userId: testUser.id,
          title: "Concurrent send test reminder",
          scheduledAt: new Date(Date.now() - 10000),
          timezone: "Africa/Addis_Ababa",
          status: ReminderStatus.SCHEDULED,
        })
      );

      // Fire 2 concurrent process-due calls simultaneously
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/reminders/process-due`, {
          method: "POST",
          headers: { "x-workflow-secret": testWorkflowSecret },
        }),
        fetch(`${baseUrl}/api/reminders/process-due`, {
          method: "POST",
          headers: { "x-workflow-secret": testWorkflowSecret },
        }),
      ]);

      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);

      const body1 = (await res1.json()) as any;
      const body2 = (await res2.json()) as any;

      const totalSent = body1.data.sentCount + body2.data.sentCount;
      // Exactly ONE request must have claimed and sent it!
      assert.equal(totalSent, 1);
      assert.equal(sentMessages.length, 1);

      // Exactly 1 success attempt record in DB
      const attempts = await attemptRepo.find({ where: { reminderId: dueReminder.id } });
      assert.equal(attempts.length, 1);
      assert.equal(attempts[0].status, NotificationAttemptStatus.SUCCESS);
    });
  });
});
