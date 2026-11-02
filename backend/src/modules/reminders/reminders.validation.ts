import { z } from "zod";
import { ReminderStatus } from "../../entities/Reminder";

// Helper for validating ISO datetime strings
const isoDateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Invalid ISO 8601 date-time string" }
);

// Helper for future date validation
const futureDateString = isoDateString.refine(
  (val) => new Date(val).getTime() > Date.now() - 5000, // allow 5s grace window for network latency
  { message: "Scheduled time must be in the future" }
);

// Helper for validating IANA timezone
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const timezoneSchema = z.string().refine(isValidTimezone, {
  message: "Invalid IANA timezone (e.g. 'Africa/Addis_Ababa', 'UTC', 'America/New_York')",
});

export const reminderIdParamSchema = z.object({
  id: z.string().uuid("Invalid reminder ID: must be a valid UUID"),
});

export const createReminderSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(255, "Title cannot exceed 255 characters"),
    description: z.string().trim().nullable().optional(),
    scheduledAt: futureDateString,
    timezone: timezoneSchema.optional().default("Africa/Addis_Ababa"),
    taskId: z.string().uuid("Invalid taskId: must be a valid UUID").nullable().optional(),
    calendarEventId: z.string().uuid("Invalid calendarEventId: must be a valid UUID").nullable().optional(),
  })
  .refine(
    (data) => !(data.taskId && data.calendarEventId),
    { message: "A reminder cannot reference both a task and a calendar event simultaneously" }
  );

export const updateReminderSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(255, "Title cannot exceed 255 characters")
      .optional(),
    description: z.string().trim().nullable().optional(),
    scheduledAt: futureDateString.optional(),
    timezone: timezoneSchema.optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided for update" }
  );

export const snoozeReminderSchema = z
  .object({
    snoozeMinutes: z.coerce.number().int().min(1, "snoozeMinutes must be at least 1").optional(),
    scheduledAt: futureDateString.optional(),
  })
  .refine(
    (data) => data.snoozeMinutes !== undefined || data.scheduledAt !== undefined,
    { message: "Either snoozeMinutes or scheduledAt must be provided to snooze a reminder" }
  );

export const listRemindersQuerySchema = z.object({
  status: z.nativeEnum(ReminderStatus).optional(),
  taskId: z.string().uuid().optional(),
  calendarEventId: z.string().uuid().optional(),
  dueBefore: isoDateString.optional(),
  dueAfter: isoDateString.optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(["scheduledAt", "createdAt", "title"]).optional().default("scheduledAt"),
  sortOrder: z.enum(["ASC", "DESC", "asc", "desc"]).optional().default("ASC"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type SnoozeReminderInput = z.infer<typeof snoozeReminderSchema>;
export type ListRemindersQuery = z.infer<typeof listRemindersQuerySchema>;
