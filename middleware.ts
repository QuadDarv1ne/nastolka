import { NextResponse, type NextRequest } from "next/server";
import { logApiRequest } from "./src/lib/api-request-log";

export function middleware(request: NextRequest) {
  logApiRequest(request);
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};