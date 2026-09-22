import {
  AnomalyProfile,
  ApprovalStatus,
  DashboardKPIs,
  NormalizedOrder,
  ParsedLineItem,
} from "@/types/order";
import { readOrdersCSV } from "./parse";
import { getCachedOrders } from "./sync-api";

import { syncOrdersFromApi } from "./sync-api";

/**
 * Returns all normalized orders synchronously:
 * Checks active in-memory / synced cache first, falling back to CSV on disk.
 */
export function getOrders(): NormalizedOrder[] {
  const synced = getCachedOrders();
  if (synced && synced.length > 0) {
    return synced;
  }
  return readOrdersCSV();
}

/**
 * Asynchronously returns all normalized orders:
 * Checks cache first; if empty and CPC_API_KEY is present (e.g. on Vercel),
 * it fetches live from the API automatically on initial load, then falls back to CSV.
 */
export async function getOrdersAsync(): Promise<NormalizedOrder[]> {
  const cached = getCachedOrders();
  if (cached && cached.length > 0) {
    return cached;
  }

  if (process.env.CPC_API_KEY) {
    try {
      const syncResult = await syncOrdersFromApi();
      if (syncResult.success && syncResult.orders.length > 0) {
        return syncResult.orders;
      }
    } catch (err) {
      console.warn("[Data] Live fetch failed, falling back to CSV:", err);
    }
  }

  return readOrdersCSV();
}

/**
 * Returns flattened list of all line items with associated order metadata.
 */
export function getOrderLineItems(): (ParsedLineItem & {
  purchaseId: string;
  farmerName: string;
  retailerName: string;
  retailerState: string;
  status: ApprovalStatus;
  createdAt: Date;
})[] {
  const orders = getOrders();
  const items: (ParsedLineItem & {
    purchaseId: string;
    farmerName: string;
    retailerName: string;
    retailerState: string;
    status: ApprovalStatus;
    createdAt: Date;
  })[] = [];

  for (const order of orders) {
    for (const item of order.lineItems) {
      items.push({
        ...item,
        purchaseId: order.purchaseId,
        farmerName: order.farmerName,
        retailerName: order.retailerName,
        retailerState: order.retailerState,
        status: order.status,
        createdAt: order.createdAt,
      });
    }
  }

  return items;
}

/**
 * Computes high-level KPIs across the entire order dataset.
 */
export function getKPIs(ordersList?: NormalizedOrder[]): DashboardKPIs {
  const orders = ordersList || getOrders();
  const totalOrders = orders.length;

  if (totalOrders === 0) {
    return {
      totalOrders: 0,
      approvedOrders: 0,
      pendingOrders: 0,
      rejectedOrders: 0,
      approvedPercentage: 0,
      pendingPercentage: 0,
      rejectedPercentage: 0,
      totalUnitsSold: 0,
      uniqueFarmers: 0,
      uniqueRetailers: 0,
      avgApprovalLatencyHours: 0,
      locationMismatchCount: 0,
      locationMismatchPercentage: 0,
      totalFlaggedFarmers: 0,
    };
  }

  let approvedOrders = 0;
  let pendingOrders = 0;
  let rejectedOrders = 0;
  let totalUnitsSold = 0;
  let totalLatencyHours = 0;
  let latencyCount = 0;
  let locationMismatchCount = 0;

  const uniqueFarmers = new Set<string>();
  const uniqueRetailers = new Set<string>();
  const uniqueStates = new Set<string>();
  const uniqueDistricts = new Set<string>();

  for (const order of orders) {
    if (order.status === ApprovalStatus.Approved) approvedOrders++;
    else if (order.status === ApprovalStatus.Pending) pendingOrders++;
    else if (order.status === ApprovalStatus.Rejected) rejectedOrders++;

    if (order.farmerUuid) uniqueFarmers.add(order.farmerUuid);
    else if (order.farmerNo) uniqueFarmers.add(order.farmerNo);

    if (order.retailerNo) uniqueRetailers.add(order.retailerNo);
    else if (order.retailerName) uniqueRetailers.add(order.retailerName);

    if (order.retailerState) uniqueStates.add(order.retailerState);
    else if (order.farmerState) uniqueStates.add(order.farmerState);

    if (order.retailerDistrict) uniqueDistricts.add(order.retailerDistrict);
    else if (order.farmerDistrict) uniqueDistricts.add(order.farmerDistrict);

    totalUnitsSold += order.noProductPurchase;

    if (order.approvalLatencyHours !== null) {
      totalLatencyHours += order.approvalLatencyHours;
      latencyCount++;
    }

    if (order.locationMismatch) {
      locationMismatchCount++;
    }
  }

  const watchlist = getWatchlist(orders);

  return {
    totalOrders,
    approvedOrders,
    pendingOrders,
    rejectedOrders,
    approvedPercentage: Math.round((approvedOrders / totalOrders) * 1000) / 10,
    pendingPercentage: Math.round((pendingOrders / totalOrders) * 1000) / 10,
    rejectedPercentage: Math.round((rejectedOrders / totalOrders) * 1000) / 10,
    totalUnitsSold,
    uniqueFarmers: uniqueFarmers.size,
    uniqueRetailers: uniqueRetailers.size,
    activeStatesCount: uniqueStates.size,
    activeDistrictsCount: uniqueDistricts.size,
    avgApprovalLatencyHours:
      latencyCount > 0 ? Math.round((totalLatencyHours / latencyCount) * 10) / 10 : 0,
    locationMismatchCount,
    locationMismatchPercentage: Math.round((locationMismatchCount / totalOrders) * 1000) / 10,
    totalFlaggedFarmers: watchlist.length,
  };
}

