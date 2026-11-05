import React from "react";
import { Button } from "./ui/Button";
import { X, Sparkles, Calendar, Key, MessageSquare, Workflow } from "lucide-react";

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSignIn: () => void;
}

export const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
  isOpen,
  onClose,
  onOpenSignIn,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90dvh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#0B132B] shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                Self-Serve Registration Coming Soon
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-Integration Onboarding Architecture
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body - scrollable on mobile */}
        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4 text-xs text-slate-600 dark:text-slate-400 overflow-y-auto flex-1">
          <p className="leading-relaxed text-slate-700 dark:text-slate-300">
            AssistFlow AI is a high-privilege executive autonomous agent deeply wired into third-party cloud infrastructure. Self-serve account creation is currently under active development because provisioning each new account requires configuring four essential stages:
          </p>

          <div className="space-y-2.5 sm:space-y-3 pt-1">
            {/* Google Cloud */}
            <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-[#080E1E] border border-slate-200 dark:border-slate-800 rounded-lg flex items-start space-x-2.5 sm:space-x-3">
              <div className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white text-xs">
                  1. Google Cloud Console & OAuth 2.0 Client
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                  Requires custom OAuth Client ID, Client Secret, and Google Calendar / Google Meet API scopes for agenda synchronization and video room provisioning.
                </div>
              </div>
            </div>

            {/* Gemini Token */}
            <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-[#080E1E] border border-slate-200 dark:border-slate-800 rounded-lg flex items-start space-x-2.5 sm:space-x-3">
              <div className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                <Key className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white text-xs">
                  2. Google Gemini API Quota & Token
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                  Requires a Gemini 3.5 API key to handle conversational slot-filling, intent extraction, and draft proposal management.
                </div>
              </div>
            </div>

            {/* Telegram Bot */}
            <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-[#080E1E] border border-slate-200 dark:border-slate-800 rounded-lg flex items-start space-x-2.5 sm:space-x-3">
              <div className="w-6 h-6 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white text-xs">
                  3. Telegram Bot Token & Numeric Chat ID
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                  Requires creating a dedicated bot via @BotFather and linking your personal Telegram numeric Chat ID for real-time notification alerts.
                </div>
              </div>
            </div>

            {/* n8n Automation Engine */}
            <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-[#080E1E] border border-slate-200 dark:border-slate-800 rounded-lg flex items-start space-x-2.5 sm:space-x-3">
              <div className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <Workflow className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white text-xs">
                  4. Scheduled Workflow Engine (n8n Webhook)
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                  Requires cron trigger webhooks configured to dispatch your morning executive briefings on schedule.
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded text-[11px] text-amber-900 dark:text-amber-200">
            <strong>Current Access:</strong> The platform is fully operational for the pre-configured default administrator account. A guided self-serve setup wizard with automated OAuth consent will be released in an upcoming update!
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-50 dark:bg-[#0B132B] shrink-0">
          <button
            onClick={() => {
              onClose();
              onOpenSignIn();
            }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-medium text-center sm:text-left py-1"
          >
            Sign in as Administrator →
          </button>
          <Button size="sm" onClick={onClose} className="w-full sm:w-auto">
            Got It
          </Button>
        </div>
      </div>
    </div>
  );
};
