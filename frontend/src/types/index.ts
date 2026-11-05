export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "completed";

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReminderStatus = "scheduled" | "sent" | "cancelled" | "failed";

export interface Reminder {
  id: string;
  userId: string;
  taskId: string | null;
  calendarEventId: string | null;
  title: string;
  description: string | null;
  scheduledAt: string;
  timezone: string;
  status: ReminderStatus;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  task?: Task | null;
  calendarEvent?: CalendarEvent | null;
}

export type CalendarEventStatus = "pending" | "confirmed" | "cancelled";

export interface CalendarEventAttendee {
  id: string;
  calendarEventId: string;
  email: string;
  displayName: string | null;
  responseStatus: string | null;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  googleCalendarId: string;
  googleEventId: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  meetUrl: string | null;
  status: CalendarEventStatus;
  attendees?: CalendarEventAttendee[];
  createdAt: string;
  updatedAt: string;
}

export type PendingActionStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired"
  | "executed"
  | "failed";

export type PendingActionType =
  | "task_create"
  | "task_update"
  | "task_complete"
  | "task_delete"
  | "reminder_create"
  | "reminder_update"
  | "reminder_snooze"
  | "reminder_cancel"
  | "calendar_event_create"
  | "calendar_event_update"
  | "calendar_event_cancel";

export interface PendingAction {
  id: string;
  userId: string;
  actionType: PendingActionType;
  proposal: string;
  payload: Record<string, any>;
  targetEntityId: string | null;
  targetEntityType: string | null;
  expiresAt: string;
  status: PendingActionStatus;
  confirmedAt: string | null;
  executedAt: string | null;
  executionResult: any;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface ConversationSession {
  id: string;
  userId: string;
  title: string | null;
  messages: ChatMessage[];
  activeDraft: {
    intent: string;
    params: Record<string, any>;
    missingFields: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyBriefingPreview {
  briefingDate: string;
  formattedDate: string;
  counts: {
    tasks: number;
    reminders: number;
    events: number;
  };
  html: string;
  tasks: Task[];
  reminders: Reminder[];
  events: CalendarEvent[];
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  timezone: string;
  dailyBriefingTime: string | null;
  dailyBriefingEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type NavTab = "briefing" | "chat" | "tasks" | "reminders" | "calendar" | "profile";
