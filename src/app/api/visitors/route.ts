import { NextRequest, NextResponse } from "next/server";
import { getVisitorReport, getDeviceReport, logApiRequest, logDeviceVisit } from "@/lib/api-request-log";
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
  const view = searchParams.get("view");

  // ?view=devices — подробный отчёт по устройствам (device_visit)
  if (view === "devices") {
    return NextResponse.json(getDeviceReport(limit));
  }

  return NextResponse.json(getVisitorReport(limit));
}

// POST /api/visitors — публичная запись полного профиля устройства при заходе
// на сайт (клиент отправляет { nickname, device }). Чтение — только админом.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { nickname?: unknown; device?: unknown };
    logDeviceVisit(request, body);
  } catch {
    // битый JSON — просто отвечаем ок (аналитика не критична)
  }
  return NextResponse.json({ ok: true });
}
