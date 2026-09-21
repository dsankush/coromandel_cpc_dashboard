"use client";

import React, { useState, useMemo } from "react";
import { AnomalyProfile, NormalizedOrder } from "@/types/order";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  AlertTriangle,
  Search,
  ExternalLink,
  MapPin,
  Calendar,
  Store,
  Package,
  Layers,
  Fingerprint,
  RotateCcw,
  Zap,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface WatchlistViewProps {
  watchlist: AnomalyProfile[];
  onSelectFarmer?: (farmerUuid: string) => void;
}

export function WatchlistView({ watchlist, onSelectFarmer }: WatchlistViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [anomalyFilter, setAnomalyFilter] = useState<string>("ALL");
  const [riskTier, setRiskTier] = useState<string>("ALL");
  const [investigatingFarmer, setInvestigatingFarmer] = useState<AnomalyProfile | null>(null);

  // Filtered anomalies
  const filteredList = useMemo(() => {
    return watchlist.filter((item) => {
      if (riskTier === "CRITICAL" && item.riskScore < 70) return false;
      if (riskTier === "HIGH" && (item.riskScore < 50 || item.riskScore >= 70)) return false;
      if (riskTier === "MEDIUM" && item.riskScore >= 50) return false;

      if (anomalyFilter === "VELOCITY" && !item.anomalies.multiRetailerVelocity) return false;
      if (anomalyFilter === "ZERO_APPROVAL" && !item.anomalies.zeroApprovalPattern) return false;
      if (anomalyFilter === "DUMMY" && !item.anomalies.dummyAccountFingerprint) return false;
      if (anomalyFilter === "MISMATCH" && !item.anomalies.highLocationMismatch) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches =
          item.farmerName.toLowerCase().includes(q) ||
          item.farmerUuid.toLowerCase().includes(q) ||
          item.farmerNo.includes(q) ||
          item.farmerState.toLowerCase().includes(q) ||
          item.flagReasons.some((r) => r.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [watchlist, anomalyFilter, riskTier, searchTerm]);

  // Metric counts
  const counts = useMemo(() => {
    return {
      total: watchlist.length,
      critical: watchlist.filter((w) => w.riskScore >= 70).length,
      velocity: watchlist.filter((w) => w.anomalies.multiRetailerVelocity).length,
      zeroApproval: watchlist.filter((w) => w.anomalies.zeroApprovalPattern).length,
      dummy: watchlist.filter((w) => w.anomalies.dummyAccountFingerprint).length,
    };
  }, [watchlist]);

  const getRiskScoreBadge = (score: number) => {
    if (score >= 70) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
          <ShieldAlert className="w-3.5 h-3.5" />
          {score} / 100 • Critical
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          {score} / 100 • High
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
        {score} / 100 • Medium
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner / Header Explanation */}
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 backdrop-blur-sm shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-500 border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-foreground flex items-center gap-2">
                Automated Data-Quality & Anomaly Watchlist
                <span className="text-xs font-bold text-rose-500 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/20">
                  {counts.total} Flagged Profiles
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-3xl leading-relaxed">
                Heuristic engine flagging suspicious behaviors computed live from{" "}
                <code className="text-emerald-400 font-mono">/data/orders.csv</code>. Identifies
                multi-state retailer velocity, 100% rejection loops, and synthetic account fingerprints.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-card/80 p-2 border border-border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Critical</span>
              <p className="text-base font-extrabold text-rose-500 mt-0.5">{counts.critical}</p>
            </div>
            <div className="rounded-lg bg-card/80 p-2 border border-border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Velocity</span>
              <p className="text-base font-extrabold text-amber-500 mt-0.5">{counts.velocity}</p>
            </div>
            <div className="rounded-lg bg-card/80 p-2 border border-border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Dummy Accts</span>
              <p className="text-base font-extrabold text-purple-500 mt-0.5">{counts.dummy}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-border/80 bg-card/70 p-4 backdrop-blur-sm shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by farmer name, UUID, state, or anomaly pattern..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/90 pl-9 pr-4 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
            />
          </div>

          {/* Anomaly Category Selector */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setAnomalyFilter("ALL")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                anomalyFilter === "ALL"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              All Anomalies ({counts.total})
            </button>
            <button
              onClick={() => setAnomalyFilter("VELOCITY")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                anomalyFilter === "VELOCITY"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Retailer Hopping ({counts.velocity})
            </button>
            <button
              onClick={() => setAnomalyFilter("ZERO_APPROVAL")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                anomalyFilter === "ZERO_APPROVAL"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Zero Approvals ({counts.zeroApproval})
            </button>
            <button
              onClick={() => setAnomalyFilter("DUMMY")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                anomalyFilter === "DUMMY"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Dummy Accounts ({counts.dummy})
            </button>
          </div>
        </div>

        {/* Risk Tier Quick Filter */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Risk Severity:</span>
          {["ALL", "CRITICAL", "HIGH", "MEDIUM"].map((tier) => (
            <button
              key={tier}
              onClick={() => setRiskTier(tier)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                riskTier === tier
                  ? "bg-foreground text-background font-bold"
                  : "hover:bg-secondary text-muted-foreground"
              }`}
            >
              {tier}
            </button>
          ))}
          <span className="ml-auto text-[11px]">
            Showing <strong>{filteredList.length}</strong> flagged accounts
          </span>
        </div>
      </div>

      {/* Flagged Accounts Table */}
      <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3 px-4 font-semibold">Risk Score</th>
                <th className="py-3 px-4 font-semibold">Farmer Identity</th>
                <th className="py-3 px-4 font-semibold">Domicile</th>
                <th className="py-3 px-4 font-semibold">Triggered Anomaly Patterns</th>
                <th className="py-3 px-4 font-semibold text-right">Orders</th>
                <th className="py-3 px-4 font-semibold text-right">Retailers</th>
                <th className="py-3 px-4 font-semibold text-center">Investigate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    No suspicious patterns matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr
                    key={item.farmerUuid || idx}
                    className="hover:bg-secondary/40 transition-colors"
                  >
                    {/* Risk Score */}
                    <td className="py-3 px-4">{getRiskScoreBadge(item.riskScore)}</td>

                    {/* Farmer */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground text-sm">{item.farmerName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[170px]">
                        {item.farmerUuid}
                      </div>
                    </td>

                    {/* Domicile */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{item.farmerDistrict}</div>
                      <div className="text-[11px] text-muted-foreground">{item.farmerState}</div>
                    </td>

                    {/* Anomaly Pattern Badges */}
                    <td className="py-3 px-4 max-w-md">
                      <div className="space-y-1">
                        {item.flagReasons.map((reason, rIdx) => (
                          <div
                            key={rIdx}
                            className="flex items-start gap-1.5 text-[11px] text-foreground font-medium"
                          >
                            <span className="text-rose-500 font-bold">•</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Orders & Approval Breakdown */}
                    <td className="py-3 px-4 text-right">
                      <div className="font-extrabold text-foreground">{item.totalOrders} total</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        <span className="text-emerald-500 font-bold">{item.approvedCount}A</span> /{" "}
                        <span className="text-amber-500 font-bold">{item.pendingCount}P</span> /{" "}
                        <span className="text-rose-500 font-bold">{item.rejectedCount}R</span>
                      </div>
                    </td>

                    {/* Retailers Spread */}
                    <td className="py-3 px-4 text-right font-bold text-foreground">
                      <div>{item.uniqueRetailersCount} stores</div>
                      <div className="text-[10px] text-muted-foreground">
                        across {item.uniqueStatesCount} states
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-4 text-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setInvestigatingFarmer(item)}
                        className="h-7 px-3 text-[11px] gap-1 shadow-sm font-semibold"
                      >
                        <span>Inspect Dossier</span>
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investigation Modal */}
      {investigatingFarmer && (
        <Modal
          isOpen={Boolean(investigatingFarmer)}
          onClose={() => setInvestigatingFarmer(null)}
          title={`Anomaly Forensic Dossier: ${investigatingFarmer.farmerName}`}
          description={`UUID: ${investigatingFarmer.farmerUuid} • Registered Location: ${investigatingFarmer.farmerDistrict}, ${investigatingFarmer.farmerState}`}
          maxWidth="4xl"
        >
          <div className="space-y-5">
            {/* Risk Summary Header */}
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm uppercase tracking-wide">
                    Risk Assessment Score: {investigatingFarmer.riskScore} / 100
                  </span>
                </div>
                {getRiskScoreBadge(investigatingFarmer.riskScore)}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-rose-500/20">
                {investigatingFarmer.flagReasons.map((reason, i) => (
                  <div key={i} className="flex items-start gap-2 text-foreground font-semibold">
                    <span className="text-rose-500 text-base leading-none">⚠</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Profile Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-secondary/50 border border-border text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Reported Land
                </span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {investigatingFarmer.farmerLandRaw || "Unspecified"}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Reported Crops
                </span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {investigatingFarmer.crops.length > 0
                    ? investigatingFarmer.crops.join(", ")
                    : "None (NULL)"}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Unique Retailers
                </span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {investigatingFarmer.uniqueRetailersCount} stores
                </p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Approval Rate
                </span>
                <p className="text-sm font-bold text-rose-500 mt-0.5">
                  {investigatingFarmer.totalOrders > 0
                    ? `${Math.round((investigatingFarmer.approvedCount / investigatingFarmer.totalOrders) * 100)}%`
                    : "0%"}{" "}
                  ({investigatingFarmer.approvedCount} approved / {investigatingFarmer.totalOrders} orders)
                </p>
              </div>
            </div>

            {/* Full Order Audit Trail */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
                <span>Suspicious Order History ({investigatingFarmer.sampleOrders.length} Orders)</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Check cross-retailer and cross-state hopping timeline
                </span>
              </h4>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {investigatingFarmer.sampleOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-lg border border-border/80 bg-card p-3 shadow-sm hover:border-primary/50 transition-all text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">
                          Order #{ord.purchaseId}
                        </span>
                        <StatusBadge status={ord.status} />
                        {ord.locationMismatch && (
                          <span className="flex items-center gap-1 text-amber-500 text-[10px] bg-amber-500/10 px-2 py-0.5 rounded font-medium border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Location Mismatch</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{ord.createdAtStr}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px]">
                      <div>
                        <span className="text-muted-foreground flex items-center gap-1 font-medium">
                          <Store className="w-3 h-3 text-indigo-400" />
                          Purchased From:
                        </span>
                        <p className="font-bold text-foreground mt-0.5">{ord.retailerName}</p>
                        <p className="text-muted-foreground">
                          {ord.retailerDistrict}, {ord.retailerState} (PIN: {ord.retailerPinCode})
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground flex items-center gap-1 font-medium">
                          <Package className="w-3 h-3 text-primary" />
                          Products Ordered ({ord.noProductPurchase} units):
                        </span>
                        <div className="mt-1 space-y-1">
                          {ord.lineItems.map((item, i) => (
                            <div key={i} className="flex justify-between font-medium">
                              <span>
                                {item.productName} ({item.skuSize || item.packSize})
                              </span>
                              <span className="font-bold text-primary">x{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {ord.couponCodes.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span>Coupon Codes:</span>
                        <span className="font-mono text-foreground">
                          {ord.couponCodes.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
