import { NextResponse } from "next/server";

// Health-check эндпоинт: GET /api/health
// Полезен для Docker/Amvera healthchecks и быстрой диагностики «жив ли сервер»
export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "nastolka",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
