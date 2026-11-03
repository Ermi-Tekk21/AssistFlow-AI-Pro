import { create } from "zustand";
import {
  Task,
  Reminder,
  CalendarEvent,
  PendingAction,
  ChatMessage,
  DailyBriefingPreview,
} from "../types";
import { api } from "../lib/api";

export type NavTab = "chat" | "tasks" | "reminders" | "calendar" | "briefing";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

interface AppState {
  // User Authentication / Context
  userId: string;
  setUserId: (id: string) => void;

  // Navigation
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;

  // Toast Notifications
  toast: ToastState | null;
  showToast: (message: string, type?: "success" | "error" | "info") => void;

  // Assistant Chat
  sessionId: string | null;
  messages: ChatMessage[];
  chatLoading: boolean;
  sendChatMessage: (message: string) => Promise<void>;
  fetchSession: () => Promise<void>;

  // Pending Actions
  pendingActions: PendingAction[];
  actionsLoading: boolean;
  fetchPendingActions: () => Promise<void>;
  confirmAction: (actionId: string) => Promise<void>;
  rejectAction: (actionId: string) => Promise<void>;

  // Tasks
  tasks: Task[];
  tasksLoading: boolean;
  taskFilter: "all" | "pending" | "completed";
  setTaskFilter: (filter: "all" | "pending" | "completed") => void;
  fetchTasks: () => Promise<void>;
  createTask: (title: string, priority?: string, dueAt?: string | null) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;

  // Reminders
  reminders: Reminder[];
  remindersLoading: boolean;
  fetchReminders: () => Promise<void>;
  cancelReminder: (reminderId: string) => Promise<void>;

  // Calendar
  calendarEvents: CalendarEvent[];
  calendarLoading: boolean;
  fetchCalendarEvents: () => Promise<void>;
  cancelCalendarEvent: (eventId: string) => Promise<void>;

  // Daily Briefing
  briefing: DailyBriefingPreview | null;
  briefingLoading: boolean;
  fetchBriefing: () => Promise<void>;
  sendBriefingNow: () => Promise<void>;
}

const DEFAULT_USER_ID =
  import.meta.env.VITE_DEFAULT_USER_ID || "32628984-366b-4c22-8995-3222734d51bf";
const INITIAL_USER_ID = localStorage.getItem("assistflow_user_id") || DEFAULT_USER_ID;

