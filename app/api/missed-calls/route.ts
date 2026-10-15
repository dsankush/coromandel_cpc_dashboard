import { NextRequest, NextResponse } from "next/server";
import {
  getMissedCallReportData,
  exportMissedCallsToCsv,
} from "@/lib/missed-call-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    const state = searchParams.get("state");
    const zone = searchParams.get("zone");
    const ptName = searchParams.get("ptName");
    const search = searchParams.get("search")?.toLowerCase().trim();
    const isExport = searchParams.get("export") === "true";

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limitParam = searchParams.get("limit");
    // limit 0 or "all" means fetch all rows without slicing
    const limit =
      limitParam === "0" || limitParam === "all"
        ? 0
        : parseInt(limitParam || "50", 10);

    const payload = await getMissedCallReportData(forceRefresh);

    let filtered = payload.calls;

    if (state && state !== "ALL") {
      filtered = filtered.filter((c) => c.state.toLowerCase() === state.toLowerCase());
    }

    if (zone && zone !== "ALL") {
      filtered = filtered.filter((c) => c.zone.toLowerCase() === zone.toLowerCase());
    }

    if (ptName && ptName !== "ALL") {
      filtered = filtered.filter(
        (c) => c.ptName.toLowerCase() === ptName.toLowerCase() || c.digitrackNo === ptName
      );
    }

    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.grower.toLowerCase().includes(search) ||
          c.digitrackNo.toLowerCase().includes(search) ||
          c.ptName.toLowerCase().includes(search) ||
          c.ptHeadquarter.toLowerCase().includes(search) ||
          c.ptDistrict.toLowerCase().includes(search) ||
          c.ptMobile.toLowerCase().includes(search)
      );
    }

    // Direct CSV export response if requested (exports 100% of filtered/full records)
    if (isExport) {
      const csvData = exportMissedCallsToCsv(filtered);
      const filename = `Coromandel_Missed_Call_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      return new NextResponse(csvData, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const totalFiltered = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = limit > 0 ? filtered.slice(startIndex, startIndex + limit) : filtered;

    return NextResponse.json({
      success: true,
      kpis: payload.kpis,
      stateMetrics: payload.stateMetrics,
      ptMetrics: payload.ptMetrics,
      calls: paginated,
      totalFiltered,
      totalCount: payload.totalCount,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(totalFiltered / limit) : 1,
      filterOptions: payload.filterOptions,
      lastSyncedAt: payload.lastSyncedAt,
    });
  } catch (err: any) {
    console.error("API error fetching missed calls:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load missed calls" },
      { status: 500 }
    );
  }
}