/**
 * Aggregates orders per day stacked by status for time-series charts.
 */
export function getTimeSeriesData(ordersList?: NormalizedOrder[]) {
  const orders = ordersList || getOrders();
  const dailyMap: Record<
    string,
    { date: string; approved: number; pending: number; rejected: number; total: number }
  > = {};

  for (const order of orders) {
    if (!order.createdAt) continue;
    const dateKey = order.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        date: dateKey,
        approved: 0,
        pending: 0,
        rejected: 0,
        total: 0,
      };
    }

    if (order.status === ApprovalStatus.Approved) dailyMap[dateKey].approved++;
    else if (order.status === ApprovalStatus.Pending) dailyMap[dateKey].pending++;
    else if (order.status === ApprovalStatus.Rejected) dailyMap[dateKey].rejected++;

    dailyMap[dateKey].total++;
  }

  return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Computes product metrics: top products by volume and pack size breakdown.
 */
export function getProductMetrics(ordersList?: NormalizedOrder[]) {
  const orders = ordersList || getOrders();
  const productAgg: Record<
    string,
    {
      productName: string;
      totalUnits: number;
      orderCount: number;
      packSizes: Record<string, { packSize: string; units: number; orders: number }>;
    }
  > = {};

  for (const order of orders) {
    const seenProductsInOrder = new Set<string>();

    for (const item of order.lineItems) {
      const name = item.productName || "Unknown Product";
      if (!productAgg[name]) {
        productAgg[name] = {
          productName: name,
          totalUnits: 0,
          orderCount: 0,
          packSizes: {},
        };
      }

      productAgg[name].totalUnits += item.quantity;
      if (!seenProductsInOrder.has(name)) {
        productAgg[name].orderCount++;
        seenProductsInOrder.add(name);
      }

      const pSize = item.packSize || "Standard";
      if (!productAgg[name].packSizes[pSize]) {
        productAgg[name].packSizes[pSize] = {
          packSize: pSize,
          units: 0,
          orders: 0,
        };
      }
      productAgg[name].packSizes[pSize].units += item.quantity;
      productAgg[name].packSizes[pSize].orders++;
    }
  }

  const productList = Object.values(productAgg).sort((a, b) => b.totalUnits - a.totalUnits);

  const packSizeBreakdown: {
    productName: string;
    packSize: string;
    totalUnits: number;
    orderCount: number;
  }[] = [];

  for (const prod of productList) {
    for (const ps of Object.values(prod.packSizes)) {
      packSizeBreakdown.push({
        productName: prod.productName,
        packSize: ps.packSize,
        totalUnits: ps.units,
        orderCount: ps.orders,
      });
    }
  }

  return {
    topProducts: productList.slice(0, 10),
    allProducts: productList,
    packSizeBreakdown: packSizeBreakdown.sort((a, b) => b.totalUnits - a.totalUnits),
  };
}

/**
 * Computes retailer performance leaderboard and geographic spread.
 */
