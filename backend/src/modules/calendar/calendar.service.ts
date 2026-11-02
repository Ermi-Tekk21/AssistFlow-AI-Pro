import { AppDataSource } from "../../config/database";
import { CalendarEvent, CalendarEventStatus } from "../../entities/CalendarEvent";
import { CalendarEventAttendee } from "../../entities/CalendarEventAttendee";
import { Reminder, ReminderStatus } from "../../entities/Reminder";
import { User } from "../../entities/User";
import {
  googleCalendarClient,
  GoogleCalendarEventPayload,
} from "../integrations/google/googleCalendar.client";
import {
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  ListCalendarEventsQuery,
} from "./calendar.validation";
import { NotFoundError, BadRequestError } from "../../middleware/errors";

export class CalendarService {
  private get eventRepo() {
    return AppDataSource.getRepository(CalendarEvent);
  }

  private get attendeeRepo() {
    return AppDataSource.getRepository(CalendarEventAttendee);
  }

  private get reminderRepo() {
    return AppDataSource.getRepository(Reminder);
  }

  private get userRepo() {
    return AppDataSource.getRepository(User);
  }

  async listEvents(
    userId: string,
    query: ListCalendarEventsQuery
  ): Promise<{ events: CalendarEvent[]; total: number }> {
    const qb = this.eventRepo
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.attendees", "attendee")
      .where("event.userId = :userId", { userId });

    if (query.status) {
      qb.andWhere("event.status = :status", { status: query.status });
    }

    if (query.startAfter) {
      qb.andWhere("event.startAt >= :startAfter", {
        startAfter: new Date(query.startAfter),
      });
    }

    if (query.startBefore) {
      qb.andWhere("event.startAt <= :startBefore", {
        startBefore: new Date(query.startBefore),
      });
    }

    qb.orderBy("event.startAt", "ASC");
    qb.take(query.limit);

    const [events, total] = await qb.getManyAndCount();
    return { events, total };
  }

