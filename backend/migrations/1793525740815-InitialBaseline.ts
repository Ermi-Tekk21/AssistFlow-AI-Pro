import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialBaseline1793525740815 implements MigrationInterface {
  name = "InitialBaseline1793525740815";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "calendar_events_status_enum" AS ENUM ('pending', 'confirmed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "reminders_status_enum" AS ENUM ('scheduled', 'processing', 'sent', 'failed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tasks_priority_enum" AS ENUM ('low', 'medium', 'high', 'urgent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tasks_status_enum" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
        "email" character varying(255) NOT NULL UNIQUE,
        "timezone" character varying(100) DEFAULT 'Africa/Addis_Ababa' NOT NULL,
        "dailyBriefingTime" time without time zone,
        "dailyBriefingEnabled" boolean DEFAULT false NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tasks" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" character varying(255) NOT NULL,
        "description" text,
        "priority" "tasks_priority_enum" DEFAULT 'medium' NOT NULL,
        "status" "tasks_status_enum" DEFAULT 'pending' NOT NULL,
        "due_at" timestamp with time zone,
        "completed_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_c7af812c1f8f4035af0934e3d9" ON "tasks" ("user_id", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_82e955900f3ad24f0d03400692" ON "tasks" ("user_id", "due_at");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reminders" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "task_id" uuid REFERENCES "tasks"("id") ON DELETE SET NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "scheduled_at" timestamp with time zone NOT NULL,
        "timezone" character varying(100) NOT NULL,
        "status" "reminders_status_enum" DEFAULT 'scheduled' NOT NULL,
        "sent_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_27d36bcc36e048a6833997f079" ON "reminders" ("user_id", "status", "scheduled_at");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_events" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "google_calendar_id" character varying(255) DEFAULT 'primary' NOT NULL,
        "google_event_id" character varying(512) NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "start_at" timestamp with time zone NOT NULL,
        "end_at" timestamp with time zone NOT NULL,
        "timezone" character varying(100) NOT NULL,
        "meet_url" text,
        "status" "calendar_events_status_enum" DEFAULT 'confirmed' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_58da5179628b906259c31f0fc3" ON "calendar_events" ("user_id", "start_at");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_8e8d3d3194ffcebbf2ff75f3cc" ON "calendar_events" ("google_calendar_id", "google_event_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_events";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reminders";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "calendar_events_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "reminders_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tasks_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tasks_priority_enum";`);
  }
}
