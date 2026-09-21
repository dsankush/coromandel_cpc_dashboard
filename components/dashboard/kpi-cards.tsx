"use client";

import React from "react";
import { DashboardKPIs } from "@/types/order";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ShoppingBag,
  Users,
  Store,
  Timer,
  AlertTriangle,
  Package,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface KPICardsProps {
  kpis: DashboardKPIs;
}

export function KPICards({ kpis }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total Orders */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Orders
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1">
                {formatNumber(kpis.totalOrders)}
              </h3>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-emerald-500">
              {kpis.totalUnitsSold.toLocaleString()}
            </span>
            <span>total units purchased across network</span>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Status Breakdown (Approved / Pending / Rejected) */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Approval Status
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-extrabold text-emerald-500">
                  {kpis.approvedPercentage}%
                </span>
                <span className="text-xs text-muted-foreground">approved</span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Micro Progress Bar */}
          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${kpis.approvedPercentage}%` }}
              title={`Approved: ${kpis.approvedOrders} (${kpis.approvedPercentage}%)`}
            />
            <div
              className="bg-amber-500 transition-all"
              style={{ width: `${kpis.pendingPercentage}%` }}
              title={`Pending: ${kpis.pendingOrders} (${kpis.pendingPercentage}%)`}
            />
            <div
              className="bg-rose-500 transition-all"
              style={{ width: `${kpis.rejectedPercentage}%` }}
              title={`Rejected: ${kpis.rejectedOrders} (${kpis.rejectedPercentage}%)`}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {kpis.approvedOrders.toLocaleString()} ({kpis.approvedPercentage}%)
            </span>
            <span className="text-amber-500 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {kpis.pendingOrders.toLocaleString()} ({kpis.pendingPercentage}%)
            </span>
            <span className="text-rose-500 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {kpis.rejectedOrders.toLocaleString()} ({kpis.rejectedPercentage}%)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Network Reach (Unique Farmers & Retailers) */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-indigo-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Agri-Network Reach
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {formatNumber(kpis.uniqueFarmers)}
                </span>
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400">Unique Farmers</span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
            <span className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-indigo-500" />
              <span>Retailers:</span>
              <strong className="text-foreground">{formatNumber(kpis.uniqueRetailers)}</strong>
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <span>{formatNumber(kpis.uniqueFarmers)} Unique Farmers</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Geographic Coverage (States & Districts) */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Geographic Coverage
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {kpis.activeStatesCount ?? 8}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">Active States</span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs border-t border-border/40 pt-2">
            <span className="text-muted-foreground">
              Across Distribution Districts:
            </span>
            <span className="font-bold text-teal-600 dark:text-teal-400">
              {kpis.activeDistrictsCount ?? 52} Districts
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
