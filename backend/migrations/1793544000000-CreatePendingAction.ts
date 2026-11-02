import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePendingAction1793544000000 implements MigrationInterface {
  name = "CreatePendingAction1793544000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "pending_actions_action_type_enum" AS ENUM (
          'task_create',
          'task_update',
          'task_complete',
          'task_delete',
          'reminder_create',
          'reminder_update',
          'reminder_snooze',
          'reminder_cancel',
          'calendar_event_create',
          'calendar_event_update',
          'calendar_event_cancel'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "pending_actions_status_enum" AS ENUM (
          'pending',
          'confirmed',
          'rejected',
          'expired',
          'executed',
          'failed'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pending_actions" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "action_type" "pending_actions_action_type_enum" NOT NULL,
        "status" "pending_actions_status_enum" DEFAULT 'pending' NOT NULL,
        "proposal" text NOT NULL,
        "payload" jsonb NOT NULL,
        "target_entity_id" uuid,
        "target_entity_type" character varying(50),
        "expires_at" timestamp with time zone NOT NULL,
        "confirmed_at" timestamp with time zone,
        "executed_at" timestamp with time zone,
        "execution_result" jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pending_actions_user_status_expires"
      ON "pending_actions" ("user_id", "status", "expires_at");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pending_actions_user_created"
      ON "pending_actions" ("user_id", "created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pending_actions_user_created";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pending_actions_user_status_expires";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pending_actions";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pending_actions_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pending_actions_action_type_enum";`);
  }
}
