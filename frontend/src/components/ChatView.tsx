import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { PendingActionCard } from "./PendingActionCard";

export const ChatView: React.FC = () => {
  const { messages, chatLoading, sendChatMessage, fetchSession } = useStore();
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || chatLoading) return;
    const msg = inputText.trim();
    setInputText("");
    await sendChatMessage(msg);
  };

  const samplePrompts = [
    "Remind me to call accountant tomorrow at 3pm",
    "Create high priority task: Submit Q4 budget report",
    "Show my pending tasks",
    "Schedule meeting with team tomorrow from 2pm to 3pm with colleague@example.com",
    "What does my day look like?",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto">
      {/* Pending Actions Alert Card */}
      <PendingActionCard />

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800/80 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-700 dark:text-slate-200">
              <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
              AssistFlow AI Executive Assistant
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
              Ask me to manage your tasks, set reminders, schedule meetings with Google Meet links, or deliver your morning daily briefing.
            </p>

            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {samplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputText(prompt);
                  }}
                  className="text-xs bg-white dark:bg-[#0F172A] hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-full px-3 py-1.5 transition-colors flex items-center text-left"
                >
                  <Sparkles className="w-3 h-3 mr-1.5 text-blue-500 dark:text-blue-400" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={index}
                className={`flex items-start space-x-2.5 ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`rounded-lg px-3.5 py-2.5 max-w-[85%] text-xs leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5 border border-slate-300/50 dark:border-slate-700">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {chatLoading && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span>AssistFlow is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Form */}
      <form onSubmit={handleSend} className="pt-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080E1E] transition-colors">
        <div className="flex items-center space-x-2 bg-white dark:bg-[#0B132B] rounded-lg border border-slate-300 dark:border-slate-700 p-1.5 shadow-sm focus-within:ring-1 focus-within:ring-blue-500">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type instructions (e.g. 'Remind me tomorrow at 9am to submit taxes')..."
            className="border-0 shadow-none focus-visible:ring-0 text-xs px-2 dark:bg-transparent"
            disabled={chatLoading}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!inputText.trim() || chatLoading}
            className="shrink-0"
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            Send
          </Button>
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 px-1 pt-1.5">
          <span>Mutations always prompt for confirmation before execution</span>
          <span>Press Enter to send</span>
        </div>
      </form>
    </div>
  );
};
