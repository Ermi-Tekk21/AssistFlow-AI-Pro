import { AppDataSource } from "../../config/database";
import { Reminder, ReminderStatus } from "../../entities/Reminder";
import { Task } from "../../entities/Task";
import { CalendarEvent } from "../../entities/CalendarEvent";
import { BadRequestError, NotFoundError } from "../../middleware/errors";
import {
  CreateReminderInput,
  UpdateReminderInput,
  SnoozeReminderInput,
  ListRemindersQuery,
} from "./reminders.validation";

export class RemindersService {
  private get reminderRepo() {
    return AppDataSource.getRepository(Reminder);
  }

  private get taskRepo() {
    return AppDataSource.getRepository(Task);
  }

  private get calendarEventRepo() {
    return AppDataSource.getRepository(CalendarEvent);
  }

  async createReminder(userId: string, input: CreateReminderInput): Promise<Reminder> {
    if (input.taskId && input.calendarEventId) {
      throw new BadRequestError(
        "A reminder cannot reference both a task and a calendar event simultaneously"
      );
    }

    if (input.taskId) {
      const task = await this.taskRepo.findOne({
        where: { id: input.taskId, userId },
      });
      if (!task) {
        throw new BadRequestError(
          "Associated task does not exist or does not belong to you"
        );
      }
    }

    if (input.calendarEventId) {
      const calendarEvent = await this.calendarEventRepo.findOne({
        where: { id: input.calendarEventId, userId },
      });
      if (!calendarEvent) {
        throw new BadRequestError(
          "Associated calendar event does not exist or does not belong to you"
        );
      }
    }

    const scheduledDate = new Date(input.scheduledAt);
    if (scheduledDate.getTime() <= Date.now() - 5000) {
      throw new BadRequestError("Scheduled time must be in the future");
    }

    const reminder = this.reminderRepo.create({
      userId,
      title: input.title,
      description: input.description ?? null,
      scheduledAt: scheduledDate,
      timezone: input.timezone,
      status: ReminderStatus.SCHEDULED,
      taskId: input.taskId ?? null,
      calendarEventId: input.calendarEventId ?? null,
      sentAt: null,
    });

    return await this.reminderRepo.save(reminder);
  }

  async listReminders(
    userId: string,
    query: ListRemindersQuery
  ): Promise<{ reminders: Reminder[]; total: number; limit: number; offset: number }> {
    const qb = this.reminderRepo.createQueryBuilder("reminder");

    qb.where("reminder.userId = :userId", { userId });

    if (query.status) {
      qb.andWhere("reminder.status = :status", { status: query.status });
    }

    if (query.taskId) {
      qb.andWhere("reminder.taskId = :taskId", { taskId: query.taskId });
    }

    if (query.calendarEventId) {
      qb.andWhere("reminder.calendarEventId = :calendarEventId", {
        calendarEventId: query.calendarEventId,
      });
    }

    if (query.search) {
      qb.andWhere(
        "(reminder.title ILIKE :search OR reminder.description ILIKE :search)",
        { search: `%${query.search}%` }
      );
    }

    if (query.dueBefore) {
      qb.andWhere("reminder.scheduledAt <= :dueBefore", {
        dueBefore: new Date(query.dueBefore),
      });
    }

    if (query.dueAfter) {
      qb.andWhere("reminder.scheduledAt >= :dueAfter", {
        dueAfter: new Date(query.dueAfter),
      });
    }

    const sortField = query.sortBy ? `reminder.${query.sortBy}` : "reminder.scheduledAt";
    const sortOrder = query.sortOrder ? (query.sortOrder.toUpperCase() as "ASC" | "DESC") : "ASC";

    qb.orderBy(sortField, sortOrder);
    qb.addOrderBy("reminder.id", "ASC");

    qb.skip(query.offset);
    qb.take(query.limit);

    const [reminders, total] = await qb.getManyAndCount();

    return {
      reminders,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getReminderById(userId: string, reminderId: string): Promise<Reminder> {
    const reminder = await this.reminderRepo.findOne({
      where: { id: reminderId, userId },
      relations: { task: true, calendarEvent: true },
    });

    if (!reminder) {
      throw new NotFoundError("Reminder not found");
    }

    return reminder;
  }

  async updateReminder(
    userId: string,
    reminderId: string,
    input: UpdateReminderInput
  ): Promise<Reminder> {
    const reminder = await this.getReminderById(userId, reminderId);

    // Validate status transition: cannot update cancelled or sent reminders
    if (reminder.status === ReminderStatus.CANCELLED) {
      throw new BadRequestError("Cannot reschedule or modify a cancelled reminder");
    }

    if (reminder.status === ReminderStatus.SENT) {
      throw new BadRequestError("Cannot reschedule or modify an already sent reminder");
    }

    if (input.scheduledAt !== undefined) {
      const newScheduledDate = new Date(input.scheduledAt);
      if (newScheduledDate.getTime() <= Date.now() - 5000) {
        throw new BadRequestError("Scheduled time must be in the future");
      }
      reminder.scheduledAt = newScheduledDate;
      // If the reminder had failed, rescheduling it resets it to scheduled
      if (reminder.status === ReminderStatus.FAILED) {
        reminder.status = ReminderStatus.SCHEDULED;
      }
    }

    if (input.title !== undefined) {
      reminder.title = input.title;
    }

    if (input.description !== undefined) {
      reminder.description = input.description;
    }

    if (input.timezone !== undefined) {
      reminder.timezone = input.timezone;
    }

    return await this.reminderRepo.save(reminder);
  }

  async snoozeReminder(
    userId: string,
    reminderId: string,
    input: SnoozeReminderInput
  ): Promise<Reminder> {
    const reminder = await this.getReminderById(userId, reminderId);

    if (reminder.status === ReminderStatus.CANCELLED) {
      throw new BadRequestError("Cannot snooze a cancelled reminder");
    }

    let nextScheduledAt: Date;

    if (input.snoozeMinutes !== undefined) {
      nextScheduledAt = new Date(Date.now() + input.snoozeMinutes * 60 * 1000);
    } else if (input.scheduledAt !== undefined) {
      nextScheduledAt = new Date(input.scheduledAt);
      if (nextScheduledAt.getTime() <= Date.now() - 5000) {
        throw new BadRequestError("Scheduled time must be in the future");
      }
    } else {
      throw new BadRequestError(
        "Either snoozeMinutes or scheduledAt must be provided to snooze"
      );
    }

    // Snoozing acts as a reschedule: set to SCHEDULED with new time
    reminder.scheduledAt = nextScheduledAt;
    reminder.status = ReminderStatus.SCHEDULED;
    reminder.sentAt = null;

    return await this.reminderRepo.save(reminder);
  }

  async cancelReminder(userId: string, reminderId: string): Promise<Reminder> {
    const reminder = await this.getReminderById(userId, reminderId);

    if (reminder.status === ReminderStatus.SENT) {
      throw new BadRequestError("Cannot cancel an already sent reminder");
    }

    reminder.status = ReminderStatus.CANCELLED;
    return await this.reminderRepo.save(reminder);
  }

  async findDueReminders(asOf = new Date(), limit = 50): Promise<Reminder[]> {
    return await this.reminderRepo
      .createQueryBuilder("reminder")
      .where("reminder.status = :status", { status: ReminderStatus.SCHEDULED })
      .andWhere("reminder.scheduledAt <= :asOf", { asOf })
      .orderBy("reminder.scheduledAt", "ASC")
      .take(limit)
      .getMany();
  }
}

export const remindersService = new RemindersService();
