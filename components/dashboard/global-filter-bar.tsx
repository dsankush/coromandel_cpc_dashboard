"use client";

import React, { useMemo } from "react";
import {
  Calendar,
  MapPin,
  Sprout,
  CheckCircle2,
  X,
  RotateCcw,
  SlidersHorizontal,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface GlobalFilterState {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  state: string;     // "ALL" or state name
  district: string;  // "ALL" or district name
  crop: string;      // "ALL" or crop name
  status: string;    // "ALL" | "Approved" | "Pending" | "Rejected"
}

interface GlobalFilterBarProps {
  filterState: GlobalFilterState;
  onChange: (patch: Partial<GlobalFilterState>) => void;
  onReset: () => void;
  availableStates: string[];
  availableDistricts: string[];
  availableCrops: string[];
  totalOrdersCount: number;
  filteredOrdersCount: number;
  activeTab?: string;
}

export function GlobalFilterBar({
  filterState,
  onChange,
  onReset,
  availableStates,
  availableDistricts,
  availableCrops,
  totalOrdersCount,
  filteredOrdersCount,
  activeTab = "overview",
}: GlobalFilterBarProps) {
  // Check how many filters are actively applied
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterState.startDate || filterState.endDate) count++;
    if (filterState.state !== "ALL") count++;
    if (filterState.district !== "ALL") count++;
    if (filterState.crop !== "ALL") count++;
    if (filterState.status !== "ALL") count++;
    return count;
  }, [filterState]);

  // Handle Quick Date Presets
  const handleQuickDatePreset = (preset: "ALL" | "7D" | "14D") => {
    if (preset === "ALL") {
      onChange({ startDate: "", endDate: "" });
      return;
    }
    // Anchor to latest dataset date: 2026-09-21
    const end = new Date("2026-09-21T23:59:59");
    const start = new Date(end);
    if (preset === "7D") {
      start.setDate(start.getDate() - 7);
    } else if (preset === "14D") {
      start.setDate(start.getDate() - 14);
    }
    onChange({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    });
  };

  const pct =
    totalOrdersCount > 0
      ? Math.round((filteredOrdersCount / totalOrdersCount) * 100)
      : 100;

  return (
    <div className="rounded-xl border border-border/80 bg-card/80 p-3.5 sm:p-4 backdrop-blur-md shadow-sm mb-6 space-y-3 transition-all">
      {/* Top Header Row of Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs sm:text-sm font-bold text-foreground">
              Analytics Filters
            </span>
            <span className="hidden sm:inline-block ml-2 text-[11px] text-muted-foreground">
              (Applied across {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} & all tabs)
            </span>
          </div>
          {activeFiltersCount > 0 && (
            <Badge variant="coromandel" className="text-[10px] py-0 px-2 h-5">
              {activeFiltersCount} Active {activeFiltersCount === 1 ? "Filter" : "Filters"}
            </Badge>
          )}
        </div>

        {/* Results Counter & Reset Button */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="text-muted-foreground text-[11px] sm:text-xs">
            Showing{" "}
            <strong className="text-foreground font-bold">
              {filteredOrdersCount.toLocaleString()}
            </strong>{" "}
            of {totalOrdersCount.toLocaleString()} orders{" "}
            <span className="text-emerald-500 font-semibold">({pct}%)</span>
          </div>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-7 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1 font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Filter Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        {/* Filter 1: Date Range */}
        <div className="space-y-1.5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3 text-primary" />
              <span>Date Range</span>
            </label>
            <div className="flex items-center gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => handleQuickDatePreset("ALL")}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  !filterState.startDate && !filterState.endDate
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => handleQuickDatePreset("7D")}
                className="px-1.5 py-0.5 rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                7D
              </button>
              <button
                type="button"
                onClick={() => handleQuickDatePreset("14D")}
                className="px-1.5 py-0.5 rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                14D
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="date"
              aria-label="Start date"
              value={filterState.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className="w-full rounded-md border border-input bg-background/90 px-2 py-1.5 text-[11px] text-foreground focus:ring-1 focus:ring-primary shadow-sm"
              title="Start Date (From)"
            />
            <input
              type="date"
              aria-label="End date"
              value={filterState.endDate}
              onChange={(e) => onChange({ endDate: e.target.value })}
              className="w-full rounded-md border border-input bg-background/90 px-2 py-1.5 text-[11px] text-foreground focus:ring-1 focus:ring-primary shadow-sm"
              title="End Date (To)"
            />
          </div>
        </div>

        {/* Filter 2: State */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-500" />
            <span>State</span>
          </label>
          <select
            value={filterState.state}
            onChange={(e) =>
              onChange({
                state: e.target.value,
                // Reset district if state changes
                district: "ALL",
              })
            }
            className="w-full rounded-md border border-input bg-background/90 px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="ALL">All States ({availableStates.length})</option>
            {availableStates.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Filter 3: District */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3 text-teal-500" />
            <span>District</span>
          </label>
          <select
            value={filterState.district}
            onChange={(e) => onChange({ district: e.target.value })}
            className="w-full rounded-md border border-input bg-background/90 px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="ALL">
              All Districts {filterState.state !== "ALL" ? `(${filterState.state})` : `(${availableDistricts.length})`}
            </option>
            {availableDistricts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Filter 4: Crop */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Sprout className="w-3 h-3 text-lime-500" />
            <span>Crop</span>
          </label>
          <select
            value={filterState.crop}
            onChange={(e) => onChange({ crop: e.target.value })}
            className="w-full rounded-md border border-input bg-background/90 px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="ALL">All Crops ({availableCrops.length})</option>
            {availableCrops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Filter 5: Approval Status */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Approval Status</span>
          </label>
          <select
            value={filterState.status}
            onChange={(e) => onChange({ status: e.target.value })}
            className="w-full rounded-md border border-input bg-background/90 px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="Approved">Approved Only</option>
            <option value="Pending">Pending Only</option>
            <option value="Rejected">Rejected Only</option>
          </select>
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-[11px]">
          <span className="text-muted-foreground text-[10px] uppercase font-semibold tracking-wider">
            Active:
          </span>

          {(filterState.startDate || filterState.endDate) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              <Calendar className="w-2.5 h-2.5" />
              <span>
                {filterState.startDate || "Start"} → {filterState.endDate || "Latest"}
              </span>
              <button
                type="button"
                onClick={() => onChange({ startDate: "", endDate: "" })}
                className="hover:text-foreground"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          {filterState.state !== "ALL" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
              <MapPin className="w-2.5 h-2.5" />
              <span>State: {filterState.state}</span>
              <button
                type="button"
                onClick={() => onChange({ state: "ALL", district: "ALL" })}
                className="hover:text-foreground"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          {filterState.district !== "ALL" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-medium">
              <MapPin className="w-2.5 h-2.5" />
              <span>District: {filterState.district}</span>
              <button
                type="button"
                onClick={() => onChange({ district: "ALL" })}
                className="hover:text-foreground"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          {filterState.crop !== "ALL" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-600 dark:text-lime-400 border border-lime-500/20 font-medium">
              <Sprout className="w-2.5 h-2.5" />
              <span>Crop: {filterState.crop}</span>
              <button
                type="button"
                onClick={() => onChange({ crop: "ALL" })}
                className="hover:text-foreground"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          {filterState.status !== "ALL" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>Status: {filterState.status}</span>
              <button
                type="button"
                onClick={() => onChange({ status: "ALL" })}
                className="hover:text-foreground"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
