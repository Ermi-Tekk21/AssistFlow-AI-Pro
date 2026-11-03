import { AppDataSource } from "../../config/database";
import { User } from "../../entities/User";
import { ConversationSession, ChatMessage, ActiveDraft } from "../../entities/ConversationSession";
import {
  PendingAction,
  PendingActionStatus,
  PendingActionType,
} from "../../entities/PendingAction";
import { Task, TaskPriority, TaskStatus } from "../../entities/Task";
import { Reminder, ReminderStatus } from "../../entities/Reminder";
import { CalendarEvent, CalendarEventStatus } from "../../entities/CalendarEvent";
import { tasksService } from "../tasks/tasks.service";
import { remindersService } from "../reminders/reminders.service";
import { confirmationsService } from "../confirmations/confirmations.service";
import { geminiClient, GeminiContext } from "./gemini.client";
import { AssistantIntent } from "./intent.schema";
import { NotFoundError, BadRequestError } from "../../middleware/errors";

export interface AssistantProcessResult {
  sessionId: string;
  response: string;
  intent: string;
  pendingAction?: PendingAction | null;
  data?: any;
}

export class AssistantService {
  private get sessionRepo() {
    return AppDataSource.getRepository(ConversationSession);
  }

  private get userRepo() {
    return AppDataSource.getRepository(User);
  }

  private get actionRepo() {
    return AppDataSource.getRepository(PendingAction);
  }

  private get taskRepo() {
    return AppDataSource.getRepository(Task);
  }

  private get reminderRepo() {
    return AppDataSource.getRepository(Reminder);
  }

  private get calendarRepo() {
    return AppDataSource.getRepository(CalendarEvent);
  }

  async getOrCreateSession(userId: string, sessionId?: string): Promise<ConversationSession> {
    if (sessionId) {
      const existing = await this.sessionRepo.findOne({
        where: { id: sessionId, userId },
      });
      if (existing) {
        return existing;
      }
    }

    // Try finding most recently updated session
    const recent = await this.sessionRepo.findOne({
      where: { userId },
      order: { updatedAt: "DESC" },
    });

    if (recent) {
      return recent;
    }

    // Create brand new session
    const newSession = this.sessionRepo.create({
      userId,
      title: "Assistant Session",
      messages: [],
      activeDraft: null,
    });
    return await this.sessionRepo.save(newSession);
  }

  async processMessage(
    userId: string,
    message: string,
    sessionId?: string
  ): Promise<AssistantProcessResult> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const session = await this.getOrCreateSession(userId, sessionId);

    // Check for an active unexpired PendingAction
    const activePendingAction = await this.actionRepo.findOne({
      where: {
        userId,
        status: PendingActionStatus.PENDING,
      },
      order: { createdAt: "DESC" },
    });

    const isPendingActive =
      activePendingAction != null && activePendingAction.expiresAt.getTime() > Date.now();

    const context: GeminiContext = {
      currentUtcTimestamp: new Date().toISOString(),
      userTimezone: user.timezone || "Africa/Addis_Ababa",
      history: session.messages,
      activeDraft: session.activeDraft,
      hasPendingConfirmation: isPendingActive,
    };

    // Interpret with Gemini
    const intentResult = await geminiClient.interpret(message, context);

    let responseText = "";
    let proposedPendingAction: PendingAction | null = null;
    let extraData: any = undefined;

