import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Server } from "node:http";
import { app } from "../src/app";
import { AppDataSource } from "../src/config/database";
import { User } from "../src/entities/User";
import { Task, TaskPriority, TaskStatus } from "../src/entities/Task";

describe("Phase 1 Core Task API Tests", () => {
  let server: Server;
  let baseUrl: string;
  let userA: User;
  let userB: User;

  before(async () => {
    // Start ephemeral server
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
    // Seed test users
    userA = await userRepo.save(
      userRepo.create({
        email: `usera_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
      })
    );

    userB = await userRepo.save(
      userRepo.create({
        email: `userb_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
      })
    );
  });

  after(async () => {
    if (AppDataSource.isInitialized) {
      const taskRepo = AppDataSource.getRepository(Task);
      const userRepo = AppDataSource.getRepository(User);
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
    // Clean tasks before each test to maintain strict test isolation
    const taskRepo = AppDataSource.getRepository(Task);
    await taskRepo.createQueryBuilder().delete().execute();
  });

  describe("Authentication and Ownership Checks", () => {
    it("should return 401 if x-user-id header is missing", async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Unauthenticated task" }),
      });

      assert.equal(res.status, 401);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "UNAUTHORIZED");
    });

    it("should return 401 if x-user-id header is not a valid UUID", async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        headers: { "x-user-id": "invalid-uuid-format" },
      });

      assert.equal(res.status, 401);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "UNAUTHORIZED");
    });

    it("should not allow User B to get User A's task (returns 404)", async () => {
      // User A creates a task
      const createRes = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ title: "User A Private Task" }),
      });
      const created = (await createRes.json()) as any;
      const taskId = created.data.id;

      // User B tries to fetch User A's task
      const fetchRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        headers: { "x-user-id": userB.id },
      });
      assert.equal(fetchRes.status, 404);
      const body = (await fetchRes.json()) as any;
      assert.equal(body.error.code, "NOT_FOUND");
    });

    it("should not allow User B to update, complete, or delete User A's task", async () => {
      // User A creates a task
      const createRes = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ title: "User A Task" }),
      });
      const taskId = ((await createRes.json()) as any).data.id;

      // User B attempts PATCH
      const patchRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userB.id,
        },
        body: JSON.stringify({ title: "Hacked title" }),
      });
      assert.equal(patchRes.status, 404);

      // User B attempts complete
      const completeRes = await fetch(`${baseUrl}/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "x-user-id": userB.id },
      });
      assert.equal(completeRes.status, 404);

      // User B attempts DELETE
      const deleteRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { "x-user-id": userB.id },
      });
      assert.equal(deleteRes.status, 404);
    });

    it("should isolate user task lists completely", async () => {
      // Create task for User A
      await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userA.id },
        body: JSON.stringify({ title: "Task for User A" }),
      });

      // Create task for User B
      await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userB.id },
        body: JSON.stringify({ title: "Task for User B" }),
      });

      // User A list
      const listARes = await fetch(`${baseUrl}/api/tasks`, {
        headers: { "x-user-id": userA.id },
      });
      const listA = (await listARes.json()) as any;
      assert.equal(listA.meta.total, 1);
      assert.equal(listA.data[0].title, "Task for User A");

      // User B list
      const listBRes = await fetch(`${baseUrl}/api/tasks`, {
        headers: { "x-user-id": userB.id },
      });
      const listB = (await listBRes.json()) as any;
      assert.equal(listB.meta.total, 1);
      assert.equal(listB.data[0].title, "Task for User B");
    });
  });

  describe("Task Creation and Validation", () => {
    it("should create a task with default priority and pending status", async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "Buy groceries",
          description: "Milk, eggs, coffee",
        }),
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.data.title, "Buy groceries");
      assert.equal(body.data.description, "Milk, eggs, coffee");
      assert.equal(body.data.priority, TaskPriority.MEDIUM);
      assert.equal(body.data.status, TaskStatus.PENDING);
      assert.equal(body.data.completedAt, null);
      assert.ok(body.data.id);
      assert.ok(body.data.createdAt);
    });

    it("should create a task with explicit priority and dueAt date", async () => {
      const dueAt = "2026-11-15T10:00:00.000Z";
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "Pay invoices",
          priority: TaskPriority.HIGH,
          dueAt,
        }),
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.data.priority, "high");
      assert.equal(new Date(body.data.dueAt).toISOString(), dueAt);
    });

    it("should fail validation if title is empty or whitespace", async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ title: "   " }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "VALIDATION_ERROR");
    });

    it("should fail validation if title exceeds 255 characters", async () => {
      const longTitle = "a".repeat(256);
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ title: longTitle }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "VALIDATION_ERROR");
    });

    it("should fail validation if priority is invalid", async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ title: "Valid title", priority: "critical" }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "VALIDATION_ERROR");
    });

    it("should fail validation if dueAt is not a valid ISO date", async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ title: "Valid title", dueAt: "not-a-real-date" }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "VALIDATION_ERROR");
    });
  });

  describe("Deterministic List, Search, and Filtering", () => {
    beforeEach(async () => {
      const taskRepo = AppDataSource.getRepository(Task);
      await taskRepo.save([
        taskRepo.create({
          userId: userA.id,
          title: "Write documentation",
          description: "Technical spec for API",
          priority: TaskPriority.HIGH,
          status: TaskStatus.PENDING,
          dueAt: new Date("2026-11-10T12:00:00Z"),
        }),
        taskRepo.create({
          userId: userA.id,
          title: "Review pull requests",
          description: "Check GitHub PRs",
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.IN_PROGRESS,
          dueAt: new Date("2026-11-12T12:00:00Z"),
        }),
        taskRepo.create({
          userId: userA.id,
          title: "Team sync meeting",
          description: "Weekly standup",
          priority: TaskPriority.LOW,
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          dueAt: new Date("2026-11-05T12:00:00Z"),
        }),
      ]);
    });

    it("should return tasks deterministically ordered", async () => {
      const res = await fetch(`${baseUrl}/api/tasks?sortBy=title&sortOrder=ASC`, {
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.length, 3);
      assert.equal(body.data[0].title, "Review pull requests");
      assert.equal(body.data[1].title, "Team sync meeting");
      assert.equal(body.data[2].title, "Write documentation");
    });

    it("should filter tasks by status", async () => {
      const res = await fetch(`${baseUrl}/api/tasks?status=in_progress`, {
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].title, "Review pull requests");
    });

    it("should filter tasks by priority", async () => {
      const res = await fetch(`${baseUrl}/api/tasks?priority=high`, {
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].title, "Write documentation");
    });

    it("should search tasks across title and description", async () => {
      const res = await fetch(`${baseUrl}/api/tasks?search=Technical`, {
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].title, "Write documentation");
    });

    it("should support pagination with limit and offset", async () => {
      const res = await fetch(`${baseUrl}/api/tasks?limit=2&offset=0&sortBy=title&sortOrder=ASC`, {
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.length, 2);
      assert.equal(body.meta.total, 3);
      assert.equal(body.meta.limit, 2);
      assert.equal(body.meta.offset, 0);
    });
  });

  describe("Task Lifecycle: Get, Update, Complete, and Delete", () => {
    let taskId: string;

    beforeEach(async () => {
      const createRes = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "Deploy release v1.0",
          priority: TaskPriority.URGENT,
        }),
      });
      const created = (await createRes.json()) as any;
      taskId = created.data.id;
    });

    it("should get task by ID", async () => {
      const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.id, taskId);
      assert.equal(body.data.title, "Deploy release v1.0");
    });

    it("should return 404 for non-existent task ID", async () => {
      const nonExistentId = "00000000-0000-4000-8000-000000000000";
      const res = await fetch(`${baseUrl}/api/tasks/${nonExistentId}`, {
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 404);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "NOT_FOUND");
    });

    it("should return 400 for malformed task ID parameter", async () => {
      const res = await fetch(`${baseUrl}/api/tasks/not-a-uuid`, {
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "VALIDATION_ERROR");
    });

    it("should update task details", async () => {
      const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "Deploy release v1.1 (hotfix)",
          priority: TaskPriority.HIGH,
          description: "Fixed critical bug in payments",
        }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.title, "Deploy release v1.1 (hotfix)");
      assert.equal(body.data.priority, "high");
      assert.equal(body.data.description, "Fixed critical bug in payments");
    });

    it("should mark task as completed via complete endpoint", async () => {
      const res = await fetch(`${baseUrl}/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.status, TaskStatus.COMPLETED);
      assert.ok(body.data.completedAt);
    });

    it("should delete task and subsequent get returns 404", async () => {
      const deleteRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { "x-user-id": userA.id },
      });

      assert.equal(deleteRes.status, 200);
      const body = (await deleteRes.json()) as any;
      assert.equal(body.id, taskId);

      // Verify deletion
      const getRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        headers: { "x-user-id": userA.id },
      });
      assert.equal(getRes.status, 404);
    });
  });
});
