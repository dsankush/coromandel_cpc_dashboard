import { NextRequest, NextResponse } from "next/server";
import {
  getKPIs,
  getTimeSeriesData,
  getProductMetrics,
  getRetailerMetrics,
  getFarmerMetrics,
  getWatchlist,
  getOrders,
  getStateLevelMetrics,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let orders = getOrders();

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        orders = orders.filter((o) => o.createdAt >= start);
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        orders = orders.filter((o) => o.createdAt <= end);
      }
    }

    const kpis = getKPIs(orders);
    const timeSeries = getTimeSeriesData(orders);
    const productMetrics = getProductMetrics(orders);
    const retailerMetrics = getRetailerMetrics(orders);
    const farmerMetrics = getFarmerMetrics(orders);
    const watchlist = getWatchlist(orders);
    const stateMetrics = getStateLevelMetrics(orders);

    return NextResponse.json({
      kpis,
      timeSeries,
      products: productMetrics,
      retailers: retailerMetrics,
      farmers: farmerMetrics.slice(0, 100), // Top 100 farmers for view
      watchlist,
      stateMetrics,
      totalOrders: orders.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("API error calculating metrics:", error);
    return NextResponse.json({ error: "Failed to compute dashboard metrics" }, { status: 500 });
  }
}
