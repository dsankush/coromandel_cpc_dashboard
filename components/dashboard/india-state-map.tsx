"use client";

import React, { useState, useMemo } from "react";
import { StateLevelMetric } from "@/lib/data";
import { REAL_INDIA_MAP_PATHS, RealStatePath } from "@/lib/india-map-paths";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Store,
  Package,
  Layers,
  Sparkles,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface IndiaStateMapProps {
  stateMetrics: StateLevelMetric[];
}

// Clean helper to normalize state names for matching
function normalizeStateKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function IndiaStateMap({ stateMetrics }: IndiaStateMapProps) {
  const [selectedStateName, setSelectedStateName] = useState<string>("Maharashtra");
  const [statusViewMode, setStatusViewMode] = useState<"ALL" | "APPROVED" | "PENDING" | "REJECTED">(
    "ALL"
  );
  const [hoveredState, setHoveredState] = useState<RealStatePath | null>(null);

  // Map of normalized state name to metrics
  const metricsMap = useMemo(() => {
    const map = new Map<string, StateLevelMetric>();
    for (const m of stateMetrics) {
      map.set(normalizeStateKey(m.state), m);
    }
    return map;
  }, [stateMetrics]);

  // Find metric for currently selected state
  const activeStateMetric = useMemo(() => {
    const target = hoveredState?.name || selectedStateName;
    const key = normalizeStateKey(target);
    return (
      metricsMap.get(key) || {
        state: target,
        totalOrders: 0,
        approvedOrders: 0,
        pendingOrders: 0,
        rejectedOrders: 0,
        approvedPercentage: 0,
        pendingPercentage: 0,
        rejectedPercentage: 0,
        totalUnitsSold: 0,
        uniqueFarmers: 0,
        uniqueRetailers: 0,
      }
    );
  }, [hoveredState, selectedStateName, metricsMap]);

  // Maximum total orders in any state for choropleth scale
  const maxOrders = useMemo(() => {
    let max = 1;
    for (const m of stateMetrics) {
      if (m.totalOrders > max) max = m.totalOrders;
    }
    return max;
  }, [stateMetrics]);

  // Color generator based on state performance and view mode
  const getStateFill = (geo: RealStatePath, isSelected: boolean) => {
    const key = normalizeStateKey(geo.name);
    const metric = metricsMap.get(key);

    if (!metric || metric.totalOrders === 0) {
      return isSelected ? "#334155" : "#1e293b";
    }

    const ratio = metric.totalOrders / maxOrders;

    if (statusViewMode === "APPROVED") {
      if (ratio > 0.6) return "#059669";
      if (ratio > 0.25) return "#10b981";
      return "#34d399";
    }

    if (statusViewMode === "PENDING") {
      if (metric.pendingOrders > 100) return "#d97706";
      if (metric.pendingOrders > 30) return "#f59e0b";
      return "#fbbf24";
    }

    if (statusViewMode === "REJECTED") {
      if (metric.rejectedOrders > 10) return "#dc2626";
      if (metric.rejectedOrders > 0) return "#f43f5e";
      return "#475569";
    }

    // Default "All Orders" Coromandel Emerald Theme
    if (metric.totalOrders > 500) return "#047857"; // High (Maharashtra, Punjab)
    if (metric.totalOrders > 200) return "#059669"; // Medium-High (Telangana, Haryana)
    if (metric.totalOrders > 40) return "#10b981";  // Medium (Andhra Pradesh)
    return "#34d399";                              // Active (Karnataka, UP, West Bengal)
  };

  return (
    <Card className="border-border/70 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-500" />
              Real India Geographic State Map & Verification Status
            </CardTitle>
            <CardDescription className="text-xs">
              Authentic boundary map of India showcasing state-level ongoing Approved, Pending, and
              Rejected orders
            </CardDescription>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-secondary/80 p-1 rounded-lg border border-border/50 text-xs font-medium self-start sm:self-auto">
            <button
              onClick={() => setStatusViewMode("ALL")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusViewMode === "ALL"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Orders
            </button>
            <button
              onClick={() => setStatusViewMode("APPROVED")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusViewMode === "APPROVED"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setStatusViewMode("PENDING")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusViewMode === "PENDING"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusViewMode("REJECTED")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusViewMode === "REJECTED"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rejected
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Authentic India Map SVG */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center relative">
            <div className="w-full max-w-[540px] aspect-[650/700] relative">
              <svg
                viewBox="0 0 650 700"
                className="w-full h-full drop-shadow-lg filter select-none"
              >
                <defs>
                  <filter id="realMapGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Base Indian States Geography */}
                {REAL_INDIA_MAP_PATHS.map((geo) => {
                  const key = normalizeStateKey(geo.name);
                  const metric = metricsMap.get(key);
                  const isSelected =
                    normalizeStateKey(hoveredState?.name || selectedStateName) === key;
                  const hasOrders = Boolean(metric && metric.totalOrders > 0);
                  const fillColor = getStateFill(geo, isSelected);

                  return (
                    <g key={geo.id} className="cursor-pointer transition-all duration-150">
                      <path
                        d={geo.d}
                        fill={fillColor}
                        stroke={isSelected ? "#ffffff" : hasOrders ? "#047857" : "#334155"}
                        strokeWidth={isSelected ? 2.5 : hasOrders ? 1.2 : 0.6}
                        opacity={hasOrders ? (isSelected ? 1 : 0.95) : 0.4}
                        filter={isSelected ? "url(#realMapGlow)" : undefined}
                        className="transition-all duration-150 hover:opacity-100 hover:brightness-110"
                        onMouseEnter={() => setHoveredState(geo)}
                        onMouseLeave={() => setHoveredState(null)}
                        onClick={() => setSelectedStateName(geo.name)}
                      />
                    </g>
                  );
                })}

                {/* Active State Labels & Pin Badges at Centroids */}
                {REAL_INDIA_MAP_PATHS.map((geo) => {
                  const key = normalizeStateKey(geo.name);
                  const metric = metricsMap.get(key);
                  if (!metric || metric.totalOrders === 0) return null;

                  const isSelected =
                    normalizeStateKey(hoveredState?.name || selectedStateName) === key;

                  // Label positions tuned for clarity
                  let lx = geo.labelX;
                  let ly = geo.labelY;

                  // Fine tune for dense northern cluster
                  if (geo.name === "Punjab") {
                    lx -= 10;
                    ly -= 5;
                  }
                  if (geo.name === "Haryana") {
                    lx += 8;
                    ly += 8;
                  }
                  if (geo.name === "Maharashtra") {
                    lx += 5;
                  }

                  return (
                    <g
                      key={`label-${geo.id}`}
                      pointerEvents="none"
                      className="transition-transform duration-150"
                    >
                      {/* Badge Background */}
                      <rect
                        x={lx - 32}
                        y={ly - 12}
                        width={64}
                        height={24}
                        rx={5}
                        fill={isSelected ? "#022c22" : "rgba(15, 23, 42, 0.85)"}
                        stroke={isSelected ? "#10b981" : "rgba(255, 255, 255, 0.2)"}
                        strokeWidth={isSelected ? 1.5 : 0.8}
                        className="drop-shadow-sm"
                      />
                      {/* State Name */}
                      <text
                        x={lx}
                        y={ly - 1}
                        textAnchor="middle"
                        fontSize="8.5px"
                        fontWeight="bold"
                        fill="#ffffff"
                      >
                        {geo.name.length > 11 ? geo.name.slice(0, 9) + "…" : geo.name}
                      </text>
                      {/* Order Count */}
                      <text
                        x={lx}
                        y={ly + 9}
                        textAnchor="middle"
                        fontSize="8px"
                        fontWeight="extrabold"
                        fill="#34d399"
                      >
                        {metric.totalOrders} ord
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Map Footer Legend */}
              <div className="mt-3 text-center text-[11px] text-muted-foreground flex flex-wrap items-center justify-center gap-4 border-t border-border/40 pt-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#047857]" />
                  <span>Maharashtra &amp; Punjab (&gt;500)</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#059669]" />
                  <span>Telangana &amp; Haryana (200-500)</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
                  <span>Andhra Pradesh (50+)</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
                  <span>Karnataka, UP, WB</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Selected State Live Forensic Inspector */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between border-b border-border/60 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-extrabold text-foreground">
                      {activeStateMetric.state}
                    </h3>
                    {activeStateMetric.totalOrders > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Active Network
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground">
                        No Recorded Orders
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time state order verification & fulfillment breakdown
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">
                    Total Orders
                  </span>
                  <p className="text-2xl font-black text-foreground">
                    {formatNumber(activeStateMetric.totalOrders)}
                  </p>
                </div>
              </div>

              {/* Tri-Color Status Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Verification Ratio:</span>
                  <span className="text-foreground">
                    {activeStateMetric.approvedPercentage}% Approved
                  </span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${activeStateMetric.approvedPercentage}%` }}
                    title={`Approved: ${activeStateMetric.approvedOrders}`}
                  />
                  <div
                    className="bg-amber-500 transition-all"
                    style={{ width: `${activeStateMetric.pendingPercentage}%` }}
                    title={`Pending: ${activeStateMetric.pendingOrders}`}
                  />
                  <div
                    className="bg-rose-500 transition-all"
                    style={{ width: `${activeStateMetric.rejectedPercentage}%` }}
                    title={`Rejected: ${activeStateMetric.rejectedOrders}`}
                  />
                </div>
              </div>

              {/* Status Breakdown Cards */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {/* Approved */}
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5">
                  <div className="flex items-center justify-center gap-1 text-emerald-500 text-[11px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approved</span>
                  </div>
                  <p className="text-lg font-extrabold text-foreground mt-1">
                    {formatNumber(activeStateMetric.approvedOrders)}
                  </p>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {activeStateMetric.approvedPercentage}%
                  </span>
                </div>

                {/* Pending */}
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
                  <div className="flex items-center justify-center gap-1 text-amber-500 text-[11px] font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Pending</span>
                  </div>
                  <p className="text-lg font-extrabold text-foreground mt-1">
                    {formatNumber(activeStateMetric.pendingOrders)}
                  </p>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    {activeStateMetric.pendingPercentage}%
                  </span>
                </div>

                {/* Rejected */}
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5">
                  <div className="flex items-center justify-center gap-1 text-rose-500 text-[11px] font-bold">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Rejected</span>
                  </div>
                  <p className="text-lg font-extrabold text-foreground mt-1">
                    {formatNumber(activeStateMetric.rejectedOrders)}
                  </p>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                    {activeStateMetric.rejectedPercentage}%
                  </span>
                </div>
              </div>

              {/* Network Footprint Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    <Users className="w-3 h-3 text-sky-400" /> Farmers
                  </span>
                  <strong className="text-sm font-bold text-foreground mt-0.5">
                    {formatNumber(activeStateMetric.uniqueFarmers)}
                  </strong>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    <Store className="w-3 h-3 text-indigo-400" /> Retailers
                  </span>
                  <strong className="text-sm font-bold text-foreground mt-0.5">
                    {formatNumber(activeStateMetric.uniqueRetailers)}
                  </strong>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    <Package className="w-3 h-3 text-primary" /> Units Sold
                  </span>
                  <strong className="text-sm font-bold text-foreground mt-0.5">
                    {formatNumber(activeStateMetric.totalUnitsSold)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Quick State Selection Tabs */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Coromandel Active States Directory
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                {stateMetrics.map((st) => (
                  <button
                    key={st.state}
                    onClick={() => setSelectedStateName(st.state)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      normalizeStateKey(selectedStateName) === normalizeStateKey(st.state)
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary/70 text-foreground hover:bg-secondary"
                    }`}
                  >
                    <span>{st.state}</span>
                    <span className="text-[10px] font-bold opacity-80">({st.totalOrders})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
