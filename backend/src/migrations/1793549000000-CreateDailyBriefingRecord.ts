import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDailyBriefingRecord1793549000000 implements MigrationInterface {
  name = "CreateDailyBriefingRecord1793549000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "daily_briefings_status_enum" AS ENUM ('sent', 'skipped', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "daily_briefings" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "briefing_date" character varying(10) NOT NULL,
        "status" "daily_briefings_status_enum" DEFAULT 'sent' NOT NULL,
        "task_count" integer DEFAULT 0 NOT NULL,
        "reminder_count" integer DEFAULT 0 NOT NULL,
        "event_count" integer DEFAULT 0 NOT NULL,
        "content" text,
        "telegram_message_id" character varying(255),
        "error_message" text,
        "sent_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "FK_daily_briefings_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_daily_briefings_user_date"
      ON "daily_briefings" ("user_id", "briefing_date");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_daily_briefings_date_status"
      ON "daily_briefings" ("briefing_date", "status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_daily_briefings_date_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_daily_briefings_user_date";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_briefings";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "daily_briefings_status_enum";`);
  }
}
