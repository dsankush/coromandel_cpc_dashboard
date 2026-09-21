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
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, Package, Layers, Sparkles, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { exportProductsCSV } from "@/lib/export-csv";

interface ProductsViewProps {
  topProducts: {
    productName: string;
    totalUnits: number;
    orderCount: number;
    packSizes: Record<string, { packSize: string; units: number; orders: number }>;
  }[];
  packSizeBreakdown: {
    productName: string;
    packSize: string;
    totalUnits: number;
    orderCount: number;
  }[];
}

const BAR_COLORS = [
  "#10b981", // Coromandel emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#f59e0b", // amber
  "#ec4899", // pink
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#84cc16", // lime
  "#f97316", // orange
];

export function ProductsView({ topProducts, packSizeBreakdown }: ProductsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredBreakdown = useMemo(() => {
    if (!searchTerm) return packSizeBreakdown;
    const q = searchTerm.toLowerCase();
    return packSizeBreakdown.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) || item.packSize.toLowerCase().includes(q)
    );
  }, [packSizeBreakdown, searchTerm]);

  const totalVolume = useMemo(() => {
    return topProducts.reduce((acc, p) => acc + p.totalUnits, 0);
  }, [topProducts]);

  return (
    <div className="space-y-6">
      {/* Top Products Volume Bar Chart */}
      <Card className="border-border/70 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="p-5 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Coromandel CPC Product Catalog by Volume
              </CardTitle>
              <CardDescription className="text-xs">
                Aggregated sales volume across all 10 official CPC portfolio brands
              </CardDescription>
            </div>
            <div className="text-xs text-muted-foreground bg-secondary/80 px-3 py-1.5 rounded-lg border border-border/50">
              Total Parsed Volume: <strong className="text-foreground">{formatNumber(totalVolume)} units</strong>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-3">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topProducts.slice(0, 10)}
                margin={{ top: 10, right: 20, left: 10, bottom: 25 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border) / 0.5)"
                />
                <XAxis
                  dataKey="productName"
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  axisLine={{ stroke: "hsl(var(--border) / 0.7)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} units`, "Units Sold"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="totalUnits" name="Units Sold" radius={[4, 4, 0, 0]}>
                  {topProducts.slice(0, 10).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Product × Pack Size Breakdown Table */}
      <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/30">
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              Product × SKU Size Matrix
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Unit volumes and order frequency across official catalog SKUs (ltr, ml, gm)
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search product or SKU size..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            <Button
              variant="default"
              size="sm"
              onClick={() => exportProductsCSV(filteredBreakdown)}
              className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              title="Download Product SKU Matrix as CSV (zero UUID columns)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Products (CSV)</span>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2.5 px-4 font-semibold">#</th>
                <th className="py-2.5 px-4 font-semibold">Product Name</th>
                <th className="py-2.5 px-4 font-semibold">SKU Size</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total Units Sold</th>
                <th className="py-2.5 px-4 font-semibold text-right">Order Occurrences</th>
                <th className="py-2.5 px-4 font-semibold text-right">Avg Units / Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    No matching product or pack size found.
                  </td>
                </tr>
              ) : (
                filteredBreakdown.map((item, idx) => {
                  const avgPerOrder =
                    item.orderCount > 0
                      ? (item.totalUnits / item.orderCount).toFixed(1)
                      : "0";
                  return (
                    <tr key={idx} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-2.5 px-4 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-bold text-foreground">
                        {item.productName}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {item.packSize}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-extrabold text-foreground">
                        {formatNumber(item.totalUnits)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground font-medium">
                        {formatNumber(item.orderCount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">
                        {avgPerOrder}
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
