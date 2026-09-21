import {
  ApprovalStatus,
  DashboardKPIs,
  NormalizedOrder,
} from "@/types/order";

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
 * Computes high-level KPIs across the given normalized orders.
 */
export function calcKPIs(orders: NormalizedOrder[]): DashboardKPIs {
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
      activeStatesCount: 0,
      activeDistrictsCount: 0,
    };
  }

  let approvedOrders = 0;
  let pendingOrders = 0;
  let rejectedOrders = 0;
  let totalUnitsSold = 0;

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
  }

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
  };
}

/**
 * Aggregates orders per day stacked by status for time-series charts.
 */
export function calcTimeSeries(orders: NormalizedOrder[]) {
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
export function calcProductMetrics(orders: NormalizedOrder[]) {
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

      const pSize = item.packSize || item.skuSize || "Standard";
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
export function calcRetailerMetrics(orders: NormalizedOrder[]) {
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
      };
    }

    const r = retailerMap[key];
    r.totalOrders++;
    r.totalUnits += order.noProductPurchase;

    if (order.status === ApprovalStatus.Approved) r.approvedOrders++;
    else if (order.status === ApprovalStatus.Pending) r.pendingOrders++;
    else if (order.status === ApprovalStatus.Rejected) r.rejectedOrders++;

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

      return {
        ...r,
        approvalRate,
      };
    })
    .sort((a, b) => b.totalOrders - a.totalOrders);

  const stateChartData = Object.values(stateDistribution).sort((a, b) => b.count - a.count);

  return {
    leaderboard,
    stateChartData,
  };
}

/**
 * Aggregates state-level ongoing Approved, Pending, and Rejected order metrics for geographic mapping.
 */
export function calcStateMetrics(orders: NormalizedOrder[]): StateLevelMetric[] {
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
export function calcFarmerMetrics(orders: NormalizedOrder[]) {
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
