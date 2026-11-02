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

export enum DailyBriefingStatus {
  SENT = "sent",
  SKIPPED = "skipped",
  FAILED = "failed",
}

@Entity("daily_briefings")
@Index(["userId", "briefingDate"], { unique: true })
export class DailyBriefingRecord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "varchar", length: 10, name: "briefing_date" }) // Format: YYYY-MM-DD
  briefingDate!: string;

  @Column({
    type: "enum",
    enum: DailyBriefingStatus,
    default: DailyBriefingStatus.SENT,
  })
  status!: DailyBriefingStatus;

  @Column({ type: "integer", default: 0, name: "task_count" })
  taskCount!: number;

  @Column({ type: "integer", default: 0, name: "reminder_count" })
  reminderCount!: number;

  @Column({ type: "integer", default: 0, name: "event_count" })
  eventCount!: number;

  @Column({ type: "text", nullable: true })
  content!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true, name: "telegram_message_id" })
  telegramMessageId!: string | null;

  @Column({ type: "text", nullable: true, name: "error_message" })
  errorMessage!: string | null;

  @Column({ type: "timestamptz", nullable: true, name: "sent_at" })
  sentAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
