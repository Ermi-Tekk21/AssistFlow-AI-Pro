import "../src/config/env";
import { AppDataSource } from "../src/config/database";
import { authService, getDefaultEmail } from "../src/modules/auth/auth.service";

async function resetDatabase(): Promise<void> {
  console.log("=== AssistFlow AI Database Reset Tool ===");

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const defaultEmail = getDefaultEmail();
  console.log(`Resetting database. Target default user: ${defaultEmail}`);

  // Truncate/delete test data in proper dependency order
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query('DELETE FROM "notification_attempts";');
    await queryRunner.query('DELETE FROM "reminders";');
    await queryRunner.query('DELETE FROM "calendar_event_attendees";');
    await queryRunner.query('DELETE FROM "calendar_events";');
    await queryRunner.query('DELETE FROM "tasks";');
    await queryRunner.query('DELETE FROM "pending_actions";');
    await queryRunner.query('DELETE FROM "conversation_sessions";');
    await queryRunner.query('DELETE FROM "daily_briefings";');
    await queryRunner.query('DELETE FROM "workflow_executions";');

    // Remove all users except default user
    await queryRunner.query('DELETE FROM "users" WHERE LOWER(email) != LOWER($1);', [defaultEmail]);

    await queryRunner.commitTransaction();
    console.log("✓ Cleared all residual testing records, tasks, calendar events, reminders, and sessions.");
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error("Failed to clear database:", err);
    throw err;
  } finally {
    await queryRunner.release();
  }

  // Seed or synchronize the default administrator user
  const user = await authService.seedDefaultUser();

  console.log("==========================================");
  console.log(`✓ Database successfully reset to fresh state!`);
  console.log(`  Active User: ${user.firstName} ${user.lastName}`);
  console.log(`  Email:       ${user.email}`);
  console.log(`  User ID:     ${user.id}`);
  console.log(`  Timezone:    ${user.timezone}`);
  console.log(`  Briefing:    ${user.dailyBriefingTime} (enabled: ${user.dailyBriefingEnabled})`);
  console.log("==========================================");

  await AppDataSource.destroy();
  process.exit(0);
}

resetDatabase().catch((err) => {
  console.error("Fatal error during database reset:", err);
  process.exit(1);
});