export function getRetailerMetrics(ordersList?: NormalizedOrder[]) {
  const orders = ordersList || getOrders();
  const retailerMap: Record<
    string,
    {
      retailerNo: string;
      retailerName: string;
      state: string;
      district: string;
      totalOrders: number;
      approvedOrders: number;
      pendingOrders: number;
      rejectedOrders: number;
      totalUnits: number;
      totalLatencyHours: number;
      latencyOrderCount: number;
    }
  > = {};

  const stateDistribution: Record<string, { state: string; count: number; approved: number }> = {};

  for (const order of orders) {
    const key = order.retailerNo || order.retailerName || "Unknown";
    if (!retailerMap[key]) {
      retailerMap[key] = {
        retailerNo: order.retailerNo,
        retailerName: order.retailerName || "Unknown Retailer",
        state: order.retailerState || "Unknown State",
        district: order.retailerDistrict || "Unknown District",
        totalOrders: 0,
        approvedOrders: 0,
        pendingOrders: 0,
        rejectedOrders: 0,
        totalUnits: 0,
        totalLatencyHours: 0,
        latencyOrderCount: 0,
      };
    }

    const r = retailerMap[key];
    r.totalOrders++;
    r.totalUnits += order.noProductPurchase;

    if (order.status === ApprovalStatus.Approved) r.approvedOrders++;
    else if (order.status === ApprovalStatus.Pending) r.pendingOrders++;
    else if (order.status === ApprovalStatus.Rejected) r.rejectedOrders++;

    if (order.approvalLatencyHours !== null) {
      r.totalLatencyHours += order.approvalLatencyHours;
      r.latencyOrderCount++;
    }

    const st = order.retailerState || "Unknown";
    if (!stateDistribution[st]) {
      stateDistribution[st] = { state: st, count: 0, approved: 0 };
    }
    stateDistribution[st].count++;
    if (order.status === ApprovalStatus.Approved) stateDistribution[st].approved++;
  }

  const leaderboard = Object.values(retailerMap)
    .map((r) => {
      const approvalRate =
        r.totalOrders > 0 ? Math.round((r.approvedOrders / r.totalOrders) * 1000) / 10 : 0;
      const avgLatencyHours =
        r.latencyOrderCount > 0
          ? Math.round((r.totalLatencyHours / r.latencyOrderCount) * 10) / 10
          : 0;

      return {
        ...r,
        approvalRate,
        avgLatencyHours,
      };
    })
    .sort((a, b) => b.totalOrders - a.totalOrders);

  const stateChartData = Object.values(stateDistribution).sort((a, b) => b.count - a.count);

  return {
    leaderboard,
    stateChartData,
  };
}

export interface StateLevelMetric {
  state: string;
  totalOrders: number;
  approvedOrders: number;
  pendingOrders: number;
  rejectedOrders: number;
  approvedPercentage: number;
  pendingPercentage: number;
  rejectedPercentage: number;
  totalUnitsSold: number;
  uniqueFarmers: number;
  uniqueRetailers: number;
}

/**
 * Aggregates state-level ongoing Approved, Pending, and Rejected order metrics for geographic mapping.
 */
export function getStateLevelMetrics(ordersList?: NormalizedOrder[]): StateLevelMetric[] {
  const orders = ordersList || getOrders();
  const stateMap: Record<
    string,
    {
      state: string;
      totalOrders: number;
      approvedOrders: number;
      pendingOrders: number;
      rejectedOrders: number;
      totalUnitsSold: number;
      farmers: Set<string>;
      retailers: Set<string>;
    }
  > = {};

  for (const order of orders) {
    const st = order.retailerState || order.farmerState || "Other";
    if (!stateMap[st]) {
      stateMap[st] = {
        state: st,
        totalOrders: 0,
        approvedOrders: 0,
        pendingOrders: 0,
        rejectedOrders: 0,
        totalUnitsSold: 0,
        farmers: new Set(),
        retailers: new Set(),
      };
    }

    const s = stateMap[st];
    s.totalOrders++;
    s.totalUnitsSold += order.noProductPurchase;

    if (order.status === ApprovalStatus.Approved) s.approvedOrders++;
    else if (order.status === ApprovalStatus.Pending) s.pendingOrders++;
    else if (order.status === ApprovalStatus.Rejected) s.rejectedOrders++;

    if (order.farmerUuid) s.farmers.add(order.farmerUuid);
    else if (order.farmerNo) s.farmers.add(order.farmerNo);

    if (order.retailerNo) s.retailers.add(order.retailerNo);
    else if (order.retailerName) s.retailers.add(order.retailerName);
  }

  return Object.values(stateMap)
    .map((s) => ({
      state: s.state,
      totalOrders: s.totalOrders,
      approvedOrders: s.approvedOrders,
      pendingOrders: s.pendingOrders,
      rejectedOrders: s.rejectedOrders,
      approvedPercentage:
        s.totalOrders > 0 ? Math.round((s.approvedOrders / s.totalOrders) * 1000) / 10 : 0,
      pendingPercentage:
        s.totalOrders > 0 ? Math.round((s.pendingOrders / s.totalOrders) * 1000) / 10 : 0,
      rejectedPercentage:
        s.totalOrders > 0 ? Math.round((s.rejectedOrders / s.totalOrders) * 1000) / 10 : 0,
      totalUnitsSold: s.totalUnitsSold,
      uniqueFarmers: s.farmers.size,
      uniqueRetailers: s.retailers.size,
    }))
    .sort((a, b) => b.totalOrders - a.totalOrders);
}

