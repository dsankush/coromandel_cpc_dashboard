"use client";

import React from "react";
import { RefreshCw, Moon, Sun, Download, LogOut, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthUser } from "@/types/auth";

interface HeaderProps {
  totalRecords: number;
  lastUpdated: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  authUser: AuthUser | null;
  onLogout: () => void;
  onDownloadFullReport: () => void;
}

export function DashboardHeader({
  totalRecords,
  lastUpdated,
  isRefreshing,
  onRefresh,
  isDarkMode,
  onToggleTheme,
  activeTab,
  onTabChange,
  authUser,
  onLogout,
  onDownloadFullReport,
}: HeaderProps) {
  const tabs: { id: string; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "orders", label: "Orders" },
    { id: "products", label: "Products" },
    { id: "retailers", label: "Retailers" },
    { id: "farmers", label: "Farmers" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-card/90 backdrop-blur-md">
      {/* Top Banner with Brand Identity */}
      <div className="border-b border-border/50 bg-emerald-950/40 px-4 py-1.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold tracking-wide uppercase">Coromandel</span>
            <span className="text-emerald-500/70">|</span>
            <span className="text-emerald-200">Crop Protection Chemicals (CPC) Division</span>
          </div>

          {authUser && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-emerald-300/80">Logged in as:</span>
              <span className="font-bold text-emerald-100">{authUser.username}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  authUser.role === "admin"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                    : "bg-sky-500/20 text-sky-300 border border-sky-400/30"
                }`}
              >
                {authUser.role.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 sm:px-6 gap-3">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1 border border-border/70 shadow-sm">
            <img
              src="/coro_logo.png"
              alt="Coromandel CPC Logo"
              className="h-9 w-auto object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Purchase & Retail Distribution Analytics
              </h1>
              <Badge variant="coromandel" className="hidden sm:inline-flex text-[10px] py-0 px-2">
                Live Server Feed
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Farmer purchases, retailer approvals, and distribution integrity monitor
            </p>
          </div>
        </div>

        {/* Action Buttons: Full Report Download, Sync, Theme, Logout */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
          {/* Top Level Download Full Report Button */}
          <Button
            variant="default"
            size="sm"
            onClick={onDownloadFullReport}
            className="h-8 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
            title="Download full report of all orders (zero UUID columns)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Full Report</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs font-medium"
            title="Re-reads /data/orders.csv dynamically from disk"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-500" : ""}`} />
            <span>Sync CSV</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={onToggleTheme}
            className="h-8 w-8 text-foreground"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </Button>

          {authUser && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="h-8 gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-border/80"
              title="Sign out of dashboard"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          )}
        </div>
      </div>

      {/* Section Tabs */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 overflow-x-auto">
        <div className="flex space-x-1 border-b border-border/40 py-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-rose-500 text-white"
                        : "bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
