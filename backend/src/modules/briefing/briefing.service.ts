import { AppDataSource } from "../../config/database";
import { User } from "../../entities/User";
import { Task, TaskPriority, TaskStatus } from "../../entities/Task";
import { Reminder, ReminderStatus } from "../../entities/Reminder";
import { CalendarEvent, CalendarEventStatus } from "../../entities/CalendarEvent";
import {
  DailyBriefingRecord,
  DailyBriefingStatus,
} from "../../entities/DailyBriefingRecord";
import { telegramClient } from "../integrations/telegram/telegram.client";
import { NotFoundError, BadRequestError } from "../../middleware/errors";

export interface CompiledBriefingData {
  user: User;
  localDateStr: string;
  formattedDate: string;
  tasks: Task[];
  reminders: Reminder[];
  events: CalendarEvent[];
}

export interface SendBriefingResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  briefingDate: string;
  messageId?: string;
  counts: {
    tasks: number;
    reminders: number;
    events: number;
  };
  content?: string;
}

export class BriefingService {
  private get userRepo() {
    return AppDataSource.getRepository(User);
  }

  private get taskRepo() {
    return AppDataSource.getRepository(Task);
  }

  private get reminderRepo() {
    return AppDataSource.getRepository(Reminder);
  }

  private get eventRepo() {
    return AppDataSource.getRepository(CalendarEvent);
  }

  private get briefingRepo() {
    return AppDataSource.getRepository(DailyBriefingRecord);
  }

