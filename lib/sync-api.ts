import fs from "fs";
import path from "path";
import {
  NormalizedOrder,
  ParsedLineItem,
  ApiFarmerReportRecord,
  SyncStatus,
} from "@/types/order";
import {
  mapApprovalStatus,
  parseDate,
  computeApprovalLatencyHours,
  parseFarmerCrops,
  parseCouponCodes,
  formatStateName,
  isLocationMismatch,
} from "./parse";
import { isBlockedPhoneNumber } from "./blocked-numbers";

// In-memory cache for live serverless execution
let memoryCachedOrders: NormalizedOrder[] | null = null;
let currentSyncStatus: SyncStatus = {
  lastSyncedAt: null,
  totalRecords: 0,
  status: "idle",
};

const TMP_CACHE_FILE = path.join("/tmp", "cpc_synced_orders.json");
const TMP_STATUS_FILE = path.join("/tmp", "cpc_sync_status.json");
const LOCAL_CSV_FILE = path.join(process.cwd(), "data", "orders.csv");

/**
 * Normalizes an API farmer report record into the dashboard NormalizedOrder model.
 */
export function normalizeApiRecord(
  rec: ApiFarmerReportRecord,
  index: number
): NormalizedOrder {
  const { code, status } = mapApprovalStatus(rec.Retailer_Approval_Status);
  const createdAt = parseDate(rec.Date_of_Entry) || new Date();
  const retailerApproveDate = parseDate(rec.Approval_Timestamp);
  const latencyHours = computeApprovalLatencyHours(createdAt, retailerApproveDate);

  const farmerCrops = parseFarmerCrops(rec["Farmer Crops_Selected"]);
  const couponCodes = parseCouponCodes(rec.Coupon_Code);

  const farmerLandRaw = (rec["Farmer Land_Acreage"] ?? "").trim();
  const farmerLandAcres =
    farmerLandRaw && farmerLandRaw.toUpperCase() !== "NULL" && !isNaN(Number(farmerLandRaw))
      ? Number(farmerLandRaw)
      : null;

  const farmerState = formatStateName(rec["Farmer State"]);
  const retailerState = formatStateName(rec["Farmer State"]); // API doesn't provide distinct retailer state, default to farmerState
  const farmerDistrict = (rec["Farmer District"] ?? "").trim();
  const retailerDistrict = farmerDistrict;

  // Process structured products list from API
  const lineItems: ParsedLineItem[] = [];
  if (Array.isArray(rec.products) && rec.products.length > 0) {
    for (const p of rec.products) {
      if (!p || !p.product_name) continue;
      const qty = parseInt(String(p.product_quantity), 10) || 1;
      const size = (p.product_size || "").trim();
      const name = (p.product_name || "").trim();
      lineItems.push({
        productName: name,
        skuSize: size,
        packSize: size,
        quantity: qty,
        rawString: `${name} ${size} ${qty}`.trim(),
      });
    }
  }

  const rawProductName = lineItems
    .map((item) => `${item.productName} ${item.skuSize} ${item.quantity}`.trim())
    .join(", ");

  const totalUnits = lineItems.reduce((acc, item) => acc + item.quantity, 0);

  const purchaseId = String(rec.Order_ID || `API-${index + 1}`).trim();
  const rin = String(rec.RIN || "").trim();

  return {
    id: purchaseId,
    purchaseId,
    retailerNo: rin,
    retailerName: (rec.Retailer_Name ?? "").trim(),
    retailerLocation: farmerDistrict,
    retailerShortCode: rin,
    retailerLocaleCode: (rec.Language_Selected ?? "").trim(),
    retailerDistrict,
    retailerState,
    retailerAddress: "",
    retailerPinCode: (rec["Farmer Pincode"] ?? "").trim(),
    farmerNo: (rec.Farmer_Mobile_Number ?? "").trim(),
    farmerName: (rec.Farmer_Name ?? "").trim(),
    farmerUuid: `${rec.Farmer_Mobile_Number || "farmer"}-${index}`,
    farmerState,
    farmerDistrict,
    farmerCrops,
    farmerLandAcres,
    farmerLandRaw,
    deliveryAddress: [farmerDistrict, farmerState].filter(Boolean).join(", "),
    statusCode: code,
    status,
    retailerApproveDate,
    retailerApproveDateStr: rec.Approval_Timestamp ? rec.Approval_Timestamp.trim() : null,
    noProductPurchase: totalUnits > 0 ? totalUnits : 1,
    waStatus: rec.Submission_Status === 0 ? "read" : "delivered",
    couponCodes,
    createdAt,
    createdAtStr: rec.Date_of_Entry ? rec.Date_of_Entry.trim() : "",
    approvalLatencyHours: latencyHours,
    locationMismatch: isLocationMismatch(
      farmerState,
      farmerDistrict,
      retailerState,
      retailerDistrict
    ),
    lineItems,
    rawProductName,
  };
}

