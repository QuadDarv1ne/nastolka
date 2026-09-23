import { NextRequest, NextResponse } from "next/server";
import { getVisitorReport, logApiRequest } from "@/lib/api-request-log";
import { requireAdminAccess } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  logApiRequest(request);

  const adminCheck = requireAdminAccess(request);
  if (!adminCheck.ok) {
    return NextResponse.json(adminCheck.body, { status: adminCheck.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(Number(searchParams.get("limit") || "20"), 200) || 20;
  const report = getVisitorReport(limit);

  return NextResponse.json({
    message: "Nastolka API",
    summary: {
      totalRequests: report.total,
      devices: report.devices,
      countries: report.countries,
      cities: report.cities,
    },
    recent: report.recent,
  });
}