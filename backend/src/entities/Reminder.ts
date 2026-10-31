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
import { Task } from "./Task";

export enum ReminderStatus {
  SCHEDULED = "scheduled",
  PROCESSING = "processing",
  SENT = "sent",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

@Entity("reminders")
@Index(["userId", "status", "scheduledAt"])
export class Reminder {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "uuid", nullable: true, name: "task_id" })
  taskId!: string | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "task_id" })
  task!: Task | null;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "timestamptz", name: "scheduled_at" })
  scheduledAt!: Date;

  @Column({ type: "varchar", length: 100 })
  timezone!: string;

  @Column({
    type: "enum",
    enum: ReminderStatus,
    default: ReminderStatus.SCHEDULED,
  })
  status!: ReminderStatus;

  @Column({ type: "timestamptz", nullable: true, name: "sent_at" })
  sentAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}