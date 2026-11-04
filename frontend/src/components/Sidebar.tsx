import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { NavTab } from "../types";
import {
  Sun,
  MessageSquare,
  CheckSquare,
  Bell,
  Calendar,
  User as UserIcon,
  AlertCircle,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Badge } from "./ui/Badge";

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    pendingActions,
    user,
    logout,
  } = useStore();

  const [mobileOpen, setMobileOpen] = useState(false);

  // Daily Briefing is FIRST, other tabs maintain their exact relative order
  const tabs: Array<{ id: NavTab; label: string; icon: React.ReactNode; badgeCount?: number }> = [
    {
      id: "briefing",
      label: "Daily Briefing",
      icon: <Sun className="w-4 h-4 shrink-0" />,
    },
    {
      id: "chat",
      label: "Assistant Chat",
      icon: <MessageSquare className="w-4 h-4 shrink-0" />,
      badgeCount: pendingActions.length > 0 ? pendingActions.length : undefined,
    },
    {
      id: "tasks",
      label: "Tasks",
      icon: <CheckSquare className="w-4 h-4 shrink-0" />,
    },
    {
      id: "reminders",
      label: "Reminders",
      icon: <Bell className="w-4 h-4 shrink-0" />,
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: <Calendar className="w-4 h-4 shrink-0" />,
    },
    {
      id: "profile",
      label: "Profile",
      icon: <UserIcon className="w-4 h-4 shrink-0" />,
    },
  ];

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : "Ermias Teklemarkos";

  const handleSelectTab = (tabId: NavTab) => {
    setActiveTab(tabId);
    setMobileOpen(false);
  };

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* Mobile Top Bar (< md)                                         */}
      {/* ------------------------------------------------------------- */}
      <div className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-sm">
            AF
          </div>
          <span className="text-sm font-semibold text-slate-900 tracking-tight">
            AssistFlow AI
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {pendingActions.length > 0 && (
            <Badge
              variant="warning"
              className="cursor-pointer text-[11px] py-0.5"
              onClick={() => handleSelectTab("chat")}
            >
              <AlertCircle className="w-3 h-3 mr-1" />
              {pendingActions.length} Pending
            </Badge>
          )}

          <button
            onClick={() => handleSelectTab("profile")}
            className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700"
            title="Profile"
          >
            {displayName.charAt(0)}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Mobile Drawer Backdrop Overlay                                */}
      {/* ------------------------------------------------------------- */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 animate-in fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* Sidebar Navigation (Desktop Fixed + Mobile Slide-out Drawer)   */}
      {/* ------------------------------------------------------------- */}
      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-30 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        } h-screen shrink-0`}
      >
        {/* Top: Logo & Brand */}
        <div>
          <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                AF
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                    AssistFlow AI
                  </h1>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Pro
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Executive Dashboard
                </p>
              </div>
            </div>

            {/* Mobile close button inside drawer */}
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Pending Approval Callout in Sidebar */}
          {pendingActions.length > 0 && (
            <div className="p-3 mx-3 mt-3 bg-amber-50 border border-amber-200/80 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-900">
                    {pendingActions.length} Pending Approval{pendingActions.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Awaiting confirmation in Chat.
                  </p>
                  <button
                    onClick={() => handleSelectTab("chat")}
                    className="mt-1.5 text-[11px] font-semibold text-amber-900 underline hover:text-amber-950"
                  >
                    Review in Chat →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <div className="px-3 py-4 space-y-1">
            <p className="px-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">
              Navigation
            </p>

            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`transition-colors ${
                        isActive
                          ? "text-white"
                          : "text-slate-400 group-hover:text-slate-600"
                      }`}
                    >
                      {tab.icon}
                    </span>
                    <span className="tracking-tight">{tab.label}</span>
                  </div>

                  {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? "bg-amber-400 text-slate-950"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {tab.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom: User Card & Sign Out */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs">
            <button
              onClick={() => handleSelectTab("profile")}
              className="flex items-center space-x-2.5 text-left min-w-0 flex-1 hover:opacity-80 transition-opacity"
              title="Edit Profile Settings"
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {displayName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {user?.email || "ermiasteklemarkos@gmail.com"}
                </p>
              </div>
            </button>

            <button
              onClick={logout}
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 ml-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
