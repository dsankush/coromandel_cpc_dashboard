"use client";

import React from "react";
import { DashboardKPIs, AnomalyProfile, NormalizedOrder } from "@/types/order";
import { StateLevelMetric } from "@/lib/data";
import { KPICards } from "./kpi-cards";
import { TimeSeriesChart } from "./time-series-chart";
import { IndiaStateMap } from "./india-state-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Package,
  Store,
  MapPin,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";

import { Download } from "lucide-react";
import { exportOverviewReportCSV } from "@/lib/export-csv";

interface OverviewViewProps {
  kpis: DashboardKPIs;
  timeSeries: {
    date: string;
    approved: number;
    pending: number;
    rejected: number;
    total: number;
  }[];
  topProducts: {
    productName: string;
    totalUnits: number;
    orderCount: number;
  }[];
  topRetailers: {
    retailerName: string;
    state: string;
    totalOrders: number;
    approvalRate: number;
  }[];
  stateMetrics: StateLevelMetric[];
  onNavigateTab: (tabId: string) => void;
  onDateFilterChange: (startDate: string | null, endDate: string | null) => void;
}

export function OverviewView({
  kpis,
  timeSeries,
  topProducts,
  topRetailers,
  stateMetrics,
  onNavigateTab,
  onDateFilterChange,
}: OverviewViewProps) {
  const handleDownloadOverview = () => {
    exportOverviewReportCSV(kpis, stateMetrics);
  };

  return (
    <div className="space-y-6">
      {/* Overview Section Action Header */}
      <div className="flex items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground">
            Coromandel CPC Distribution Network Overview
          </h2>
          <p className="text-xs text-muted-foreground">
            Macro KPIs, real geographic state status, velocity, and top performers
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadOverview}
          className="h-8 gap-1.5 text-xs font-semibold shrink-0 border-border/80"
          title="Download Overview summary report as CSV"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>Download Overview Report</span>
        </Button>
      </div>

      {/* KPI Cards Row */}
      <KPICards kpis={kpis} />

      {/* India Geographic State Distribution Map & Verification Status */}
      <IndiaStateMap stateMetrics={stateMetrics} />

      {/* Time-Series Chart */}
      <TimeSeriesChart data={timeSeries} onDateFilterChange={onDateFilterChange} />

      {/* Two Column Grid: Top Products Snapshot & Top Retailers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top CPC Products Snapshot */}
        <Card className="border-border/70 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-500" />
                Top Performing Products (Volume)
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("products")}
                className="h-7 text-xs text-primary gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-3">
            <div className="space-y-3">
              {topProducts.slice(0, 5).map((prod, idx) => {
                const maxVol = topProducts[0]?.totalUnits || 1;
                const pct = Math.round((prod.totalUnits / maxVol) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="font-bold text-foreground">{prod.productName}</span>
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">{formatNumber(prod.totalUnits)}</strong> units
                        ({formatNumber(prod.orderCount)} orders)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Active Retailers Leaderboard */}
        <Card className="border-border/70 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Store className="w-4 h-4 text-primary" />
                Active Retailer Throughput
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("retailers")}
                className="h-7 text-xs text-primary gap-1"
              >
                <span>Leaderboard</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-3">
            <div className="space-y-2.5">
              {topRetailers.slice(0, 5).map((ret, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs"
                >
                  <div>
                    <p className="font-bold text-foreground">{ret.retailerName}</p>
                    <span className="text-[11px] text-muted-foreground">{ret.state}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-foreground">
                      {formatNumber(ret.totalOrders)} orders
                    </div>
                    <span className="inline-block text-[11px] font-semibold text-emerald-500">
                      {ret.approvalRate}% approved
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
