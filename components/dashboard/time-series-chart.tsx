"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, BarChart3, LineChart } from "lucide-react";

interface TimeSeriesItem {
  date: string;
  approved: number;
  pending: number;
  rejected: number;
  total: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesItem[];
  onDateFilterChange?: (startDate: string | null, endDate: string | null) => void;
}

export function TimeSeriesChart({ data, onDateFilterChange }: TimeSeriesChartProps) {
  const [chartType, setChartType] = useState<"bar" | "area">("bar");
  const [rangePreset, setRangePreset] = useState<string>("all");

  const formattedData = React.useMemo(() => {
    if (!data || data.length === 0) return [];

    let filtered = [...data];
    if (rangePreset === "7d") {
      filtered = filtered.slice(-7);
    } else if (rangePreset === "14d") {
      filtered = filtered.slice(-14);
    } else if (rangePreset === "30d") {
      filtered = filtered.slice(-30);
    }

    return filtered.map((d) => ({
      ...d,
      formattedDate: new Date(d.date).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [data, rangePreset]);

  const handlePresetChange = (preset: string) => {
    setRangePreset(preset);
    if (!onDateFilterChange || data.length === 0) return;

    if (preset === "all") {
      onDateFilterChange(null, null);
    } else {
      let days = 30;
      if (preset === "7d") days = 7;
      if (preset === "14d") days = 14;
      const filteredSlice = data.slice(-days);
      if (filteredSlice.length > 0) {
        onDateFilterChange(filteredSlice[0].date, filteredSlice[filteredSlice.length - 1].date);
      }
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((acc: number, curr: any) => acc + (curr.value || 0), 0);
      return (
        <div className="rounded-xl border border-border bg-card/95 p-3.5 shadow-xl backdrop-blur-md text-xs">
          <p className="font-bold text-foreground mb-1.5">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color }}>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.name}:
                </span>
                <span className="font-semibold text-foreground">{entry.value}</span>
              </div>
            ))}
            <div className="border-t border-border/60 pt-1 mt-1 flex justify-between font-bold text-foreground">
              <span>Total Orders:</span>
              <span>{total}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg font-bold">
                Orders Timeline & Daily Velocity
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Daily purchase orders stacked by retailer approval status (created_at)
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Range Presets */}
            <div className="flex items-center bg-secondary/80 rounded-lg p-0.5 text-xs font-medium border border-border/50">
              <button
                onClick={() => handlePresetChange("7d")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  rangePreset === "7d"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                7D
              </button>
              <button
                onClick={() => handlePresetChange("14d")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  rangePreset === "14d"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                14D
              </button>
              <button
                onClick={() => handlePresetChange("30d")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  rangePreset === "30d"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                30D
              </button>
              <button
                onClick={() => handlePresetChange("all")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  rangePreset === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
            </div>

            {/* Chart Type Toggle */}
            <div className="flex items-center bg-secondary/80 rounded-lg p-0.5 border border-border/50">
              <Button
                variant={chartType === "bar" ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setChartType("bar")}
                title="Stacked Bar Chart"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={chartType === "area" ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setChartType("area")}
                title="Stacked Area Chart"
              >
                <LineChart className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-2">
        <div className="h-[280px] sm:h-[340px] w-full">
          {formattedData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No orders recorded for selected timeline.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" ? (
                <BarChart
                  data={formattedData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border) / 0.5)"
                  />
                  <XAxis
                    dataKey="formattedDate"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={{ stroke: "hsl(var(--border) / 0.7)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: 8, fontSize: 12 }}
                  />
                  <Bar
                    dataKey="approved"
                    name="Approved"
                    stackId="orders"
                    fill="#10b981"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="pending"
                    name="Pending"
                    stackId="orders"
                    fill="#f59e0b"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="rejected"
                    name="Rejected"
                    stackId="orders"
                    fill="#ef4444"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              ) : (
                <AreaChart
                  data={formattedData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorRejected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border) / 0.5)"
                  />
                  <XAxis
                    dataKey="formattedDate"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={{ stroke: "hsl(var(--border) / 0.7)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: 8, fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="approved"
                    name="Approved"
                    stackId="1"
                    stroke="#10b981"
                    fill="url(#colorApproved)"
                  />
                  <Area
                    type="monotone"
                    dataKey="pending"
                    name="Pending"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="url(#colorPending)"
                  />
                  <Area
                    type="monotone"
                    dataKey="rejected"
                    name="Rejected"
                    stackId="1"
                    stroke="#ef4444"
                    fill="url(#colorRejected)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
