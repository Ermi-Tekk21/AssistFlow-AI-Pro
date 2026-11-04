import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Sun, Send, RefreshCw, Loader2, Calendar, Bell, CheckSquare } from "lucide-react";

export const BriefingView: React.FC = () => {
  const { briefing, briefingLoading, fetchBriefing, sendBriefingNow } = useStore();

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Daily Morning Briefing</h2>
          <p className="text-xs text-slate-500">
            A concise daily summary aggregated in your timezone and delivered to your Telegram.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchBriefing()}
            disabled={briefingLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${briefingLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            variant="default"
            onClick={() => sendBriefingNow()}
            disabled={briefingLoading}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Send to Telegram Now
          </Button>
        </div>
      </div>

      {briefingLoading && !briefing ? (
        <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <span>Compiling today's briefing...</span>
        </div>
      ) : !briefing ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-sm font-medium text-slate-800">Briefing not available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quick Metrics Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-white shadow-sm border-slate-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Today's Meetings
                  </p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">
                    {briefing.counts.events}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-slate-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Today's Reminders
                  </p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">
                    {briefing.counts.reminders}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-slate-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Pending Tasks
                  </p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">
                    {briefing.counts.tasks}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Telegram Preview Card */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="py-3.5 flex flex-row items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sun className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-sm font-semibold">Telegram Message Preview</CardTitle>
              </div>
              <Badge variant="outline" className="font-mono text-[11px]">
                {briefing.formattedDate}
              </Badge>
            </CardHeader>

            <CardContent className="pt-4">
              <div
                className="bg-slate-50 border border-slate-200 rounded-lg p-5 font-sans text-xs text-slate-800 leading-relaxed space-y-2 whitespace-pre-wrap select-text"
                dangerouslySetInnerHTML={{ __html: briefing.html }}
              />
            </CardContent>

            <CardFooter className="py-3 justify-between text-xs text-slate-500">
              <span>Automatic schedule triggers via n8n at configured briefing time</span>
              <Button size="sm" onClick={() => sendBriefingNow()}>
                <Send className="w-3.5 h-3.5 mr-1" />
                Send Now
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
