"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  PhoneCall,
  PhoneIncoming,
  Users,
  MapPin,
  Download,
  RefreshCw,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award,
  Hash,
  Activity,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MissedCallRecord,
  MissedCallKPIs,
  StateMissedCallMetric,
  PTMissedCallMetric,
  MissedCallReportPayload,
} from "@/types/missed-call";

export function MissedCallsView() {
  const [data, setData] = useState<MissedCallReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [selectedZone, setSelectedZone] = useState<string>("ALL");
  const [selectedPt, setSelectedPt] = useState<string>("ALL");

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Active sub-tab for analytics
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "states" | "pts" | "table">("overview");

  // Fetch missed call data
  const fetchData = async (forceRefresh = false) => {
    if (forceRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const url = `/api/missed-calls?limit=10000${forceRefresh ? "&refresh=true" : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      }
    } catch (err) {
      console.error("[MissedCallsView] Error loading data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Calls list
  const filteredCalls = useMemo(() => {
    if (!data?.calls) return [];

    return data.calls.filter((call) => {
      // State Filter
      if (selectedState !== "ALL" && call.state.toLowerCase() !== selectedState.toLowerCase()) {
        return false;
      }
      // Zone Filter
      if (selectedZone !== "ALL" && call.zone.toLowerCase() !== selectedZone.toLowerCase()) {
        return false;
      }
      // PT Filter (by Digitrack No or PT Name)
      if (
        selectedPt !== "ALL" &&
        call.digitrackNo !== selectedPt &&
        call.ptName.toLowerCase() !== selectedPt.toLowerCase()
      ) {
        return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesGrower = call.grower.toLowerCase().includes(q);
        const matchesDigitrack = call.digitrackNo.toLowerCase().includes(q);
        const matchesPt = call.ptName.toLowerCase().includes(q);
        const matchesHq = call.ptHeadquarter.toLowerCase().includes(q);
        const matchesDist = call.ptDistrict.toLowerCase().includes(q);
        const matchesMobile = call.ptMobile.toLowerCase().includes(q);
        if (!matchesGrower && !matchesDigitrack && !matchesPt && !matchesHq && !matchesDist && !matchesMobile) {
          return false;
        }
      }
      return true;
    });
  }, [data?.calls, selectedState, selectedZone, selectedPt, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedState, selectedZone, selectedPt, pageSize]);

  // Paginated calls
  const paginatedCalls = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCalls.slice(start, start + pageSize);
  }, [filteredCalls, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredCalls.length / pageSize) || 1;

  // Filter options
  const filterOptions = useMemo(() => {
    if (!data?.calls) return { states: [], zones: [], pts: [] };

    const states = new Set<string>();
    const zones = new Set<string>();
    const pts = new Map<string, string>(); // digitrackNo -> display name

    for (const c of data.calls) {
      if (c.state) states.add(c.state);
      if (c.zone) zones.add(c.zone);
      if (c.digitrackNo) {
        pts.set(c.digitrackNo, `${c.ptName} (${c.digitrackNo})`);
      }
    }

    return {
      states: Array.from(states).sort(),
      zones: Array.from(zones).sort(),
      pts: Array.from(pts.entries()).map(([digitrack, label]) => ({ digitrack, label })),
    };
  }, [data?.calls]);

  // Dynamic KPIs recalculation based on active filtered calls
  const dynamicKPIs: MissedCallKPIs = useMemo(() => {
    if (!data?.kpis) {
      return {
        totalCalls: 0,
        uniqueCalls: 0,
        repeatCalls: 0,
        repeatRate: 0,
        activeStatesCount: 0,
        activePTsCount: 0,
        activeZonesCount: 0,
      };
    }

    // If no filters are active, use the exact Google Sheet KPIs
    const isFiltered =
      selectedState !== "ALL" ||
      selectedZone !== "ALL" ||
      selectedPt !== "ALL" ||
      searchQuery.trim() !== "";

    if (!isFiltered) {
      return data.kpis;
    }

    const total = filteredCalls.length;
    const uniqueGrowers = new Set(filteredCalls.map((c) => c.grower).filter(Boolean)).size;
    const repeats = Math.max(0, total - uniqueGrowers);
    const rate = total > 0 ? Math.round((repeats / total) * 1000) / 10 : 0;
    const statesCount = new Set(filteredCalls.map((c) => c.state).filter(Boolean)).size;
    const ptsCount = new Set(filteredCalls.map((c) => c.digitrackNo).filter(Boolean)).size;
    const zonesCount = new Set(filteredCalls.map((c) => c.zone).filter(Boolean)).size;

    return {
      totalCalls: total,
      uniqueCalls: uniqueGrowers,
      repeatCalls: repeats,
      repeatRate: rate,
      activeStatesCount: statesCount,
      activePTsCount: ptsCount,
      activeZonesCount: zonesCount,
    };
  }, [data?.kpis, filteredCalls, selectedState, selectedZone, selectedPt, searchQuery]);

  // CSV Download Handler
  const handleDownloadCsv = () => {
    if (!filteredCalls || filteredCalls.length === 0) return;

    const headers = [
      "Record ID",
      "Digitrack Number",
      "Grower Mobile",
      "Date & Time",
      "Date Processed",
      "Action",
      "Division",
      "State",
      "Zone",
      "PT Name",
      "PT Headquarter",
      "PT District",
      "PT Mobile",
      "Designation",
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return "";
      const s = String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = filteredCalls.map((c) => [
      escapeCsv(c.id),
      escapeCsv(c.digitrackNo),
      escapeCsv(c.grower),
      escapeCsv(c.date),
      escapeCsv(c.dateProcessed),
      escapeCsv(c.action),
      escapeCsv(c.division),
      escapeCsv(c.state),
      escapeCsv(c.zone),
      escapeCsv(c.ptName),
      escapeCsv(c.ptHeadquarter),
      escapeCsv(c.ptDistrict),
      escapeCsv(c.ptMobile),
      escapeCsv(c.designation),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Coromandel_Missed_Call_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedState("ALL");
    setSelectedZone("ALL");
    setSelectedPt("ALL");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">
          Loading live Missed Call records from Google Sheets...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/80 rounded-xl p-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-emerald-600" />
              <span>Missed Call Field Intelligence Report</span>
            </h2>
            <Badge variant="coromandel" className="text-[10px] py-0 px-2">
              Live Google Sheets Feed
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Grower call velocity, unique caller penetration, and PT field response performance
          </p>
        </div>

        {/* Top Actions: Refresh Google Sheet & Download CSV */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs font-medium border-emerald-600/30 hover:border-emerald-500 hover:bg-emerald-500/10"
            title="Pulls fresh data directly from Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-500" : "text-emerald-600"}`} />
            <span>{isRefreshing ? "Syncing..." : "Sync Sheet"}</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={filteredCalls.length === 0}
            className="h-8 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
            title="Download missed calls as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Missed Call Report</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Missed Calls */}
        <Card className="border-border/70 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Missed Calls
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <PhoneIncoming className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight text-foreground">
              {dynamicKPIs.totalCalls.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="font-semibold text-emerald-600">100%</span>
              <span>total inbound call volume</span>
            </p>
          </CardContent>
        </Card>

        {/* Unique Missed Calls */}
        <Card className="border-border/70 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Unique Growers (Calls)
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight text-foreground">
              {dynamicKPIs.uniqueCalls.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="font-semibold text-blue-600">
                {dynamicKPIs.totalCalls > 0
                  ? Math.round((dynamicKPIs.uniqueCalls / dynamicKPIs.totalCalls) * 100)
                  : 0}
                %
              </span>
              <span>unique farmer reach</span>
            </p>
          </CardContent>
        </Card>

        {/* Repeat Calls & Rate */}
        <Card className="border-border/70 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Repeat Callers
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight text-foreground">
              {dynamicKPIs.repeatCalls.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="font-semibold text-amber-600">{dynamicKPIs.repeatRate}%</span>
              <span>repeat enquiry rate</span>
            </p>
          </CardContent>
        </Card>

        {/* Active PTs & States */}
        <Card className="border-border/70 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Field Force
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Award className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight text-foreground">
              {dynamicKPIs.activePTsCount}{" "}
              <span className="text-sm font-semibold text-muted-foreground">PTs</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span>Across</span>
              <span className="font-bold text-foreground">{dynamicKPIs.activeStatesCount} States</span>
              <span>&</span>
              <span className="font-bold text-foreground">{dynamicKPIs.activeZonesCount} Zones</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("overview")}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
            activeSubTab === "overview"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Analytics Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab("states")}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
            activeSubTab === "states"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>State-wise Comparison ({data?.stateMetrics.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("pts")}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
            activeSubTab === "pts"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>PT / Digitrack Leaderboard ({data?.ptMetrics.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("table")}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
            activeSubTab === "table"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Full Log Table ({filteredCalls.length.toLocaleString()})</span>
        </button>
      </div>

      {/* SubTab 1: Overview & State-wise Chart */}
      {(activeSubTab === "overview" || activeSubTab === "states") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* State Comparison Bar Chart */}
          <div className="lg:col-span-7">
            <Card className="border-border/70 h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>State-wise Call Volume: Total vs Unique</span>
                  </CardTitle>
                  <span className="text-[11px] text-muted-foreground">
                    Sorted by total call volume
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.stateMetrics || []}
                      margin={{ top: 10, right: 20, left: -10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis
                        dataKey="state"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(15, 23, 42, 0.95)",
                          borderRadius: "8px",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Bar
                        dataKey="totalCalls"
                        name="Total Missed Calls"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="uniqueCalls"
                        name="Unique Calls"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* State Breakdown Summary Table */}
          <div className="lg:col-span-5">
            <Card className="border-border/70 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>State Performance Breakdown</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {data?.stateMetrics.length || 0} active states
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/70 text-muted-foreground text-left">
                        <th className="py-2 font-semibold">State</th>
                        <th className="py-2 font-semibold text-right">Total</th>
                        <th className="py-2 font-semibold text-right">Unique</th>
                        <th className="py-2 font-semibold text-right">Repeat</th>
                        <th className="py-2 font-semibold text-right">PTs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {(data?.stateMetrics || []).map((s) => (
                        <tr
                          key={s.state}
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedState(s.state);
                            setActiveSubTab("table");
                          }}
                          title={`Click to filter table for ${s.state}`}
                        >
                          <td className="py-2.5 font-medium flex items-center gap-1.5 text-foreground">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>{s.state}</span>
                          </td>
                          <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {s.totalCalls.toLocaleString()}
                          </td>
                          <td className="py-2.5 text-right font-semibold text-blue-600 dark:text-blue-400">
                            {s.uniqueCalls.toLocaleString()}
                          </td>
                          <td className="py-2.5 text-right text-muted-foreground font-medium">
                            {s.repeatCalls.toLocaleString()}
                          </td>
                          <td className="py-2.5 text-right font-bold text-foreground">
                            {s.ptCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* SubTab 2: PT / Digitrack No Leaderboard */}
      {(activeSubTab === "overview" || activeSubTab === "pts") && (
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>PT / Field Officer Leaderboard (Ranked by Total Missed Calls)</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uniquely mapped by <strong>Digitrack Number</strong> across all divisions and headquarters
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-semibold self-start sm:self-center">
                {data?.ptMetrics.length || 0} Total PT Lines
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card z-10 border-b border-border/80 text-muted-foreground text-left">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Rank</th>
                    <th className="py-2.5 px-3 font-semibold">PT Name & Designation</th>
                    <th className="py-2.5 px-3 font-semibold">Digitrack No (Unique)</th>
                    <th className="py-2.5 px-3 font-semibold">Headquarter / District</th>
                    <th className="py-2.5 px-3 font-semibold">State / Zone</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total Calls</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Unique Calls</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Repeat Calls</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(data?.ptMetrics || []).slice(0, activeSubTab === "pts" ? 150 : 10).map((pt, idx) => (
                    <tr key={pt.digitrackNo || idx} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-muted-foreground">
                        #{idx + 1}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-foreground">{pt.ptName}</div>
                        <div className="text-[10px] text-muted-foreground">{pt.designation}</div>
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {pt.digitrackNo}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-foreground">{pt.ptHeadquarter || "—"}</div>
                        <div className="text-[10px] text-muted-foreground">{pt.ptDistrict}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-foreground">{pt.state}</div>
                        <div className="text-[10px] text-muted-foreground">{pt.zone}</div>
                      </td>
                      <td className="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {pt.totalCalls.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                        {pt.uniqueCalls.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground font-medium">
                        {pt.repeatCalls.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedPt(pt.digitrackNo);
                            setActiveSubTab("table");
                          }}
                          className="px-2 py-1 bg-secondary hover:bg-primary hover:text-primary-foreground rounded text-[10px] font-semibold transition-colors"
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {activeSubTab !== "pts" && (data?.ptMetrics.length || 0) > 10 && (
              <div className="pt-3 text-center border-t border-border/40 mt-3">
                <button
                  onClick={() => setActiveSubTab("pts")}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  View all {data?.ptMetrics.length} PT Leaderboard entries →
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SubTab 3: Full Detailed Missed Call Report Table */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Detailed Missed Call Records</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Search, filter, and inspect individual grower caller entries
              </p>
            </div>
            <div className="text-xs font-semibold text-muted-foreground">
              Showing <span className="font-bold text-foreground">{filteredCalls.length.toLocaleString()}</span> of{" "}
              {data?.totalCount.toLocaleString() || 0} total calls
            </div>
          </div>

          {/* Interactive Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Grower, Digitrack, PT..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* State Filter */}
            <div>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All States ({filterOptions.states.length})</option>
                {filterOptions.states.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Zone Filter */}
            <div>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Zones ({filterOptions.zones.length})</option>
                {filterOptions.zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            {/* PT Filter (by unique Digitrack) */}
            <div>
              <select
                value={selectedPt}
                onChange={(e) => setSelectedPt(e.target.value)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All PTs / Lines ({filterOptions.pts.length})</option>
                {filterOptions.pts.map((pt) => (
                  <option key={pt.digitrack} value={pt.digitrack}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="w-full h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto border border-border/60 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground text-left">
                <tr>
                  <th className="py-2 px-3 font-semibold">ID</th>
                  <th className="py-2 px-3 font-semibold">Grower Mobile</th>
                  <th className="py-2 px-3 font-semibold">Digitrack No (Line)</th>
                  <th className="py-2 px-3 font-semibold">Date & Time</th>
                  <th className="py-2 px-3 font-semibold">PT Name</th>
                  <th className="py-2 px-3 font-semibold">Headquarter / District</th>
                  <th className="py-2 px-3 font-semibold">State / Zone</th>
                  <th className="py-2 px-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paginatedCalls.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No missed calls found matching your filters.
                    </td>
                  </tr>
                ) : (
                  paginatedCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                        {call.id}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        {call.grower}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {call.digitrackNo}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground font-medium">
                        {call.date}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-foreground">{call.ptName}</div>
                        <div className="text-[10px] text-muted-foreground">{call.designation}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-foreground">{call.ptHeadquarter || "—"}</div>
                        <div className="text-[10px] text-muted-foreground">{call.ptDistrict}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-foreground">{call.state}</div>
                        <div className="text-[10px] text-muted-foreground">{call.zone}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          {call.action}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-7 px-2 rounded border border-border bg-background text-foreground"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>
                Showing {paginatedCalls.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{" "}
                {Math.min(currentPage * pageSize, filteredCalls.length)} of {filteredCalls.length.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>

              <span className="px-2 text-muted-foreground">
                Page <span className="font-bold text-foreground">{currentPage}</span> of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
