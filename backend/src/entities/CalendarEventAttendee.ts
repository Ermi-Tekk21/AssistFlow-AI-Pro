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
import { CalendarEvent } from "./CalendarEvent";

@Entity("calendar_event_attendees")
export class CalendarEventAttendee {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid", name: "calendar_event_id" })
  calendarEventId!: string;

  @ManyToOne(() => CalendarEvent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "calendar_event_id" })
  calendarEvent!: CalendarEvent;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 255, nullable: true, name: "display_name" })
  displayName!: string | null;

  @Column({ type: "varchar", length: 50, nullable: true, name: "response_status" })
  responseStatus!: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
