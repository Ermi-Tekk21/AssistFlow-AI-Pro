import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalendarEventToReminders1793543000000 implements MigrationInterface {
  name = "AddCalendarEventToReminders1793543000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reminders"
      ADD COLUMN IF NOT EXISTS "calendar_event_id" uuid;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "reminders"
        ADD CONSTRAINT "FK_reminders_calendar_event"
        FOREIGN KEY ("calendar_event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reminders_user_calendar_event"
      ON "reminders" ("user_id", "calendar_event_id");
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "reminders"
        ADD CONSTRAINT "chk_reminder_target_exclusive"
        CHECK (NOT ("task_id" IS NOT NULL AND "calendar_event_id" IS NOT NULL));
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reminders"
      DROP CONSTRAINT IF EXISTS "chk_reminder_target_exclusive";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_reminders_user_calendar_event";
    `);

    await queryRunner.query(`
      ALTER TABLE "reminders"
      DROP CONSTRAINT IF EXISTS "FK_reminders_calendar_event";
    `);

    await queryRunner.query(`
      ALTER TABLE "reminders"
      DROP COLUMN IF EXISTS "calendar_event_id";
    `);
  }
}
