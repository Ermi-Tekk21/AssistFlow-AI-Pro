import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationAttempt1793545000000 implements MigrationInterface {
  name = "CreateNotificationAttempt1793545000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notification_attempts_status_enum" AS ENUM ('success', 'failed', 'processing');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_attempts" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
        "reminder_id" uuid NOT NULL REFERENCES "reminders"("id") ON DELETE CASCADE,
        "channel" character varying(50) DEFAULT 'telegram' NOT NULL,
        "destination" character varying(255) NOT NULL,
        "status" "notification_attempts_status_enum" DEFAULT 'processing' NOT NULL,
        "attempt_number" integer DEFAULT 1 NOT NULL,
        "provider_message_id" character varying(255),
        "error_details" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_attempts_reminder_attempt"
      ON "notification_attempts" ("reminder_id", "attempt_number");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_attempts_status_created"
      ON "notification_attempts" ("status", "created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_attempts_status_created";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_attempts_reminder_attempt";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_attempts";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_attempts_status_enum";`);
  }
}
