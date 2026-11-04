import "./config/env";

import { app } from "./app";
import { AppDataSource } from "./config/database";
import { authService } from "./modules/auth/auth.service";

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
  } catch (error) {
    console.error("Failed to start AssistFlow API:", error);
    process.exit(1);
  }
}

void startServer();