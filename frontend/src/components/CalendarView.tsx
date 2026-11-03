import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Calendar, Video, Clock, Users, XCircle, Loader2 } from "lucide-react";
import { formatDateTime } from "../lib/utils";

export const CalendarView: React.FC = () => {
  const {
    calendarEvents = [],
    calendarLoading = false,
    fetchCalendarEvents,
    cancelCalendarEvent,
  } = useStore();

  useEffect(() => {
    fetchCalendarEvents();
  }, [fetchCalendarEvents]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Google Calendar Agenda</h2>
          <p className="text-xs text-slate-500">
            Meetings synchronized with Google Calendar. Google Meet links and 10-minute reminders are provisioned automatically.
          </p>
        </div>
      </div>

      {calendarLoading ? (
        <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <span>Loading calendar events...</span>
        </div>
      ) : (calendarEvents || []).length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-600">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-800">No upcoming meetings</p>
          <p className="text-xs text-slate-500 mt-1">
            Say "Schedule meeting tomorrow with team from 3pm to 4pm" in the chat to create one!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(calendarEvents || []).map((event) => {
            const isCancelled = event.status === "cancelled";

            return (
              <div
                key={event.id}
                className={`bg-white border rounded-lg p-4 shadow-sm transition-colors ${
                  isCancelled
                    ? "border-slate-200 bg-slate-50/70 opacity-70"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h3
                        className={`text-sm font-semibold ${
                          isCancelled ? "line-through text-slate-400" : "text-slate-900"
                        }`}
                      >
                        {event.title}
                      </h3>
                      {isCancelled ? (
                        <Badge variant="secondary">Cancelled</Badge>
                      ) : (
                        <Badge variant="success">Confirmed</Badge>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-xs text-slate-600">{event.description}</p>
                    )}

                    {/* Timing */}
                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-500 pt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDateTime(event.startAt)}</span>
                      <span>—</span>
                      <span>{formatDateTime(event.endAt)}</span>
                      <span className="text-[11px] text-slate-400">({event.timezone})</span>
                    </div>

                    {/* Attendees */}
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="flex items-center space-x-1.5 pt-2 flex-wrap gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400 mr-1" />
                        {event.attendees.map((attendee) => (
                          <span
                            key={attendee.id}
                            className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono"
                          >
                            {attendee.email}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions & Meet Link */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {event.meetUrl && !isCancelled && (
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white"
                        onClick={() => window.open(event.meetUrl!, "_blank")}
                      >
                        <Video className="w-3.5 h-3.5 mr-1.5" />
                        Join Google Meet
                      </Button>
                    )}

                    {!isCancelled && (
                      <button
                        onClick={() => cancelCalendarEvent(event.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded hover:bg-slate-100"
                        title="Cancel meeting"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
