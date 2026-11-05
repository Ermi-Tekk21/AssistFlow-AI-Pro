import "reflect-metadata";
import "./env";

import { DataSource } from "typeorm";

import { User } from "../entities/User";
import { Task } from "../entities/Task";
import { Reminder } from "../entities/Reminder";
import { CalendarEvent } from "../entities/CalendarEvent";
import { PendingAction } from "../entities/PendingAction";
import { NotificationAttempt } from "../entities/NotificationAttempt";
import { WorkflowExecution } from "../entities/WorkflowExecution";
import { ConversationSession } from "../entities/ConversationSession";
import { IntegrationAccount } from "../entities/IntegrationAccount";
import { CalendarEventAttendee } from "../entities/CalendarEventAttendee";
import { DailyBriefingRecord } from "../entities/DailyBriefingRecord";

export const AppDataSource = new DataSource({
  type: "postgres",

  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
      }),

  ssl:
    process.env.DATABASE_SSL === "true" ||
    (Boolean(process.env.DATABASE_URL) &&
      !process.env.DATABASE_URL?.includes("localhost") &&
      !process.env.DATABASE_URL?.includes("127.0.0.1"))
      ? { rejectUnauthorized: false }
      : false,

  entities: [
    User,
    Task,
    Reminder,
    CalendarEvent,
    PendingAction,
    NotificationAttempt,
    WorkflowExecution,
    ConversationSession,
    IntegrationAccount,
    CalendarEventAttendee,
    DailyBriefingRecord,
  ],

  migrations: [__dirname + "/../migrations/*{.ts,.js}"],

  synchronize: false,

  logging: process.env.NODE_ENV === "development",
});