  async getEventById(userId: string, eventId: string): Promise<CalendarEvent> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId, userId },
      relations: { attendees: true },
    });

    if (!event) {
      throw new NotFoundError("Calendar event not found");
    }

    return event;
  }

  async createEvent(
    userId: string,
    input: CreateCalendarEventInput
  ): Promise<{ event: CalendarEvent; reminder?: Reminder }> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const timezone = input.timezone || user.timezone || "Africa/Addis_Ababa";

    // 1. Google Calendar is authoritative - call Google API first
    const googlePayload: GoogleCalendarEventPayload = {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startAt, timeZone: timezone },
      end: { dateTime: input.endAt, timeZone: timezone },
      location: input.location,
      attendees: input.attendees?.map((email) => ({ email })),
    };

    const googleRes = await googleCalendarClient.createEvent(userId, googlePayload);

    // Extract Meet URL if returned
    const meetUrl =
      googleRes.hangoutLink ||
      googleRes.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")
        ?.uri ||
      null;

    // 2. Persist local CalendarEvent
    const calendarEvent = this.eventRepo.create({
      userId,
      googleCalendarId: "primary",
      googleEventId: googleRes.id || `google-${Date.now()}`,
      title: input.summary,
      description: input.description ?? null,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      timezone,
      meetUrl,
      status: CalendarEventStatus.CONFIRMED,
    });

    const savedEvent = await this.eventRepo.save(calendarEvent);

    // 3. Persist Attendees
    if (input.attendees && input.attendees.length > 0) {
      const attendees = input.attendees.map((email) =>
        this.attendeeRepo.create({
          calendarEventId: savedEvent.id,
          email,
          displayName: null,
          responseStatus: "needsAction",
        })
      );
      await this.attendeeRepo.save(attendees);
      savedEvent.attendees = attendees;
    }

    // 4. Automatically schedule a Telegram reminder 10 minutes prior to meeting start
    const reminderScheduledAt = new Date(savedEvent.startAt.getTime() - 10 * 60 * 1000);
    let reminder: Reminder | undefined = undefined;

    const reminderTitle = `Meeting: ${savedEvent.title}`;
    const reminderDesc = `Upcoming meeting starts in 10 minutes.${
      meetUrl ? ` Google Meet: ${meetUrl}` : ""
    }`;

    reminder = await this.reminderRepo.save(
      this.reminderRepo.create({
        userId,
        calendarEventId: savedEvent.id,
        title: reminderTitle,
        description: reminderDesc,
        scheduledAt: reminderScheduledAt,
        timezone,
        status: ReminderStatus.SCHEDULED,
      })
    );

    return { event: savedEvent, reminder };
  }

  async updateEvent(
    userId: string,
    eventId: string,
    updates: UpdateCalendarEventInput
  ): Promise<{ event: CalendarEvent; reminder?: Reminder }> {
    const event = await this.getEventById(userId, eventId);

    if (event.status === CalendarEventStatus.CANCELLED) {
      throw new BadRequestError("Cannot update a cancelled calendar event");
    }

    // 1. Mutate Google Calendar API first
    const googlePayload: Partial<GoogleCalendarEventPayload> = {};
    if (updates.summary) googlePayload.summary = updates.summary;
    if (updates.description !== undefined) googlePayload.description = updates.description;
    if (updates.startAt)
      googlePayload.start = { dateTime: updates.startAt, timeZone: updates.timezone || event.timezone };
    if (updates.endAt)
      googlePayload.end = { dateTime: updates.endAt, timeZone: updates.timezone || event.timezone };
    if (updates.location !== undefined) googlePayload.location = updates.location;
    if (updates.attendees) {
      googlePayload.attendees = updates.attendees.map((email) => ({ email }));
    }

    const googleRes = await googleCalendarClient.updateEvent(
      userId,
      event.googleEventId,
      googlePayload
    );

    // 2. Update local event
    if (updates.summary) event.title = updates.summary;
    if (updates.description !== undefined) event.description = updates.description;
    if (updates.startAt) event.startAt = new Date(updates.startAt);
    if (updates.endAt) event.endAt = new Date(updates.endAt);
    if (updates.timezone) event.timezone = updates.timezone;
    if (googleRes.hangoutLink) event.meetUrl = googleRes.hangoutLink;

    const savedEvent = await this.eventRepo.save(event);

    // 3. If attendees updated, re-sync attendees
    if (updates.attendees) {
      await this.attendeeRepo.delete({ calendarEventId: event.id });
      const attendees = updates.attendees.map((email) =>
        this.attendeeRepo.create({
          calendarEventId: event.id,
          email,
          displayName: null,
          responseStatus: "needsAction",
        })
      );
      await this.attendeeRepo.save(attendees);
      savedEvent.attendees = attendees;
    }

    // 4. Update linked 10-minute reminder if start time changed
    let reminder: Reminder | undefined = undefined;
    if (updates.startAt || updates.summary) {
      const existingReminder = await this.reminderRepo.findOne({
        where: { calendarEventId: event.id, userId },
      });

      if (existingReminder && existingReminder.status === ReminderStatus.SCHEDULED) {
        if (updates.startAt) {
          existingReminder.scheduledAt = new Date(savedEvent.startAt.getTime() - 10 * 60 * 1000);
        }
        if (updates.summary) {
          existingReminder.title = `Meeting: ${savedEvent.title}`;
        }
        reminder = await this.reminderRepo.save(existingReminder);
      }
    }

    return { event: savedEvent, reminder };
  }

  async cancelEvent(userId: string, eventId: string): Promise<CalendarEvent> {
    const event = await this.getEventById(userId, eventId);

    // 1. Delete on Google Calendar API first
    await googleCalendarClient.cancelEvent(userId, event.googleEventId);

    // 2. Mark local event cancelled
    event.status = CalendarEventStatus.CANCELLED;
    const cancelledEvent = await this.eventRepo.save(event);

    // 3. Automatically cancel the linked reminder
    const existingReminder = await this.reminderRepo.findOne({
      where: { calendarEventId: event.id, userId },
    });

    if (existingReminder && existingReminder.status === ReminderStatus.SCHEDULED) {
      existingReminder.status = ReminderStatus.CANCELLED;
      await this.reminderRepo.save(existingReminder);
    }

    return cancelledEvent;
  }
}

export const calendarService = new CalendarService();
