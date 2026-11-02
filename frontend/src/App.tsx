import React, { useEffect } from "react";
import { useStore } from "./store/useStore";
import { Header } from "./components/Header";
import { ChatView } from "./components/ChatView";
import { TasksView } from "./components/TasksView";
import { RemindersView } from "./components/RemindersView";
import { CalendarView } from "./components/CalendarView";
import { BriefingView } from "./components/BriefingView";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

export const App: React.FC = () => {
  const { activeTab, toast, fetchPendingActions, fetchSession } = useStore();

  useEffect(() => {
    fetchPendingActions();
    fetchSession();
  }, [fetchPendingActions, fetchSession]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {activeTab === "chat" && <ChatView />}
        {activeTab === "tasks" && <TasksView />}
        {activeTab === "reminders" && <RemindersView />}
        {activeTab === "calendar" && <CalendarView />}
        {activeTab === "briefing" && <BriefingView />}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-lg shadow-lg border text-xs font-medium animate-in fade-in slide-in-from-bottom-2 bg-white text-slate-900 border-slate-200">
          {toast.type === "success" && (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          {toast.type === "error" && (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          {toast.type === "info" && (
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