/**
 * Escapes CSV values safely according to RFC 4180.
 */
function toCsvValue(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes normalized orders to standard CSV format.
 */
export function exportOrdersToCsvString(orders: NormalizedOrder[]): string {
  const headers = [
    "retailer_no",
    "retailer_name",
    "retailer_location",
    "retailer_short_code",
    "retailer_locale_code",
    "retailer_district",
    "retailer_state",
    "retailer_address",
    "retailer_pin_code",
    "farmer_no",
    "farmer_name",
    "farmer_uuid",
    "farmer_state",
    "farmer_district",
    "farmer_crop",
    "farmer_land",
    "address",
    "purchase_id",
    "product1_name",
    "is_approve_by_retailer",
    "retailer_approve_date",
    "no_product_purchase",
    "wa_status",
    "coupon_code",
    "created_at",
  ];

  const rows = orders.map((o) => [
    toCsvValue(o.retailerNo),
    toCsvValue(o.retailerName),
    toCsvValue(o.retailerLocation),
    toCsvValue(o.retailerShortCode),
    toCsvValue(o.retailerLocaleCode),
    toCsvValue(o.retailerDistrict),
    toCsvValue(o.retailerState),
    toCsvValue(o.retailerAddress),
    toCsvValue(o.retailerPinCode),
    toCsvValue(o.farmerNo),
    toCsvValue(o.farmerName),
    toCsvValue(o.farmerUuid),
    toCsvValue(o.farmerState),
    toCsvValue(o.farmerDistrict),
    toCsvValue(o.farmerCrops.join(",")),
    toCsvValue(o.farmerLandRaw),
    toCsvValue(o.deliveryAddress),
    toCsvValue(o.purchaseId),
    toCsvValue(o.rawProductName),
    toCsvValue(o.statusCode),
    toCsvValue(o.retailerApproveDateStr || ""),
    toCsvValue(o.noProductPurchase),
    toCsvValue(o.waStatus),
    toCsvValue(o.couponCodes.join(",")),
    toCsvValue(o.createdAtStr),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Fetches all orders from the external CPC WhatsApp Report API with batch pagination.
 */
/**
 * Fetches latest orders from the external CPC WhatsApp Report API.
 * Uses fast reverse delta pagination (fetches latest pages first) to complete
 * in under 5 seconds without triggering Vercel serverless timeouts.
 */
export async function syncOrdersFromApi(): Promise<{
  success: boolean;
  orders: NormalizedOrder[];
  total: number;
  error?: string;
}> {
  const apiUrl =
    process.env.CPC_API_URL ||
    "https://wa-dashboard.digicides.in/whatsapp/api/cpc/report/farmer";
  const apiKey = process.env.CPC_API_KEY;

  if (!apiKey) {
    const msg = "CPC_API_KEY is not configured in environment variables";
    console.warn(`[Sync] ${msg}`);
    return { success: false, orders: [], total: 0, error: msg };
  }

  currentSyncStatus = {
    ...currentSyncStatus,
    status: "syncing",
  };

  try {
    // 1. Fetch metadata in <2s with per_page=1 to get live total & last_page
    console.log(`[Sync] Checking live API metadata...`);
    const metaRes = await fetch(`${apiUrl}?pagination=true&page=1&per_page=1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    if (!metaRes.ok) {
      throw new Error(`API returned HTTP ${metaRes.status}: ${metaRes.statusText}`);
    }

    const metaJson = await metaRes.json();
    if (!metaJson || metaJson.code !== 200 || !metaJson.data) {
      throw new Error(`Invalid API response: ${metaJson?.message || "Unknown error"}`);
    }

    const totalRecordsInApi = Number(metaJson.data.total) || 0;
    const perPage = 250;
    const lastPage = Math.ceil(totalRecordsInApi / perPage) || 1;

    console.log(`[Sync] API reports ${totalRecordsInApi} total records across ~${lastPage} pages.`);

    // 2. Load existing base orders from cache or disk
    const existingOrders = getCachedOrders() || [];
    const orderMap = new Map<string, NormalizedOrder>();
    for (const ord of existingOrders) {
      orderMap.set(ord.purchaseId, ord);
    }

    // 3. Reverse delta fetch: only fetch the newest 2 pages (most recent ~500 orders)
    // This completes in 3-5 seconds, safely under Vercel's 10-15s limit
    const pagesToFetch = Array.from(
      new Set([lastPage, Math.max(1, lastPage - 1)])
    );

    console.log(`[Sync] Fetching newest pages [${pagesToFetch.join(", ")}]...`);
    const newRecords: ApiFarmerReportRecord[] = [];

    for (const pageIdx of pagesToFetch) {
      try {
        const pageUrl = `${apiUrl}?pagination=true&page=${pageIdx}&per_page=${perPage}`;
        const pRes = await fetch(pageUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({}),
          cache: "no-store",
        });

        if (pRes.ok) {
          const pJson = await pRes.json();
          if (pJson?.data?.records && Array.isArray(pJson.data.records)) {
            newRecords.push(...pJson.data.records);
          }
        }
      } catch (pageErr) {
        console.warn(`[Sync] Page ${pageIdx} fetch failed:`, pageErr);
      }
    }

    console.log(`[Sync] Retrieved ${newRecords.length} recent records from live API.`);

    // 4. Normalize and filter (drop Gujarat and test numbers)
    const cleanNew = newRecords
      .map((r, i) => normalizeApiRecord(r, i))
      .filter(
        (o) =>
          (o.farmerState || "").toLowerCase() !== "gujarat" &&
          (o.retailerState || "").toLowerCase() !== "gujarat" &&
          !isBlockedPhoneNumber(o.farmerNo) &&
          !isBlockedPhoneNumber(o.retailerNo)
      );

    // 5. Merge into existing orders dictionary
    for (const ord of cleanNew) {
      orderMap.set(ord.purchaseId, ord);
    }

    const merged = Array.from(orderMap.values());
    merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Update memory cache
    memoryCachedOrders = merged;
    currentSyncStatus = {
      lastSyncedAt: new Date().toISOString(),
      totalRecords: merged.length,
      status: "success",
    };

    // Save to /tmp for serverless persistence across executions
    try {
      fs.writeFileSync(
        TMP_CACHE_FILE,
        JSON.stringify(merged, (key, value) => {
          if (value instanceof Date) return value.toISOString();
          return value;
        }),
        "utf-8"
      );
      fs.writeFileSync(TMP_STATUS_FILE, JSON.stringify(currentSyncStatus), "utf-8");
    } catch (e) {
      console.warn("[Sync] Failed to write /tmp cache:", e);
    }

    // If local development and writable, also refresh data/orders.csv
    try {
      if (fs.existsSync(path.dirname(LOCAL_CSV_FILE))) {
        const csvContent = exportOrdersToCsvString(merged);
        fs.writeFileSync(LOCAL_CSV_FILE, csvContent, "utf-8");
        console.log(`[Sync] Updated local CSV file: ${LOCAL_CSV_FILE}`);
      }
    } catch (e) {
      // Local CSV update skipped in read-only environment
    }

    return {
      success: true,
      orders: merged,
      total: merged.length,
    };
  } catch (error: any) {
    const errorMsg = error?.message || "Sync failed";
    console.error(`[Sync Error] ${errorMsg}`);
    currentSyncStatus = {
      ...currentSyncStatus,
      status: "error",
      errorMessage: errorMsg,
    };

    const fallbackOrders = getCachedOrders() || [];
    return {
      success: false,
      orders: fallbackOrders,
      total: fallbackOrders.length,
      error: errorMsg,
    };
  }
}

/**
 * Returns current memory or /tmp cached orders if available.
 */
export function getCachedOrders(): NormalizedOrder[] | null {
  if (memoryCachedOrders && memoryCachedOrders.length > 0) {
    return memoryCachedOrders;
  }

  // Fallback to /tmp cache
  try {
    if (fs.existsSync(TMP_CACHE_FILE)) {
      const data = fs.readFileSync(TMP_CACHE_FILE, "utf-8");
      const parsed = JSON.parse(data) as NormalizedOrder[];
      // Hydrate dates
      memoryCachedOrders = parsed.map((o) => ({
        ...o,
        createdAt: new Date(o.createdAt),
        retailerApproveDate: o.retailerApproveDate ? new Date(o.retailerApproveDate) : null,
      }));
      return memoryCachedOrders;
    }
  } catch (e) {
    console.warn("[Sync] Error reading /tmp cache:", e);
  }

  return null;
}

/**
 * Returns sync status metadata.
 */
export function getSyncStatus(): SyncStatus {
  if (currentSyncStatus.lastSyncedAt) {
    return currentSyncStatus;
  }

  try {
    if (fs.existsSync(TMP_STATUS_FILE)) {
      const data = fs.readFileSync(TMP_STATUS_FILE, "utf-8");
      currentSyncStatus = JSON.parse(data);
      return currentSyncStatus;
    }
  } catch (e) {
    // Ignore
  }

  return currentSyncStatus;
}
