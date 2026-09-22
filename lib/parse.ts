import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import {
  ApprovalStatus,
  ApprovalStatusCode,
  NormalizedOrder,
  ParsedLineItem,
  RawOrderCSVRow,
} from "@/types/order";

/**
 * Official Coromandel CPC Product & SKU Catalog.
 */
export const CPC_PRODUCT_CATALOG: Record<string, string[]> = {
  "Fantac Plus": ["25 ml", "50 ml", "100 ml", "250 ml", "500 ml", "1 ltr"],
  "Prospell": ["250 ml", "500 ml", "1 ltr"],
  "Platina": ["100 ml", "250 ml", "500 ml", "1 ltr"],
  "Prachand": ["40 ml", "80 ml", "160 ml", "400 ml"],
  "Marvex": ["150 ml", "300 ml", "600 ml", "900 ml"],
  "Caveco": ["100 ml", "200 ml", "400 ml", "1 ltr"],
  "Blitz": ["80 gm", "160 gm"],
  "Saujas": ["100 ml", "200 ml", "400 ml", "1 ltr"],
  "Indrastra": ["60 gm", "120 gm", "250 gm", "500 gm"],
  "Benofit": ["200 gm", "400 gm", "800 gm"],
};

const SORTED_CATALOG_PRODUCTS = Object.keys(CPC_PRODUCT_CATALOG).sort(
  (a, b) => b.length - a.length
);

/**
 * Parses product1_name string into an array of structured line items.
 * 
 * Supports:
 * 1. Standard repeating triples: <Product Name> <SKU Size> <Quantity>
 *    Example: "Fantac Plus 1 ltr 1, Prachand 40 ml 4"
 * 2. Multi-SKU collapsed orders: <Product Name> <SKU 1>,<SKU 2> <Qty 1>,<Qty 2>
 *    Example: "Prospell 250 ml,1 ltr 2,7" -> Prospell 250 ml (2), Prospell 1 ltr (7)
 *    Example: "Fantac Plus 500 ml,250 ml,1 ltr 1,1,1" -> Fantac Plus 500 ml (1), 250 ml (1), 1 ltr (1)
 */
export function parseProduct1Name(raw: string | null | undefined): ParsedLineItem[] {
  if (!raw || typeof raw !== "string" || raw.trim() === "" || raw.trim().toUpperCase() === "NULL") {
    return [];
  }

  const trimmed = raw.trim();

  // Find all occurrences of known catalog products
  const productMatches: { name: string; start: number }[] = [];
  for (const pName of SORTED_CATALOG_PRODUCTS) {
    let pos = 0;
    while ((pos = trimmed.indexOf(pName, pos)) !== -1) {
      productMatches.push({ name: pName, start: pos });
      pos += pName.length;
    }
  }

  // If known catalog products are found, parse with catalog awareness
  if (productMatches.length > 0) {
    productMatches.sort((a, b) => a.start - b.start);

    // Filter out overlapping product matches (e.g. shorter names inside longer names)
    const filteredMatches: { name: string; start: number }[] = [];
    let lastEnd = -1;
    for (const m of productMatches) {
      if (m.start >= lastEnd) {
        filteredMatches.push(m);
        lastEnd = m.start + m.name.length;
      }
    }

    const parsedItems: ParsedLineItem[] = [];

    for (let i = 0; i < filteredMatches.length; i++) {
      const cur = filteredMatches[i];
      const end = i + 1 < filteredMatches.length ? filteredMatches[i + 1].start : trimmed.length;
      const chunk = trimmed
        .slice(cur.start + cur.name.length, end)
        .replace(/^[\s,]+|[\s,]+$/g, "");

      // Extract all SKU sizes in this chunk
      const skuRegex = /(\d+(?:\.\d+)?\s*(?:ltr|ml|gm|kg|g|l))/gi;
      const foundSkus: string[] = [];
      let sm: RegExpExecArray | null;
      let lastSkuEnd = 0;

      while ((sm = skuRegex.exec(chunk)) !== null) {
        // Standardize spacing: "1  ltr" -> "1 ltr", "40ml" -> "40 ml"
        const formattedSku = sm[1].trim().replace(/\s+/g, " ").toLowerCase();
        foundSkus.push(formattedSku);
        lastSkuEnd = sm.index + sm[0].length;
      }

      // Everything after the last SKU contains the trailing quantity tokens
      const qtyPart = chunk.slice(lastSkuEnd).trim();
      const quantities = (qtyPart.match(/\d+/g) || []).map((q) => parseInt(q, 10));

      if (foundSkus.length > 0) {
        if (foundSkus.length === quantities.length) {
          for (let k = 0; k < foundSkus.length; k++) {
            parsedItems.push({
              productName: cur.name,
              skuSize: foundSkus[k],
              packSize: foundSkus[k],
              quantity: quantities[k],
              rawString: `${cur.name} ${foundSkus[k]} ${quantities[k]}`,
            });
          }
        } else if (foundSkus.length === 1 && quantities.length === 0) {
          parsedItems.push({
            productName: cur.name,
            skuSize: foundSkus[0],
            packSize: foundSkus[0],
            quantity: 1,
            rawString: `${cur.name} ${foundSkus[0]} 1`,
          });
        } else {
          // For any mismatch, match what we can and fallback cleanly
          for (let k = 0; k < foundSkus.length; k++) {
            const qty = quantities[k] !== undefined ? quantities[k] : 1;
            parsedItems.push({
              productName: cur.name,
              skuSize: foundSkus[k],
              packSize: foundSkus[k],
              quantity: qty,
              rawString: `${cur.name} ${foundSkus[k]} ${qty}`,
            });
          }
        }
      } else {
        // Product name found without SKU size
        const qty = quantities[0] || 1;
        parsedItems.push({
          productName: cur.name,
          skuSize: "Standard",
          packSize: "Standard",
          quantity: qty,
          rawString: chunk || cur.name,
        });
      }
    }

    if (parsedItems.length > 0) {
      return parsedItems;
    }
  }

  // Fallback for non-catalog or generic strings: split by comma and triples
  const segments = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  const fallbackItems: ParsedLineItem[] = [];

  for (const segment of segments) {
    const tokens = segment.split(/\s+/).filter(Boolean);
    const n = tokens.length;

    if (n >= 4) {
      const quantityToken = tokens[n - 1];
      const unitToken = tokens[n - 2];
      const numberToken = tokens[n - 3];
      const parsedQty = parseInt(quantityToken, 10);

      if (!isNaN(parsedQty)) {
        const skuSize = `${numberToken} ${unitToken}`;
        const productName = tokens.slice(0, n - 3).join(" ").trim();
        if (productName.length > 0) {
          fallbackItems.push({
            productName,
            skuSize,
            packSize: skuSize,
            quantity: parsedQty,
            rawString: segment,
          });
          continue;
        }
      }
    }

    // Default fallback
    const trailingNumMatch = segment.match(/^(.*?)\s+(\d+)$/);
    if (trailingNumMatch) {
      fallbackItems.push({
        productName: trailingNumMatch[1].trim(),
        skuSize: "Standard",
        packSize: "Standard",
        quantity: parseInt(trailingNumMatch[2], 10) || 1,
        rawString: segment,
      });
      continue;
    }

    fallbackItems.push({
      productName: segment,
      skuSize: "1 unit",
      packSize: "1 unit",
      quantity: 1,
      rawString: segment,
    });
  }

  return fallbackItems;
}

