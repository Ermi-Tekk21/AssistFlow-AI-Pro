import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Server } from "node:http";
import { app } from "../src/app";
import { AppDataSource } from "../src/config/database";
import { User } from "../src/entities/User";
import { CalendarEvent, CalendarEventStatus } from "../src/entities/CalendarEvent";
import { CalendarEventAttendee } from "../src/entities/CalendarEventAttendee";
import { Reminder, ReminderStatus } from "../src/entities/Reminder";
import {
  PendingAction,
  PendingActionStatus,
  PendingActionType,
} from "../src/entities/PendingAction";
import {
  googleCalendarClient,
  GoogleCalendarTransport,
  GoogleCalendarEventPayload,
  GoogleCalendarEventResponse,
} from "../src/modules/integrations/google/googleCalendar.client";
import { confirmationsService } from "../src/modules/confirmations/confirmations.service";

describe("Phase 7 Google Calendar & Google Meet Tests", () => {
  let server: Server;
  let baseUrl: string;
  let user: User;
  let mockCreatedEvents: GoogleCalendarEventResponse[] = [];
  let mockUpdatedEvents: Array<{ eventId: string; payload: Partial<GoogleCalendarEventPayload> }> = [];
  let mockDeletedEventIds: string[] = [];

  const mockTransport: GoogleCalendarTransport = {
    async listEvents(_token, _params) {
      return mockCreatedEvents;
    },
    async createEvent(_token, payload) {
      const newEvent: GoogleCalendarEventResponse = {
        id: `google-ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        summary: payload.summary,
        description: payload.description,
        start: payload.start,
        end: payload.end,
        hangoutLink: "https://meet.google.com/abc-defg-hij",
        attendees: payload.attendees?.map((a) => ({
          email: a.email,
          responseStatus: "needsAction",
        })),
        status: "confirmed",
      };
      mockCreatedEvents.push(newEvent);
      return newEvent;
    },
    async updateEvent(_token, eventId, payload) {
      mockUpdatedEvents.push({ eventId, payload });
      return {
        id: eventId,
        summary: payload.summary || "Updated Event",
        start: payload.start || {},
        end: payload.end || {},
        hangoutLink: "https://meet.google.com/abc-defg-hij",
      };
    },
    async deleteEvent(_token, eventId) {
      mockDeletedEventIds.push(eventId);
    },
  };

  before(async () => {
    googleCalendarClient.setTransport(mockTransport);

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
    user = await userRepo.save(
      userRepo.create({
        email: `calendar_user_${Date.now()}@example.com`,
        timezone: "Africa/Addis_Ababa",
      })
    );
  });

  after(async () => {
    googleCalendarClient.setTransport(undefined);

    const userRepo = AppDataSource.getRepository(User);
    const eventRepo = AppDataSource.getRepository(CalendarEvent);
    const attendeeRepo = AppDataSource.getRepository(CalendarEventAttendee);
    const reminderRepo = AppDataSource.getRepository(Reminder);
    const actionRepo = AppDataSource.getRepository(PendingAction);

    await attendeeRepo.createQueryBuilder().delete().execute();
    await reminderRepo.createQueryBuilder().delete().execute();
    await eventRepo.createQueryBuilder().delete().execute();
    await actionRepo.createQueryBuilder().delete().execute();

    if (user?.id) {
      await userRepo.delete({ id: user.id });
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
    mockCreatedEvents = [];
    mockUpdatedEvents = [];
    mockDeletedEventIds = [];

    const eventRepo = AppDataSource.getRepository(CalendarEvent);
    const attendeeRepo = AppDataSource.getRepository(CalendarEventAttendee);
    const reminderRepo = AppDataSource.getRepository(Reminder);
    const actionRepo = AppDataSource.getRepository(PendingAction);

    await attendeeRepo.createQueryBuilder().delete().execute();
    await reminderRepo.createQueryBuilder().delete().execute();
    await eventRepo.createQueryBuilder().delete().execute();
    await actionRepo.createQueryBuilder().delete().execute();
  });

  describe("Authentication & Input Validation", () => {
    it("should reject unauthenticated requests with 401", async () => {
      const res = await fetch(`${baseUrl}/api/calendar/events`);
      assert.equal(res.status, 401);
    });

    it("should reject event creation where endAt is before startAt with 400", async () => {
      const res = await fetch(`${baseUrl}/api/calendar/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({
          summary: "Invalid timing meeting",
          startAt: "2026-11-05T14:00:00.000Z",
          endAt: "2026-11-05T13:00:00.000Z",
        }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, "VALIDATION_ERROR");
    });
  });

  describe("Meeting Creation & Automatic 10-Minute Reminder", () => {
    it("should create event in Google Calendar, persist local record + attendees, and schedule 10-minute reminder", async () => {
      const meetingStart = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
      const meetingEnd = new Date(meetingStart.getTime() + 45 * 60 * 1000); // 45 min duration

      const res = await fetch(`${baseUrl}/api/calendar/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({
          summary: "Q4 Strategy Sync",
          description: "Review milestones and OKRs with team",
          startAt: meetingStart.toISOString(),
          endAt: meetingEnd.toISOString(),
          attendees: ["colleague@example.com"],
        }),
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.ok(body.data.event);
      assert.equal(body.data.event.title, "Q4 Strategy Sync");
      assert.equal(body.data.event.meetUrl, "https://meet.google.com/abc-defg-hij");
      assert.ok(body.data.event.googleEventId);

      // Verify attendees in database
      const attendeeRepo = AppDataSource.getRepository(CalendarEventAttendee);
      const attendees = await attendeeRepo.find({
        where: { calendarEventId: body.data.event.id },
      });
      assert.equal(attendees.length, 1);
      assert.equal(attendees[0].email, "colleague@example.com");

      // Verify automated 10-minute reminder
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const reminder = await reminderRepo.findOne({
        where: { calendarEventId: body.data.event.id },
      });
      assert.ok(reminder);
      assert.equal(reminder.status, ReminderStatus.SCHEDULED);
      assert.match(reminder.title, /Meeting: Q4 Strategy Sync/);
      assert.match(reminder.description || "", /https:\/\/meet\.google\.com/);

      // Verify reminder scheduled time is exactly 10 minutes prior to meeting start
      const expectedReminderTime = meetingStart.getTime() - 10 * 60 * 1000;
      assert.equal(reminder.scheduledAt.getTime(), expectedReminderTime);
    });
  });

  describe("Meeting Rescheduling & Linked Reminder Update", () => {
    it("should update Google event time and automatically reschedule linked reminder", async () => {
      const meetingStart = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const meetingEnd = new Date(meetingStart.getTime() + 30 * 60 * 1000);

      // 1. Create meeting
      const createRes = await fetch(`${baseUrl}/api/calendar/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({
          summary: "Client Presentation",
          startAt: meetingStart.toISOString(),
          endAt: meetingEnd.toISOString(),
        }),
      });
      const createBody = (await createRes.json()) as any;
      const eventId = createBody.data.event.id;

      // 2. Reschedule meeting to 5 hours from now
      const newStart = new Date(Date.now() + 5 * 60 * 60 * 1000);
      const newEnd = new Date(newStart.getTime() + 30 * 60 * 1000);

      const updateRes = await fetch(`${baseUrl}/api/calendar/events/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
        }),
      });

      assert.equal(updateRes.status, 200);

      // Verify Google client update was invoked
      assert.equal(mockUpdatedEvents.length, 1);
      assert.equal(mockUpdatedEvents[0].eventId, createBody.data.event.googleEventId);

      // Verify linked reminder was automatically rescheduled to newStart - 10 minutes
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const reminder = await reminderRepo.findOne({
        where: { calendarEventId: eventId },
      });
      assert.ok(reminder);
      const expectedNewReminderTime = newStart.getTime() - 10 * 60 * 1000;
      assert.equal(reminder.scheduledAt.getTime(), expectedNewReminderTime);
    });
  });

  describe("Meeting Cancellation & Linked Reminder Cancellation", () => {
    it("should delete Google event, mark local event cancelled, and cancel linked reminder", async () => {
      const meetingStart = new Date(Date.now() + 4 * 60 * 60 * 1000);
      const meetingEnd = new Date(meetingStart.getTime() + 30 * 60 * 1000);

      // Create meeting
      const createRes = await fetch(`${baseUrl}/api/calendar/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({
          summary: "Budget Review",
          startAt: meetingStart.toISOString(),
          endAt: meetingEnd.toISOString(),
        }),
      });
      const createBody = (await createRes.json()) as any;
      const eventId = createBody.data.event.id;
      const googleEventId = createBody.data.event.googleEventId;

      // Cancel meeting
      const deleteRes = await fetch(`${baseUrl}/api/calendar/events/${eventId}`, {
        method: "DELETE",
        headers: { "x-user-id": user.id },
      });

      assert.equal(deleteRes.status, 200);

      // Verify Google API delete was called
      assert.ok(mockDeletedEventIds.includes(googleEventId));

      // Verify local event is cancelled
      const eventRepo = AppDataSource.getRepository(CalendarEvent);
      const localEvent = await eventRepo.findOneBy({ id: eventId });
      assert.ok(localEvent);
      assert.equal(localEvent.status, CalendarEventStatus.CANCELLED);

      // Verify linked reminder is cancelled
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const reminder = await reminderRepo.findOne({
        where: { calendarEventId: eventId },
      });
      assert.ok(reminder);
      assert.equal(reminder.status, ReminderStatus.CANCELLED);
    });
  });

  describe("PendingAction Confirmation Flow", () => {
    it("should execute CALENDAR_EVENT_CREATE upon confirmation and create 10-minute reminder", async () => {
      const meetingStart = new Date(Date.now() + 6 * 60 * 60 * 1000);
      const meetingEnd = new Date(meetingStart.getTime() + 60 * 60 * 1000);

      // Propose meeting creation action
      const pendingAction = await confirmationsService.proposeAction(user.id, {
        actionType: PendingActionType.CALENDAR_EVENT_CREATE,
        proposal: `Create meeting "Executive Committee" from ${meetingStart.toISOString()} to ${meetingEnd.toISOString()}`,
        payload: {
          summary: "Executive Committee",
          startAt: meetingStart.toISOString(),
          endAt: meetingEnd.toISOString(),
        },
        expiresInMinutes: 10,
      });

      assert.equal(pendingAction.status, PendingActionStatus.PENDING);

      // Confirm action
      const confirmationResult = await confirmationsService.confirmAction(
        user.id,
        pendingAction.id
      );

      assert.equal(confirmationResult.action.status, PendingActionStatus.EXECUTED);
      assert.ok(confirmationResult.result.event);
      assert.equal(confirmationResult.result.event.title, "Executive Committee");

      // Verify 10-minute reminder was created
      const reminderRepo = AppDataSource.getRepository(Reminder);
      const reminder = await reminderRepo.findOne({
        where: { calendarEventId: confirmationResult.result.event.id },
      });
      assert.ok(reminder);
      assert.equal(reminder.scheduledAt.getTime(), meetingStart.getTime() - 10 * 60 * 1000);
    });
  });

  describe("Provider Error Handling", () => {
    it("should abort creation and not save local records if Google Calendar API fails", async () => {
      googleCalendarClient.setTransport({
        async listEvents() {
          return [];
        },
        async createEvent() {
          throw new Error("Google Calendar API 500: Internal Server Error");
        },
        async updateEvent() {
          throw new Error("Update error");
        },
        async deleteEvent() {},
      });

      const meetingStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const meetingEnd = new Date(meetingStart.getTime() + 30 * 60 * 1000);

      const res = await fetch(`${baseUrl}/api/calendar/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({
          summary: "Failing Meeting",
          startAt: meetingStart.toISOString(),
          endAt: meetingEnd.toISOString(),
        }),
      });

      assert.equal(res.status, 500);

      // Verify no orphan local records exist in database
      const eventRepo = AppDataSource.getRepository(CalendarEvent);
      const count = await eventRepo.count({ where: { userId: user.id } });
      assert.equal(count, 0);

      // Restore transport
      googleCalendarClient.setTransport(mockTransport);
    });
  });
});
