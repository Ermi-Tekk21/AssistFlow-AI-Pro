import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/Card";
import {
  Calendar,
  Video,
  Clock,
  Users,
  XCircle,
  Loader2,
  Plus,
  Copy,
  Check,
} from "lucide-react";
import { formatDateTime } from "../lib/utils";

export const CalendarView: React.FC = () => {
  const {
    calendarEvents = [],
    calendarLoading = false,
    fetchCalendarEvents,
    createCalendarEvent,
    cancelCalendarEvent,
    showToast,
  } = useStore();

  const [isAdding, setIsAdding] = useState(false);
  const [summary, setSummary] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [description, setDescription] = useState("");
  const [attendees, setAttendees] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCalendarEvents();
  }, [fetchCalendarEvents]);

  const attendeesList = attendees
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || !startAt || !endAt) return;

    if (attendeesList.length === 0) {
      showToast("Please provide at least one attendee email address for the meeting.", "error");
      return;
    }

    const startIso = new Date(startAt).toISOString();
    const endIso = new Date(endAt).toISOString();

    await createCalendarEvent(
      summary.trim(),
      startIso,
      endIso,
      description.trim() || undefined,
      attendeesList
    );

    setSummary("");
    setStartAt("");
    setEndAt("");
    setDescription("");
    setAttendees("");
    setIsAdding(false);
  };

  const handleCopyMeetUrl = (eventId: string, meetUrl: string) => {
    navigator.clipboard.writeText(meetUrl);
    setCopiedId(eventId);
    showToast("Google Meet link copied to clipboard! Ready to share.", "success");
    setTimeout(() => {
      setCopiedId((curr) => (curr === eventId ? null : curr));
    }, 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Google Calendar Agenda</h2>
          <p className="text-xs text-slate-500">
            Meetings synchronized with Google Calendar. Google Meet links and 10-minute reminders are provisioned automatically.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          variant={isAdding ? "outline" : "default"}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {isAdding ? "Cancel" : "Add Meeting"}
        </Button>
      </div>

      {/* New Meeting Inline Form */}
      {isAdding && (
        <Card className="border-slate-300 shadow-sm bg-white">
          <CardHeader className="py-3 border-b border-slate-100">
            <CardTitle className="text-xs font-semibold">Schedule New Meeting</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1">
                <Input
                  placeholder="Meeting title / summary (e.g. Q4 Executive Strategy Sync)..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="text-xs"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 w-16 shrink-0">Starts:</span>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white w-full"
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 w-16 shrink-0">Ends:</span>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white w-full"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">
                    Attendees <span className="text-red-500">* (at least one email required)</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Comma-separated</span>
                </div>
                <Input
                  placeholder="colleague@example.com, partner@company.com..."
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  className="text-xs font-mono"
                  required
                />
                {attendees.trim().length > 0 && attendeesList.length === 0 && (
                  <p className="text-[11px] text-red-500">
                    Please provide at least one valid attendee email address.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Input
                  placeholder="Optional meeting agenda / notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!summary.trim() || !startAt || !endAt || attendeesList.length === 0}
                >
                  Schedule Meeting
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Calendar List */}
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
            Click "Add Meeting" above or say "Schedule meeting tomorrow with alex@example.com from 3pm to 4pm" in chat!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(calendarEvents || []).map((event) => {
            const isCancelled = event.status === "cancelled";
            const isCopied = copiedId === event.id;

            return (
              <div
                key={event.id}
                className={`bg-white border rounded-lg p-4 shadow-sm transition-colors ${
                  isCancelled
                    ? "border-slate-200 bg-slate-50/70 opacity-70"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
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
                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-500 pt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDateTime(event.startAt)}</span>
                      <span>—</span>
                      <span>{formatDateTime(event.endAt)}</span>
                      <span className="text-[11px] text-slate-400">({event.timezone})</span>
                    </div>

                    {/* Attendees */}
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="flex items-center space-x-1.5 pt-1.5 flex-wrap gap-1">
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

                    {/* Prominent Google Meet URL display for sharing */}
                    {event.meetUrl && !isCancelled && (
                      <div className="pt-2 flex items-center space-x-2">
                        <div className="flex items-center space-x-1 text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 truncate max-w-sm sm:max-w-md">
                          <Video className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                          <span className="truncate">{event.meetUrl}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs text-slate-700 hover:text-slate-900"
                          onClick={() => handleCopyMeetUrl(event.id, event.meetUrl!)}
                          title="Copy link to share with attendees"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1 text-slate-500" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Actions: Join Meet & Cancel */}
                  <div className="flex items-center space-x-2 shrink-0 pt-1 sm:pt-0">
                    {event.meetUrl && !isCancelled && (
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white"
                        onClick={() => window.open(event.meetUrl!, "_blank")}
                      >
                        <Video className="w-3.5 h-3.5 mr-1.5" />
                        Join Meet
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
