import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { readOrdersCSV } from "../lib/parse";
import { normalizeApiRecord, exportOrdersToCsvString } from "../lib/sync-api";
import { isBlockedPhoneNumber } from "../lib/blocked-numbers";
import { NormalizedOrder } from "../types/order";

const CPC_API_URL =
  process.env.CPC_API_URL || "https://wa-dashboard.digicides.in/whatsapp/api/cpc/report/farmer";
const CPC_API_KEY =
  process.env.CPC_API_KEY || "b6b2237e2a9e8d8c94c52f1a7aaf8f8b54f2d1a6e4ad42ed9d8a6ec55f0bb1f1";

const ORDERS_CSV_PATH = path.join(process.cwd(), "data", "orders.csv");
const SPREADSHEET_ID = "1_ct5eF_GvO_EZ1qvYOjk8x3hIJN3gClt";
const GOOGLE_XLSX_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`;

async function syncOrders() {
  console.log("=== 1. SYNCING WHATSAPP ORDERS ===");
  if (!CPC_API_KEY) {
    console.warn("CPC_API_KEY missing. Skipping orders sync.");
    return 0;
  }

  // 1. Load existing normalized orders
  const existingOrders = readOrdersCSV();
  const existingOrdersMap = new Map<string, NormalizedOrder>();
  for (const ord of existingOrders) {
    existingOrdersMap.set(String(ord.purchaseId), ord);
  }
  console.log(`Loaded ${existingOrdersMap.size} existing orders from ${ORDERS_CSV_PATH}`);

  // 2. Query live metadata
  const perPage = 500;
  const metaRes = await fetch(`${CPC_API_URL}?pagination=true&page=1&per_page=1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CPC_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({})
  });

  if (!metaRes.ok) {
    throw new Error(`WhatsApp API responded HTTP ${metaRes.status}: ${metaRes.statusText}`);
  }

  const metaJson = await metaRes.json();
  const total = Number(metaJson?.data?.total) || 0;
  const lastPage = Math.ceil(total / perPage) || 1;
  console.log(`Live API Total: ${total} records across ~${lastPage} pages.`);

  // 3. Fetch from lastPage downwards until historical overlap
  const newRawRecords: any[] = [];
  for (let p = lastPage; p >= 1; p--) {
    console.log(`Fetching page ${p}/${lastPage}...`);
    try {
      const res = await fetch(`${CPC_API_URL}?pagination=true&page=${p}&per_page=${perPage}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CPC_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({})
      });

      if (!res.ok) {
        console.warn(`Page ${p} returned ${res.status}. Retrying once...`);
        continue;
      }

      const j = await res.json();
      const recs = j.data?.records || [];
      let overlap = 0;
      for (const r of recs) {
        if (existingOrdersMap.has(String(r.Order_ID))) overlap++;
        newRawRecords.push(r);
      }
      console.log(`Page ${p}: got ${recs.length} records (${overlap} already in local database).`);
      if (overlap > recs.length * 0.8 && recs.length > 50) {
        console.log(`Historical boundary reached on page ${p}. Halting sweep.`);
        break;
      }
    } catch (e: any) {
      console.warn(`Page ${p} error:`, e.message);
    }
  }

  // 4. Normalize and filter
  const cleanNew = newRawRecords
    .map((r, i) => normalizeApiRecord(r, i))
    .filter(
      (o) =>
        (o.farmerState || "").toLowerCase() !== "gujarat" &&
        (o.retailerState || "").toLowerCase() !== "gujarat" &&
        !isBlockedPhoneNumber(o.farmerNo) &&
        !isBlockedPhoneNumber(o.retailerNo)
    );

  let newCount = 0;
  for (const o of cleanNew) {
    if (!existingOrdersMap.has(o.purchaseId)) newCount++;
    existingOrdersMap.set(o.purchaseId, o);
  }

  const allMerged = Array.from(existingOrdersMap.values());
  allMerged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const csvOut = exportOrdersToCsvString(allMerged);
  fs.writeFileSync(ORDERS_CSV_PATH, csvOut, "utf-8");
  console.log(`Successfully merged ${newCount} new orders. Total orders in CSV: ${allMerged.length}`);
  return newCount;
}

async function syncMissedCalls() {
  console.log("\n=== 2. SYNCING MISSED CALL REPORT FROM GOOGLE SHEETS ===");
  try {
    const res = await fetch(GOOGLE_XLSX_URL);
    if (!res.ok) {
      throw new Error(`Google Sheets responded HTTP ${res.status}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) {
      throw new Error("Downloaded workbook is invalid or too small");
    }

    fs.writeFileSync(path.join(process.cwd(), "data", "missed_call_workbook.xlsx"), buf);
    const wb = XLSX.read(buf, { type: "buffer" });

    // Update CSVs
    if (wb.Sheets["Mapping Sheet"]) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets["Mapping Sheet"]);
      fs.writeFileSync(path.join(process.cwd(), "data", "mapping_sheet.csv"), csv, "utf-8");
    }
    if (wb.Sheets["Missed call Tracker"]) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets["Missed call Tracker"]);
      fs.writeFileSync(path.join(process.cwd(), "data", "missed_call_tracker.csv"), csv, "utf-8");
    }
    if (wb.Sheets["Unique Missed Call Tracker"]) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets["Unique Missed Call Tracker"]);
      fs.writeFileSync(path.join(process.cwd(), "data", "unique_missed_call_tracker.csv"), csv, "utf-8");
    }

    console.log("Successfully updated Missed Calls sheets & workbook!");
  } catch (err: any) {
    console.warn("Missed Calls sync error:", err.message);
  }
}

async function main() {
  await syncOrders();
  await syncMissedCalls();
  console.log("\nSync cycle complete!");
}

main().catch((err) => {
  console.error("Fatal sync error:", err);
  process.exit(1);
});