/**
 * Computes farmer metrics and profiles.
 */
export function getFarmerMetrics(ordersList?: NormalizedOrder[]) {
  const orders = ordersList || getOrders();
  const farmerMap: Record<
    string,
    {
      farmerUuid: string;
      farmerName: string;
      farmerNo: string;
      state: string;
      district: string;
      crops: Set<string>;
      landAcres: number | null;
      landRaw: string;
      totalOrders: number;
      approvedCount: number;
      pendingCount: number;
      rejectedCount: number;
      retailers: Set<string>;
      orders: NormalizedOrder[];
    }
  > = {};

  for (const order of orders) {
    const key = order.farmerUuid || order.farmerNo || order.farmerName;
    if (!farmerMap[key]) {
      farmerMap[key] = {
        farmerUuid: order.farmerUuid,
        farmerName: order.farmerName || "Unknown Farmer",
        farmerNo: order.farmerNo,
        state: order.farmerState,
        district: order.farmerDistrict,
        crops: new Set<string>(),
        landAcres: order.farmerLandAcres,
        landRaw: order.farmerLandRaw,
        totalOrders: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        retailers: new Set<string>(),
        orders: [],
      };
    }

    const f = farmerMap[key];
    f.totalOrders++;
    if (order.status === ApprovalStatus.Approved) f.approvedCount++;
    else if (order.status === ApprovalStatus.Pending) f.pendingCount++;
    else if (order.status === ApprovalStatus.Rejected) f.rejectedCount++;

    for (const crop of order.farmerCrops) {
      f.crops.add(crop);
    }
    if (order.retailerName) {
      f.retailers.add(order.retailerName);
    }
    f.orders.push(order);
  }

  return Object.values(farmerMap)
    .map((f) => ({
      farmerUuid: f.farmerUuid,
      farmerName: f.farmerName,
      farmerNo: f.farmerNo,
      state: f.state,
      district: f.district,
      crops: Array.from(f.crops),
      landAcres: f.landAcres,
      landRaw: f.landRaw,
      totalOrders: f.totalOrders,
      approvedCount: f.approvedCount,
      pendingCount: f.pendingCount,
      rejectedCount: f.rejectedCount,
      approvalRate:
        f.totalOrders > 0 ? Math.round((f.approvedCount / f.totalOrders) * 1000) / 10 : 0,
      uniqueRetailersCount: f.retailers.size,
      orders: f.orders,
    }))
    .sort((a, b) => b.totalOrders - a.totalOrders);
}

/**
 * Dedicated Anomaly / Data Quality Engine:
 * Flags suspicious patterns computed from the live data:
 * 1. Multi-retailer / multi-state hopping in short time window.
 * 2. 100% Pending or Rejected rate (zero approvals).
 * 3. Dummy / test account fingerprint: Null/Unknown crop but unusually precise/repeated land size (e.g. 0.4125).
 * 4. Extreme location mismatch (farmer vs retailer state).
 */
