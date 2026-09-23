import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { NextRequest } from "next/server";

type DeviceType = "phone" | "tablet" | "desktop" | "unknown";

export type VisitorLogEntry = {
  event: "api_request";
  timestamp: string;
  method: string;
  path: string;
  query: string | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  device: DeviceType;
  os: string;
  browser: string;
  userAgent: string | null;
  referer: string | null;
  language: string | null;
  forwardedHost: string | null;
  macAddress: null;
};

const LOG_FILE = resolve(process.env.API_VISITOR_LOG_FILE || "logs/api-visitors.jsonl");
mkdirSync(dirname(LOG_FILE), { recursive: true });

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

const normalizeEntries = (entries: unknown[]): VisitorLogEntry[] => entries
  .filter((entry): entry is VisitorLogEntry => !!entry && typeof entry === "object" && "event" in entry)
  .filter((entry) => entry.event === "api_request");

export const appendVisitorLog = (entry: VisitorLogEntry) => {
  try {
    appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.error("[api-log] failed to write visitor log:", error);
  }
};

export const readVisitorLogs = (limit = 50): VisitorLogEntry[] => {
  if (!existsSync(LOG_FILE)) return [];

  try {
    const content = readFileSync(LOG_FILE, "utf8");
    const entries = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown)
      .filter(Boolean);

    return normalizeEntries(entries).slice(-limit).reverse();
  } catch (error) {
    console.error("[api-log] failed to read visitor log:", error);
    return [];
  }
};

export const getVisitorReport = (limit = 50) => {
  const entries = readVisitorLogs(limit);
  const devices = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.device] = (acc[entry.device] || 0) + 1;
    return acc;
  }, {});
  const countries = entries.reduce<Record<string, number>>((acc, entry) => {
    if (!entry.country) return acc;
    acc[entry.country] = (acc[entry.country] || 0) + 1;
    return acc;
  }, {});
  const cities = entries.reduce<Record<string, number>>((acc, entry) => {
    if (!entry.city) return acc;
    acc[entry.city] = (acc[entry.city] || 0) + 1;
    return acc;
  }, {});

  return {
    total: entries.length,
    devices,
    countries,
    cities,
    recent: entries,
  };
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
  const payload: VisitorLogEntry = {
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
  };

  console.info(JSON.stringify(payload));
  appendVisitorLog(payload);
};