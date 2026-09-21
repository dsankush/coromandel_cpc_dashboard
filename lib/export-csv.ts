import { NormalizedOrder, DashboardKPIs } from "@/types/order";
import { StateLevelMetric } from "@/lib/metrics-calc";

/**
 * Clean CSV escape helper: wraps in quotes if commas, quotes, or newlines exist.
 */
function escapeCSV(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Triggers a browser download of a CSV file.
 */
function downloadBlob(csvContent: string, fileName: string) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 1. FULL DATASET REPORT
 * Strictly excludes any UUID columns.
 */
export function exportFullReportCSV(orders: NormalizedOrder[]) {
  const headers = [
    "Purchase ID",
    "Order Date",
    "Status",
    "Total Units Purchased",
    "Retailer ID",
    "Retailer Name",
    "Retailer Location",
    "Retailer District",
    "Retailer State",
    "Retailer Pin Code",
    "Farmer Name",
    "Farmer Phone",
    "Farmer State",
    "Farmer District",
    "Farmer Crops",
    "Farmer Land (Acres)",
    "Products Purchased",
    "Retailer Approved Date",
  ];

  const rows = orders.map((o) => [
    escapeCSV(o.purchaseId),
    escapeCSV(o.createdAtStr),
    escapeCSV(o.status),
    escapeCSV(o.noProductPurchase),
    escapeCSV(o.retailerNo),
    escapeCSV(o.retailerName),
    escapeCSV(o.retailerLocation),
    escapeCSV(o.retailerDistrict),
    escapeCSV(o.retailerState),
    escapeCSV(o.retailerPinCode),
    escapeCSV(o.farmerName),
    escapeCSV(o.farmerNo),
    escapeCSV(o.farmerState),
    escapeCSV(o.farmerDistrict),
    escapeCSV(o.farmerCrops.join("; ")),
    escapeCSV(o.farmerLandRaw && o.farmerLandRaw.toUpperCase() !== "NULL" ? o.farmerLandRaw : ""),
    escapeCSV(o.rawProductName),
    escapeCSV(o.retailerApproveDateStr || ""),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(csv, `coromandel_cpc_full_analytics_report_${timestamp}.csv`);
}

/**
 * 2. OVERVIEW TAB REPORT
 * State-level and KPI performance breakdown. Zero UUIDs.
 */
export function exportOverviewReportCSV(kpis: DashboardKPIs, stateMetrics: StateLevelMetric[]) {
  const lines: string[] = [];

  // KPI Section
  lines.push("=== COROMANDEL CPC NETWORK OVERVIEW SUMMARY ===");
  lines.push(`Total Orders,${kpis.totalOrders}`);
  lines.push(`Approved Orders,${kpis.approvedOrders} (${kpis.approvedPercentage}%)`);
  lines.push(`Pending Orders,${kpis.pendingOrders} (${kpis.pendingPercentage}%)`);
  lines.push(`Rejected Orders,${kpis.rejectedOrders} (${kpis.rejectedPercentage}%)`);
  lines.push(`Total Units Sold,${kpis.totalUnitsSold}`);
  lines.push(`Unique Farmers,${kpis.uniqueFarmers}`);
  lines.push(`Active Retailers,${kpis.uniqueRetailers}`);
  lines.push(`Active States,${kpis.activeStatesCount ?? stateMetrics.length}`);
  lines.push("");

  // Geographic Breakdown Table
  lines.push("=== STATE-LEVEL VERIFICATION & DISTRIBUTION BREAKDOWN ===");
  const headers = [
    "State",
    "Total Orders",
    "Approved Orders",
    "Approval %",
    "Pending Orders",
    "Pending %",
    "Rejected Orders",
    "Rejected %",
    "Units Sold",
    "Unique Farmers",
    "Active Retailers",
  ];
  lines.push(headers.join(","));

  for (const s of stateMetrics) {
    lines.push(
      [
        escapeCSV(s.state),
        s.totalOrders,
        s.approvedOrders,
        `${s.approvedPercentage}%`,
        s.pendingOrders,
        `${s.pendingPercentage}%`,
        s.rejectedOrders,
        `${s.rejectedPercentage}%`,
        s.totalUnitsSold,
        s.uniqueFarmers,
        s.uniqueRetailers,
      ].join(",")
    );
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(lines.join("\n"), `coromandel_cpc_overview_report_${timestamp}.csv`);
}

/**
 * 3. ORDERS TAB REPORT
 * Filtered orders table data. Zero UUIDs.
 */
export function exportOrdersCSV(orders: NormalizedOrder[]) {
  const headers = [
    "Purchase ID",
    "Order Date",
    "Retailer Name",
    "Retailer District",
    "Retailer State",
    "Farmer Name",
    "Farmer Phone",
    "Farmer State",
    "Farmer District",
    "Crops",
    "Land (Acres)",
    "Status",
    "Units",
    "Products Purchased",
  ];

  const rows = orders.map((o) => [
    escapeCSV(o.purchaseId),
    escapeCSV(o.createdAtStr),
    escapeCSV(o.retailerName),
    escapeCSV(o.retailerDistrict),
    escapeCSV(o.retailerState),
    escapeCSV(o.farmerName),
    escapeCSV(o.farmerNo),
    escapeCSV(o.farmerState),
    escapeCSV(o.farmerDistrict),
    escapeCSV(o.farmerCrops.join("; ")),
    escapeCSV(o.farmerLandRaw && o.farmerLandRaw.toUpperCase() !== "NULL" ? o.farmerLandRaw : ""),
    escapeCSV(o.status),
    escapeCSV(o.noProductPurchase),
    escapeCSV(o.rawProductName),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(csv, `coromandel_cpc_orders_${timestamp}.csv`);
}

/**
 * 4. PRODUCTS TAB REPORT
 * Product and SKU Matrix breakdown. Zero UUIDs.
 */
export function exportProductsCSV(
  packSizeBreakdown: {
    productName: string;
    packSize: string;
    totalUnits: number;
    orderCount: number;
  }[]
) {
  const headers = ["Product Name", "Pack / SKU Size", "Total Units Sold", "Total Orders"];
  const rows = packSizeBreakdown.map((p) => [
    escapeCSV(p.productName),
    escapeCSV(p.packSize),
    p.totalUnits,
    p.orderCount,
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(csv, `coromandel_cpc_product_sku_matrix_${timestamp}.csv`);
}

/**
 * 5. RETAILERS TAB REPORT
 * Retailer Leaderboard and Performance. Zero UUIDs.
 */
export function exportRetailersCSV(
  leaderboard: {
    retailerNo: string;
    retailerName: string;
    state: string;
    district: string;
    totalOrders: number;
    totalUnits: number;
    approvedOrders: number;
    approvalRate: number;
    rejectedOrders: number;
  }[]
) {
  const headers = [
    "Rank",
    "Retailer ID",
    "Retailer Name",
    "State",
    "District",
    "Total Orders",
    "Units Sold",
    "Approved Orders",
    "Approval Rate (%)",
    "Rejected Orders",
  ];

  const rows = leaderboard.map((r, idx) => [
    idx + 1,
    escapeCSV(r.retailerNo),
    escapeCSV(r.retailerName),
    escapeCSV(r.state),
    escapeCSV(r.district),
    r.totalOrders,
    r.totalUnits,
    r.approvedOrders,
    `${r.approvalRate}%`,
    r.rejectedOrders,
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(csv, `coromandel_cpc_retailers_leaderboard_${timestamp}.csv`);
}

/**
 * 6. FARMERS TAB REPORT
 * Farmer Directory without any UUID. Zero UUIDs.
 */
export function exportFarmersCSV(
  farmers: {
    farmerName: string;
    farmerNo: string;
    state: string;
    district: string;
    crops: string[];
    landRaw: string;
    totalOrders: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    approvalRate: number;
    uniqueRetailersCount: number;
  }[]
) {
  const headers = [
    "Farmer Name",
    "Phone Number",
    "State",
    "District",
    "Crops",
    "Land (Acres)",
    "Total Orders",
    "Approved Orders",
    "Pending Orders",
    "Rejected Orders",
    "Approval Rate (%)",
    "Unique Retailers Count",
  ];

  const rows = farmers.map((f) => [
    escapeCSV(f.farmerName),
    escapeCSV(f.farmerNo),
    escapeCSV(f.state),
    escapeCSV(f.district),
    escapeCSV(f.crops.join("; ")),
    escapeCSV(f.landRaw && f.landRaw.toUpperCase() !== "NULL" ? f.landRaw : ""),
    f.totalOrders,
    f.approvedCount,
    f.pendingCount,
    f.rejectedCount,
    `${f.approvalRate}%`,
    f.uniqueRetailersCount,
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(csv, `coromandel_cpc_farmers_directory_${timestamp}.csv`);
}
