import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import {
  MissedCallRecord,
  PTMappingRecord,
  MissedCallKPIs,
  StateMissedCallMetric,
  PTMissedCallMetric,
  MissedCallReportPayload,
} from "@/types/missed-call";

const SPREADSHEET_ID = "1_ct5eF_GvO_EZ1qvYOjk8x3hIJN3gClt";
// Google Drive full workbook export URL (exports all sheets cleanly in 2-3 seconds)
const GOOGLE_XLSX_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`;

const LOCAL_XLSX_FILE = path.join(process.cwd(), "data", "missed_call_workbook.xlsx");
const LOCAL_MISSED_CALLS_FILE = path.join(process.cwd(), "data", "missed_call_tracker.csv");
const LOCAL_UNIQUE_CALLS_FILE = path.join(process.cwd(), "data", "unique_missed_call_tracker.csv");
const LOCAL_MAPPING_FILE = path.join(process.cwd(), "data", "mapping_sheet.csv");
const TMP_CACHE_FILE = path.join("/tmp", "cpc_missed_calls_cache.json");

// In-memory cache with 5-minute TTL
let memoryCache: MissedCallReportPayload | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Normalizes state name (e.g. Maharastra -> Maharashtra).
 */
export function normalizeStateName(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "Other";
  const cleaned = raw.trim();
  const lower = cleaned.toLowerCase();
  if (lower === "maharastra" || lower === "maharashtra") return "Maharashtra";
  if (lower === "andhra pradesh") return "Andhra Pradesh";
  if (lower === "haryana") return "Haryana";
  if (lower === "punjab") return "Punjab";
  if (lower === "telangana") return "Telangana";
  if (lower === "karnataka") return "Karnataka";
  if (lower === "west bengal") return "West Bengal";
  if (lower === "gujarat") return "Gujarat";
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Cleans and normalizes phone and Digitrack numbers.
 * Handles scientific notation (e.g., 9.18047590498E11 -> 918047590498) and floats.
 */
function cleanPhone(val: any): string {
  if (val === null || val === undefined) return "";
  let s = String(val).trim().replace(/['"]/g, "");
  if (!s || s.toUpperCase() === "NULL" || s.toUpperCase() === "#N/A") return "";

  // Handle scientific notation
  if (s.toLowerCase().includes("e")) {
    const num = Number(s);
    if (!isNaN(num)) {
      return String(Math.round(num));
    }
  }

  // Remove trailing .0 from float string
  if (s.endsWith(".0")) {
    s = s.slice(0, -2);
  }

  return s;
}

/**
 * Parses date string or serial number from Excel / Google Sheets.
 */
function parseCallDate(raw: any): Date | null {
  if (raw === null || raw === undefined) return null;

  // Handle numeric Excel date serial number
  if (typeof raw === "number" || (!isNaN(Number(raw)) && !String(raw).includes("/") && !String(raw).includes("-"))) {
    const num = Number(raw);
    if (num > 30000 && num < 60000) {
      // Excel epoch starts at 1899-12-30
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      return isNaN(date.getTime()) ? null : date;
    }
  }

  const s = String(raw).trim();
  if (!s) return null;

  try {
    const parts = s.split(" ");
    const datePart = parts[0];
    const timePart = parts[1] || "00:00";

    const dParts = datePart.split(/[\/\-]/);
    if (dParts.length === 3) {
      let day = parseInt(dParts[0], 10);
      let month = parseInt(dParts[1], 10) - 1;
      let year = parseInt(dParts[2], 10);
      if (year < 100) year += 2000;

      const tParts = timePart.split(":");
      const hours = parseInt(tParts[0] || "0", 10);
      const mins = parseInt(tParts[1] || "0", 10);

      const d = new Date(year, month, day, hours, mins);
      if (!isNaN(d.getTime())) return d;
    }
  } catch (e) {
    // Fallback
  }

  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Fetches the complete workbook buffer from Google Sheets live export,
 * falling back to local disk copy.
 */
async function loadWorkbook(): Promise<XLSX.WorkBook | null> {
  // 1. Try remote fetch of XLSX
  try {
    const res = await fetch(GOOGLE_XLSX_URL, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > 5000) {
        const wb = XLSX.read(buffer, { type: "buffer" });
        if (wb && wb.SheetNames.includes("Mapping Sheet")) {
          // Persist to local disk if writable
          try {
            if (fs.existsSync(path.dirname(LOCAL_XLSX_FILE))) {
              fs.writeFileSync(LOCAL_XLSX_FILE, buffer);
            }
          } catch (e) {
            // Ignore
          }
          return wb;
        }
      }
    }
  } catch (err) {
    console.warn("[MissedCalls] Remote XLSX fetch failed, falling back to local cache:", err);
  }

  // 2. Fallback to local XLSX file
  try {
    if (fs.existsSync(LOCAL_XLSX_FILE)) {
      const buffer = fs.readFileSync(LOCAL_XLSX_FILE);
      return XLSX.read(buffer, { type: "buffer" });
    }
  } catch (err) {
    console.warn("[MissedCalls] Failed reading local XLSX file:", err);
  }

  return null;
}

/**
 * Parses Mapping Sheet and creates a Map keyed by Digitrack Number (the unique key for PTs).
 */
function buildMappingMap(mappingRows: any[]): Map<string, PTMappingRecord> {
  const map = new Map<string, PTMappingRecord>();

  for (const r of mappingRows) {
    const digitrackNo = cleanPhone(r["Digitrack number"] || r["Digitrack No"] || r["A"]);
    if (!digitrackNo) continue;

    map.set(digitrackNo, {
      digitrackNo,
      division: String(r["Division"] || r["C"] || "").trim(),
      state: normalizeStateName(r["State"] || r["D"]),
      rbhName: String(r["RBH NAME"] || r["E"] || "").trim(),
      zm: String(r["ZM"] || r["F"] || "").trim(),
      zone: String(r["Zone"] || r["G"] || "").trim(),
      tmName: String(r["TM Name"] || r["H"] || "").trim(),
      tmHeadquarter: String(r["TM Headquarter"] || r["I"] || "").trim(),
      tmiCode: String(r["TMI CODE"] || r["J"] || "").trim(),
      ptName: String(r["PT Name"] || r["K"] || "").trim(),
      ptHeadquarter: String(r["PT Headquarter"] || r["L"] || "").trim(),
      ptDistrict: String(r["PT District"] || r["M"] || "").trim(),
      ptMobile: cleanPhone(r["PT Mobile"] || r["N"]),
      designation: String(r["DESIGN PT/PO/COM.PT"] || r["P"] || "PT").trim(),
      email: String(r["Email"] || r["Q"] || "").trim(),
      language: String(r["Language"] || r["R"] || "").trim(),
    });
  }

  return map;
}

/**
 * Fallback to parse local CSV files if XLSX reading is unavailable.
 */
function loadLocalCsvFallback(): {
  mappingRows: any[];
  missedRows: any[];
  uniqueRows: any[];
} {
  const readCsv = (filePath: string) => {
    if (!fs.existsSync(filePath)) return [];
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
    } catch {
      return [];
    }
  };

  return {
    mappingRows: readCsv(LOCAL_MAPPING_FILE),
    missedRows: readCsv(LOCAL_MISSED_CALLS_FILE),
    uniqueRows: readCsv(LOCAL_UNIQUE_CALLS_FILE),
  };
}

/**
 * Main ingestion & aggregation pipeline for Missed Calls.
 * Digitrack No is the guaranteed master unique identifier for PTs and lines.
 */
export async function getMissedCallReportData(
  forceRefresh = false
): Promise<MissedCallReportPayload> {
  const now = Date.now();
  if (!forceRefresh && memoryCache && now - lastCacheTime < CACHE_TTL_MS) {
    return memoryCache;
  }

  // Check /tmp cache on serverless
  if (!forceRefresh && !memoryCache) {
    try {
      if (fs.existsSync(TMP_CACHE_FILE)) {
        const fileData = fs.readFileSync(TMP_CACHE_FILE, "utf-8");
        const parsed = JSON.parse(fileData);
        if (parsed && parsed.calls && parsed.calls.length > 5000) {
          memoryCache = parsed;
          lastCacheTime = now;
          return memoryCache!;
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  console.log("[MissedCalls] Fetching fresh missed call data...");

  let mappingRows: any[] = [];
  let missedRows: any[] = [];
  let uniqueRows: any[] = [];

  const wb = await loadWorkbook();
  if (wb) {
    if (wb.Sheets["Mapping Sheet"]) {
      mappingRows = XLSX.utils.sheet_to_json(wb.Sheets["Mapping Sheet"], { defval: "" });
    }
    if (wb.Sheets["Missed call Tracker"]) {
      missedRows = XLSX.utils.sheet_to_json(wb.Sheets["Missed call Tracker"], { defval: "" });
    }
    if (wb.Sheets["Unique Missed Call Tracker"]) {
      uniqueRows = XLSX.utils.sheet_to_json(wb.Sheets["Unique Missed Call Tracker"], { defval: "" });
    }
  }

  // If workbook failed or incomplete, fallback to local CSVs
  if (mappingRows.length === 0 || missedRows.length === 0) {
    const fallback = loadLocalCsvFallback();
    if (mappingRows.length === 0) mappingRows = fallback.mappingRows;
    if (missedRows.length === 0) missedRows = fallback.missedRows;
    if (uniqueRows.length === 0) uniqueRows = fallback.uniqueRows;
  }

  // 1. Build Mapping Map (keyed by Digitrack No - the unique key for PTs)
  const mappingMap = buildMappingMap(mappingRows);

  // 2. Parse Unique Missed Calls to index unique callers per Digitrack No & State
  const uniqueGrowersGlobal = new Set<string>();
  const uniqueByDigitrack = new Map<string, Set<string>>();
  const uniqueByState = new Map<string, Set<string>>();

  for (const r of uniqueRows) {
    const grower = cleanPhone(r["Grower"] || r["Grower Mobile"]);
    const digitrackNo = cleanPhone(r["Digitrack No"] || r["Digitrack number"]);
    const mapped = mappingMap.get(digitrackNo);
    const state = normalizeStateName(mapped?.state || r["State"]);

    if (grower) {
      uniqueGrowersGlobal.add(grower);

      if (digitrackNo) {
        if (!uniqueByDigitrack.has(digitrackNo)) {
          uniqueByDigitrack.set(digitrackNo, new Set());
        }
        uniqueByDigitrack.get(digitrackNo)!.add(grower);
      }

      if (state) {
        if (!uniqueByState.has(state)) {
          uniqueByState.set(state, new Set());
        }
        uniqueByState.get(state)!.add(grower);
      }
    }
  }

  // 3. Parse Total Missed Call Tracker
  // Use Digitrack No to resolve master PT profile metadata
  const allCalls: MissedCallRecord[] = [];
  const stateStats = new Map<
    string,
    { totalCalls: number; digitracks: Set<string> }
  >();
  const ptStats = new Map<
    string,
    {
      digitrackNo: string;
      ptName: string;
      ptHeadquarter: string;
      ptDistrict: string;
      state: string;
      zone: string;
      division: string;
      ptMobile: string;
      designation: string;
      totalCalls: number;
    }
  >();

  missedRows.forEach((r, idx) => {
    const digitrackNo = cleanPhone(r["Digitrack No"] || r["Digitrack number"]);
    const grower = cleanPhone(r["Grower"] || r["Grower Mobile"]);
    if (!digitrackNo && !grower) return;

    // Resolve PT profile strictly via unique Digitrack No
    const mapped = mappingMap.get(digitrackNo);

    const state = normalizeStateName(mapped?.state || r["State"] || "Other");
    const zone = (mapped?.zone || r["Zone"] || "").trim();
    const division = (mapped?.division || r["Division"] || "").trim();
    const ptName = (mapped?.ptName || r["PT Name"] || "Unassigned").trim();
    const ptHeadquarter = (mapped?.ptHeadquarter || r["PT Headquarter"] || "").trim();
    const ptDistrict = (mapped?.ptDistrict || r["PT District"] || "").trim();
    const ptMobile = cleanPhone(mapped?.ptMobile || r["PT Mobile"]);
    const designation = (mapped?.designation || r["DESIGN PT/PO/COM.PT"] || "PT").trim();
    const action = String(r["Action"] || "Missed Call").trim();
    const dateStr = String(r["Date"] || "").trim();
    const dateProcessed = String(r["Date Processed"] || "").trim();

    allCalls.push({
      id: `MC-${idx + 1}`,
      digitrackNo,
      grower,
      date: dateStr,
      dateParsed: parseCallDate(r["Date"] || dateStr),
      action,
      dateProcessed,
      division,
      state,
      zone,
      ptName,
      ptHeadquarter,
      ptDistrict,
      ptMobile,
      designation,
    });

    // State aggregation
    if (!stateStats.has(state)) {
      stateStats.set(state, { totalCalls: 0, digitracks: new Set() });
    }
    const sEntry = stateStats.get(state)!;
    sEntry.totalCalls += 1;
    if (digitrackNo) sEntry.digitracks.add(digitrackNo);

    // PT aggregation strictly keyed by Digitrack No
    const ptKey = digitrackNo || ptName;
    if (!ptStats.has(ptKey)) {
      ptStats.set(ptKey, {
        digitrackNo,
        ptName,
        ptHeadquarter,
        ptDistrict,
        state,
        zone,
        division,
        ptMobile,
        designation,
        totalCalls: 0,
      });
    }
    ptStats.get(ptKey)!.totalCalls += 1;
  });

  // 4. Compute KPIs
  const totalCalls = allCalls.length;
  const uniqueCalls = uniqueGrowersGlobal.size || totalCalls;
  const repeatCalls = Math.max(0, totalCalls - uniqueCalls);
  const repeatRate = totalCalls > 0 ? Math.round((repeatCalls / totalCalls) * 1000) / 10 : 0;

  const kpis: MissedCallKPIs = {
    totalCalls,
    uniqueCalls,
    repeatCalls,
    repeatRate,
    activeStatesCount: stateStats.size,
    activePTsCount: ptStats.size,
    activeZonesCount: new Set(allCalls.map((c) => c.zone).filter(Boolean)).size,
  };

  // 5. Build State Metrics
  const stateMetrics: StateMissedCallMetric[] = Array.from(stateStats.entries())
    .map(([state, data]) => {
      const uCount = uniqueByState.has(state) ? uniqueByState.get(state)!.size : data.totalCalls;
      const rCalls = Math.max(0, data.totalCalls - uCount);
      const pct = totalCalls > 0 ? Math.round((data.totalCalls / totalCalls) * 1000) / 10 : 0;
      return {
        state,
        totalCalls: data.totalCalls,
        uniqueCalls: uCount,
        repeatCalls: rCalls,
        ptCount: data.digitracks.size,
        percentage: pct,
      };
    })
    .sort((a, b) => b.totalCalls - a.totalCalls);

  // 6. Build PT Metrics (keyed by unique Digitrack No)
  const ptMetrics: PTMissedCallMetric[] = Array.from(ptStats.values())
    .map((p) => {
      const uCount =
        p.digitrackNo && uniqueByDigitrack.has(p.digitrackNo)
          ? uniqueByDigitrack.get(p.digitrackNo)!.size
          : p.totalCalls;
      const rCalls = Math.max(0, p.totalCalls - uCount);
      return {
        digitrackNo: p.digitrackNo,
        ptName: p.ptName,
        ptHeadquarter: p.ptHeadquarter,
        ptDistrict: p.ptDistrict,
        state: p.state,
        zone: p.zone,
        division: p.division,
        ptMobile: p.ptMobile,
        designation: p.designation,
        totalCalls: p.totalCalls,
        uniqueCalls: uCount,
        repeatCalls: rCalls,
      };
    })
    .sort((a, b) => b.totalCalls - a.totalCalls);

  // 7. Filter Options
  const statesSet = new Set<string>();
  const zonesSet = new Set<string>();
  const ptNamesSet = new Set<string>();

  for (const c of allCalls) {
    if (c.state) statesSet.add(c.state);
    if (c.zone) zonesSet.add(c.zone);
    if (c.ptName) ptNamesSet.add(c.ptName);
  }

  const payload: MissedCallReportPayload = {
    kpis,
    stateMetrics,
    ptMetrics,
    calls: allCalls,
    totalCount: allCalls.length,
    filterOptions: {
      states: Array.from(statesSet).sort(),
      zones: Array.from(zonesSet).sort(),
      ptNames: Array.from(ptNamesSet).sort(),
    },
    lastSyncedAt: new Date().toISOString(),
  };

  // Cache to memory and /tmp
  memoryCache = payload;
  lastCacheTime = now;

  try {
    fs.writeFileSync(TMP_CACHE_FILE, JSON.stringify(payload), "utf-8");
  } catch (e) {
    // Ignore serverless write errors
  }

  return payload;
}

/**
 * Exports missed call records to CSV format.
 */
export function exportMissedCallsToCsv(calls: MissedCallRecord[]): string {
  const headers = [
    "ID",
    "Digitrack No",
    "Grower Mobile",
    "Date & Time",
    "Date Processed",
    "Action",
    "Division",
    "State",
    "Zone",
    "PT Name",
    "PT Headquarter",
    "PT District",
    "PT Mobile",
    "Designation",
  ];

  const escapeCsv = (str: any) => {
    if (str === null || str === undefined) return "";
    const s = String(str);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = calls.map((c) => [
    escapeCsv(c.id),
    escapeCsv(c.digitrackNo),
    escapeCsv(c.grower),
    escapeCsv(c.date),
    escapeCsv(c.dateProcessed),
    escapeCsv(c.action),
    escapeCsv(c.division),
    escapeCsv(c.state),
    escapeCsv(c.zone),
    escapeCsv(c.ptName),
    escapeCsv(c.ptHeadquarter),
    escapeCsv(c.ptDistrict),
    escapeCsv(c.ptMobile),
    escapeCsv(c.designation),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
