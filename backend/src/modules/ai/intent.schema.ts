import { z } from "zod";

export const TaskCreateIntentSchema = z.object({
  intent: z.literal("task_create"),
  params: z.object({
    title: z.string().min(1, "Task title is required"),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    dueAt: z.string().datetime().optional().nullable(),
  }),
});

export const TaskListIntentSchema = z.object({
  intent: z.literal("task_list"),
  params: z.object({
    status: z.enum(["pending", "completed"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    sortBy: z.enum(["dueAt", "createdAt", "priority"]).optional(),
    sortOrder: z.enum(["ASC", "DESC"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }).default({}),
});

export const TaskCompleteIntentSchema = z.object({
  intent: z.literal("task_complete"),
  params: z.object({
    taskId: z.string().uuid().optional(),
    query: z.string().optional(),
  }),
});

export const TaskUpdateIntentSchema = z.object({
  intent: z.literal("task_update"),
  params: z.object({
    taskId: z.string().uuid().optional(),
    query: z.string().optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueAt: z.string().datetime().optional().nullable(),
    status: z.enum(["pending", "completed"]).optional(),
  }),
});

export const TaskDeleteIntentSchema = z.object({
  intent: z.literal("task_delete"),
  params: z.object({
    taskId: z.string().uuid().optional(),
    query: z.string().optional(),
  }),
});

export const ReminderCreateIntentSchema = z.object({
  intent: z.literal("reminder_create"),
  params: z.object({
    title: z.string().min(1, "Reminder title is required"),
    scheduledAt: z.string().datetime({ message: "scheduledAt must be an ISO 8601 datetime" }).optional(),
    description: z.string().optional(),
  }),
});

export const ReminderListIntentSchema = z.object({
  intent: z.literal("reminder_list"),
  params: z.object({
    status: z.enum(["scheduled", "sent", "cancelled", "failed"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }).default({}),
});

export const ReminderSnoozeIntentSchema = z.object({
  intent: z.literal("reminder_snooze"),
  params: z.object({
    reminderId: z.string().uuid().optional(),
    query: z.string().optional(),
    minutes: z.number().int().min(1).max(10080).default(15),
  }),
});

export const ReminderCancelIntentSchema = z.object({
  intent: z.literal("reminder_cancel"),
  params: z.object({
    reminderId: z.string().uuid().optional(),
    query: z.string().optional(),
  }),
});

export const CalendarListIntentSchema = z.object({
  intent: z.literal("calendar_list"),
  params: z.object({
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
  }).default({}),
});

export const CalendarCreateIntentSchema = z.object({
  intent: z.literal("calendar_create"),
  params: z.object({
    summary: z.string().min(1, "Event summary is required"),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    attendees: z.array(z.string().email()).optional(),
  }),
});

export const CalendarCancelIntentSchema = z.object({
  intent: z.literal("calendar_cancel"),
  params: z.object({
    calendarEventId: z.string().uuid().optional(),
    query: z.string().optional(),
  }),
});

export const CalendarUpdateIntentSchema = z.object({
  intent: z.literal("calendar_update"),
  params: z.object({
    calendarEventId: z.string().uuid().optional(),
    query: z.string().optional(),
    summary: z.string().optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    attendees: z.array(z.string().email()).optional(),
  }),
});

export const OverviewQueryIntentSchema = z.object({
  intent: z.literal("overview_query"),
  params: z.object({
    query: z.string().optional(),
    includeTasks: z.boolean().default(true),
    includeCalendar: z.boolean().default(true),
    includeReminders: z.boolean().default(true),
  }).default({
    includeTasks: true,
    includeCalendar: true,
    includeReminders: true,
  }),
});

export const DailyBriefingRequestIntentSchema = z.object({
  intent: z.literal("daily_briefing_request"),
  params: z.object({
    date: z.string().optional(),
  }).default({}),
});

export const ConfirmationReplyIntentSchema = z.object({
  intent: z.literal("confirmation_reply"),
  params: z.object({
    confirmed: z.boolean(),
    actionId: z.string().uuid().optional(),
    rawReply: z.string().default(""),
  }),
});

export const ClarificationNeededIntentSchema = z.object({
  intent: z.literal("clarification_needed"),
  params: z.object({
    question: z.string().min(1, "Clarification question is required"),
    missingFields: z.array(z.string()).min(1),
    partialIntent: z.string().optional(),
    partialParams: z.record(z.string(), z.any()).optional(),
  }),
});

export const UnknownIntentSchema = z.object({
  intent: z.literal("unknown"),
  params: z.object({
    message: z.string(),
  }),
});

export const AssistantIntentSchema = z.discriminatedUnion("intent", [
  TaskCreateIntentSchema,
  TaskListIntentSchema,
  TaskCompleteIntentSchema,
  TaskUpdateIntentSchema,
  TaskDeleteIntentSchema,
  ReminderCreateIntentSchema,
  ReminderListIntentSchema,
  ReminderSnoozeIntentSchema,
  ReminderCancelIntentSchema,
  CalendarListIntentSchema,
  CalendarCreateIntentSchema,
  CalendarUpdateIntentSchema,
  CalendarCancelIntentSchema,
  OverviewQueryIntentSchema,
  DailyBriefingRequestIntentSchema,
  ConfirmationReplyIntentSchema,
  ClarificationNeededIntentSchema,
  UnknownIntentSchema,
]);

export type AssistantIntent = z.infer<typeof AssistantIntentSchema>;
