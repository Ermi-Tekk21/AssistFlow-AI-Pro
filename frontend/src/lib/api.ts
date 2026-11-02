import {
  Task,
  Reminder,
  CalendarEvent,
  PendingAction,
  ConversationSession,
  DailyBriefingPreview,
} from "../types";

const BASE_URL = ""; // Empty string routes through Vite dev proxy to /api

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;

  constructor(message: string, status: number, code?: string, details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(
  endpoint: string,
  userId: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-user-id": userId,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json: any = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiError(`Non-JSON response from server: ${text.slice(0, 100)}`, response.status);
    }
  }

  if (!response.ok) {
    const errorMsg = json.error?.message || json.message || "An error occurred with the request";
    throw new ApiError(errorMsg, response.status, json.error?.code, json.error?.details);
  }

  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Tasks
  async getTasks(userId: string, status?: string): Promise<{ tasks: Task[]; total: number }> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<{ tasks: Task[]; total: number }>(`/api/tasks${query}`, userId);
  },

  async createTask(
    userId: string,
    data: { title: string; description?: string; priority?: string; dueAt?: string | null }
  ): Promise<Task> {
    return request<Task>("/api/tasks", userId, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async completeTask(userId: string, taskId: string): Promise<Task> {
    return request<Task>(`/api/tasks/${taskId}/complete`, userId, {
      method: "POST",
    });
  },

  async deleteTask(userId: string, taskId: string): Promise<void> {
    await request<void>(`/api/tasks/${taskId}`, userId, {
      method: "DELETE",
    });
  },

  // Reminders
  async getReminders(userId: string): Promise<{ reminders: Reminder[]; total: number }> {
    return request<{ reminders: Reminder[]; total: number }>("/api/reminders", userId);
  },

  async cancelReminder(userId: string, reminderId: string): Promise<Reminder> {
    return request<Reminder>(`/api/reminders/${reminderId}/cancel`, userId, {
      method: "POST",
    });
  },

  // Calendar
  async getCalendarEvents(userId: string): Promise<CalendarEvent[]> {
    return request<CalendarEvent[]>("/api/calendar/events", userId);
  },

  async cancelCalendarEvent(userId: string, eventId: string): Promise<CalendarEvent> {
    return request<CalendarEvent>(`/api/calendar/events/${eventId}`, userId, {
      method: "DELETE",
    });
  },

  // Confirmations
  async getPendingActions(userId: string): Promise<PendingAction[]> {
    return request<PendingAction[]>("/api/confirmations?activeOnly=true", userId);
  },

  async confirmPendingAction(userId: string, actionId: string): Promise<{ action: PendingAction; result: any }> {
    return request<{ action: PendingAction; result: any }>(
      `/api/confirmations/${actionId}/confirm`,
      userId,
      { method: "POST" }
    );
  },

  async rejectPendingAction(userId: string, actionId: string): Promise<PendingAction> {
    return request<PendingAction>(`/api/confirmations/${actionId}/reject`, userId, {
      method: "POST",
    });
  },

  // Assistant Chat
  async sendAssistantMessage(
    userId: string,
    message: string,
    sessionId?: string
  ): Promise<{
    sessionId: string;
    response: string;
    intent: string;
    pendingAction?: PendingAction | null;
    data?: any;
  }> {
    return request("/api/assistant/message", userId, {
      method: "POST",
      body: JSON.stringify({ message, sessionId }),
    });
  },

  async getSession(userId: string, sessionId?: string): Promise<ConversationSession> {
    const endpoint = sessionId ? `/api/assistant/sessions/${sessionId}` : "/api/assistant/sessions";
    return request<ConversationSession>(endpoint, userId);
  },

  // Daily Briefing
  async getBriefingPreview(userId: string): Promise<DailyBriefingPreview> {
    return request<DailyBriefingPreview>("/api/briefing/preview", userId);
  },

  async sendBriefing(userId: string, force = true): Promise<any> {
    return request("/api/briefing/send", userId, {
      method: "POST",
      body: JSON.stringify({ force }),
    });
  },
};
