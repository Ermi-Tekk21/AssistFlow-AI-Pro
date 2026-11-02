import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Server } from "node:http";
import { app } from "../src/app";
import { AppDataSource } from "../src/config/database";
import { User } from "../src/entities/User";
import { Task } from "../src/entities/Task";
import { Reminder, ReminderStatus } from "../src/entities/Reminder";
import { CalendarEvent, CalendarEventStatus } from "../src/entities/CalendarEvent";
import { remindersService } from "../src/modules/reminders/reminders.service";

describe("Phase 2 Reminder API and Domain Rules Tests", () => {
  let server: Server;
  let baseUrl: string;
  let userA: User;
  let userB: User;
  let taskA: Task;

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
    const taskRepo = AppDataSource.getRepository(Task);

    userA = await userRepo.save(
      userRepo.create({
        email: `usera_rem_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
      })
    );

    userB = await userRepo.save(
      userRepo.create({
        email: `userb_rem_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
      })
    );

    taskA = await taskRepo.save(
      taskRepo.create({
        userId: userA.id,
        title: "Submit financial report",
      })
    );
  });

  after(async () => {
    if (AppDataSource.isInitialized) {
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const taskRepo = AppDataSource.getRepository(Task);
      const userRepo = AppDataSource.getRepository(User);

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
    const reminderRepo = AppDataSource.getRepository(Reminder);
    await reminderRepo.createQueryBuilder().delete().execute();
  });

  describe("Authentication and Ownership Security", () => {
    it("should return 401 when x-user-id header is missing", async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const res = await fetch(`${baseUrl}/api/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Doctor appointment",
          scheduledAt: futureTime,
        }),
      });

      assert.equal(res.status, 401);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "UNAUTHORIZED");
    });

    it("should not allow User B to get User A's reminder (returns 404)", async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const createRes = await fetch(`${baseUrl}/api/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "User A Private Reminder",
          scheduledAt: futureTime,
        }),
      });
      const created = (await createRes.json()) as any;
      const reminderId = created.data.id;

      const fetchRes = await fetch(`${baseUrl}/api/reminders/${reminderId}`, {
        headers: { "x-user-id": userB.id },
      });
      assert.equal(fetchRes.status, 404);
      const body = (await fetchRes.json()) as any;
      assert.equal(body.error.code, "NOT_FOUND");
    });

    it("should not allow User B to reschedule, snooze, or cancel User A's reminder", async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const createRes = await fetch(`${baseUrl}/api/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "User A Reminder",
          scheduledAt: futureTime,
        }),
      });
      const reminderId = ((await createRes.json()) as any).data.id;

      // User B patch
      const patchRes = await fetch(`${baseUrl}/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userB.id,
        },
        body: JSON.stringify({ title: "Hacked" }),
      });
      assert.equal(patchRes.status, 404);

      // User B snooze
      const snoozeRes = await fetch(`${baseUrl}/api/reminders/${reminderId}/snooze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userB.id,
        },
        body: JSON.stringify({ snoozeMinutes: 10 }),
      });
      assert.equal(snoozeRes.status, 404);

      // User B cancel
      const cancelRes = await fetch(`${baseUrl}/api/reminders/${reminderId}/cancel`, {
        method: "POST",
        headers: { "x-user-id": userB.id },
      });
      assert.equal(cancelRes.status, 404);
    });
  });

  describe("Reminder Creation and Domain Rules", () => {
    it("should create standalone reminder with default timezone and scheduled status", async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const res = await fetch(`${baseUrl}/api/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "Buy airline tickets",
          description: "Flight to Nairobi",
          scheduledAt: futureTime,
        }),
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.data.title, "Buy airline tickets");
      assert.equal(body.data.timezone, "Africa/Addis_Ababa");
      assert.equal(body.data.status, ReminderStatus.SCHEDULED);
      assert.equal(body.data.taskId, null);
      assert.equal(body.data.calendarEventId, null);
      assert.ok(body.data.id);
    });

    it("should create task-linked reminder when task belongs to user", async () => {
      const futureTime = new Date(Date.now() + 7200000).toISOString();
      const res = await fetch(`${baseUrl}/api/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "Reminder: Submit financial report",
          scheduledAt: futureTime,
          taskId: taskA.id,
        }),
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.data.taskId, taskA.id);
    });

    it("should reject creation when scheduledAt is in the past", async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString();
      const res = await fetch(`${baseUrl}/api/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "Past reminder",
          scheduledAt: pastTime,
        }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "VALIDATION_ERROR");
    });

    it("should reject creation with invalid IANA timezone", async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const res = await fetch(`${baseUrl}/api/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "Meeting reminder",
          scheduledAt: futureTime,
          timezone: "Fake/Timezone_Invalid",
        }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "VALIDATION_ERROR");
    });

    it("should reject creation if associated task belongs to another user", async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const res = await fetch(`${baseUrl}/api/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userB.id, // User B trying to link User A's task
        },
        body: JSON.stringify({
          title: "Steal task reminder",
          scheduledAt: futureTime,
          taskId: taskA.id,
        }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "BAD_REQUEST");
    });

    it("should reject creation when both taskId and calendarEventId are provided (mutual exclusivity)", async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const res = await fetch(`${baseUrl}/api/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "Double-linked invalid reminder",
          scheduledAt: futureTime,
          taskId: taskA.id,
          calendarEventId: "00000000-0000-4000-8000-000000000000",
        }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "VALIDATION_ERROR");
    });
  });

  describe("Deterministic Listing and Due Querying", () => {
    beforeEach(async () => {
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const now = Date.now();

      await reminderRepo.save([
        reminderRepo.create({
          userId: userA.id,
          title: "Reminder 1 - in 10 mins",
          scheduledAt: new Date(now + 10 * 60000),
          timezone: "Africa/Addis_Ababa",
          status: ReminderStatus.SCHEDULED,
        }),
        reminderRepo.create({
          userId: userA.id,
          title: "Reminder 2 - in 30 mins",
          scheduledAt: new Date(now + 30 * 60000),
          timezone: "Africa/Addis_Ababa",
          status: ReminderStatus.SCHEDULED,
        }),
        reminderRepo.create({
          userId: userA.id,
          title: "Reminder 3 - in 5 mins (Cancelled)",
          scheduledAt: new Date(now + 5 * 60000),
          timezone: "Africa/Addis_Ababa",
          status: ReminderStatus.CANCELLED,
        }),
      ]);
    });

    it("should return reminders ordered chronologically by scheduledAt ASC", async () => {
      const res = await fetch(`${baseUrl}/api/reminders?status=scheduled`, {
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.length, 2);
      assert.equal(body.data[0].title, "Reminder 1 - in 10 mins");
      assert.equal(body.data[1].title, "Reminder 2 - in 30 mins");
    });

    it("should query due reminders efficiently", async () => {
      const dueTime = new Date(Date.now() + 15 * 60000); // 15 mins from now
      const dueReminders = await remindersService.findDueReminders(dueTime);

      assert.equal(dueReminders.length, 1);
      assert.equal(dueReminders[0].title, "Reminder 1 - in 10 mins");
      assert.equal(dueReminders[0].status, ReminderStatus.SCHEDULED);
    });
  });

  describe("Status Transitions: Reschedule, Snooze, and Cancel", () => {
    let reminderId: string;

    beforeEach(async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const createRes = await fetch(`${baseUrl}/api/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          title: "Follow up with client",
          scheduledAt: futureTime,
        }),
      });
      reminderId = ((await createRes.json()) as any).data.id;
    });

    it("should reschedule reminder with new future time", async () => {
      const newFutureTime = new Date(Date.now() + 86400000).toISOString(); // +24 hours
      const res = await fetch(`${baseUrl}/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({
          scheduledAt: newFutureTime,
          title: "Follow up with client (rescheduled)",
        }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.title, "Follow up with client (rescheduled)");
      assert.equal(new Date(body.data.scheduledAt).toISOString(), newFutureTime);
    });

    it("should snooze reminder by minutes and keep status as SCHEDULED", async () => {
      const res = await fetch(`${baseUrl}/api/reminders/${reminderId}/snooze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ snoozeMinutes: 20 }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.status, ReminderStatus.SCHEDULED);
      const expectedMinTime = Date.now() + 19 * 60000;
      assert.ok(new Date(body.data.scheduledAt).getTime() >= expectedMinTime);
    });

    it("should cancel reminder", async () => {
      const res = await fetch(`${baseUrl}/api/reminders/${reminderId}/cancel`, {
        method: "POST",
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.data.status, ReminderStatus.CANCELLED);
    });

    it("should reject rescheduling a cancelled reminder", async () => {
      // First cancel
      await fetch(`${baseUrl}/api/reminders/${reminderId}/cancel`, {
        method: "POST",
        headers: { "x-user-id": userA.id },
      });

      // Try to reschedule
      const newFutureTime = new Date(Date.now() + 86400000).toISOString();
      const res = await fetch(`${baseUrl}/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ scheduledAt: newFutureTime }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "BAD_REQUEST");
    });

    it("should reject snoozing a cancelled reminder", async () => {
      // Cancel
      await fetch(`${baseUrl}/api/reminders/${reminderId}/cancel`, {
        method: "POST",
        headers: { "x-user-id": userA.id },
      });

      // Try to snooze
      const res = await fetch(`${baseUrl}/api/reminders/${reminderId}/snooze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA.id,
        },
        body: JSON.stringify({ snoozeMinutes: 10 }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "BAD_REQUEST");
    });

    it("should reject cancelling an already sent reminder", async () => {
      // Set status to SENT manually in DB to simulate post-delivery state
      const reminderRepo = AppDataSource.getRepository(Reminder);
      await reminderRepo.update(reminderId, {
        status: ReminderStatus.SENT,
        sentAt: new Date(),
      });

      // Attempt cancel
      const res = await fetch(`${baseUrl}/api/reminders/${reminderId}/cancel`, {
        method: "POST",
        headers: { "x-user-id": userA.id },
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "BAD_REQUEST");
    });
  });
});
