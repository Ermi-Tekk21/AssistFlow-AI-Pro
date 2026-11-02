import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User";

export enum PendingActionStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  REJECTED = "rejected",
  EXPIRED = "expired",
  EXECUTED = "executed",
  FAILED = "failed",
}

export enum PendingActionType {
  TASK_CREATE = "task_create",
  TASK_UPDATE = "task_update",
  TASK_COMPLETE = "task_complete",
  TASK_DELETE = "task_delete",
  REMINDER_CREATE = "reminder_create",
  REMINDER_UPDATE = "reminder_update",
  REMINDER_SNOOZE = "reminder_snooze",
  REMINDER_CANCEL = "reminder_cancel",
  CALENDAR_EVENT_CREATE = "calendar_event_create",
  CALENDAR_EVENT_UPDATE = "calendar_event_update",
  CALENDAR_EVENT_CANCEL = "calendar_event_cancel",
}

@Entity("pending_actions")
@Index(["userId", "status", "expiresAt"])
@Index(["userId", "createdAt"])
export class PendingAction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({
    type: "enum",
    enum: PendingActionType,
    name: "action_type",
  })
  actionType!: PendingActionType;

  @Column({
    type: "enum",
    enum: PendingActionStatus,
    default: PendingActionStatus.PENDING,
  })
  status!: PendingActionStatus;

  @Column({ type: "text" })
  proposal!: string;

  @Column({ type: "jsonb" })
  payload!: Record<string, any>;

  @Column({ type: "uuid", nullable: true, name: "target_entity_id" })
  targetEntityId!: string | null;

  @Column({ type: "varchar", length: 50, nullable: true, name: "target_entity_type" })
  targetEntityType!: string | null;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", nullable: true, name: "confirmed_at" })
  confirmedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true, name: "executed_at" })
  executedAt!: Date | null;

  @Column({ type: "jsonb", nullable: true, name: "execution_result" })
  executionResult!: Record<string, any> | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