/**
 * Parses comma-separated coupon codes. Treats "NULL" as empty array.
 */
export function parseCouponCodes(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== "string" || raw.trim() === "" || raw.trim().toUpperCase() === "NULL") {
    return [];
  }
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && c.toUpperCase() !== "NULL");
}

/**
 * Parses comma-separated crop names. Treats literal "NULL" as empty array.
 */
export function parseFarmerCrops(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== "string" || raw.trim() === "" || raw.trim().toUpperCase() === "NULL") {
    return [];
  }
  return raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0 && c !== "null");
}

/**
 * Maps raw status code (0, 1, 2) or string labels ("Verified", "Approved", "Rejected", "Pending")
 * to strongly-typed ApprovalStatus enum.
 */
export function mapApprovalStatus(rawCode: string | number | null | undefined): {
  code: ApprovalStatusCode;
  status: ApprovalStatus;
} {
  if (rawCode === null || rawCode === undefined) {
    return { code: 0, status: ApprovalStatus.Pending };
  }
  const str = String(rawCode).trim().toLowerCase();
  if (str === "1" || str === "approved" || str === "verified") {
    return { code: 1, status: ApprovalStatus.Approved };
  }
  if (str === "2" || str === "rejected") {
    return { code: 2, status: ApprovalStatus.Rejected };
  }
  return { code: 0, status: ApprovalStatus.Pending };
}

/**
 * Parses datetime string into Date object. Handles NULL or invalid dates.
 */
export function parseDate(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== "string" || raw.trim() === "" || raw.trim().toUpperCase() === "NULL") {
    return null;
  }
  const parsed = new Date(raw.trim().replace(" ", "T"));
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Computes approval latency in hours.
 */
export function computeApprovalLatencyHours(
  createdAt: Date | null,
  approveDate: Date | null
): number | null {
  if (!createdAt || !approveDate) return null;
  const diffMs = approveDate.getTime() - createdAt.getTime();
  if (diffMs < 0) return 0; // Guard against minor clock skew
  const hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 10) / 10;
}

/**
 * Normalizes location strings for comparison (case-insensitive, trims).
 */
