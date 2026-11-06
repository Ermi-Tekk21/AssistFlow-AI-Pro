import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Button } from "./ui/Button";
import { SignInModal } from "./SignInModal";
import { ComingSoonModal } from "./ComingSoonModal";
import {
  Send,
  ShieldCheck,
  Video,
  Bot,
  Sparkles,
  ArrowRight,
  UserCheck,
  Sun,
  Moon,
} from "lucide-react";

export const LandingPage: React.FC = () => {
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const { theme, toggleTheme } = useStore();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080E1E] text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-slate-200 dark:selection:bg-blue-600 selection:text-slate-900 dark:selection:text-white transition-colors">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B132B] sticky top-0 z-30 transition-colors">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm shrink-0">
              AF
            </div>
            <div>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="font-semibold text-xs sm:text-sm tracking-tight text-slate-900 dark:text-white">
                  AssistFlow AI
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-700">
                  v1.0 Pro
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Theme Switcher Button */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Toggle Night Mode"
            >
              {theme === "dark" ? (
                <Moon className="w-4 h-4 text-blue-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsComingSoonOpen(true)}
              className="text-xs px-2.5 sm:px-3 h-8"
            >
              Create Account
            </Button>
            <Button
              size="sm"
              onClick={() => setIsSignInOpen(true)}
              className="text-xs px-2.5 sm:px-3 h-8"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 sm:pb-12 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 mb-4 sm:mb-6 font-mono max-w-full">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate sm:whitespace-normal">Autonomous Executive Assistant</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight px-1">
            Autonomous Executive Orchestration for High-Impact Days
          </h1>

          <p className="mt-3 sm:mt-4 text-xs sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Manage priorities conversationally, schedule calendar meetings with auto-provisioned
            Google Meet rooms and attendee invites, and receive curated executive morning briefings
            delivered straight to your Telegram phone.
          </p>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 w-full sm:w-auto px-2">
            <Button
              size="lg"
              onClick={() => setIsSignInOpen(true)}
              className="w-full sm:w-auto text-sm px-6 font-medium h-10 sm:h-11"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Sign In
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsComingSoonOpen(true)}
              className="w-full sm:w-auto text-sm px-6 h-10 sm:h-11"
            >
              Create Account
              <ArrowRight className="w-4 h-4 ml-1.5 text-slate-400" />
            </Button>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="text-center mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Enterprise-Grade Autonomous Capabilities
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Built with full-stack TypeScript, TypeORM, PostgreSQL, Google Cloud, and Telegram APIs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Feature 1: Chat & Slot Filling */}
            <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm space-y-2.5">
              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Natural-Language Chat & Slot Filling
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Interact with your assistant in natural language. If a meeting or task detail is missing
                (such as required attendee emails or scheduled dates), Gemini asks slot-filling questions
                across conversational turns until complete.
              </p>
            </div>

            {/* Feature 2: Calendar & Google Meet */}
            <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm space-y-2.5">
              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
                <Video className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Google Calendar Sync & Meet Video Rooms
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Schedule meetings with mandatory attendee validation. Automatically provisions unique
                Google Meet URLs, links attendee invites with email notifications, and schedules a 10-minute preparation alert.
              </p>
            </div>

            {/* Feature 3: Telegram Reminders & Briefings */}
            <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm space-y-2.5">
              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Telegram Dispatch & Daily Morning Briefings
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Dispatches time-critical reminders directly to your Telegram chat. At your configured
                briefing time, compiles pending tasks, scheduled meetings, and reminders into a clean summary.
              </p>
            </div>

            {/* Feature 4: Safe Confirmation Guardrails */}
            <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm space-y-2.5">
              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Dual-Phase Human Confirmation Guardrails
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Protective safety architecture: mutating operations are proposed first as PendingActions
                and execute only when you confirm via interactive button or natural language reply.
              </p>
            </div>
          </div>
        </section>

        {/* Live Architecture Summary */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-slate-100/80 dark:bg-[#0B132B] border border-slate-200 dark:border-slate-800 rounded-lg p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
              System Architecture & Connected Services
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center">
              <div className="bg-white dark:bg-[#0F172A] p-2.5 sm:p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-800 dark:text-white">Gemini 3.5</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Intent Reasoning</div>
              </div>
              <div className="bg-white dark:bg-[#0F172A] p-2.5 sm:p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-800 dark:text-white">Google Meet</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Calendar API</div>
              </div>
              <div className="bg-white dark:bg-[#0F172A] p-2.5 sm:p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-800 dark:text-white">Telegram Bot</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Push Delivery</div>
              </div>
              <div className="bg-white dark:bg-[#0F172A] p-2.5 sm:p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-800 dark:text-white">PostgreSQL</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">ACID State Store</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B132B] py-5 sm:py-6 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
          <div>
            © 2026 AssistFlow AI. Autonomous executive assistant project for Ermias Teklemarkos.
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4">
            <button
              onClick={() => setIsComingSoonOpen(true)}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Account Registration Setup
            </button>
            <button
              onClick={() => setIsSignInOpen(true)}
              className="hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
            >
              Administrator Sign In
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SignInModal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
      />
      <ComingSoonModal
        isOpen={isComingSoonOpen}
        onClose={() => setIsComingSoonOpen(false)}
        onOpenSignIn={() => {
          setIsComingSoonOpen(false);
          setIsSignInOpen(true);
        }}
      />
    </div>
  );
};
