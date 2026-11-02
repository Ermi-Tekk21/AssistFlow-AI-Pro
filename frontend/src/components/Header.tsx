import React, { useState } from "react";
import { useStore, NavTab } from "../store/useStore";
import {
  MessageSquare,
  CheckSquare,
  Bell,
  Calendar,
  Sun,
  User as UserIcon,
  AlertCircle,
} from "lucide-react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

export const Header: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    pendingActions,
    userId,
    setUserId,
  } = useStore();

  const [isEditingUser, setIsEditingUser] = useState(false);
  const [newUserId, setNewUserId] = useState(userId);

  const tabs: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: "chat", label: "Assistant Chat", icon: <MessageSquare className="w-4 h-4 mr-2" /> },
    { id: "tasks", label: "Tasks", icon: <CheckSquare className="w-4 h-4 mr-2" /> },
    { id: "reminders", label: "Reminders", icon: <Bell className="w-4 h-4 mr-2" /> },
    { id: "calendar", label: "Calendar", icon: <Calendar className="w-4 h-4 mr-2" /> },
    { id: "briefing", label: "Daily Briefing", icon: <Sun className="w-4 h-4 mr-2" /> },
  ];

  const handleSaveUser = () => {
    if (newUserId.trim()) {
      setUserId(newUserId.trim());
      setIsEditingUser(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
              AF
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                AssistFlow AI
              </h1>
              <p className="text-[11px] text-slate-500 font-mono hidden sm:block">
                Executive Assistant Dashboard
              </p>
            </div>
          </div>

          {/* User ID Context Indicator */}
          <div className="flex items-center space-x-2">
            {isEditingUser ? (
              <div className="flex items-center space-x-2">
                <Input
                  className="w-64 h-8 text-xs font-mono"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="Paste User UUID"
                />
                <Button size="sm" onClick={handleSaveUser}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingUser(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingUser(true)}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-mono text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                title="Click to change active User UUID"
              >
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate max-w-[120px] sm:max-w-[200px]">{userId}</span>
              </button>
            )}

            {pendingActions.length > 0 && (
              <Badge variant="warning" className="cursor-pointer" onClick={() => setActiveTab("chat")}>
                <AlertCircle className="w-3 h-3 mr-1" />
                {pendingActions.length} Pending Approval
              </Badge>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto border-t border-slate-100 py-1.5 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-3.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