  public getLocalDayBounds(
    timeZone: string,
    refDate: Date = new Date()
  ): { localDateStr: string; startUtc: Date; endUtc: Date; localTimeStr: string } {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(refDate);

    const m: Record<string, string> = {};
    parts.forEach((p) => (m[p.type] = p.value));

    const localDateStr = `${m.year}-${m.month}-${m.day}`;
    const localTimeStr = `${m.hour}:${m.minute}`;

    const utcDate = new Date(Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day)));
    const testParts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(utcDate);

    const tm: Record<string, string> = {};
    testParts.forEach((p) => (tm[p.type] = p.value));

    const testHour = Number(tm.hour) % 24;
    const testMinute = Number(tm.minute);
    const offsetMs = (testHour * 60 + testMinute) * 60 * 1000;

    const startUtc = new Date(utcDate.getTime() - offsetMs);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

    return { localDateStr, startUtc, endUtc, localTimeStr };
  }

  async compileBriefingData(userId: string, targetDate: Date = new Date()): Promise<CompiledBriefingData> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const timezone = user.timezone || "Africa/Addis_Ababa";
    const { localDateStr, startUtc, endUtc } = this.getLocalDayBounds(timezone, targetDate);

    // 1. Pending & Overdue Tasks
    const tasks = await this.taskRepo
      .createQueryBuilder("task")
      .where("task.userId = :userId", { userId })
      .andWhere("task.status = :status", { status: TaskStatus.PENDING })
      .andWhere("(task.dueAt IS NULL OR task.dueAt <= :endUtc)", { endUtc })
      .orderBy(
        `CASE task.priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4 END`,
        "ASC"
      )
      .addOrderBy("task.dueAt", "ASC", "NULLS LAST")
      .getMany();

    // 2. Scheduled Reminders for Today
    const reminders = await this.reminderRepo
      .createQueryBuilder("r")
      .where("r.userId = :userId", { userId })
      .andWhere("r.status = :status", { status: ReminderStatus.SCHEDULED })
      .andWhere("r.scheduledAt >= :startUtc AND r.scheduledAt <= :endUtc", { startUtc, endUtc })
      .orderBy("r.scheduledAt", "ASC")
      .getMany();

    // 3. Confirmed Calendar Events for Today
    const events = await this.eventRepo
      .createQueryBuilder("e")
      .where("e.userId = :userId", { userId })
      .andWhere("e.status = :status", { status: CalendarEventStatus.CONFIRMED })
      .andWhere("e.startAt >= :startUtc AND e.startAt <= :endUtc", { startUtc, endUtc })
      .orderBy("e.startAt", "ASC")
      .getMany();

    const formattedDate = targetDate.toLocaleDateString("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return {
      user,
      localDateStr,
      formattedDate,
      tasks,
      reminders,
      events,
    };
  }

  formatBriefingHtml(data: CompiledBriefingData): string {
    const { user, formattedDate, tasks, reminders, events } = data;
    const timezone = user.timezone || "Africa/Addis_Ababa";

    const lines: string[] = [];

    lines.push(`☀️ <b>AssistFlow Daily Briefing</b>`);
    lines.push(`📅 <b>${formattedDate}</b> | 🌍 <code>${timezone}</code>\n`);

    const isCompletelyEmpty = tasks.length === 0 && reminders.length === 0 && events.length === 0;

    if (isCompletelyEmpty) {
      lines.push(
        `🎉 <b>Your schedule is completely clear today!</b>\nNo pending tasks, reminders, or meetings scheduled. Have a great day!`
      );
      return lines.join("\n");
    }

    // Calendar Events Section
    lines.push(`📅 <b>Today's Meetings (${events.length}):</b>`);
    if (events.length === 0) {
      lines.push(`<i>No meetings scheduled for today.</i>`);
    } else {
      for (const e of events) {
        const startTimeStr = new Date(e.startAt).toLocaleTimeString("en-US", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
        });
        const endTimeStr = new Date(e.endAt).toLocaleTimeString("en-US", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
        });

        let eventLine = `• <b>${this.escapeHtml(e.title)}</b> (${startTimeStr} - ${endTimeStr})`;
        if (e.meetUrl) {
          eventLine += `\n  📹 <a href="${e.meetUrl}">Join Google Meet</a>`;
        }
        lines.push(eventLine);
      }
    }
    lines.push("");

    // Reminders Section
    lines.push(`⏰ <b>Today's Reminders (${reminders.length}):</b>`);
    if (reminders.length === 0) {
      lines.push(`<i>No reminders scheduled for today.</i>`);
    } else {
      for (const r of reminders) {
        const timeStr = new Date(r.scheduledAt).toLocaleTimeString("en-US", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
        });
        lines.push(`• <b>${this.escapeHtml(r.title)}</b> at <code>${timeStr}</code>`);
      }
    }
    lines.push("");

    // Tasks Section
    lines.push(`📋 <b>Pending Tasks (${tasks.length}):</b>`);
    if (tasks.length === 0) {
      lines.push(`<i>No pending tasks.</i>`);
    } else {
      const now = new Date();
      for (const t of tasks) {
        const priorityBadge = `[${t.priority.toUpperCase()}]`;
        let taskLine = `• ${priorityBadge} ${this.escapeHtml(t.title)}`;

        if (t.dueAt) {
          const isOverdue = new Date(t.dueAt).getTime() < now.getTime();
          const dueTimeStr = new Date(t.dueAt).toLocaleTimeString("en-US", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
          });
          if (isOverdue) {
            taskLine += ` ⚠️ <b>(Overdue: ${dueTimeStr})</b>`;
          } else {
            taskLine += ` (Due: ${dueTimeStr})`;
          }
        }
        lines.push(taskLine);
      }
    }

    return lines.join("\n");
  }

  async sendBriefingForUser(
    userId: string,
    options: { force?: boolean; destinationChatId?: string } = {}
  ): Promise<SendBriefingResult> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Check if daily briefing is enabled (unless manually forced)
    if (!user.dailyBriefingEnabled && !options.force) {
      return {
        success: false,
        skipped: true,
        reason: "Daily briefing is disabled for this user",
        briefingDate: "",
        counts: { tasks: 0, reminders: 0, events: 0 },
      };
    }

    const compiled = await this.compileBriefingData(userId);
    const { localDateStr, tasks, reminders, events } = compiled;

    // Idempotency: avoid sending duplicate briefings for the same user and local date
    if (!options.force) {
      const existingRecord = await this.briefingRepo.findOne({
        where: {
          userId,
          briefingDate: localDateStr,
          status: DailyBriefingStatus.SENT,
        },
      });

      if (existingRecord) {
        return {
          success: true,
          skipped: true,
          reason: `Daily briefing already sent for ${localDateStr}`,
          briefingDate: localDateStr,
          counts: {
            tasks: existingRecord.taskCount,
            reminders: existingRecord.reminderCount,
            events: existingRecord.eventCount,
          },
        };
      }
    }

    const htmlContent = this.formatBriefingHtml(compiled);
    const chatId = options.destinationChatId || process.env.TELEGRAM_CHAT_ID;

    if (!chatId) {
      throw new BadRequestError("Missing Telegram destination chat ID (TELEGRAM_CHAT_ID)");
    }

    let telegramMessageId: string | null = null;
    try {
      const telegramRes = await telegramClient.sendMessage(chatId, htmlContent, {
        parseMode: "HTML",
      });
      telegramMessageId = telegramRes.messageId;
    } catch (sendErr: any) {
      // Record failure for audit
      await this.saveBriefingRecord(
        userId,
        localDateStr,
        DailyBriefingStatus.FAILED,
        tasks.length,
        reminders.length,
        events.length,
        htmlContent,
        null,
        sendErr.message
      );
      throw new Error(`Failed to deliver daily briefing via Telegram: ${sendErr.message}`);
    }

    // Record success
    await this.saveBriefingRecord(
      userId,
      localDateStr,
      DailyBriefingStatus.SENT,
      tasks.length,
      reminders.length,
      events.length,
      htmlContent,
      telegramMessageId,
      null
    );

    return {
      success: true,
      briefingDate: localDateStr,
      messageId: telegramMessageId,
      counts: {
        tasks: tasks.length,
        reminders: reminders.length,
        events: events.length,
      },
      content: htmlContent,
    };
  }

  async dispatchScheduledBriefings(refDate: Date = new Date()): Promise<{
    processed: number;
    sent: number;
    skipped: number;
    failed: number;
    details: Array<{ userId: string; status: string; reason?: string }>;
  }> {
    const eligibleUsers = await this.userRepo.find({
      where: { dailyBriefingEnabled: true },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const details: Array<{ userId: string; status: string; reason?: string }> = [];

    for (const user of eligibleUsers) {
      const timezone = user.timezone || "Africa/Addis_Ababa";
      const { localTimeStr } = this.getLocalDayBounds(timezone, refDate);

      // Check if user's configured briefing time has arrived for today
      if (user.dailyBriefingTime) {
        const configuredTime = user.dailyBriefingTime.slice(0, 5); // "HH:mm"
        if (localTimeStr < configuredTime) {
          skipped++;
          details.push({
            userId: user.id,
            status: "skipped",
            reason: `Local time (${localTimeStr}) has not reached configured briefing time (${user.dailyBriefingTime})`,
          });
          continue;
        }
      }

      try {
        const outcome = await this.sendBriefingForUser(user.id, { force: false });
        if (outcome.skipped) {
          skipped++;
          details.push({ userId: user.id, status: "skipped", reason: outcome.reason });
        } else {
          sent++;
          details.push({ userId: user.id, status: "sent" });
        }
      } catch (err: any) {
        failed++;
        details.push({ userId: user.id, status: "failed", reason: err.message });
      }
    }

    return {
      processed: eligibleUsers.length,
      sent,
      skipped,
      failed,
      details,
    };
  }

  private async saveBriefingRecord(
    userId: string,
    briefingDate: string,
    status: DailyBriefingStatus,
    taskCount: number,
    reminderCount: number,
    eventCount: number,
    content: string,
    telegramMessageId: string | null,
    errorMessage: string | null
  ): Promise<DailyBriefingRecord> {
    let record = await this.briefingRepo.findOne({
      where: { userId, briefingDate },
    });

    if (!record) {
      record = this.briefingRepo.create({
        userId,
        briefingDate,
      });
    }

    record.status = status;
    record.taskCount = taskCount;
    record.reminderCount = reminderCount;
    record.eventCount = eventCount;
    record.content = content;
    record.telegramMessageId = telegramMessageId;
    record.errorMessage = errorMessage;
    record.sentAt = status === DailyBriefingStatus.SENT ? new Date() : null;

    return await this.briefingRepo.save(record);
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

export const briefingService = new BriefingService();
