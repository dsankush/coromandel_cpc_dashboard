import fs from "fs";
import path from "path";
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
const GOOGLE_CSV_BASE = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=`;

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
 * Normalizes 10-digit phone / Digitrack numbers.
 */
function cleanPhone(val: any): string {
  if (!val) return "";
  const s = String(val).trim().replace(/['"]/g, "");
  return s;
}

/**
 * Parses date string from Google Sheets.
 */
function parseCallDate(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    // Examples: "12/09/26 7:48", "12/9/2026 7:48:00"
    const parts = raw.trim().split(" ");
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
  const fallback = new Date(raw);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Loads CSV text from Google Sheet URL, falling back to local disk copy.
 */
async function loadSheetCSV(sheetName: string, localFallbackPath: string): Promise<string> {
  const url = `${GOOGLE_CSV_BASE}${encodeURIComponent(sheetName)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "text/csv" },
    });

    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 50 && !text.includes("<!DOCTYPE html>")) {
        return text;
      }
    }
  } catch (err) {
    console.warn(`[MissedCalls] Remote fetch for ${sheetName} failed, using local file:`, err);
  }

  // Fallback to local CSV on disk
  if (fs.existsSync(localFallbackPath)) {
    return fs.readFileSync(localFallbackPath, "utf-8");
  }

  return "";
}

/**
 * Parses Mapping Sheet and creates a Map keyed by Digitrack Number (the unique key for PTs).
 */
function parseMappingRecords(csvText: string): Map<string, PTMappingRecord> {
  const map = new Map<string, PTMappingRecord>();
  if (!csvText) return map;

  try {
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as any[];

    for (const r of records) {
      const digitrackNo = cleanPhone(r["Digitrack number"] || r["Digitrack No"]);
      if (!digitrackNo) continue;

      map.set(digitrackNo, {
        digitrackNo,
        division: (r["Division"] || "").trim(),
        state: normalizeStateName(r["State"]),
        rbhName: (r["RBH NAME"] || "").trim(),
        zm: (r["ZM"] || "").trim(),
        zone: (r["Zone"] || "").trim(),
        tmName: (r["TM Name"] || "").trim(),
        tmHeadquarter: (r["TM Headquarter"] || "").trim(),
        tmiCode: (r["TMI CODE"] || "").trim(),
        ptName: (r["PT Name"] || "").trim(),
        ptHeadquarter: (r["PT Headquarter"] || "").trim(),
        ptDistrict: (r["PT District"] || "").trim(),
        ptMobile: cleanPhone(r["PT Mobile"]),
        designation: (r["DESIGN PT/PO/COM.PT"] || "PT").trim(),
        email: (r["Email"] || "").trim(),
        language: (r["Language"] || "").trim(),
      });
    }
  } catch (err) {
    console.error("[MissedCalls] Error parsing Mapping Sheet:", err);
  }

  return map;
}

/**
 * Main ingestion & aggregation pipeline for Missed Calls.
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
        if (parsed && parsed.calls && parsed.calls.length > 0) {
          memoryCache = parsed;
          lastCacheTime = now;
          return memoryCache!;
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  console.log("[MissedCalls] Fetching fresh missed call data from Google Sheets...");

  // Fetch all 3 sheets in parallel
  const [missedCallsCsv, uniqueCallsCsv, mappingCsv] = await Promise.all([
    loadSheetCSV("Missed call Tracker", LOCAL_MISSED_CALLS_FILE),
    loadSheetCSV("Unique Missed Call Tracker", LOCAL_UNIQUE_CALLS_FILE),
    loadSheetCSV("Mapping Sheet", LOCAL_MAPPING_FILE),
  ]);

  // 1. Build Mapping Map (keyed by Digitrack No)
  const mappingMap = parseMappingRecords(mappingCsv);

  // 2. Parse Unique Missed Calls to index unique callers per Digitrack No & State
  const uniqueGrowersGlobal = new Set<string>();
  const uniqueByDigitrack = new Map<string, Set<string>>();
  const uniqueByState = new Map<string, Set<string>>();

  if (uniqueCallsCsv) {
    try {
      const uRecords = parse(uniqueCallsCsv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as any[];

      for (const r of uRecords) {
        const grower = cleanPhone(r["Grower"]);
        const digitrackNo = cleanPhone(r["Digitrack No"] || r["Digitrack number"]);
        const state = normalizeStateName(r["State"]);

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
    } catch (err) {
      console.error("[MissedCalls] Error parsing Unique Missed Calls:", err);
    }
  }

  // 3. Parse Total Missed Call Tracker
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

  if (missedCallsCsv) {
    try {
      const records = parse(missedCallsCsv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as any[];

      records.forEach((r, idx) => {
        const digitrackNo = cleanPhone(r["Digitrack No"] || r["Digitrack number"]);
        const grower = cleanPhone(r["Grower"]);
        if (!digitrackNo && !grower) return;

        // Merge with Mapping Sheet profile via unique Digitrack No
        const mapped = mappingMap.get(digitrackNo);

        const state = normalizeStateName(r["State"] || mapped?.state || "Other");
        const zone = (r["Zone"] || mapped?.zone || "").trim();
        const division = (r["Division"] || mapped?.division || "").trim();
        const ptName = (r["PT Name"] || mapped?.ptName || "Unassigned").trim();
        const ptHeadquarter = (r["PT Headquarter"] || mapped?.ptHeadquarter || "").trim();
        const ptDistrict = (r["PT District"] || mapped?.ptDistrict || "").trim();
        const ptMobile = cleanPhone(r["PT Mobile"] || mapped?.ptMobile);
        const designation = (r["DESIGN PT/PO/COM.PT"] || mapped?.designation || "PT").trim();
        const action = (r["Action"] || "Missed Call").trim();
        const dateStr = (r["Date"] || "").trim();
        const dateProcessed = (r["Date Processed"] || "").trim();

        allCalls.push({
          id: `MC-${idx + 1}`,
          digitrackNo,
          grower,
          date: dateStr,
          dateParsed: parseCallDate(dateStr),
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

        // State grouping
        if (!stateStats.has(state)) {
          stateStats.set(state, { totalCalls: 0, digitracks: new Set() });
        }
        const sEntry = stateStats.get(state)!;
        sEntry.totalCalls += 1;
        if (digitrackNo) sEntry.digitracks.add(digitrackNo);

        // PT / Digitrack No grouping (Digitrack is the unique key for PT!)
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
    } catch (err) {
      console.error("[MissedCalls] Error parsing Missed Call Tracker:", err);
    }
  }

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
