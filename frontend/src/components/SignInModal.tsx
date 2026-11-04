import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { X, Lock, Mail, Loader2, AlertCircle, KeyRound } from "lucide-react";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_EMAIL =
  import.meta.env.VITE_DEFAULT_USER_EMAIL || "ermiasteklemarkos@gmail.com";

export const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose }) => {
  const { login, authLoading } = useStore();
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState("password123");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const success = await login(email, password);
    if (success) {
      onClose();
    } else {
      setErrorMessage(
        email.trim().toLowerCase() !== DEFAULT_EMAIL.toLowerCase()
          ? `Access restricted: Only default user (${DEFAULT_EMAIL}) can sign in currently. Self-serve registration is coming soon.`
          : "Invalid email or password. Please verify your credentials."
      );
    }
  };

  const handleFillDefault = () => {
    setEmail(DEFAULT_EMAIL);
    setPassword("password123");
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
      <div className="bg-white border border-slate-300 rounded-lg shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Sign In to AssistFlow AI</h3>
              <p className="text-xs text-slate-500">Executive Autonomous Assistant Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
              <span>Account Email</span>
              <span className="text-[11px] text-slate-400 font-normal">Default: {DEFAULT_EMAIL}</span>
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={DEFAULT_EMAIL}
                className="pl-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
              <span>Password</span>
              <span className="text-[11px] text-slate-400 font-normal">Default: password123</span>
            </label>
            <div className="relative">
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="pl-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Quick-fill helper banner */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 flex items-center justify-between">
            <div className="text-[11px]">
              <span className="font-semibold text-slate-700">Single-User Mode:</span> configured for Ermias Teklemarkos
            </div>
            <button
              type="button"
              onClick={handleFillDefault}
              className="text-[11px] font-medium text-slate-900 underline hover:text-slate-700 ml-2"
            >
              Fill Default
            </button>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={authLoading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={authLoading}>
              {authLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
