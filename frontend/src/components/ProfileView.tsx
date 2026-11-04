import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/Card";
import {
  User,
  Mail,
  Lock,
  Clock,
  Globe,
  Bell,
  LogOut,
  Save,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Send,
} from "lucide-react";

export const ProfileView: React.FC = () => {
  const { user, fetchMe, updateProfile, sendBriefingNow, logout, authLoading } = useStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dailyBriefingTime, setDailyBriefingTime] = useState("08:00");
  const [dailyBriefingEnabled, setDailyBriefingEnabled] = useState(false);
  const [timezone, setTimezone] = useState("Africa/Addis_Ababa");
  const [isSaved, setIsSaved] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testSentSuccess, setTestSentSuccess] = useState(false);

  const handleTestSendBriefing = async () => {
    try {
      setTestSending(true);
      await sendBriefingNow();
      setTestSentSuccess(true);
      setTimeout(() => setTestSentSuccess(false), 4000);
    } catch (err) {
      console.error("Test send briefing failed:", err);
    } finally {
      setTestSending(false);
    }
  };

  useEffect(() => {
    if (!user) {
      fetchMe();
    } else {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setDailyBriefingTime(user.dailyBriefingTime ? user.dailyBriefingTime.slice(0, 5) : "08:00");
      setDailyBriefingEnabled(Boolean(user.dailyBriefingEnabled));
      setTimezone(user.timezone || "Africa/Addis_Ababa");
    }
  }, [user, fetchMe]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(false);

    await updateProfile({
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      dailyBriefingTime: dailyBriefingTime ? `${dailyBriefingTime}:00` : null,
      dailyBriefingEnabled,
      timezone: timezone.trim() || undefined,
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Administrator Profile</h2>
          <p className="text-xs text-slate-500">
            Manage your personal details, immutable identity, and daily executive briefing settings.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          Sign Out
        </Button>
      </div>

      {/* Profile Form Card */}
      <Card className="border-slate-300 shadow-sm bg-white">
        <CardHeader className="py-3.5 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
              <User className="w-3.5 h-3.5" />
            </div>
            <CardTitle className="text-xs font-semibold">User Details & Briefing Preferences</CardTitle>
          </div>
          {/* <Badge variant="secondary" className="font-mono text-[11px]">
            Single JWT Access
          </Badge> */}
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Immutable Email */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700 flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Address</span>
                </label>
                <span className="inline-flex items-center text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium border border-slate-200">
                  <Lock className="w-2.5 h-2.5 mr-1 text-slate-400" />
                  Immutable
                </span>
              </div>
              <Input
                type="email"
                value={user?.email || (import.meta.env.VITE_DEFAULT_USER_EMAIL || "ermiasteklemarkos@gmail.com")}
                disabled
                className="bg-slate-50 text-slate-500 font-mono text-xs cursor-not-allowed border-slate-200"
              />
              <p className="text-[11px] text-slate-400">
                The account email address is permanently bound to this user record and cannot be edited.
              </p>
            </div>

            {/* First Name & Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">First Name</label>
                <Input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ermias"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Last Name</label>
                <Input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Teklemarkos"
                  className="text-xs"
                />
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>Timezone</span>
              </label>
              <Input
                type="text"
                required
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Africa/Addis_Ababa"
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-slate-400">
                Used for calculating relative times ("tomorrow 3pm") and morning briefing dispatch.
              </p>
            </div>

            {/* Daily Briefing Settings */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-800 flex items-center space-x-1.5">
                    <Bell className="w-3.5 h-3.5 text-slate-500" />
                    <span>Daily Morning Briefing</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Receive automated summary of tasks and agenda via Telegram.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dailyBriefingEnabled}
                    onChange={(e) => setDailyBriefingEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
                </label>
              </div>

              {dailyBriefingEnabled && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Briefing Scheduled Time</span>
                  </label>
                  <input
                    type="time"
                    value={dailyBriefingTime}
                    onChange={(e) => setDailyBriefingTime(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white font-mono"
                    required
                  />
                  <p className="text-[11px] text-slate-500">
                    Dispatched daily at this time in your local timezone ({timezone}).
                  </p>

                  <div className="pt-2 mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-200/70">
                    <span className="text-[11px] text-slate-500">
                      Want to verify Telegram delivery right now?
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testSending}
                      onClick={handleTestSendBriefing}
                      className="text-xs border-slate-300 text-slate-700 hover:bg-slate-100 shrink-0"
                    >
                      {testSending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-slate-500" />
                          <span>Dispatching...</span>
                        </>
                      ) : testSentSuccess ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                          <span className="text-emerald-700 font-medium">Sent to Telegram!</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                          <span>Send Briefing to Telegram Now</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex items-center justify-between border-t border-slate-100">
              <div className="text-xs text-emerald-600 font-medium flex items-center space-x-1">
                {isSaved && (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Profile saved!</span>
                  </>
                )}
              </div>

              <Button type="submit" size="sm" disabled={authLoading}>
                {authLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save Profile
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Security & Connected Integrations Card */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-slate-600" />
            <span>Security & Integration Status</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-white p-2.5 rounded border border-slate-200 space-y-0.5">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Authentication</div>
              <div className="font-medium text-slate-700">JWT Access Token</div>
              <div className="text-[10px] text-slate-500">Stateless 7-Day Session</div>
            </div>

            <div className="bg-white p-2.5 rounded border border-slate-200 space-y-0.5">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Google Calendar</div>
              <div className="font-medium text-emerald-700">Active OAuth Sync</div>
              <div className="text-[10px] text-slate-500">Meet Video Rooms</div>
            </div>

            <div className="bg-white p-2.5 rounded border border-slate-200 space-y-0.5">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Telegram Delivery</div>
              <div className="font-medium text-emerald-700">Bot Connected</div>
              <div className="text-[10px] text-slate-500">Direct Push Alerts</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
