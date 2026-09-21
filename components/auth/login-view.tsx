"use client";

import React, { useState } from "react";
import { AuthUser } from "@/types/auth";
import { authenticateUser, setStoredAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Lock, User, ShieldCheck, ArrowRight, AlertCircle, KeyRound } from "lucide-react";

interface LoginViewProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const user = authenticateUser(username, password);
      if (user) {
        setStoredAuth(user);
        onLoginSuccess(user);
      } else {
        setError("Invalid username or password. Please check your credentials.");
      }
      setLoading(false);
    }, 250);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50/60 via-background to-teal-50/40 dark:from-background dark:to-background">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="rounded-2xl border border-border/80 bg-card p-7 sm:p-8 shadow-xl shadow-emerald-950/5 space-y-6">
          {/* Logo & Brand Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white shadow-md border border-border/60">
              <img
                src="/coro_logo.png"
                alt="Coromandel CPC Logo"
                className="h-14 w-auto object-contain"
              />
            </div>

            <div>
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
                <span>Coromandel International</span>
                <span>•</span>
                <span>CPC Division</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight mt-1">
                Analytics & Distribution Portal
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your authorized credentials to access purchase & retail analytics
              </p>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Username</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Password</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 gap-2 mt-2"
            >
              <span>{loading ? "Authenticating..." : "Sign In to Dashboard"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Quick Client Access Shortcut */}
          <div className="pt-2 border-t border-border/60 text-center space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground flex items-center justify-center gap-1">
              <KeyRound className="w-3 h-3" />
              <span>Quick Access:</span>
            </p>
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setUsername("namsute-cpc");
                  setPassword("n@muste-cpc");
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-colors shadow-sm"
              >
                Client (namsute-cpc)
              </button>
            </div>
          </div>

          {/* Bottom Security Note */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/80">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted Session • Crop Protection Chemicals Agri-Network</span>
          </div>
        </div>
      </div>
    </div>
  );
}
