import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Server } from "node:http";
import { app } from "../src/app";
import { AppDataSource } from "../src/config/database";
import { User } from "../src/entities/User";
import { Task, TaskPriority, TaskStatus } from "../src/entities/Task";
import { Reminder, ReminderStatus } from "../src/entities/Reminder";
import {
  WorkflowExecution,
  WorkflowExecutionStatus,
} from "../src/entities/WorkflowExecution";
import { NotificationAttempt } from "../src/entities/NotificationAttempt";
import { telegramClient } from "../src/modules/integrations/telegram/telegram.client";

describe("Phase 5 n8n Scheduled Workflows Tests", () => {
  let server: Server;
  let baseUrl: string;
  let user1: User;
  let user2: User;

  const testWorkflowSecret = "test-n8n-secret-phase-5";

  before(async () => {
    process.env.N8N_WORKFLOW_SECRET = testWorkflowSecret;
    process.env.TELEGRAM_BOT_TOKEN = "fake_bot_token_123";
    process.env.TELEGRAM_CHAT_ID = "fake_chat_id_123";

    // Mock Telegram transport
    telegramClient.setBotToken("fake_bot_token_123");
    telegramClient.setTransport(async () => {
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 9999 } }),
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

    user1 = await userRepo.save(
      userRepo.create({
        email: `workflow_user1_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
        dailyBriefingEnabled: true,
        dailyBriefingTime: "08:00:00",
      })
    );

    user2 = await userRepo.save(
      userRepo.create({
        email: `workflow_user2_${Date.now()}@example.com`,
        timezone: "America/New_York",
        dailyBriefingEnabled: false, // Disabled
        dailyBriefingTime: "08:00:00",
      })
    );
  });

  after(async () => {
    if (AppDataSource.isInitialized) {
      const execRepo = AppDataSource.getRepository(WorkflowExecution);
      const attemptRepo = AppDataSource.getRepository(NotificationAttempt);
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const taskRepo = AppDataSource.getRepository(Task);
      const userRepo = AppDataSource.getRepository(User);

      await execRepo.createQueryBuilder().delete().execute();
      await attemptRepo.createQueryBuilder().delete().execute();
      await reminderRepo.createQueryBuilder().delete().execute();
      await taskRepo.createQueryBuilder().delete().execute();
      if (user1) await userRepo.delete(user1.id);
      if (user2) await userRepo.delete(user2.id);
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
    const execRepo = AppDataSource.getRepository(WorkflowExecution);
    const attemptRepo = AppDataSource.getRepository(NotificationAttempt);
    const reminderRepo = AppDataSource.getRepository(Reminder);
    const taskRepo = AppDataSource.getRepository(Task);

    await execRepo.createQueryBuilder().delete().execute();
    await attemptRepo.createQueryBuilder().delete().execute();
    await reminderRepo.createQueryBuilder().delete().execute();
    await taskRepo.createQueryBuilder().delete().execute();
  });

  describe("Workflow Authentication", () => {
    it("should reject requests without workflow secret with 401", async () => {
      const res = await fetch(`${baseUrl}/api/workflows/reminders/delivery`, {
        method: "POST",
      });

      assert.equal(res.status, 401);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "UNAUTHORIZED");
    });

    it("should reject requests with invalid workflow secret with 401", async () => {
      const res = await fetch(`${baseUrl}/api/workflows/reminders/delivery`, {
        method: "POST",
        headers: { "x-workflow-secret": "bad-secret" },
      });

      assert.equal(res.status, 401);
    });
  });

  describe("Reminder Delivery Workflow Execution", () => {
    it("should trigger reminder delivery, process due items, and record execution in DB", async () => {
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const execRepo = AppDataSource.getRepository(WorkflowExecution);

      // Create a due reminder
      await reminderRepo.save(
        reminderRepo.create({
          userId: user1.id,
          title: "Scheduled n8n test reminder",
          scheduledAt: new Date(Date.now() - 5000),
          timezone: "Africa/Addis_Ababa",
          status: ReminderStatus.SCHEDULED,
        })
      );

      // Call endpoint (simulating n8n schedule trigger)
      const res = await fetch(`${baseUrl}/api/workflows/reminders/delivery`, {
        method: "POST",
        headers: {
          "x-workflow-secret": testWorkflowSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ triggeredBy: "n8n_cron" }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.ok(body.data.executionId);
      assert.equal(body.data.result.claimedCount, 1);
      assert.equal(body.data.result.sentCount, 1);

      // Check WorkflowExecution record
      const execution = await execRepo.findOneBy({ id: body.data.executionId });
      assert.ok(execution);
      assert.equal(execution.workflowName, "reminder_delivery");
      assert.equal(execution.status, WorkflowExecutionStatus.COMPLETED);
      assert.equal(execution.triggeredBy, "n8n_cron");
      assert.ok(execution.startedAt);
      assert.ok(execution.finishedAt);
      assert.equal(execution.result.sentCount, 1);
    });
  });

  describe("Daily Briefing Schedule & Timezone Rules", () => {
    it("should respect dailyBriefingEnabled setting and aggregate user tasks/reminders", async () => {
      const taskRepo = AppDataSource.getRepository(Task);
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const execRepo = AppDataSource.getRepository(WorkflowExecution);

      // Seed 2 tasks for user 1 (briefing enabled)
      await taskRepo.save([
        taskRepo.create({
          userId: user1.id,
          title: "Complete sprint tasks",
          priority: TaskPriority.HIGH,
          status: TaskStatus.PENDING,
        }),
        taskRepo.create({
          userId: user1.id,
          title: "Finished task",
          status: TaskStatus.COMPLETED,
        }),
      ]);

      // Seed reminder for today for user 1
      await reminderRepo.save(
        reminderRepo.create({
          userId: user1.id,
          title: "Daily standup reminder",
          scheduledAt: new Date(),
          timezone: "Africa/Addis_Ababa",
          status: ReminderStatus.SCHEDULED,
        })
      );

      // Trigger daily briefing workflow for user1
      const res = await fetch(`${baseUrl}/api/workflows/briefing/trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workflow-secret": testWorkflowSecret,
        },
        body: JSON.stringify({ forceUserId: user1.id }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.ok(body.data.executionId);
      assert.equal(body.data.processedCount, 1);

      const summaries = body.data.summaries;
      assert.equal(summaries.length, 1); // Only user 1 has dailyBriefingEnabled = true
      assert.equal(summaries[0].userId, user1.id);
      assert.equal(summaries[0].eligible, true);
      assert.equal(summaries[0].taskCount, 1); // 1 incomplete task (completed is excluded)
      assert.equal(summaries[0].reminderCount, 1);

      // Verify WorkflowExecution record
      const execution = await execRepo.findOneBy({ id: body.data.executionId });
      assert.ok(execution);
      assert.equal(execution.workflowName, "daily_briefing");
      assert.equal(execution.status, WorkflowExecutionStatus.COMPLETED);
    });
  });

  describe("Observability & Retries Safety", () => {
    it("should return history of workflow executions via GET /executions", async () => {
      // Trigger a delivery
      await fetch(`${baseUrl}/api/workflows/reminders/delivery`, {
        method: "POST",
        headers: { "x-workflow-secret": testWorkflowSecret },
      });

      // Get executions list
      const res = await fetch(`${baseUrl}/api/workflows/executions`, {
        headers: { "x-workflow-secret": testWorkflowSecret },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.length >= 1);
      assert.equal(body.data[0].workflowName, "reminder_delivery");
    });

    it("should handle overlapping workflow calls safely without errors", async () => {
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/workflows/reminders/delivery`, {
          method: "POST",
          headers: { "x-workflow-secret": testWorkflowSecret },
        }),
        fetch(`${baseUrl}/api/workflows/reminders/delivery`, {
          method: "POST",
          headers: { "x-workflow-secret": testWorkflowSecret },
        }),
      ]);

      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);
    });
  });
});