export const useStore = create<AppState>((set, get) => ({
  userId: INITIAL_USER_ID,
  setUserId: (id: string) => {
    localStorage.setItem("assistflow_user_id", id);
    set({ userId: id });
    // Reload all data for new user
    get().fetchTasks();
    get().fetchReminders();
    get().fetchCalendarEvents();
    get().fetchPendingActions();
    get().fetchSession();
  },

  activeTab: "chat",
  setActiveTab: (tab: NavTab) => set({ activeTab: tab }),

  toast: null,
  showToast: (message: string, type: "success" | "error" | "info" = "info") => {
    set({ toast: { message, type } });
    setTimeout(() => {
      set({ toast: null });
    }, 4000);
  },

  // Assistant Chat
  sessionId: null,
  messages: [],
  chatLoading: false,

  fetchSession: async () => {
    const { userId, sessionId } = get();
    try {
      const session = await api.getSession(userId, sessionId || undefined);
      if (session) {
        set({
          sessionId: session.id,
          messages: session.messages || [],
        });
      }
    } catch (err: any) {
      console.warn("Could not fetch active session:", err.message);
    }
  },

  sendChatMessage: async (messageText: string) => {
    const { userId, sessionId, messages } = get();
    if (!messageText.trim()) return;

    // Optimistic user message append
    const userMsg: ChatMessage = {
      role: "user",
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    set({
      messages: [...messages, userMsg],
      chatLoading: true,
    });

    try {
      const result = await api.sendAssistantMessage(userId, messageText, sessionId || undefined);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.response,
        timestamp: new Date().toISOString(),
      };

      set({
        sessionId: result.sessionId,
        messages: [...get().messages, assistantMsg],
        chatLoading: false,
      });

      // If a pending action was created or executed, refresh pending actions
      if (result.pendingAction || result.intent === "confirmation_reply") {
        get().fetchPendingActions();
        get().fetchTasks();
        get().fetchReminders();
        get().fetchCalendarEvents();
      }
    } catch (err: any) {
      set({ chatLoading: false });
      get().showToast(err.message, "error");
    }
  },

  // Pending Actions
  pendingActions: [],
  actionsLoading: false,

  fetchPendingActions: async () => {
    const { userId } = get();
    set({ actionsLoading: true });
    try {
      const actions = await api.getPendingActions(userId);
      set({ pendingActions: Array.isArray(actions) ? actions : [], actionsLoading: false });
    } catch (err: any) {
      set({ pendingActions: [], actionsLoading: false });
      console.error("Failed to fetch pending actions:", err);
    }
  },

  confirmAction: async (actionId: string) => {
    const { userId } = get();
    try {
      const res = await api.confirmPendingAction(userId, actionId);
      get().showToast(`Confirmed: ${res.action.proposal}`, "success");
      // Refresh state
      await get().fetchPendingActions();
      await get().fetchTasks();
      await get().fetchReminders();
      await get().fetchCalendarEvents();
    } catch (err: any) {
      get().showToast(err.message, "error");
    }
  },

  rejectAction: async (actionId: string) => {
    const { userId } = get();
    try {
      const res = await api.rejectPendingAction(userId, actionId);
      get().showToast(`Cancelled: ${res.proposal}`, "info");
      await get().fetchPendingActions();
    } catch (err: any) {
      get().showToast(err.message, "error");
    }
  },

  // Tasks
  tasks: [],
  tasksLoading: false,
  taskFilter: "all",
  setTaskFilter: (filter) => {
    set({ taskFilter: filter });
    get().fetchTasks();
  },

  fetchTasks: async () => {
    const { userId, taskFilter } = get();
    set({ tasksLoading: true });
    try {
      const statusParam = taskFilter === "all" ? undefined : taskFilter;
      const tasks = await api.getTasks(userId, statusParam);
      set({ tasks: Array.isArray(tasks) ? tasks : [], tasksLoading: false });
    } catch (err: any) {
      set({ tasks: [], tasksLoading: false });
      get().showToast(`Failed to load tasks: ${err.message}`, "error");
    }
  },

  createTask: async (title: string, priority = "medium", dueAt = null) => {
    const { userId } = get();
    try {
      await api.createTask(userId, { title, priority, dueAt });
      get().showToast(`Created task "${title}"`, "success");
      await get().fetchTasks();
    } catch (err: any) {
      get().showToast(err.message, "error");
    }
  },

  completeTask: async (taskId: string) => {
    const { userId } = get();
    try {
      await api.completeTask(userId, taskId);
      get().showToast("Task completed!", "success");
      await get().fetchTasks();
    } catch (err: any) {
      get().showToast(err.message, "error");
    }
  },

  deleteTask: async (taskId: string) => {
    const { userId } = get();
    try {
      await api.deleteTask(userId, taskId);
      get().showToast("Task deleted", "info");
      await get().fetchTasks();
    } catch (err: any) {
      get().showToast(err.message, "error");
    }
  },

  // Reminders
  reminders: [],
  remindersLoading: false,

  fetchReminders: async () => {
    const { userId } = get();
    set({ remindersLoading: true });
    try {
      const reminders = await api.getReminders(userId);
      set({ reminders: Array.isArray(reminders) ? reminders : [], remindersLoading: false });
    } catch (err: any) {
      set({ reminders: [], remindersLoading: false });
      get().showToast(`Failed to load reminders: ${err.message}`, "error");
    }
  },

  cancelReminder: async (reminderId: string) => {
    const { userId } = get();
    try {
      await api.cancelReminder(userId, reminderId);
      get().showToast("Reminder cancelled", "info");
      await get().fetchReminders();
    } catch (err: any) {
      get().showToast(err.message, "error");
    }
  },

  // Calendar
  calendarEvents: [],
  calendarLoading: false,

  fetchCalendarEvents: async () => {
    const { userId } = get();
    set({ calendarLoading: true });
    try {
      const events = await api.getCalendarEvents(userId);
      set({ calendarEvents: Array.isArray(events) ? events : [], calendarLoading: false });
    } catch (err: any) {
      set({ calendarEvents: [], calendarLoading: false });
      get().showToast(`Failed to load calendar events: ${err.message}`, "error");
    }
  },

  cancelCalendarEvent: async (eventId: string) => {
    const { userId } = get();
    try {
      await api.cancelCalendarEvent(userId, eventId);
      get().showToast("Meeting cancelled", "info");
      await get().fetchCalendarEvents();
      await get().fetchReminders();
    } catch (err: any) {
      get().showToast(err.message, "error");
    }
  },

  // Daily Briefing
  briefing: null,
  briefingLoading: false,

  fetchBriefing: async () => {
    const { userId } = get();
    set({ briefingLoading: true });
    try {
      const data = await api.getBriefingPreview(userId);
      set({ briefing: data, briefingLoading: false });
    } catch (err: any) {
      set({ briefingLoading: false });
      get().showToast(`Failed to load briefing: ${err.message}`, "error");
    }
  },

  sendBriefingNow: async () => {
    const { userId } = get();
    set({ briefingLoading: true });
    try {
      await api.sendBriefing(userId, true);
      get().showToast("Daily briefing dispatched to Telegram!", "success");
      set({ briefingLoading: false });
    } catch (err: any) {
      set({ briefingLoading: false });
      get().showToast(err.message, "error");
    }
  },
}));
