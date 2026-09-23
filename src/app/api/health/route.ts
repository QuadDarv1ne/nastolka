import { NextRequest, NextResponse } from "next/server";
import { logApiRequest } from "@/lib/api-request-log";

export const runtime = "nodejs";

// Health-check эндпоинт: GET /api/health
// Полезен для Docker/Amvera healthchecks и быстрой диагностики жив ли сервер
export async function GET(request: NextRequest) {
  logApiRequest(request);

  return NextResponse.json({
    status: "ok",
    app: "nastolka",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
