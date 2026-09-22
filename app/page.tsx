import {
  getOrdersAsync,
  getKPIs,
  getTimeSeriesData,
  getProductMetrics,
  getRetailerMetrics,
  getFarmerMetrics,
  getWatchlist,
  getStateLevelMetrics,
} from "@/lib/data";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

// Ensure Next.js always re-evaluates at request time so committed CSV updates reflect instantly
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const orders = await getOrdersAsync();
  const kpis = getKPIs(orders);
  const timeSeries = getTimeSeriesData(orders);
  const products = getProductMetrics(orders);
  const retailers = getRetailerMetrics(orders);
  const farmers = getFarmerMetrics(orders);
  const watchlist = getWatchlist(orders);
  const stateMetrics = getStateLevelMetrics(orders);

  return (
    <DashboardClient
      initialOrders={orders}
      initialKPIs={kpis}
      initialTimeSeries={timeSeries}
      initialProducts={products}
      initialRetailers={retailers}
      initialFarmers={farmers.slice(0, 150)} // Top 150 farmers for fast initial render
      initialWatchlist={watchlist}
      initialStateMetrics={stateMetrics}
      initialTimestamp={new Date().toISOString()}
    />
  );
}