function cleanLocation(str: string | null | undefined): string {
  if (!str) return "";
  return str.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Determines if there is a location mismatch between farmer and retailer.
 */
export function isLocationMismatch(
  farmerState: string,
  farmerDistrict: string,
  retailerState: string,
  retailerDistrict: string
): boolean {
  const fState = cleanLocation(farmerState);
  const rState = cleanLocation(retailerState);
  if (fState && rState && fState !== rState) {
    return true;
  }

  const fDist = cleanLocation(farmerDistrict);
  const rDist = cleanLocation(retailerDistrict);
  if (fDist && rDist && fDist !== rDist) {
    return true;
  }

  return false;
}

/**
 * Normalizes state names to standard proper casing (e.g. MAHARASHTRA -> Maharashtra).
 */
export function formatStateName(rawState: string | null | undefined): string {
  if (!rawState || rawState.trim() === "" || rawState.toUpperCase() === "NULL") return "";
  const cleaned = rawState.trim();
  const lower = cleaned.toLowerCase();
  if (lower === "maharashtra") return "Maharashtra";
  if (lower === "punjab") return "Punjab";
  if (lower === "haryana") return "Haryana";
  if (lower === "telangana") return "Telangana";
  if (lower === "andhra pradesh") return "Andhra Pradesh";
  if (lower === "karnataka") return "Karnataka";
  if (lower === "uttar pradesh") return "Uttar Pradesh";
  if (lower === "west bengal") return "West Bengal";
  if (lower === "madhya pradesh") return "Madhya Pradesh";
  if (lower === "rajasthan") return "Rajasthan";
  if (lower === "gujarat") return "Gujarat";
  if (lower === "tamil nadu") return "Tamil Nadu";
  if (lower === "kerala") return "Kerala";
  if (lower === "bihar") return "Bihar";
  if (lower === "odisha") return "Odisha";
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Transforms a raw CSV row into a NormalizedOrder object.
 */
export function normalizeOrderRow(raw: RawOrderCSVRow, index: number): NormalizedOrder {
  const { code, status } = mapApprovalStatus(raw.is_approve_by_retailer);
  const createdAt = parseDate(raw.created_at) || new Date();
  const retailerApproveDate = parseDate(raw.retailer_approve_date);
  const latencyHours = computeApprovalLatencyHours(createdAt, retailerApproveDate);

  const farmerCrops = parseFarmerCrops(raw.farmer_crop);
  const lineItems = parseProduct1Name(raw.product1_name);
  const couponCodes = parseCouponCodes(raw.coupon_code);

  const farmerLandRaw = (raw.farmer_land ?? "").trim();
  const farmerLandAcres =
    farmerLandRaw && farmerLandRaw.toUpperCase() !== "NULL" && !isNaN(Number(farmerLandRaw))
      ? Number(farmerLandRaw)
      : null;

  const retailerState = formatStateName(raw.retailer_state);
  const farmerState = formatStateName(raw.farmer_state);

  const locationMismatch = isLocationMismatch(
    farmerState,
    raw.farmer_district,
    retailerState,
    raw.retailer_district
  );

  const purchaseId = (raw.purchase_id ?? "").trim() || `ORD-${index + 1}`;

  return {
    id: purchaseId,
    purchaseId,
    retailerNo: (raw.retailer_no ?? "").trim(),
    retailerName: (raw.retailer_name ?? "").trim(),
    retailerLocation: (raw.retailer_location ?? "").trim(),
    retailerShortCode: (raw.retailer_short_code ?? "").trim(),
    retailerLocaleCode: (raw.retailer_locale_code ?? "").trim(),
    retailerDistrict: (raw.retailer_district ?? "").trim(),
    retailerState,
    retailerAddress: (raw.retailer_address ?? "").trim(),
    retailerPinCode: (raw.retailer_pin_code ?? "").trim(),
    farmerNo: (raw.farmer_no ?? "").trim(),
    farmerName: (raw.farmer_name ?? "").trim(),
    farmerUuid: (raw.farmer_uuid ?? "").trim(),
    farmerState,
    farmerDistrict: (raw.farmer_district ?? "").trim(),
    farmerCrops,
    farmerLandAcres,
    farmerLandRaw,
    deliveryAddress: (raw.address ?? "").trim(),
    statusCode: code,
    status,
    retailerApproveDate,
    retailerApproveDateStr: raw.retailer_approve_date ? raw.retailer_approve_date.trim() : null,
    noProductPurchase: parseInt(raw.no_product_purchase ?? "0", 10) || lineItems.reduce((acc, i) => acc + i.quantity, 0) || 1,
    waStatus: (raw.wa_status ?? "").trim(),
    couponCodes,
    createdAt,
    createdAtStr: raw.created_at ? raw.created_at.trim() : "",
    approvalLatencyHours: latencyHours,
    locationMismatch,
    lineItems,
    rawProductName: (raw.product1_name ?? "").trim(),
  };
}

/**
 * Synchronously reads and parses CSV file from disk.
 * Supports /data/orders.csv or report_data.csv fallback.
 */
export function readOrdersCSV(): NormalizedOrder[] {
  const possiblePaths = [
    path.join(process.cwd(), "data", "orders.csv"),
    path.join(process.cwd(), "report_data.csv"),
    "/data/orders.csv",
  ];

  let filePath = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    console.warn("Orders CSV not found in search paths, returning empty list");
    return [];
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const rawRecords = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as RawOrderCSVRow[];

  return rawRecords
    .map((row, index) => normalizeOrderRow(row, index))
    .filter(
      (order) =>
        (order.farmerState || "").toLowerCase() !== "gujarat" &&
        (order.retailerState || "").toLowerCase() !== "gujarat"
    );
}
