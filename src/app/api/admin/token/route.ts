import { NextRequest, NextResponse } from "next/server";
import { createAdminToken, getAdminApiKey } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const key = request.headers.get("x-admin-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const configuredKey = getAdminApiKey();

  if (!configuredKey || key !== configuredKey) {
    return NextResponse.json({
      error: "Unauthorized",
      message: "Provide a valid admin key in x-admin-key or Authorization header.",
    }, { status: 401 });
  }

  const token = createAdminToken();
  if (!token) {
    return NextResponse.json({
      error: "Server error",
      message: "ADMIN_SECRET or ADMIN_API_KEY is not configured.",
    }, { status: 500 });
  }

  const origin = request.nextUrl.origin;

  return NextResponse.json({
    token,
    url: `${origin}/admin?token=${encodeURIComponent(token)}`,
  });
}
