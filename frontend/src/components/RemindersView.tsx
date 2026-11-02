import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { Badge } from "./ui/Badge";
import { Bell, Clock, Calendar, CheckSquare, XCircle, Loader2 } from "lucide-react";
import { formatDateTime } from "../lib/utils";

export const RemindersView: React.FC = () => {
  const { reminders, remindersLoading, fetchReminders, cancelReminder } = useStore();

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="info">Scheduled</Badge>;
      case "sent":
        return <Badge variant="success">Sent</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Reminders & Telegram Alerts</h2>
          <p className="text-xs text-slate-500">
            Due reminders are claimed concurrency-safe and dispatched to Telegram by n8n.
          </p>
        </div>
      </div>

      {remindersLoading ? (
        <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <span>Loading reminders...</span>
        </div>
      ) : reminders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-600">
            <Bell className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-800">No reminders found</p>
          <p className="text-xs text-slate-500 mt-1">
            Ask the assistant in chat to schedule a reminder for you!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map((reminder) => {
            const isScheduled = reminder.status === "scheduled";

            return (
              <div
                key={reminder.id}
                className="bg-white border border-slate-200 rounded-lg p-3.5 flex items-center justify-between shadow-sm hover:border-slate-300 transition-colors"
              >
                <div className="space-y-1 min-w-0 pr-4">
                  <div className="flex items-center space-x-2">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {reminder.title}
                    </p>
                    {getStatusBadge(reminder.status)}
                  </div>

                  {reminder.description && (
                    <p className="text-[11px] text-slate-600 truncate">{reminder.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                    <div className="flex items-center font-mono">
                      <Clock className="w-3 h-3 mr-1 text-slate-400" />
                      <span>{formatDateTime(reminder.scheduledAt)}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({reminder.timezone})</span>
                    </div>

                    {reminder.task && (
                      <div className="flex items-center text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                        <CheckSquare className="w-3 h-3 mr-1 text-slate-400" />
                        <span>Task: {reminder.task.title}</span>
                      </div>
                    )}

                    {reminder.calendarEvent && (
                      <div className="flex items-center text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                        <Calendar className="w-3 h-3 mr-1 text-blue-400" />
                        <span>10-Min Pre-Meeting Alert</span>
                      </div>
                    )}
                  </div>
                </div>

                {isScheduled && (
                  <button
                    onClick={() => cancelReminder(reminder.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors p-1 shrink-0"
                    title="Cancel reminder"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
