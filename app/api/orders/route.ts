import { NextRequest, NextResponse } from "next/server";
import { getOrders, getFilterOptions } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const orders = getOrders();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status"); // "Approved", "Pending", "Rejected", or empty
    const state = searchParams.get("state");
    const district = searchParams.get("district");
    const retailer = searchParams.get("retailer");
    const crop = searchParams.get("crop");
    const search = searchParams.get("search")?.toLowerCase().trim();
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const mismatchOnly = searchParams.get("mismatch") === "true";

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);

    let filtered = orders;

    if (status && status !== "ALL") {
      filtered = filtered.filter((o) => o.status.toLowerCase() === status.toLowerCase());
    }

    if (state && state !== "ALL") {
      filtered = filtered.filter(
        (o) =>
          o.retailerState.toLowerCase() === state.toLowerCase() ||
          o.farmerState.toLowerCase() === state.toLowerCase()
      );
    }

    if (district && district !== "ALL") {
      filtered = filtered.filter(
        (o) =>
          o.retailerDistrict.toLowerCase() === district.toLowerCase() ||
          o.farmerDistrict.toLowerCase() === district.toLowerCase()
      );
    }

    if (retailer && retailer !== "ALL") {
      filtered = filtered.filter((o) => o.retailerName.toLowerCase().includes(retailer.toLowerCase()));
    }

    if (crop && crop !== "ALL") {
      filtered = filtered.filter((o) =>
        o.farmerCrops.some((c) => c.toLowerCase() === crop.toLowerCase())
      );
    }

    if (mismatchOnly) {
      filtered = filtered.filter((o) => o.locationMismatch);
    }

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        filtered = filtered.filter((o) => o.createdAt >= start);
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        // Set to end of day
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter((o) => o.createdAt <= end);
      }
    }

    if (search) {
      filtered = filtered.filter((o) => {
        return (
          o.farmerName.toLowerCase().includes(search) ||
          o.farmerNo.includes(search) ||
          o.retailerName.toLowerCase().includes(search) ||
          o.purchaseId.toLowerCase().includes(search) ||
          o.rawProductName.toLowerCase().includes(search) ||
          o.farmerUuid.toLowerCase().includes(search)
        );
      });
    }

    const totalCount = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      orders: paginated,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      filterOptions: getFilterOptions(orders),
    });
  } catch (error) {
    console.error("API error fetching orders:", error);
    return NextResponse.json({ error: "Failed to read and parse orders" }, { status: 500 });
  }
}
