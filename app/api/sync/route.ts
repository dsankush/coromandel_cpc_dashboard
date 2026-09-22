import { NextRequest, NextResponse } from "next/server";
import { syncOrdersFromApi, getSyncStatus } from "@/lib/sync-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync
 * Returns current sync status or triggers sync if ?trigger=true.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const trigger = searchParams.get("trigger") === "true";

    if (trigger) {
      return handleSync(req);
    }

    const status = getSyncStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to get sync status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync
 * Triggers full live sync from the CPC WhatsApp Report API.
 */
export async function POST(req: NextRequest) {
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  try {
    // Optional CRON_SECRET authorization for automated Vercel Cron jobs
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncOrdersFromApi();
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Sync failed",
          total: result.total,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.total} orders from CPC Report API`,
      total: result.total,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error during sync" },
      { status: 500 }
    );
  }
}
