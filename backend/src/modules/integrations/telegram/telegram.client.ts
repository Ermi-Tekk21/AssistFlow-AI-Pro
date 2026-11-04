export interface TelegramMessageResponse {
  messageId: string;
}

export type TelegramFetchTransport = (
  url: string,
  init?: RequestInit
) => Promise<Response>;

export class TelegramClient {
  private botToken?: string;
  private fetchTransport: TelegramFetchTransport;

  constructor(botToken?: string, transport?: TelegramFetchTransport) {
    this.botToken = botToken;
    this.fetchTransport = transport ?? globalThis.fetch;
  }

  get token(): string | undefined {
    return this.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  }

  setTransport(transport: TelegramFetchTransport): void {
    this.fetchTransport = transport;
  }

  setBotToken(token: string): void {
    this.botToken = token;
  }

  private sanitize(message: string): string {
    const token = this.token;
    if (!token) return message;
    return message.split(token).join("[REDACTED_BOT_TOKEN]");
  }

  async sendMessage(
    chatId: string,
    text: string,
    options?: { parseMode?: "HTML" | "MarkdownV2" }
  ): Promise<TelegramMessageResponse> {
    const token = this.token;
    if (!token) {
      throw new Error("Telegram bot token is not configured (missing TELEGRAM_BOT_TOKEN)");
    }

    const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;

    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchTransport(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: options?.parseMode ?? "HTML",
          }),
        });

        const responseText = await response.text();
        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(`Telegram API non-JSON response (HTTP ${response.status})`);
        }

        if (!response.ok || !data.ok) {
          const errorDesc = data?.description ?? `HTTP error ${response.status}`;
          throw new Error(`Telegram send failed: ${errorDesc}`);
        }

        return {
          messageId: String(data.result?.message_id ?? "unknown"),
        };
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries && err.message?.includes("fetch failed")) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        break;
      }
    }

    const sanitizedMsg = this.sanitize(lastError?.message ?? "Unknown Telegram error");
    throw new Error(sanitizedMsg);
  }
}

export const telegramClient = new TelegramClient();
