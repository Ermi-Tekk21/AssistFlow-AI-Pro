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
import { Reminder } from "./Reminder";

export enum NotificationAttemptStatus {
  SUCCESS = "success",
  FAILED = "failed",
  PROCESSING = "processing",
}

@Entity("notification_attempts")
@Index(["reminderId", "attemptNumber"])
@Index(["status", "createdAt"])
export class NotificationAttempt {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "reminder_id" })
  reminderId!: string;

  @ManyToOne(() => Reminder, { onDelete: "CASCADE" })
  @JoinColumn({ name: "reminder_id" })
  reminder!: Reminder;

  @Column({ type: "varchar", length: 50, default: "telegram" })
  channel!: string;

  @Column({ type: "varchar", length: 255 })
  destination!: string;

  @Column({
    type: "enum",
    enum: NotificationAttemptStatus,
    default: NotificationAttemptStatus.PROCESSING,
  })
  status!: NotificationAttemptStatus;

  @Column({ type: "int", name: "attempt_number", default: 1 })
  attemptNumber!: number;

  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    name: "provider_message_id",
  })
  providerMessageId!: string | null;

  @Column({ type: "text", nullable: true, name: "error_details" })
  errorDetails!: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
