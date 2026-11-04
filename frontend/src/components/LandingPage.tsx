import React, { useState } from "react";
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
} from "lucide-react";

export const LandingPage: React.FC = () => {
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-slate-200">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight">
              AF
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm tracking-tight text-slate-900">
                  AssistFlow AI
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                  v1.0 Pro
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsComingSoonOpen(true)}
              className="text-xs"
            >
              Create Account
            </Button>
            <Button
              size="sm"
              onClick={() => setIsSignInOpen(true)}
              className="text-xs"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 mb-6 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-slate-600" />
            <span>Autonomous Executive Assistant Powered by Gemini 3.5</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            Autonomous Executive Orchestration for High-Impact Days
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Manage priorities conversationally, schedule calendar meetings with auto-provisioned
            Google Meet rooms and attendee invites, and receive curated executive morning briefings
            delivered straight to your Telegram phone.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => setIsSignInOpen(true)}
              className="w-full sm:w-auto text-sm px-6 font-medium"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Sign In (Default User)
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsComingSoonOpen(true)}
              className="w-full sm:w-auto text-sm px-6 bg-white"
            >
              Create Account (Coming Soon)
              <ArrowRight className="w-4 h-4 ml-1.5 text-slate-400" />
            </Button>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Default administrator profile pre-configured for{" "}
            <span className="font-mono text-slate-600">ermias@gmail.com</span> (Ermias Teklemarkos)
          </p>
        </section>

        {/* Feature Highlights Grid */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="text-center mb-8">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Enterprise-Grade Autonomous Capabilities
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Built with full-stack TypeScript, TypeORM, PostgreSQL, Google Cloud, and Telegram APIs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Feature 1: Chat & Slot Filling */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-2.5">
              <div className="w-8 h-8 rounded bg-slate-100 text-slate-800 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Natural-Language Chat & Slot Filling
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Interact with your assistant in natural language. If a meeting or task detail is missing
                (such as required attendee emails or due dates), Gemini asks slot-filling questions
                across conversational turns until complete.
              </p>
            </div>

            {/* Feature 2: Calendar & Google Meet */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-2.5">
              <div className="w-8 h-8 rounded bg-slate-100 text-slate-800 flex items-center justify-center">
                <Video className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Google Calendar Sync & Meet Video Rooms
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Schedule meetings with mandatory attendee validation. Automatically provisions unique
                Google Meet URLs, links attendee invites, and schedules a 10-minute preparation alert.
              </p>
            </div>

            {/* Feature 3: Telegram Reminders & Briefings */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-2.5">
              <div className="w-8 h-8 rounded bg-slate-100 text-slate-800 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Telegram Dispatch & Daily Morning Briefings
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dispatches time-critical reminders directly to your Telegram chat. At your configured
                briefing time, compiles pending tasks, scheduled meetings, and reminders into a clean summary.
              </p>
            </div>

            {/* Feature 4: Safe Confirmation Guardrails */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-2.5">
              <div className="w-8 h-8 rounded bg-slate-100 text-slate-800 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Dual-Phase Human Confirmation Guardrails
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Protective safety architecture: mutating operations are proposed first as PendingActions
                and execute only when you confirm via interactive button or natural language reply.
              </p>
            </div>
          </div>
        </section>

        {/* Live Architecture Summary */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-slate-100/80 border border-slate-200 rounded-lg p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3">
              System Architecture & Connected Services
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-white p-3 rounded border border-slate-200">
                <div className="text-xs font-bold text-slate-800">Gemini 3.5</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Intent Reasoning</div>
              </div>
              <div className="bg-white p-3 rounded border border-slate-200">
                <div className="text-xs font-bold text-slate-800">Google Meet</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Calendar API</div>
              </div>
              <div className="bg-white p-3 rounded border border-slate-200">
                <div className="text-xs font-bold text-slate-800">Telegram Bot</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Push Delivery</div>
              </div>
              <div className="bg-white p-3 rounded border border-slate-200">
                <div className="text-xs font-bold text-slate-800">PostgreSQL</div>
                <div className="text-[11px] text-slate-500 mt-0.5">ACID State Store</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            © 2026 AssistFlow AI. Autonomous executive assistant project for Ermias Teklemarkos.
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsComingSoonOpen(true)}
              className="hover:text-slate-900 transition-colors"
            >
              Account Registration Setup
            </button>
            <button
              onClick={() => setIsSignInOpen(true)}
              className="hover:text-slate-900 font-medium transition-colors"
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
