import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Server } from "node:http";
import { app } from "../src/app";
import { AppDataSource } from "../src/config/database";
import { User } from "../src/entities/User";
import { Task } from "../src/entities/Task";
import { Reminder } from "../src/entities/Reminder";
import {
  PendingAction,
  PendingActionStatus,
  PendingActionType,
} from "../src/entities/PendingAction";

describe("Phase 3 Confirmation Workflow Tests", () => {
  let server: Server;
  let baseUrl: string;
  let userA: User;
  let userB: User;

  before(async () => {
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
        email: `usera_conf_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
      })
    );

    userB = await userRepo.save(
      userRepo.create({
        email: `userb_conf_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
      })
    );
  });

  after(async () => {
    if (AppDataSource.isInitialized) {
      const actionRepo = AppDataSource.getRepository(PendingAction);
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const taskRepo = AppDataSource.getRepository(Task);
      const userRepo = AppDataSource.getRepository(User);

      await actionRepo.createQueryBuilder().delete().execute();
      await reminderRepo.createQueryBuilder().delete().execute();
      await taskRepo.createQueryBuilder().delete().execute();
      if (userA) await userRepo.delete(userA.id);
      if (userB) await userRepo.delete(userB.id);
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
    const actionRepo = AppDataSource.getRepository(PendingAction);
    const taskRepo = AppDataSource.getRepository(Task);
    const reminderRepo = AppDataSource.getRepository(Reminder);

    await actionRepo.createQueryBuilder().delete().execute();
    await taskRepo.createQueryBuilder().delete().execute();
    await reminderRepo.createQueryBuilder().delete().execute();
  });

  describe("Proposal Lifecycle & No Mutation Before Confirmation", () => {
    it("should propose action without mutating state until confirmed", async () => {
      const taskRepo = AppDataSource.getRepository(Task);

      // Propose creating a task
      const proposeRes = await fetch(`${baseUrl}/api/confirmations/propose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          actionType: PendingActionType.TASK_CREATE,
          proposal: "Create task 'Publish security whitepaper' with high priority",
          payload: {
            title: "Publish security whitepaper",
            priority: "high",
          },
          expiresInMinutes: 10,
        }),
      });

      assert.equal(proposeRes.status, 201);
      const proposeBody = (await proposeRes.json()) as any;
      const actionId = proposeBody.data.id;
      assert.equal(proposeBody.data.status, PendingActionStatus.PENDING);
      assert.equal(proposeBody.data.actionType, PendingActionType.TASK_CREATE);
      assert.ok(proposeBody.data.expiresAt);

      // CRITICAL CHECK: Verify NO task was created yet!
      const countBeforeConfirm = await taskRepo.count({ where: { userId: userA.id } });
      assert.equal(countBeforeConfirm, 0);

      // Now confirm the proposal
      const confirmRes = await fetch(`${baseUrl}/api/confirmations/${actionId}/confirm`, {
        method: "POST",
        headers: { "x-user-id": userA.id },
      });

      assert.equal(confirmRes.status, 200);
      const confirmBody = (await confirmRes.json()) as any;
      assert.equal(confirmBody.data.action.status, PendingActionStatus.EXECUTED);
      assert.equal(confirmBody.data.result.title, "Publish security whitepaper");

      // Verify task now exists in the database
      const countAfterConfirm = await taskRepo.count({ where: { userId: userA.id } });
      assert.equal(countAfterConfirm, 1);
    });

    it("should reject action and prevent state mutation when rejected", async () => {
      const taskRepo = AppDataSource.getRepository(Task);

      // Propose action
      const proposeRes = await fetch(`${baseUrl}/api/confirmations/propose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          actionType: PendingActionType.TASK_CREATE,
          proposal: "Delete all system logs",
          payload: { title: "Delete all system logs" },
        }),
      });
      const actionId = ((await proposeRes.json()) as any).data.id;

      // Reject the proposal
      const rejectRes = await fetch(`${baseUrl}/api/confirmations/${actionId}/reject`, {
        method: "POST",
        headers: { "x-user-id": userA.id },
      });

      assert.equal(rejectRes.status, 200);
      const rejectBody = (await rejectRes.json()) as any;
      assert.equal(rejectBody.data.status, PendingActionStatus.REJECTED);

      // Verify NO task was created
      const count = await taskRepo.count({ where: { userId: userA.id } });
      assert.equal(count, 0);

      // Subsequent confirmation of rejected action must fail
      const confirmAttempt = await fetch(`${baseUrl}/api/confirmations/${actionId}/confirm`, {
        method: "POST",
        headers: { "x-user-id": userA.id },
      });
      assert.equal(confirmAttempt.status, 400);
    });
  });

  describe("Single-Use and Concurrency Safety", () => {
    it("should prevent duplicate confirmations on the same pending action", async () => {
      const taskRepo = AppDataSource.getRepository(Task);

      // Propose action
      const proposeRes = await fetch(`${baseUrl}/api/confirmations/propose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          actionType: PendingActionType.TASK_CREATE,
          proposal: "Create recurring report task",
          payload: { title: "Recurring report task" },
        }),
      });
      const actionId = ((await proposeRes.json()) as any).data.id;

      // First confirmation succeeds
      const firstConfirm = await fetch(`${baseUrl}/api/confirmations/${actionId}/confirm`, {
        method: "POST",
        headers: { "x-user-id": userA.id },
      });
      assert.equal(firstConfirm.status, 200);

      // Second confirmation fails
      const secondConfirm = await fetch(`${baseUrl}/api/confirmations/${actionId}/confirm`, {
        method: "POST",
        headers: { "x-user-id": userA.id },
      });
      assert.equal(secondConfirm.status, 400);
      const errorBody = (await secondConfirm.json()) as any;
      assert.equal(errorBody.error.code, "BAD_REQUEST");

      // Verify only one task exists
      const tasks = await taskRepo.find({ where: { userId: userA.id } });
      assert.equal(tasks.length, 1);
    });

    it("should handle simultaneous concurrent confirmation requests safely", async () => {
      const taskRepo = AppDataSource.getRepository(Task);

      // Propose action
      const proposeRes = await fetch(`${baseUrl}/api/confirmations/propose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          actionType: PendingActionType.TASK_CREATE,
          proposal: "Perform concurrent write test",
          payload: { title: "Concurrent write test" },
        }),
      });
      const actionId = ((await proposeRes.json()) as any).data.id;

      // Fire 2 simultaneous concurrent confirmation requests
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/confirmations/${actionId}/confirm`, {
          method: "POST",
          headers: { "x-user-id": userA.id },
        }),
        fetch(`${baseUrl}/api/confirmations/${actionId}/confirm`, {
          method: "POST",
          headers: { "x-user-id": userA.id },
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must succeed (200) and the other must be rejected (400)
      assert.deepEqual(statuses, [200, 400]);

      // Exactly one task created
      const tasks = await taskRepo.find({ where: { userId: userA.id } });
      assert.equal(tasks.length, 1);
    });

    it("should reject confirmation when action has expired", async () => {
      const actionRepo = AppDataSource.getRepository(PendingAction);

      // Save an already expired action directly in DB
      const expiredAction = await actionRepo.save(
        actionRepo.create({
          userId: userA.id,
          actionType: PendingActionType.TASK_CREATE,
          proposal: "Expired task proposal",
          payload: { title: "Expired task" },
          status: PendingActionStatus.PENDING,
          expiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
        })
      );

      const res = await fetch(`${baseUrl}/api/confirmations/${expiredAction.id}/confirm`, {
        method: "POST",
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "BAD_REQUEST");
      assert.match(body.error.message, /expired/i);
    });
  });

  describe("Natural Language / Quick Reply (Yes / No / Ambiguity Resolution)", () => {
    it("should confirm single active pending action when user replies 'yes' or 'y'", async () => {
      const taskRepo = AppDataSource.getRepository(Task);

      // Propose one action
      await fetch(`${baseUrl}/api/confirmations/propose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          actionType: PendingActionType.TASK_CREATE,
          proposal: "Create task from natural language reply",
          payload: { title: "Quick reply task" },
        }),
      });

      // Quick reply "yes" without specifying actionId
      const replyRes = await fetch(`${baseUrl}/api/confirmations/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ reply: "yes" }),
      });

      assert.equal(replyRes.status, 200);
      const replyBody = (await replyRes.json()) as any;
      assert.equal(replyBody.data.decision, "confirmed");
      assert.equal(replyBody.data.action.status, PendingActionStatus.EXECUTED);

      // Verify task exists
      const task = await taskRepo.findOne({ where: { userId: userA.id } });
      assert.ok(task);
      assert.equal(task.title, "Quick reply task");
    });

    it("should reject single active pending action when user replies 'no' or 'n'", async () => {
      const taskRepo = AppDataSource.getRepository(Task);

      // Propose one action
      await fetch(`${baseUrl}/api/confirmations/propose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          actionType: PendingActionType.TASK_CREATE,
          proposal: "Task to cancel via quick reply",
          payload: { title: "Cancelled task" },
        }),
      });

      // Quick reply "n"
      const replyRes = await fetch(`${baseUrl}/api/confirmations/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ reply: "n" }),
      });

      assert.equal(replyRes.status, 200);
      const replyBody = (await replyRes.json()) as any;
      assert.equal(replyBody.data.decision, "rejected");

      // Verify task was NOT created
      const count = await taskRepo.count({ where: { userId: userA.id } });
      assert.equal(count, 0);
    });

    it("should return 400 when user replies 'yes' but no active pending action exists", async () => {
      const replyRes = await fetch(`${baseUrl}/api/confirmations/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ reply: "yes" }),
      });

      assert.equal(replyRes.status, 400);
      const body = (await replyRes.json()) as any;
      assert.match(body.error.message, /no active pending action/i);
    });

    it("should return 400 when ambiguous: multiple active pending actions exist without actionId", async () => {
      // Propose action 1
      await fetch(`${baseUrl}/api/confirmations/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userA.id },
        body: JSON.stringify({
          actionType: PendingActionType.TASK_CREATE,
          proposal: "Action 1",
          payload: { title: "Task 1" },
        }),
      });

      // Propose action 2
      await fetch(`${baseUrl}/api/confirmations/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userA.id },
        body: JSON.stringify({
          actionType: PendingActionType.TASK_CREATE,
          proposal: "Action 2",
          payload: { title: "Task 2" },
        }),
      });

      // User replies "yes" without specifying which one
      const replyRes = await fetch(`${baseUrl}/api/confirmations/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ reply: "yes" }),
      });

      assert.equal(replyRes.status, 400);
      const body = (await replyRes.json()) as any;
      assert.match(body.error.message, /ambiguous confirmation/i);
    });
  });

  describe("Ownership & Tenant Isolation", () => {
    it("should prevent User B from viewing, confirming, or rejecting User A's pending action", async () => {
      // User A proposes action
      const proposeRes = await fetch(`${baseUrl}/api/confirmations/propose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          actionType: PendingActionType.TASK_CREATE,
          proposal: "User A Confidential Task",
          payload: { title: "Confidential task" },
        }),
      });
      const actionId = ((await proposeRes.json()) as any).data.id;

      // User B tries GET
      const getRes = await fetch(`${baseUrl}/api/confirmations/${actionId}`, {
        headers: { "x-user-id": userB.id },
      });
      assert.equal(getRes.status, 404);

      // User B tries confirm
      const confirmRes = await fetch(`${baseUrl}/api/confirmations/${actionId}/confirm`, {
        method: "POST",
        headers: { "x-user-id": userB.id },
      });
      assert.equal(confirmRes.status, 404);

      // User B tries reject
      const rejectRes = await fetch(`${baseUrl}/api/confirmations/${actionId}/reject`, {
        method: "POST",
        headers: { "x-user-id": userB.id },
      });
      assert.equal(rejectRes.status, 404);
    });
  });
});
