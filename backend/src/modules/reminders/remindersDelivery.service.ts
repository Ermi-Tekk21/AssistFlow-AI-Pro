import { AppDataSource } from "../../config/database";
import { Reminder, ReminderStatus } from "../../entities/Reminder";
import {
  NotificationAttempt,
  NotificationAttemptStatus,
} from "../../entities/NotificationAttempt";
import { telegramService, TelegramService } from "../integrations/telegram/telegram.service";

export interface DeliveryJobResult {
  claimedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  details: Array<{
    reminderId: string;
    status: "sent" | "failed" | "skipped";
    messageId?: string;
    reason?: string;
    error?: string;
  }>;
}

export class RemindersDeliveryService {
  private readonly maxAttempts = 3;

  constructor(private telegram: TelegramService = telegramService) {}

  async claimDueReminders(limit = 50): Promise<Reminder[]> {
    return await AppDataSource.transaction(async (tx) => {
      const reminders = await tx
        .getRepository(Reminder)
        .createQueryBuilder("reminder")
        .where("reminder.status = :status", { status: ReminderStatus.SCHEDULED })
        .andWhere("reminder.scheduledAt <= :now", { now: new Date() })
        .orderBy("reminder.scheduledAt", "ASC")
        .take(limit)
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .getMany();

      if (reminders.length === 0) {
        return [];
      }

      // Mark claimed reminders as PROCESSING
      for (const reminder of reminders) {
        reminder.status = ReminderStatus.PROCESSING;
        await tx.save(reminder);
      }

      return reminders;
    });
  }

  async processDueReminders(options?: {
    limit?: number;
    destinationOverride?: string;
  }): Promise<DeliveryJobResult> {
    const claimed = await this.claimDueReminders(options?.limit ?? 50);

    const result: DeliveryJobResult = {
      claimedCount: claimed.length,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      details: [],
    };

    for (const claimedReminder of claimed) {
      const outcome = await this.deliverReminder(
        claimedReminder.id,
        options?.destinationOverride
      );

      if (outcome.status === "sent") {
        result.sentCount++;
      } else if (outcome.status === "failed") {
        result.failedCount++;
      } else {
        result.skippedCount++;
      }

      result.details.push(outcome);
    }

    return result;
  }

  async deliverReminder(
    reminderId: string,
    destinationOverride?: string
  ): Promise<{
    reminderId: string;
    status: "sent" | "failed" | "skipped";
    messageId?: string;
    reason?: string;
    error?: string;
  }> {
    const reminderRepo = AppDataSource.getRepository(Reminder);
    const attemptRepo = AppDataSource.getRepository(NotificationAttempt);

    // Recheck reminder state
    const reminder = await reminderRepo.findOne({
      where: { id: reminderId },
      relations: { task: true },
    });

    if (!reminder) {
      return { reminderId, status: "skipped", reason: "reminder_not_found" };
    }

    // Immediate recheck: was it cancelled while claimed?
    if (reminder.status === ReminderStatus.CANCELLED) {
      return { reminderId, status: "skipped", reason: "reminder_cancelled" };
    }

    // Immediate recheck: was it rescheduled to a future time?
    if (new Date(reminder.scheduledAt).getTime() > Date.now()) {
      reminder.status = ReminderStatus.SCHEDULED;
      await reminderRepo.save(reminder);
      return { reminderId, status: "skipped", reason: "reminder_rescheduled" };
    }

    const priorAttempts = await attemptRepo.count({ where: { reminderId } });
    const attemptNumber = priorAttempts + 1;

    const destination =
      destinationOverride ??
      this.telegram.getDefaultDestination() ??
      "configured_telegram_chat";

    // Create tracking attempt record
    const attempt = attemptRepo.create({
      reminderId: reminder.id,
      channel: "telegram",
      destination,
      status: NotificationAttemptStatus.PROCESSING,
      attemptNumber,
      providerMessageId: null,
      errorDetails: null,
    });
    await attemptRepo.save(attempt);

    try {
      const sendResult = await this.telegram.sendReminderNotification(
        reminder,
        destinationOverride
      );

      // On Success
      attempt.status = NotificationAttemptStatus.SUCCESS;
      attempt.providerMessageId = sendResult.messageId;
      await attemptRepo.save(attempt);

      reminder.status = ReminderStatus.SENT;
      reminder.sentAt = new Date();
      await reminderRepo.save(reminder);

      return {
        reminderId: reminder.id,
        status: "sent",
        messageId: sendResult.messageId,
      };
    } catch (err: any) {
      // On Failure
      const sanitizedError = (err?.message ?? "Delivery failed")
        .split(process.env.TELEGRAM_BOT_TOKEN ?? "")
        .join("[REDACTED_BOT_TOKEN]");

      attempt.status = NotificationAttemptStatus.FAILED;
      attempt.errorDetails = sanitizedError;
      await attemptRepo.save(attempt);

      if (attemptNumber < this.maxAttempts) {
        // Bounded exponential backoff: retry in 2 mins * attemptNumber
        const retryDelayMs = attemptNumber * 2 * 60 * 1000;
        reminder.status = ReminderStatus.SCHEDULED;
        reminder.scheduledAt = new Date(Date.now() + retryDelayMs);
      } else {
        // Terminal failure after max attempts
        reminder.status = ReminderStatus.FAILED;
      }
      await reminderRepo.save(reminder);

      return {
        reminderId: reminder.id,
        status: "failed",
        error: sanitizedError,
      };
    }
  }
}

export const remindersDeliveryService = new RemindersDeliveryService();
