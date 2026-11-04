import "./config/env";

import { app } from "./app";
import { AppDataSource } from "./config/database";
import { authService } from "./modules/auth/auth.service";
import { remindersDeliveryService } from "./modules/reminders/remindersDelivery.service";

const PORT = Number(process.env.PORT ?? 3000);

async function startServer(): Promise<void> {
  try {
    await AppDataSource.initialize();

    console.log("PostgreSQL connection established.");

    // Seed or synchronize default administrator account
    await authService.seedDefaultUser();

    app.listen(PORT, () => {
      console.log(`AssistFlow API running on port ${PORT}`);
    });

    // Background worker: automatically deliver due reminders to Telegram every 10 seconds
    const REMINDER_POLL_INTERVAL_MS = 10000;
    setInterval(async () => {
      try {
        const result = await remindersDeliveryService.processDueReminders({ limit: 25 });
        if (result.sentCount > 0) {
          console.log(`[RemindersWorker] Dispatched ${result.sentCount} reminder(s) to Telegram.`);
        }
      } catch (err: any) {
        console.error("[RemindersWorker] Failed checking due reminders:", err.message);
      }
    }, REMINDER_POLL_INTERVAL_MS);
  } catch (error) {
    console.error("Failed to start AssistFlow API:", error);
    process.exit(1);
  }
}

void startServer();