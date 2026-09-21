"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Store, Search, MapPin, CheckCircle, Clock, XCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { exportRetailersCSV } from "@/lib/export-csv";

interface RetailersViewProps {
  leaderboard: {
    retailerNo: string;
    retailerName: string;
    state: string;
    district: string;
    totalOrders: number;
    approvedOrders: number;
    pendingOrders: number;
    rejectedOrders: number;
    totalUnits: number;
    approvalRate: number;
    avgLatencyHours?: number;
  }[];
  stateChartData: {
    state: string;
    count: number;
    approved: number;
  }[];
}

export function RetailersView({ leaderboard, stateChartData }: RetailersViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"totalOrders" | "approvalRate">("totalOrders");
  const [sortAsc, setSortAsc] = useState(false);

  const filteredLeaderboard = useMemo(() => {
    let list = [...leaderboard];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.retailerName.toLowerCase().includes(q) ||
          r.retailerNo.includes(q) ||
          r.state.toLowerCase().includes(q) ||
          r.district.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortField === "totalOrders") {
        return sortAsc ? a.totalOrders - b.totalOrders : b.totalOrders - a.totalOrders;
      }
      if (sortField === "approvalRate") {
        return sortAsc ? a.approvalRate - b.approvalRate : b.approvalRate - a.approvalRate;
      }
      return 0;
    });

    return list;
  }, [leaderboard, searchTerm, sortField, sortAsc]);

  return (
    <div className="space-y-6">
      {/* State & Regional Order Concentration Chart */}
      <Card className="border-border/70 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="p-5 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-500" />
                Regional Order Volume by Retailer State
              </CardTitle>
              <CardDescription className="text-xs">
                Distribution of farmer orders and retailer approvals across states
              </CardDescription>
            </div>
            <div className="text-xs text-muted-foreground bg-secondary/80 px-3 py-1.5 rounded-lg border border-border/50">
              Active States: <strong className="text-foreground">{stateChartData.length}</strong>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-3">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stateChartData.slice(0, 8)}
                margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border) / 0.5)"
                />
                <XAxis
                  dataKey="state"
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border) / 0.7)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 6, fontSize: 12 }}
                />
                <Bar dataKey="count" name="Total Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="approved" name="Approved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Retailer Leaderboard Table */}
      <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/30">
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" />
              Retailer Performance Leaderboard
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Order fulfillment throughput, approval velocity, and rejection rates
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search retailer, district, state..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground"
            >
              <option value="totalOrders">Sort: Orders</option>
              <option value="approvalRate">Sort: Approval %</option>
            </select>

            <Button
              variant="default"
              size="sm"
              onClick={() => exportRetailersCSV(filteredLeaderboard)}
              className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              title="Download Retailers Leaderboard as CSV (zero UUID columns)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Retailers (CSV)</span>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2.5 px-4 font-semibold">#</th>
                <th className="py-2.5 px-4 font-semibold">Retailer Details</th>
                <th className="py-2.5 px-4 font-semibold">Location</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total Orders</th>
                <th className="py-2.5 px-4 font-semibold text-right">Units Sold</th>
                <th className="py-2.5 px-4 font-semibold text-right">Approved</th>
                <th className="py-2.5 px-4 font-semibold text-right">Approval Rate</th>
                <th className="py-2.5 px-4 font-semibold text-right">Rejected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                    No retailers match your search query.
                  </td>
                </tr>
              ) : (
                filteredLeaderboard.map((retailer, idx) => {
                  let rateColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
                  if (retailer.approvalRate < 70) {
                    rateColor = "text-rose-500 bg-rose-500/10 border-rose-500/20";
                  } else if (retailer.approvalRate < 85) {
                    rateColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
                  }

                  return (
                    <tr key={retailer.retailerNo || idx} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-2.5 px-4 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-foreground">{retailer.retailerName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          ID: {retailer.retailerNo}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-foreground">{retailer.district}</div>
                        <div className="text-[11px] text-muted-foreground">{retailer.state}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-extrabold text-foreground">
                        {formatNumber(retailer.totalOrders)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-foreground">
                        {formatNumber(retailer.totalUnits)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-500 font-semibold">
                        {formatNumber(retailer.approvedOrders)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${rateColor}`}
                        >
                          {retailer.approvalRate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {retailer.rejectedOrders > 0 ? (
                          <span className="font-semibold text-rose-500">
                            {retailer.rejectedOrders}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
