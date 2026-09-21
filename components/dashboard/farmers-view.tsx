"use client";

import React, { useState, useMemo } from "react";
import { NormalizedOrder } from "@/types/order";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  Users,
  Search,
  MapPin,
  Calendar,
  Store,
  ExternalLink,
  AlertTriangle,
  Package,
  Download,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { exportFarmersCSV } from "@/lib/export-csv";

interface FarmerProfile {
  farmerUuid: string;
  farmerName: string;
  farmerNo: string;
  state: string;
  district: string;
  crops: string[];
  landAcres: number | null;
  landRaw: string;
  totalOrders: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  approvalRate: number;
  uniqueRetailersCount: number;
  orders: NormalizedOrder[];
}

interface FarmersViewProps {
  farmers: FarmerProfile[];
  initialSelectedFarmerUuid?: string | null;
}

export function FarmersView({ farmers, initialSelectedFarmerUuid }: FarmersViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerProfile | null>(null);

  React.useEffect(() => {
    if (initialSelectedFarmerUuid) {
      const match = farmers.find(
        (f) => f.farmerUuid.toLowerCase() === initialSelectedFarmerUuid.toLowerCase()
      );
      if (match) setSelectedFarmer(match);
    }
  }, [initialSelectedFarmerUuid, farmers]);

  const filteredFarmers = useMemo(() => {
    if (!searchTerm) return farmers;
    const q = searchTerm.toLowerCase();
    return farmers.filter(
      (f) =>
        f.farmerName.toLowerCase().includes(q) ||
        f.farmerUuid.toLowerCase().includes(q) ||
        f.farmerNo.includes(q) ||
        f.state.toLowerCase().includes(q) ||
        f.crops.some((c) => c.toLowerCase().includes(q))
    );
  }, [farmers, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="rounded-xl border border-border/80 bg-card/70 p-4 backdrop-blur-sm shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Registered Farmer Network Directory
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Individual farmer profiles, land holdings, crops, and cross-retailer order history
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search farmer by name, phone, crop, state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
            />
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={() => exportFarmersCSV(filteredFarmers)}
            className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            title="Download Farmers Directory as CSV (zero UUID columns)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Farmers (CSV)</span>
          </Button>
        </div>
      </div>

      {/* Farmers Table */}
      <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[580px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Farmer Details</th>
                <th className="py-2.5 px-4 font-semibold">Location</th>
                <th className="py-2.5 px-4 font-semibold">Crop(s)</th>
                <th className="py-2.5 px-4 font-semibold">Land (Acres)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Orders</th>
                <th className="py-2.5 px-4 font-semibold text-right">Retailers</th>
                <th className="py-2.5 px-4 font-semibold text-right">Approval Breakdown</th>
                <th className="py-2.5 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredFarmers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                    No farmers found matching your query.
                  </td>
                </tr>
              ) : (
                filteredFarmers.map((farmer) => (
                  <tr
                    key={farmer.farmerUuid || farmer.farmerNo}
                    className="hover:bg-secondary/40 transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-foreground">{farmer.farmerName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                        UUID: {farmer.farmerUuid}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-foreground">{farmer.district}</div>
                      <div className="text-[11px] text-muted-foreground">{farmer.state}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {farmer.crops.length > 0 ? (
                          farmer.crops.map((c, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground font-medium"
                            >
                              {c.replace(/_/g, " ")}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground/60 italic text-[11px]">NULL</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      {farmer.landRaw && farmer.landRaw.toUpperCase() !== "NULL" ? (
                        <span>{farmer.landRaw} ac</span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-extrabold text-foreground">
                      {formatNumber(farmer.totalOrders)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-muted-foreground">
                      {farmer.uniqueRetailersCount}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-[11px]">
                        <span className="text-emerald-500 font-bold">{farmer.approvedCount}A</span>
                        <span className="text-muted-foreground/40">/</span>
                        <span className="text-amber-500 font-bold">{farmer.pendingCount}P</span>
                        <span className="text-muted-foreground/40">/</span>
                        <span className="text-rose-500 font-bold">{farmer.rejectedCount}R</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFarmer(farmer)}
                        className="h-7 px-2.5 text-[11px] gap-1 text-primary hover:text-primary"
                      >
                        <span>History</span>
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

      {/* Drill-down Modal for Farmer History */}
      {selectedFarmer && (
        <Modal
          isOpen={Boolean(selectedFarmer)}
          onClose={() => setSelectedFarmer(null)}
          title={`Farmer Order Dossier: ${selectedFarmer.farmerName}`}
          description={`UUID: ${selectedFarmer.farmerUuid} • Domicile: ${selectedFarmer.district}, ${selectedFarmer.state}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            {/* Top Profile Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-secondary/50 border border-border text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Land Holdings
                </span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {selectedFarmer.landRaw ? `${selectedFarmer.landRaw} acres` : "Unspecified"}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Registered Crops
                </span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {selectedFarmer.crops.length > 0
                    ? selectedFarmer.crops.map((c) => c.replace(/_/g, " ")).join(", ")
                    : "None (NULL)"}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Retailer Spread
                </span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {selectedFarmer.uniqueRetailersCount} distinct retailers
                </p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Approval Rate
                </span>
                <p className="text-sm font-bold text-emerald-500 mt-0.5">
                  {selectedFarmer.approvalRate}% ({selectedFarmer.approvedCount} approved)
                </p>
              </div>
            </div>

            {/* Timeline of All Purchases */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Order Timeline ({selectedFarmer.orders.length} Records)
              </h4>
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {selectedFarmer.orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-lg border border-border/80 bg-card p-3 shadow-sm hover:border-primary/50 transition-all text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">
                          #{ord.purchaseId}
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
                          Retailer:
                        </span>
                        <p className="font-bold text-foreground mt-0.5">{ord.retailerName}</p>
                        <p className="text-muted-foreground">
                          {ord.retailerDistrict}, {ord.retailerState} (PIN: {ord.retailerPinCode})
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground flex items-center gap-1 font-medium">
                          <Package className="w-3 h-3 text-primary" />
                          Purchased Products ({ord.noProductPurchase} units):
                        </span>
                        <div className="mt-1 space-y-1">
                          {ord.lineItems.map((item, i) => (
                            <div key={i} className="flex justify-between font-medium">
                              <span>{item.productName} ({item.skuSize || item.packSize})</span>
                              <span className="font-bold text-primary">x{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {ord.couponCodes.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span>Coupon Codes:</span>
                        <span className="font-mono text-foreground">{ord.couponCodes.join(", ")}</span>
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
