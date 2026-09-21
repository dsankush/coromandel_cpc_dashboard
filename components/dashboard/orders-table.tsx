"use client";

import React, { useState, useMemo } from "react";
import { NormalizedOrder } from "@/types/order";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Download,
  AlertTriangle,
  Filter,
  Tag,
  Package,
  Layers,
  MapPin,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { exportOrdersCSV } from "@/lib/export-csv";

interface OrdersTableProps {
  orders: NormalizedOrder[];
  filterOptions?: {
    states: string[];
    districts: string[];
    retailers: string[];
    crops: string[];
  };
  onSelectFarmer?: (farmerUuid: string) => void;
}

export function OrdersTable({ orders, filterOptions, onSelectFarmer }: OrdersTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [districtFilter, setDistrictFilter] = useState("ALL");
  const [cropFilter, setCropFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Sorting
  const [sortField, setSortField] = useState<"createdAt" | "purchaseId">("createdAt");
  const [sortAsc, setSortAsc] = useState(false);

  // Derived filter options if not provided
  const options = useMemo(() => {
    if (filterOptions) return filterOptions;
    const states = new Set<string>();
    const crops = new Set<string>();
    const districts = new Set<string>();
    for (const o of orders) {
      if (o.retailerState) states.add(o.retailerState);
      if (o.farmerState) states.add(o.farmerState);
      if (o.retailerDistrict) districts.add(o.retailerDistrict);
      if (o.farmerDistrict) districts.add(o.farmerDistrict);
      for (const c of o.farmerCrops) crops.add(c);
    }
    return {
      states: Array.from(states).sort(),
      crops: Array.from(crops).sort(),
      districts: Array.from(districts).sort(),
      retailers: [],
    };
  }, [orders, filterOptions]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Date range filter
      if (startDate) {
        const d = o.createdAt ? o.createdAt.toISOString().slice(0, 10) : "";
        if (d && d < startDate) return false;
      }
      if (endDate) {
        const d = o.createdAt ? o.createdAt.toISOString().slice(0, 10) : "";
        if (d && d > endDate) return false;
      }
      if (statusFilter !== "ALL" && o.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (stateFilter !== "ALL") {
        const matchesRetailer = (o.retailerState || "").toLowerCase() === stateFilter.toLowerCase();
        const matchesFarmer = (o.farmerState || "").toLowerCase() === stateFilter.toLowerCase();
        if (!matchesRetailer && !matchesFarmer) return false;
      }
      if (districtFilter !== "ALL") {
        const matchesRetailer = (o.retailerDistrict || "").toLowerCase() === districtFilter.toLowerCase();
        const matchesFarmer = (o.farmerDistrict || "").toLowerCase() === districtFilter.toLowerCase();
        if (!matchesRetailer && !matchesFarmer) return false;
      }
      if (cropFilter !== "ALL") {
        if (!o.farmerCrops.some((c) => c.toLowerCase() === cropFilter.toLowerCase())) {
          return false;
        }
      }
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matches =
          o.farmerName.toLowerCase().includes(query) ||
          o.farmerNo.includes(query) ||
          o.farmerUuid.toLowerCase().includes(query) ||
          o.retailerName.toLowerCase().includes(query) ||
          o.retailerNo.includes(query) ||
          o.purchaseId.toLowerCase().includes(query) ||
          o.rawProductName.toLowerCase().includes(query);
        if (!matches) return false;
      }
      return true;
    });
  }, [orders, statusFilter, stateFilter, districtFilter, cropFilter, startDate, endDate, searchTerm]);

  // Sorted orders
  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    list.sort((a, b) => {
      if (sortField === "createdAt") {
        const timeA = a.createdAt ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt ? b.createdAt.getTime() : 0;
        return sortAsc ? timeA - timeB : timeB - timeA;
      }
      if (sortField === "purchaseId") {
        return sortAsc ? a.purchaseId.localeCompare(b.purchaseId) : b.purchaseId.localeCompare(a.purchaseId);
      }
      return 0;
    });
    return list;
  }, [filteredOrders, sortField, sortAsc]);

  // Pagination calculation
  const totalPages = Math.ceil(sortedOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExportCSV = () => {
    exportOrdersCSV(sortedOrders);
  };

  return (
    <div className="space-y-4">
      {/* Search and Table Actions Bar (Clean single-row, no duplicate filters) */}
      <div className="rounded-xl border border-border/80 bg-card/70 p-4 backdrop-blur-sm shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by farmer name, phone, retailer, purchase ID, or product..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-input bg-background/90 pl-9 pr-4 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
            />
          </div>

          {/* Table Sort & Export Controls */}
          <div className="flex items-center gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
            >
              <option value="createdAt">Sort: Date (Recent)</option>
              <option value="purchaseId">Sort: Purchase ID</option>
            </select>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-xs shrink-0"
              onClick={() => setSortAsc(!sortAsc)}
              title={sortAsc ? "Sort Ascending" : "Sort Descending"}
            >
              {sortAsc ? "↑" : "↓"}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              title="Download filtered orders as CSV (zero UUID columns)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Orders (CSV)</span>
            </Button>
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2.5 mt-2.5 border-t border-border/40">
          <span>
            Showing <strong>{sortedOrders.length.toLocaleString()}</strong> orders in table view
            {sortedOrders.length !== orders.length && ` (filtered from ${orders.length.toLocaleString()})`}
          </span>
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
                setCurrentPage(1);
              }}
              className="text-xs text-emerald-500 hover:underline font-medium"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground border-collapse">
            <thead className="bg-secondary/60 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3 px-3 w-8"></th>
                <th className="py-3 px-3 font-semibold">Purchase ID & Date</th>
                <th className="py-3 px-3 font-semibold">Retailer</th>
                <th className="py-3 px-3 font-semibold">Farmer / Location</th>
                <th className="py-3 px-3 font-semibold">Crops & Land</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold text-right">Units</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    No orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const isExpanded = Boolean(expandedRows[order.id]);
                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`hover:bg-secondary/40 transition-colors ${
                          isExpanded ? "bg-secondary/30" : ""
                        } ${order.locationMismatch ? "bg-amber-500/[0.03]" : ""}`}
                      >
                        {/* Expand Button */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => toggleExpand(order.id)}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-transform"
                            title="Expand product details and coupons"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-primary" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Purchase ID & Created At */}
                        <td className="py-3 px-3 font-mono">
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            <span>#{order.purchaseId}</span>
                            {order.locationMismatch && (
                              <span
                                className="inline-flex p-0.5 rounded text-amber-500 bg-amber-500/10"
                                title={`Location mismatch: Farmer in ${order.farmerState}/${order.farmerDistrict}, Retailer in ${order.retailerState}/${order.retailerDistrict}`}
                              >
                                <AlertTriangle className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 font-sans">
                            <Calendar className="w-3 h-3 text-muted-foreground/70" />
                            <span>{order.createdAtStr}</span>
                          </div>
                        </td>

                        {/* Retailer */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground truncate max-w-[190px]">
                            {order.retailerName}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-muted-foreground/70" />
                            <span>
                              {order.retailerDistrict}, {order.retailerState}
                            </span>
                          </div>
                        </td>

                        {/* Farmer */}
                        <td className="py-3 px-3">
                          <button
                            onClick={() => onSelectFarmer?.(order.farmerUuid)}
                            className="font-semibold text-primary hover:underline flex items-center gap-1 group text-left"
                            title="Click to view farmer history & anomalies"
                          >
                            <span>{order.farmerName}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {order.farmerDistrict}, {order.farmerState}
                          </div>
                        </td>

                        {/* Crops & Land */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[170px]">
                            {order.farmerCrops.length > 0 ? (
                              order.farmerCrops.map((c, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground font-medium"
                                >
                                  {c.replace(/_/g, " ")}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                Unknown Crop
                              </span>
                            )}
                          </div>
                          {order.farmerLandRaw && order.farmerLandRaw.toUpperCase() !== "NULL" && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Land: {order.farmerLandRaw} ac
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          <StatusBadge status={order.status} />
                        </td>

                        {/* Units */}
                        <td className="py-3 px-3 text-right font-semibold">
                          {order.noProductPurchase}
                        </td>
                      </tr>

                      {/* Expanded Row Detail */}
                      {isExpanded && (
                        <tr className="bg-secondary/20 border-y border-border/80">
                          <td colSpan={7} className="p-4 sm:p-5">
                            <div className="rounded-lg border border-border/70 bg-card/90 p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-primary" />
                                  <h4 className="font-bold text-xs uppercase tracking-wide text-foreground">
                                    Normalized Order Line Items
                                  </h4>
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  Raw text: &ldquo;{order.rawProductName}&rdquo;
                                </div>
                              </div>

                              {/* Parsed Line Items Table */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                {order.lineItems.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-xs"
                                  >
                                    <div>
                                      <p className="font-bold text-foreground">
                                        {item.productName}
                                      </p>
                                      <span className="text-[11px] text-muted-foreground">
                                        SKU Size: <strong>{item.skuSize || item.packSize}</strong>
                                      </span>
                                    </div>
                                    <div className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                                      Qty: {item.quantity}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Coupon Codes Array & Diagnostics */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Tag className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                  <span className="text-muted-foreground font-medium">
                                    Coupon Codes ({order.couponCodes.length}):
                                  </span>
                                  {order.couponCodes.length > 0 ? (
                                    order.couponCodes.map((code, cIdx) => (
                                      <code
                                        key={cIdx}
                                        className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-foreground border border-border"
                                      >
                                        {code}
                                      </code>
                                    ))
                                  ) : (
                                    <span className="text-muted-foreground italic text-[11px]">
                                      No coupon codes recorded
                                    </span>
                                  )}
                                </div>

                                {order.locationMismatch && (
                                  <div className="flex items-center gap-1.5 text-amber-500 text-[11px] font-medium bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>
                                      Location Mismatch: Farmer ({order.farmerState}) ≠ Retailer (
                                      {order.retailerState})
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border/80 bg-card text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>orders per page</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-8 px-2.5 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 px-2.5 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
