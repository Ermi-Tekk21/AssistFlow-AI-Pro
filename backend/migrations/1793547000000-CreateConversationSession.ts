import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateConversationSession1793547000000 implements MigrationInterface {
  name = "CreateConversationSession1793547000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversation_sessions" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "title" character varying(255),
        "messages" jsonb DEFAULT '[]' NOT NULL,
        "active_draft" jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "FK_conversation_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversation_sessions_user_id"
      ON "conversation_sessions" ("user_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversation_sessions_updated_at"
      ON "conversation_sessions" ("updated_at" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversation_sessions_updated_at";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversation_sessions_user_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversation_sessions";`);
  }
}
