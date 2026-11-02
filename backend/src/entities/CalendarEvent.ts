import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";

import { User } from "./User";
import { CalendarEventAttendee } from "./CalendarEventAttendee";

export enum CalendarEventStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
}

@Entity("calendar_events")
@Index(["userId", "startAt"])
@Index(["googleCalendarId", "googleEventId"], { unique: true })
export class CalendarEvent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @OneToMany(() => CalendarEventAttendee, (attendee) => attendee.calendarEvent)
  attendees?: CalendarEventAttendee[];

  @Column({
    type: "varchar",
    length: 255,
    name: "google_calendar_id",
    default: "primary",
  })
  googleCalendarId!: string;

  @Column({ type: "varchar", length: 512, name: "google_event_id" })
  googleEventId!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "timestamptz", name: "start_at" })
  startAt!: Date;

  @Column({ type: "timestamptz", name: "end_at" })
  endAt!: Date;

  @Column({ type: "varchar", length: 100 })
  timezone!: string;

  @Column({ type: "text", nullable: true, name: "meet_url" })
  meetUrl!: string | null;

  @Column({
    type: "enum",
    enum: CalendarEventStatus,
    default: CalendarEventStatus.CONFIRMED,
  })
  status!: CalendarEventStatus;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}