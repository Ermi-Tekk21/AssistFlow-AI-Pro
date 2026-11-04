import React from "react";
import { useStore } from "../store/useStore";
import { NavTab } from "../types";
import {
  MessageSquare,
  CheckSquare,
  Bell,
  Calendar,
  Sun,
  User as UserIcon,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { Badge } from "./ui/Badge";

export const Header: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    pendingActions,
    user,
    logout,
  } = useStore();

  const tabs: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: "chat", label: "Assistant Chat", icon: <MessageSquare className="w-4 h-4 mr-2" /> },
    { id: "tasks", label: "Tasks", icon: <CheckSquare className="w-4 h-4 mr-2" /> },
    { id: "reminders", label: "Reminders", icon: <Bell className="w-4 h-4 mr-2" /> },
    { id: "calendar", label: "Calendar", icon: <Calendar className="w-4 h-4 mr-2" /> },
    { id: "briefing", label: "Daily Briefing", icon: <Sun className="w-4 h-4 mr-2" /> },
    { id: "profile", label: "Profile", icon: <UserIcon className="w-4 h-4 mr-2" /> },
  ];

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : "Ermias Teklemarkos";

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

          {/* Right Controls: Pending Approvals, User Profile Pill & Sign Out */}
          <div className="flex items-center space-x-2">
            {pendingActions.length > 0 && (
              <Badge variant="warning" className="cursor-pointer" onClick={() => setActiveTab("chat")}>
                <AlertCircle className="w-3 h-3 mr-1" />
                {pendingActions.length} Pending Approval
              </Badge>
            )}

            {/* User Profile Pill */}
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-xs transition-colors border ${
                activeTab === "profile"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
              }`}
              title="View and edit profile settings"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                  activeTab === "profile"
                    ? "bg-white text-slate-900"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {displayName.charAt(0)}
              </div>
              <span className="font-medium hidden sm:inline">{displayName}</span>
            </button>

            {/* Quick Sign Out Button */}
            <button
              onClick={logout}
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
