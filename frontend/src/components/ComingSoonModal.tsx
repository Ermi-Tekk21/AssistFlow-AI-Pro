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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
      <div className="bg-white border border-slate-300 rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Self-Serve Registration Coming Soon
              </h3>
              <p className="text-xs text-slate-500">
                Multi-Integration Onboarding Architecture
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs text-slate-600">
          <p className="leading-relaxed text-slate-700">
            AssistFlow AI is a high-privilege executive autonomous agent deeply wired into third-party cloud infrastructure. Self-serve account creation is currently under active development because provisioning each new account requires configuring four essential stages:
          </p>

          <div className="space-y-3 pt-1">
            {/* Google Cloud */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-3">
              <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900 text-xs">
                  1. Google Cloud Console & OAuth 2.0 Client
                </div>
                <div className="text-[11px] text-slate-600 leading-normal">
                  Requires custom OAuth Client ID, Client Secret, and Google Calendar / Google Meet API scopes for agenda synchronization and video room provisioning.
                </div>
              </div>
            </div>

            {/* Gemini Token */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-3">
              <div className="w-6 h-6 rounded bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                <Key className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900 text-xs">
                  2. Google Gemini API Quota & Token
                </div>
                <div className="text-[11px] text-slate-600 leading-normal">
                  Requires a Gemini 3.5 API key to handle conversational slot-filling, intent extraction, and draft proposal management.
                </div>
              </div>
            </div>

            {/* Telegram Bot */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-3">
              <div className="w-6 h-6 rounded bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900 text-xs">
                  3. Telegram Bot Token & Numeric Chat ID
                </div>
                <div className="text-[11px] text-slate-600 leading-normal">
                  Requires creating a dedicated bot via @BotFather and linking your personal Telegram numeric Chat ID for real-time notification alerts.
                </div>
              </div>
            </div>

            {/* n8n Automation Engine */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-3">
              <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <Workflow className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900 text-xs">
                  4. Scheduled Workflow Engine (n8n Webhook)
                </div>
                <div className="text-[11px] text-slate-600 leading-normal">
                  Requires cron trigger webhooks configured to dispatch your morning executive briefings on schedule.
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded text-[11px] text-amber-900">
            <strong>Current Access:</strong> The platform is fully operational for the pre-configured default administrator account. A guided self-serve setup wizard with automated OAuth consent will be released in an upcoming update!
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            onClick={() => {
              onClose();
              onOpenSignIn();
            }}
            className="text-xs text-slate-700 hover:text-slate-900 underline font-medium"
          >
            Sign in as Default User →
          </button>
          <Button size="sm" onClick={onClose}>
            Got It
          </Button>
        </div>
      </div>
    </div>
  );
};
