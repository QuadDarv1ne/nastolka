import type { NextRequest } from "next/server";

type DeviceType = "phone" | "tablet" | "desktop" | "unknown";

const firstHeader = (request: NextRequest, names: string[]) => {
  for (const name of names) {
    const value = request.headers.get(name)?.trim();
    if (value) return value;
  }
  return null;
};

const getClientIp = (request: NextRequest) => {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || null;
};

const getDeviceInfo = (userAgent: string | null) => {
  if (!userAgent) return { type: "unknown" as DeviceType, os: "unknown", browser: "unknown" };

  const type: DeviceType = /ipad|tablet|playbook|silk/i.test(userAgent)
    ? "tablet"
    : /mobile|iphone|ipod|android.*mobile|windows phone/i.test(userAgent)
      ? "phone"
      : /windows|macintosh|linux|cros/i.test(userAgent)
        ? "desktop"
        : "unknown";

  const os = /windows phone/i.test(userAgent)
    ? "Windows Phone"
    : /windows/i.test(userAgent)
      ? "Windows"
      : /android/i.test(userAgent)
        ? "Android"
        : /iphone|ipad|ipod/i.test(userAgent)
          ? "iOS"
          : /macintosh|mac os/i.test(userAgent)
            ? "macOS"
            : /cros/i.test(userAgent)
              ? "ChromeOS"
              : /linux/i.test(userAgent)
                ? "Linux"
                : "unknown";

  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /opr\//i.test(userAgent)
      ? "Opera"
      : /chrome\//i.test(userAgent)
        ? "Chrome"
        : /firefox\//i.test(userAgent)
          ? "Firefox"
          : /safari\//i.test(userAgent)
            ? "Safari"
            : /curl\//i.test(userAgent)
              ? "curl"
              : "unknown";

  return { type, os, browser };
};

export const logApiRequest = (request: NextRequest) => {
  const userAgent = request.headers.get("user-agent");
  const device = getDeviceInfo(userAgent);
  const country = firstHeader(request, [
    "x-vercel-ip-country",
    "cf-ipcountry",
    "x-country-code",
    "x-country",
  ]);
  const city = firstHeader(request, ["x-vercel-ip-city", "cf-ipcity", "x-city"]);

  console.info(JSON.stringify({
    event: "api_request",
    timestamp: new Date().toISOString(),
    method: request.method,
    path: request.nextUrl.pathname,
    query: request.nextUrl.search || null,
    ip: getClientIp(request),
    country,
    city,
    device: device.type,
    os: device.os,
    browser: device.browser,
    userAgent,
    referer: request.headers.get("referer"),
    language: request.headers.get("accept-language"),
    forwardedHost: firstHeader(request, ["x-forwarded-host", "host"]),
    macAddress: null,
  }));
};