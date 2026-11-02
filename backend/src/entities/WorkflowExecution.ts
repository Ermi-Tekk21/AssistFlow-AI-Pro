import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum WorkflowExecutionStatus {
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

@Entity("workflow_executions")
@Index(["workflowName", "status", "startedAt"])
@Index(["startedAt"])
export class WorkflowExecution {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100, name: "workflow_name" })
  workflowName!: string;

  @Column({
    type: "enum",
    enum: WorkflowExecutionStatus,
    default: WorkflowExecutionStatus.RUNNING,
  })
  status!: WorkflowExecutionStatus;

  @Column({ type: "varchar", length: 50, name: "triggered_by", default: "n8n" })
  triggeredBy!: string;

  @Column({ type: "timestamptz", name: "started_at" })
  startedAt!: Date;

  @Column({ type: "timestamptz", nullable: true, name: "finished_at" })
  finishedAt!: Date | null;

  @Column({ type: "jsonb", nullable: true })
  result!: Record<string, any> | null;

  @Column({ type: "text", nullable: true, name: "error_details" })
  errorDetails!: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