    switch (intentResult.intent) {
      case "confirmation_reply": {
        if (!isPendingActive || !activePendingAction) {
          responseText =
            "There are currently no pending proposals awaiting confirmation. How else can I assist you?";
          session.activeDraft = null;
          break;
        }

        if (intentResult.params.confirmed) {
          try {
            const outcome = await confirmationsService.confirmAction(userId, activePendingAction.id);
            responseText = `Confirmed and executed: "${activePendingAction.proposal}".`;

            // If a meeting was scheduled, prominently return the Google Meet URL so the user can share it
            if (
              activePendingAction.actionType === PendingActionType.CALENDAR_EVENT_CREATE &&
              outcome.result?.event?.meetUrl
            ) {
              responseText += `\n\nGoogle Meet Link:\n${outcome.result.event.meetUrl}\n(Share this URL with attendees to join)`;
            }

            extraData = outcome.result;
          } catch (execErr: any) {
            responseText = `Could not execute action: ${execErr.message || execErr}`;
          }
        } else {
          const rejected = await confirmationsService.rejectAction(userId, activePendingAction.id);
          responseText = `Cancelled: "${activePendingAction.proposal}". No changes were made.`;
          extraData = rejected;
        }
        session.activeDraft = null;
        break;
      }

      case "clarification_needed": {
        // Save or update active draft for slot filling across turns
        const currentDraft = session.activeDraft || {
          intent: intentResult.params.partialIntent || "draft",
          params: {},
          missingFields: [],
        };

        session.activeDraft = {
          intent: intentResult.params.partialIntent || currentDraft.intent,
          params: {
            ...currentDraft.params,
            ...(intentResult.params.partialParams || {}),
          },
          missingFields: intentResult.params.missingFields,
        };

        responseText = intentResult.params.question;
        break;
      }

      case "task_create": {
        session.activeDraft = null;
        const { title, description, priority, dueAt } = intentResult.params;
        const dueFormatted = dueAt ? ` due ${dueAt}` : "";
        const proposal = `Create task "${title}" with priority ${priority}${dueFormatted}`;

        proposedPendingAction = await confirmationsService.proposeAction(userId, {
          actionType: PendingActionType.TASK_CREATE,
          proposal,
          payload: { title, description, priority, dueAt: dueAt || undefined },
          expiresInMinutes: 10,
        });

        responseText = `I have prepared the following proposal:\n"${proposal}"\n\nWould you like me to proceed? (Reply 'yes' to confirm or 'no' to cancel)`;
        break;
      }

      case "task_complete": {
        session.activeDraft = null;
        let task: Task | null = null;
        if (intentResult.params.taskId) {
          task = await this.taskRepo.findOne({
            where: { id: intentResult.params.taskId, userId },
          });
        } else if (intentResult.params.query) {
          task = await this.taskRepo
            .createQueryBuilder("task")
            .where("task.userId = :userId", { userId })
            .andWhere("task.status = :status", { status: TaskStatus.PENDING })
            .andWhere("task.title ILIKE :q", { q: `%${intentResult.params.query}%` })
            .orderBy("task.createdAt", "DESC")
            .getOne();
        }

        if (!task) {
          responseText = `I could not find a pending task matching "${
            intentResult.params.query || intentResult.params.taskId
          }".`;
          break;
        }

        const proposal = `Mark task "${task.title}" as completed`;
        proposedPendingAction = await confirmationsService.proposeAction(userId, {
          actionType: PendingActionType.TASK_COMPLETE,
          proposal,
          payload: {},
          targetEntityId: task.id,
          targetEntityType: "task",
          expiresInMinutes: 10,
        });

        responseText = `Proposal:\n"${proposal}"\n\nWould you like me to mark this as completed? (yes/no)`;
        break;
      }

      case "task_update": {
        session.activeDraft = null;
        let task: Task | null = null;
        if (intentResult.params.taskId) {
          task = await this.taskRepo.findOne({
            where: { id: intentResult.params.taskId, userId },
          });
        } else if (intentResult.params.query) {
          task = await this.taskRepo
            .createQueryBuilder("task")
            .where("task.userId = :userId", { userId })
            .andWhere("task.title ILIKE :q", { q: `%${intentResult.params.query}%` })
            .orderBy("task.createdAt", "DESC")
            .getOne();
        }

        if (!task) {
          responseText = `Could not find a task matching "${
            intentResult.params.query || intentResult.params.taskId
          }".`;
          break;
        }

        const updates: any = {};
        if (intentResult.params.title) updates.title = intentResult.params.title;
        if (intentResult.params.description !== undefined)
          updates.description = intentResult.params.description;
        if (intentResult.params.priority) updates.priority = intentResult.params.priority;
        if (intentResult.params.dueAt !== undefined) updates.dueAt = intentResult.params.dueAt;
        if (intentResult.params.status) updates.status = intentResult.params.status;

        const proposal = `Update task "${task.title}": ${JSON.stringify(updates)}`;
        proposedPendingAction = await confirmationsService.proposeAction(userId, {
          actionType: PendingActionType.TASK_UPDATE,
          proposal,
          payload: updates,
          targetEntityId: task.id,
          targetEntityType: "task",
          expiresInMinutes: 10,
        });

        responseText = `Proposal:\n"${proposal}"\n\nPlease reply 'yes' to apply this update, or 'no' to cancel.`;
        break;
      }

      case "task_delete": {
        session.activeDraft = null;
        let task: Task | null = null;
        if (intentResult.params.taskId) {
          task = await this.taskRepo.findOne({
            where: { id: intentResult.params.taskId, userId },
          });
        } else if (intentResult.params.query) {
          task = await this.taskRepo
            .createQueryBuilder("task")
            .where("task.userId = :userId", { userId })
            .andWhere("task.title ILIKE :q", { q: `%${intentResult.params.query}%` })
            .getOne();
        }

        if (!task) {
          responseText = `Could not find a task matching "${
            intentResult.params.query || intentResult.params.taskId
          }".`;
          break;
        }

        const proposal = `Delete task "${task.title}"`;
        proposedPendingAction = await confirmationsService.proposeAction(userId, {
          actionType: PendingActionType.TASK_DELETE,
          proposal,
          payload: {},
          targetEntityId: task.id,
          targetEntityType: "task",
          expiresInMinutes: 10,
        });

        responseText = `Proposal:\n"${proposal}"\n\nAre you sure you want to delete this task? (yes/no)`;
        break;
      }

      case "reminder_create": {
        session.activeDraft = null;
        const { title, scheduledAt, description } = intentResult.params;
        const proposal = `Schedule reminder "${title}" for ${scheduledAt}`;

        proposedPendingAction = await confirmationsService.proposeAction(userId, {
          actionType: PendingActionType.REMINDER_CREATE,
          proposal,
          payload: {
            title,
            scheduledAt,
            timezone: user.timezone || "Africa/Addis_Ababa",
            description,
          },
          expiresInMinutes: 10,
        });

        responseText = `I have prepared the following reminder:\n"${proposal}"\n\nWould you like me to schedule it? (yes/no)`;
        break;
      }

      case "reminder_snooze": {
        session.activeDraft = null;
        let reminder: Reminder | null = null;
        if (intentResult.params.reminderId) {
          reminder = await this.reminderRepo.findOne({
            where: { id: intentResult.params.reminderId, userId },
          });
        } else if (intentResult.params.query) {
          reminder = await this.reminderRepo
            .createQueryBuilder("r")
            .where("r.userId = :userId", { userId })
            .andWhere("r.status = :st", { st: ReminderStatus.SCHEDULED })
            .andWhere("r.title ILIKE :q", { q: `%${intentResult.params.query}%` })
            .orderBy("r.scheduledAt", "ASC")
            .getOne();
        }

        if (!reminder) {
          responseText = `Could not find an active reminder matching "${
            intentResult.params.query || intentResult.params.reminderId
          }".`;
          break;
        }

        const minutes = intentResult.params.minutes || 15;
        const proposal = `Snooze reminder "${reminder.title}" by ${minutes} minutes`;
        proposedPendingAction = await confirmationsService.proposeAction(userId, {
          actionType: PendingActionType.REMINDER_SNOOZE,
          proposal,
          payload: { minutes },
          targetEntityId: reminder.id,
          targetEntityType: "reminder",
          expiresInMinutes: 10,
        });

        responseText = `Proposal:\n"${proposal}"\n\nConfirm snooze? (yes/no)`;
        break;
      }

      case "reminder_cancel": {
        session.activeDraft = null;
        let reminder: Reminder | null = null;
        if (intentResult.params.reminderId) {
          reminder = await this.reminderRepo.findOne({
            where: { id: intentResult.params.reminderId, userId },
          });
        } else if (intentResult.params.query) {
          reminder = await this.reminderRepo
            .createQueryBuilder("r")
            .where("r.userId = :userId", { userId })
            .andWhere("r.status = :st", { st: ReminderStatus.SCHEDULED })
            .andWhere("r.title ILIKE :q", { q: `%${intentResult.params.query}%` })
            .getOne();
        }

        if (!reminder) {
          responseText = `Could not find a scheduled reminder matching "${
            intentResult.params.query || intentResult.params.reminderId
          }".`;
          break;
        }

        const proposal = `Cancel reminder "${reminder.title}"`;
        proposedPendingAction = await confirmationsService.proposeAction(userId, {
          actionType: PendingActionType.REMINDER_CANCEL,
          proposal,
          payload: {},
          targetEntityId: reminder.id,
          targetEntityType: "reminder",
          expiresInMinutes: 10,
        });

        responseText = `Proposal:\n"${proposal}"\n\nConfirm cancellation? (yes/no)`;
        break;
      }

      case "task_list": {
        // Read-only operation: executes directly without confirmation
        session.activeDraft = null;
        const result = await tasksService.listTasks(userId, {
          status: intentResult.params.status as any,
          priority: intentResult.params.priority as any,
          sortBy: (intentResult.params.sortBy || "createdAt") as any,
          sortOrder: (intentResult.params.sortOrder || "desc") as any,
          limit: intentResult.params.limit || 50,
          offset: 0,
        });
        extraData = result;

        if (result.tasks.length === 0) {
          responseText = "You have no tasks matching the criteria.";
        } else {
          const lines = result.tasks.map(
            (t) =>
              `- [${t.status.toUpperCase()}] ${t.title} (Priority: ${t.priority}${
                t.dueAt ? `, Due: ${new Date(t.dueAt).toISOString()}` : ""
              })`
          );
          responseText = `Found ${result.tasks.length} task(s):\n${lines.join("\n")}`;
        }
        break;
      }

      case "reminder_list": {
        // Read-only: executes directly
        session.activeDraft = null;
        const result = await remindersService.listReminders(userId, {
          status: intentResult.params.status as any,
          limit: intentResult.params.limit || 50,
          offset: 0,
          sortBy: "scheduledAt",
          sortOrder: "asc",
        });
        extraData = result;

        if (result.reminders.length === 0) {
          responseText = "You have no reminders found.";
        } else {
          const lines = result.reminders.map(
            (r) =>
              `- [${r.status.toUpperCase()}] ${r.title} at ${new Date(
                r.scheduledAt
              ).toISOString()} (${r.timezone})`
          );
          responseText = `Found ${result.reminders.length} reminder(s):\n${lines.join("\n")}`;
        }
        break;
      }

      case "calendar_list": {
        // Read-only
        session.activeDraft = null;
        const events = await this.calendarRepo.find({
          where: { userId },
          order: { startAt: "ASC" },
          take: 10,
        });
        extraData = events;

        if (events.length === 0) {
          responseText = "You have no upcoming calendar events.";
        } else {
          const lines = events.map(
            (e) =>
              `- ${e.title} (${new Date(e.startAt).toISOString()} to ${new Date(
                e.endAt
              ).toISOString()})${e.meetUrl ? ` [Meet: ${e.meetUrl}]` : ""}`
          );
          responseText = `Upcoming calendar events:\n${lines.join("\n")}`;
        }
        break;
      }

      case "calendar_create": {
        const { summary, startAt, endAt, description, location, attendees } = intentResult.params;

        // Require at least one attendee email for meeting creation
        if (!attendees || attendees.length === 0) {
          session.activeDraft = {
            intent: "calendar_create",
            params: intentResult.params,
            missingFields: ["attendees"],
          };
          responseText = `Who will be attending "${summary}"? Please provide at least one attendee email address (e.g. colleague@example.com) to complete the meeting invite.`;
          break;
        }

        session.activeDraft = null;
        const attendeesStr = attendees.join(", ");
        const proposal = `Create meeting "${summary}" from ${startAt} to ${endAt} with attendees: ${attendeesStr}`;

        proposedPendingAction = await confirmationsService.proposeAction(userId, {
          actionType: PendingActionType.CALENDAR_EVENT_CREATE,
          proposal,
          payload: { summary, startAt, endAt, description, location, attendees },
          expiresInMinutes: 10,
        });

        responseText = `I prepared this meeting proposal:\n"${proposal}"\n\nWould you like me to schedule it? (yes/no)`;
        break;
      }

      case "calendar_cancel": {
        session.activeDraft = null;
        let event: CalendarEvent | null = null;
        if (intentResult.params.calendarEventId) {
          event = await this.calendarRepo.findOne({
            where: { id: intentResult.params.calendarEventId, userId },
          });
        } else if (intentResult.params.query) {
          event = await this.calendarRepo
            .createQueryBuilder("e")
            .where("e.userId = :userId", { userId })
            .andWhere("e.status = :status", { status: CalendarEventStatus.CONFIRMED })
            .andWhere("e.title ILIKE :q", { q: `%${intentResult.params.query}%` })
            .orderBy("e.startAt", "ASC")
            .getOne();
        }

        if (!event) {
          responseText = `Could not find an upcoming meeting matching "${
            intentResult.params.query || intentResult.params.calendarEventId
          }".`;
          break;
        }

        const proposal = `Cancel meeting "${event.title}" scheduled for ${event.startAt.toISOString()}`;
        proposedPendingAction = await confirmationsService.proposeAction(userId, {
          actionType: PendingActionType.CALENDAR_EVENT_CANCEL,
          proposal,
          payload: { id: event.id },
          targetEntityId: event.id,
          targetEntityType: "calendar_event",
          expiresInMinutes: 10,
        });

        responseText = `Proposal:\n"${proposal}"\n\nConfirm cancellation? (yes/no)`;
        break;
      }

      case "daily_briefing_request": {
        session.activeDraft = null;
        const pendingTasks = await this.taskRepo.find({
          where: { userId, status: TaskStatus.PENDING },
          order: { priority: "DESC", dueAt: "ASC" },
          take: 5,
        });

        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const todayReminders = await this.reminderRepo
          .createQueryBuilder("r")
          .where("r.userId = :userId", { userId })
          .andWhere("r.status = :status", { status: ReminderStatus.SCHEDULED })
          .andWhere("r.scheduledAt <= :endOfDay", { endOfDay })
          .orderBy("r.scheduledAt", "ASC")
          .getMany();

        const todayEvents = await this.calendarRepo
          .createQueryBuilder("e")
          .where("e.userId = :userId", { userId })
          .andWhere("e.status = :status", { status: CalendarEventStatus.CONFIRMED })
          .andWhere("e.startAt <= :endOfDay", { endOfDay })
          .orderBy("e.startAt", "ASC")
          .getMany();

        let briefingText = `Good morning! Here is your daily briefing for ${now.toDateString()}:\n\n`;

        briefingText += `📋 Pending Tasks (${pendingTasks.length}):\n`;
        if (pendingTasks.length === 0) {
          briefingText += "  No pending tasks for today.\n";
        } else {
          pendingTasks.forEach((t) => {
            briefingText += `  • [${t.priority.toUpperCase()}] ${t.title}${
              t.dueAt ? ` (Due: ${new Date(t.dueAt).toLocaleTimeString()})` : ""
            }\n`;
          });
        }

        briefingText += `\n⏰ Reminders (${todayReminders.length}):\n`;
        if (todayReminders.length === 0) {
          briefingText += "  No scheduled reminders for today.\n";
        } else {
          todayReminders.forEach((r) => {
            briefingText += `  • ${r.title} at ${new Date(r.scheduledAt).toLocaleTimeString()}\n`;
          });
        }

        briefingText += `\n📅 Calendar Meetings (${todayEvents.length}):\n`;
        if (todayEvents.length === 0) {
          briefingText += "  No scheduled meetings for today.\n";
        } else {
          todayEvents.forEach((e) => {
            briefingText += `  • ${e.title} at ${new Date(e.startAt).toLocaleTimeString()}${
              e.meetUrl ? ` (Meet: ${e.meetUrl})` : ""
            }\n`;
          });
        }

        responseText = briefingText;
        extraData = {
          taskCount: pendingTasks.length,
          reminderCount: todayReminders.length,
          eventCount: todayEvents.length,
        };
        break;
      }

      case "unknown":
      default: {
        const unknownParams = intentResult.params as { message?: string };
        responseText =
          unknownParams?.message ||
          "I'm sorry, I couldn't understand that request. Could you please clarify?";
        break;
      }
    }

    // Append to message history
    const nowIso = new Date().toISOString();
    session.messages.push({
      role: "user",
      content: message,
      timestamp: nowIso,
    });
    session.messages.push({
      role: "assistant",
      content: responseText,
      timestamp: nowIso,
    });

    // Retain maximum last 30 messages in session
    if (session.messages.length > 30) {
      session.messages = session.messages.slice(-30);
    }

    await this.sessionRepo.save(session);

    return {
      sessionId: session.id,
      response: responseText,
      intent: intentResult.intent,
      pendingAction: proposedPendingAction,
      data: extraData,
    };
  }
}

export const assistantService = new AssistantService();