export function getWatchlist(ordersList?: NormalizedOrder[]): AnomalyProfile[] {
  const orders = ordersList || getOrders();
  const farmerProfiles = getFarmerMetrics(orders);

  // Analyze land frequencies where crop is empty to find artificial repeated land values
  const nullCropLandCounts: Record<string, number> = {};
  for (const f of farmerProfiles) {
    if (f.crops.length === 0 && f.landRaw && f.landRaw.toUpperCase() !== "NULL") {
      nullCropLandCounts[f.landRaw] = (nullCropLandCounts[f.landRaw] || 0) + 1;
    }
  }

  const flagged: AnomalyProfile[] = [];

  for (const farmer of farmerProfiles) {
    const flagReasons: string[] = [];
    let riskScore = 0;

    // Check Anomaly 1: Multi-retailer / Multi-State Velocity (Serious)
    const retailerStates = new Set<string>();
    const retailerIds = new Set<string>();
    let mismatchCount = 0;

    for (const ord of farmer.orders) {
      if (ord.retailerState) retailerStates.add(ord.retailerState.toLowerCase().trim());
      if (ord.retailerNo) retailerIds.add(ord.retailerNo);
      if (ord.locationMismatch) mismatchCount++;
    }

    const multiRetailerVelocity =
      retailerIds.size >= 3 || (retailerIds.size >= 2 && retailerStates.size >= 2);

    if (multiRetailerVelocity) {
      flagReasons.push(
        `Multi-Retailer / Multi-State Hopping: Ordered through ${retailerIds.size} retailers across ${retailerStates.size} states`
      );
      riskScore += 45;
    }

    // Check Anomaly 2: Zero Approval Pattern (Must have at least 2 orders)
    const zeroApprovalPattern =
      farmer.totalOrders >= 2 &&
      farmer.approvedCount === 0 &&
      farmer.pendingCount + farmer.rejectedCount >= 2;

    if (zeroApprovalPattern) {
      const isHighRejection = farmer.rejectedCount >= 1;
      flagReasons.push(
        `Zero Approval History: ${farmer.totalOrders} total orders with 0 Approved (${farmer.rejectedCount} Rejected, ${farmer.pendingCount} Pending)`
      );
      riskScore += isHighRejection ? 35 : 25;
    }

    // Check Anomaly 3: Dummy / Test Account Fingerprint
    // farmer_crop is null/empty AND farmer_land is unusually precise (>= 3 decimals, e.g. 0.4125) OR repeated non-zero value across 3+ accounts
    const decimals = farmer.landRaw.includes(".") ? farmer.landRaw.split(".")[1]?.length || 0 : 0;
    const isNonZeroLand = farmer.landRaw !== "" && farmer.landRaw !== "0" && farmer.landRaw !== "0.0" && Number(farmer.landRaw) > 0;
    const isSyntheticLandValue =
      farmer.crops.length === 0 &&
      isNonZeroLand &&
      farmer.landRaw.toUpperCase() !== "NULL" &&
      (decimals >= 3 || (nullCropLandCounts[farmer.landRaw] && nullCropLandCounts[farmer.landRaw] >= 3));

    if (isSyntheticLandValue) {
      flagReasons.push(
        `Dummy Account Fingerprint: Unregistered crop (NULL) paired with suspicious land figure "${farmer.landRaw}"`
      );
      riskScore += 35;
    }

    // Check Anomaly 4: High Cross-State Location Mismatch (Only if >= 2 orders or cross-state hopping)
    const highLocationMismatch =
      farmer.orders.length >= 2 && mismatchCount === farmer.orders.length && retailerStates.size > 1;

    if (highLocationMismatch && !multiRetailerVelocity) {
      flagReasons.push(
        `Consistent Cross-Region Mismatch: All ${farmer.orders.length} orders placed outside registered district/state`
      );
      riskScore += 25;
    }

    // Only add to watchlist if at least one meaningful anomaly rule triggered and riskScore >= 25
    if (flagReasons.length > 0 && riskScore >= 25) {
      flagged.push({
        farmerUuid: farmer.farmerUuid || farmer.farmerNo || "Unknown",
        farmerName: farmer.farmerName,
        farmerNo: farmer.farmerNo,
        farmerState: farmer.state,
        farmerDistrict: farmer.district,
        totalOrders: farmer.totalOrders,
        approvedCount: farmer.approvedCount,
        pendingCount: farmer.pendingCount,
        rejectedCount: farmer.rejectedCount,
        uniqueRetailersCount: retailerIds.size,
        uniqueStatesCount: retailerStates.size,
        crops: farmer.crops,
        farmerLandRaw: farmer.landRaw,
        riskScore: Math.min(100, riskScore),
        flagReasons,
        anomalies: {
          multiRetailerVelocity,
          zeroApprovalPattern,
          dummyAccountFingerprint: Boolean(isSyntheticLandValue),
          highLocationMismatch,
        },
        sampleOrders: farmer.orders,
      });
    }
  }

  return flagged.sort((a, b) => b.riskScore - a.riskScore || b.totalOrders - a.totalOrders);
}

/**
 * Returns unique filter options derived from current data.
 */
export function getFilterOptions(ordersList?: NormalizedOrder[]) {
  const orders = ordersList || getOrders();
  const states = new Set<string>();
  const districts = new Set<string>();
  const retailers = new Set<string>();
  const crops = new Set<string>();

  for (const o of orders) {
    if (o.retailerState) states.add(o.retailerState);
    if (o.retailerDistrict) districts.add(o.retailerDistrict);
    if (o.retailerName) retailers.add(o.retailerName);
    for (const c of o.farmerCrops) {
      crops.add(c);
    }
  }

  return {
    states: Array.from(states).sort(),
    districts: Array.from(districts).sort(),
    retailers: Array.from(retailers).sort(),
    crops: Array.from(crops).sort(),
  };
}
