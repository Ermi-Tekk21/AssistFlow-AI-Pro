import "reflect-metadata";
import "./env";

import { DataSource } from "typeorm";

import { User } from "../entities/User";
import { Task } from "../entities/Task";
import { Reminder } from "../entities/Reminder";
import { CalendarEvent } from "../entities/CalendarEvent";
import { PendingAction } from "../entities/PendingAction";
import { NotificationAttempt } from "../entities/NotificationAttempt";

export const AppDataSource = new DataSource({
  type: "postgres",

  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,

  entities: [User, Task, Reminder, CalendarEvent, PendingAction, NotificationAttempt],

  migrations: [__dirname + "/../../migrations/*{.ts,.js}"],

  synchronize: false,

  logging: process.env.NODE_ENV === "development",
});
