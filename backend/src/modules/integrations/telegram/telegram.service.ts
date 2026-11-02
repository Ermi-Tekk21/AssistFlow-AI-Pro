import { Reminder } from "../../../entities/Reminder";
import { telegramClient, TelegramClient } from "./telegram.client";

export class TelegramService {
  constructor(private client: TelegramClient = telegramClient) {}

  getDefaultDestination(): string | undefined {
    return process.env.TELEGRAM_CHAT_ID;
  }

  formatReminderMessage(reminder: Reminder): string {
    const lines: string[] = [];

    lines.push(`⏰ <b>AssistFlow Reminder</b>`);
    lines.push(`<b>${this.escapeHtml(reminder.title)}</b>`);

    if (reminder.description) {
      lines.push(`${this.escapeHtml(reminder.description)}`);
    }

    if (reminder.task?.title) {
      lines.push(`📌 Linked Task: <i>${this.escapeHtml(reminder.task.title)}</i>`);
    }

    const scheduledStr = reminder.scheduledAt
      ? new Date(reminder.scheduledAt).toLocaleString("en-US", {
          timeZone: reminder.timezone || "UTC",
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Now";

    lines.push(`🕒 Scheduled for: <code>${scheduledStr} (${reminder.timezone || "UTC"})</code>`);

    return lines.join("\n\n");
  }

  async sendReminderNotification(
    reminder: Reminder,
    destinationChatId?: string
  ): Promise<{ messageId: string }> {
    const targetChatId = destinationChatId ?? this.getDefaultDestination();
    if (!targetChatId) {
      throw new Error("No Telegram destination chat ID configured (missing TELEGRAM_CHAT_ID)");
    }

    const text = this.formatReminderMessage(reminder);
    return await this.client.sendMessage(targetChatId, text, { parseMode: "HTML" });
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

export const telegramService = new TelegramService();
