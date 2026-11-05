import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWorkflowExecution1793546000000 implements MigrationInterface {
  name = "CreateWorkflowExecution1793546000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "workflow_executions_status_enum" AS ENUM ('running', 'completed', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workflow_executions" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
        "workflow_name" character varying(100) NOT NULL,
        "status" "workflow_executions_status_enum" DEFAULT 'running' NOT NULL,
        "triggered_by" character varying(50) DEFAULT 'n8n' NOT NULL,
        "started_at" timestamp with time zone NOT NULL,
        "finished_at" timestamp with time zone,
        "result" jsonb,
        "error_details" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workflow_executions_name_status_started"
      ON "workflow_executions" ("workflow_name", "status", "started_at");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workflow_executions_started"
      ON "workflow_executions" ("started_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_started";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_name_status_started";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_executions";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "workflow_executions_status_enum";`);
  }
}
