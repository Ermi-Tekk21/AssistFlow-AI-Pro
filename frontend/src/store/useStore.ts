import { create } from "zustand";
import {
  Task,
  Reminder,
  CalendarEvent,
  PendingAction,
  ChatMessage,
  DailyBriefingPreview,
  UserProfile,
  NavTab,
} from "../types";
import { api } from "../lib/api";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

interface AppState {
  // User Authentication & Profile
  token: string | null;
  user: UserProfile | null;
  userId: string;
  authLoading: boolean;
  setUserId: (id: string) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateProfile: (updates: {
    firstName?: string;
    lastName?: string;
    dailyBriefingTime?: string | null;
    dailyBriefingEnabled?: boolean;
    timezone?: string;
  }) => Promise<void>;

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
  createCalendarEvent: (
    summary: string,
    startAt: string,
    endAt: string,
    description?: string,
    attendees?: string[]
  ) => Promise<void>;
  cancelCalendarEvent: (eventId: string) => Promise<void>;

  // Daily Briefing
  briefing: DailyBriefingPreview | null;
  briefingLoading: boolean;
  fetchBriefing: () => Promise<void>;
  sendBriefingNow: () => Promise<void>;
}

const INITIAL_TOKEN = localStorage.getItem("assistflow_token");
const INITIAL_USER_ID = localStorage.getItem("assistflow_user_id") || "";

export const useStore = create<AppState>((set, get) => ({
  // Authentication & Profile State
  token: INITIAL_TOKEN,
  user: null,
  userId: INITIAL_USER_ID,
  authLoading: false,

  setUserId: (id: string) => {
    localStorage.setItem("assistflow_user_id", id);
    set({ userId: id });
    get().fetchTasks();
    get().fetchReminders();
    get().fetchCalendarEvents();
    get().fetchPendingActions();
    get().fetchSession();
  },

  login: async (email: string, password: string): Promise<boolean> => {
    set({ authLoading: true });
    try {
      const res = await api.login(email, password);
      localStorage.setItem("assistflow_token", res.token);
      localStorage.setItem("assistflow_user_id", res.user.id);

      set({
        token: res.token,
        user: res.user,
        userId: res.user.id,
        authLoading: false,
      });

      get().showToast(`Welcome back, ${res.user.firstName || "Ermias"}!`, "success");

      // Load initial dashboard data
      get().fetchTasks();
      get().fetchReminders();
      get().fetchCalendarEvents();
      get().fetchPendingActions();
      get().fetchSession();

      return true;
    } catch (err: any) {
      set({ authLoading: false });
      get().showToast(err.message || "Failed to sign in", "error");
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("assistflow_token");
    localStorage.removeItem("assistflow_user_id");
    set({
      token: null,
      user: null,
      userId: "",
      messages: [],
      sessionId: null,
      tasks: [],
      reminders: [],
      calendarEvents: [],
      pendingActions: [],
      activeTab: "chat",
    });
    get().showToast("You have been signed out.", "info");
  },

  fetchMe: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const res = await api.getMe();
      if (res && res.user) {
        set({
          user: res.user,
          userId: res.user.id,
        });
        localStorage.setItem("assistflow_user_id", res.user.id);
      }
    } catch (err: any) {
      console.warn("Session expired or invalid, signing out:", err.message);
      get().logout();
    }
  },

  updateProfile: async (updates) => {
    set({ authLoading: true });
    try {
      const res = await api.updateProfile(updates);
      set({ user: res.user, authLoading: false });
      get().showToast("Profile settings updated successfully!", "success");
    } catch (err: any) {
      set({ authLoading: false });
      get().showToast(err.message || "Failed to update profile", "error");
    }
  },

  // Navigation
  activeTab: "chat",
  setActiveTab: (tab: NavTab) => set({ activeTab: tab }),

  // Toast
  toast: null,
  showToast: (message: string, type = "info") => {
    set({ toast: { message, type } });
    setTimeout(() => {
      set((state) => {
        if (state.toast?.message === message) {
          return { toast: null };
        }
        return {};
      });
    }, 4000);
  },

  // Chat
  sessionId: null,
  messages: [],
  chatLoading: false,

  fetchSession: async () => {
    const { userId, sessionId } = get();
    if (!userId) return;
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
    if (!userId || !messageText.trim()) return;

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

      // Reload dashboard data
      get().fetchPendingActions();
      get().fetchTasks();
      get().fetchReminders();
      get().fetchCalendarEvents();
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
    if (!userId) return;
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
    if (!userId) return;
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
    if (!userId) return;
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

  setTaskFilter: (filter: "all" | "pending" | "completed") => {
    set({ taskFilter: filter });
    get().fetchTasks();
  },

  fetchTasks: async () => {
    const { userId, taskFilter } = get();
    if (!userId) return;
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
    if (!userId) return;
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
    if (!userId) return;
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
    if (!userId) return;
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
    if (!userId) return;
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
    if (!userId) return;
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
    if (!userId) return;
    set({ calendarLoading: true });
    try {
      const events = await api.getCalendarEvents(userId);
      set({ calendarEvents: Array.isArray(events) ? events : [], calendarLoading: false });
    } catch (err: any) {
      set({ calendarEvents: [], calendarLoading: false });
      get().showToast(`Failed to load calendar events: ${err.message}`, "error");
    }
  },

  createCalendarEvent: async (
    summary: string,
    startAt: string,
    endAt: string,
    description?: string,
    attendees?: string[]
  ) => {
    const { userId } = get();
    if (!userId) return;
    try {
      await api.createCalendarEvent(userId, { summary, startAt, endAt, description, attendees });
      get().showToast(`Meeting "${summary}" scheduled!`, "success");
      await get().fetchCalendarEvents();
      await get().fetchReminders();
    } catch (err: any) {
      get().showToast(err.message, "error");
    }
  },

  cancelCalendarEvent: async (eventId: string) => {
    const { userId } = get();
    if (!userId) return;
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
    if (!userId) return;
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
    if (!userId) return;
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
