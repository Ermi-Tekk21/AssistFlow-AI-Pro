import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIntegrationAccountAndAttendees1793548000000 implements MigrationInterface {
  name = "CreateIntegrationAccountAndAttendees1793548000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integration_accounts" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "provider" character varying(50) NOT NULL,
        "access_token" text NOT NULL,
        "refresh_token" text,
        "expires_at" timestamp with time zone,
        "scope" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "FK_integration_accounts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_integration_accounts_user_provider"
      ON "integration_accounts" ("user_id", "provider");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_event_attendees" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
        "calendar_event_id" uuid NOT NULL,
        "email" character varying(255) NOT NULL,
        "display_name" character varying(255),
        "response_status" character varying(50),
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "FK_calendar_event_attendees_event" FOREIGN KEY ("calendar_event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_calendar_event_attendees_event_id"
      ON "calendar_event_attendees" ("calendar_event_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_calendar_event_attendees_event_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_event_attendees";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_integration_accounts_user_provider";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "integration_accounts";`);
  }
}
