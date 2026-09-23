import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { NextRequest } from "next/server";

type DeviceType = "phone" | "tablet" | "desktop" | "unknown";

/** Полный профиль устройства от клиента (POST /api/visitors) */
export type DeviceVisitEntry = {
  event: "device_visit";
  timestamp: string;
  nickname: string | null;
  ip: string | null;
  deviceType: DeviceType;
  model: string;
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
  screenW: number;
  screenH: number;
  dpr: number;
  timezone: string;
  language: string;
  touch: boolean;
  cores: number | null;
  memoryGb: number | null;
  userAgent: string;
};

export type VisitorLogEntry =
  | {
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
    }
  | DeviceVisitEntry;

const LOG_FILE = resolve(process.env.API_VISITOR_LOG_FILE || "logs/api-visitors.jsonl");
const LOG_ROTATE_BYTES = Number(process.env.API_VISITOR_LOG_MAX_BYTES || 5 * 1024 * 1024); // 5 МБ
mkdirSync(dirname(LOG_FILE), { recursive: true });

/**
 * Простая ротация: если лог вырос больше лимита, текущий файл
 * переименовывается в .old (старый .old затирается), а новый пишется с нуля.
 * Без этого файл растёт бесконечно и readVisitorLogs читает его целиком в память.
 */
const rotateIfNeeded = () => {
  try {
    if (!existsSync(LOG_FILE)) return;
    if (statSync(LOG_FILE).size < LOG_ROTATE_BYTES) return;
    renameSync(LOG_FILE, `${LOG_FILE}.old`);
  } catch {
    // ротация не критична — просто продолжаем писать в текущий файл
  }
};

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
  .filter((entry) => entry.event === "api_request" || entry.event === "device_visit");

export const appendVisitorLog = (entry: VisitorLogEntry) => {
  try {
    rotateIfNeeded();
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
  const allEntries = readVisitorLogs(Number.MAX_SAFE_INTEGER);
  // Старый отчёт строится только по api_request-записям
  const apiEntries = allEntries.filter((e): e is Extract<VisitorLogEntry, { event: "api_request" }> => e.event === "api_request");
  const entries = apiEntries.slice(0, limit);
  const devices = apiEntries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.device] = (acc[entry.device] || 0) + 1;
    return acc;
  }, {});
  const countries = apiEntries.reduce<Record<string, number>>((acc, entry) => {
    if (!entry.country) return acc;
    acc[entry.country] = (acc[entry.country] || 0) + 1;
    return acc;
  }, {});
  const cities = apiEntries.reduce<Record<string, number>>((acc, entry) => {
    if (!entry.city) return acc;
    acc[entry.city] = (acc[entry.city] || 0) + 1;
    return acc;
  }, {});
  const browsers = apiEntries.reduce<Record<string, number>>((acc, entry) => {
    if (!entry.browser) return acc;
    acc[entry.browser] = (acc[entry.browser] || 0) + 1;
    return acc;
  }, {});
  const operatingSystems = apiEntries.reduce<Record<string, number>>((acc, entry) => {
    if (!entry.os) return acc;
    acc[entry.os] = (acc[entry.os] || 0) + 1;
    return acc;
  }, {});
  const paths = apiEntries.reduce<Record<string, number>>((acc, entry) => {
    const key = entry.path || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const languages = apiEntries.reduce<Record<string, number>>((acc, entry) => {
    const value = entry.language?.split(",")[0]?.trim() || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const methods = apiEntries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.method] = (acc[entry.method] || 0) + 1;
    return acc;
  }, {});
  const referers = apiEntries.reduce<Record<string, number>>((acc, entry) => {
    const key = entry.referer || "direct";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const hosts = apiEntries.reduce<Record<string, number>>((acc, entry) => {
    const key = entry.forwardedHost || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const uniqueIps = new Set(apiEntries.map((entry) => entry.ip).filter(Boolean)).size;
  const knownCountries = apiEntries.filter((entry) => Boolean(entry.country)).length;
  const knownCities = apiEntries.filter((entry) => Boolean(entry.city)).length;

  return {
    total: apiEntries.length,
    uniqueIps,
    knownCountries,
    knownCities,
    devices,
    countries,
    cities,
    browsers,
    operatingSystems,
    paths,
    languages,
    methods,
    referers,
    hosts,
    recent: entries,
  };
};

/** Отчёт по устройствам (device_visit — полный профиль с никнеймами) */
export const getDeviceReport = (limit = 50) => {
  const allEntries = readVisitorLogs(Number.MAX_SAFE_INTEGER);
  const visits = allEntries.filter((e): e is DeviceVisitEntry => e.event === "device_visit");
  const count = (fn: (v: DeviceVisitEntry) => string) =>
    visits.reduce<Record<string, number>>((acc, v) => {
      const key = fn(v) || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  const byModel = count((v) => v.model);
  const byOs = count((v) => (v.osVersion ? `${v.os} ${v.osVersion}` : v.os));
  const byBrowser = count((v) => (v.browserVersion ? `${v.browser} ${v.browserVersion}` : v.browser));
  const byDeviceType = count((v) => v.deviceType);
  const byScreen = count((v) => (v.screenW && v.screenH ? `${v.screenW}×${v.screenH} @${v.dpr}x` : "unknown"));
  const byTimezone = count((v) => v.timezone);
  const byLanguage = count((v) => v.language);
  const byTouch = visits.reduce<Record<string, number>>((acc, v) => {
    const key = v.touch ? "touch" : "mouse";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const byNickname = count((v) => v.nickname || "");
  const uniqueIps = new Set(visits.map((v) => v.ip).filter(Boolean)).size;
  const uniqueNicknames = new Set(visits.map((v) => v.nickname).filter(Boolean)).size;

  return {
    total: visits.length,
    uniqueIps,
    uniqueNicknames,
    byModel,
    byOs,
    byBrowser,
    byDeviceType,
    byScreen,
    byTimezone,
    byLanguage,
    byTouch,
    byNickname,
    recent: visits.slice(0, limit),
  };
};

/** Записать визит устройства (полный профиль от клиента, POST /api/visitors) */
export const logDeviceVisit = (request: NextRequest, body: { nickname?: unknown; device?: unknown }) => {
  const d = (body.device || {}) as Record<string, unknown>;
  const str = (v: unknown, max = 40) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const bool = (v: unknown) => v === true;
  const deviceType = ["phone", "tablet", "desktop", "unknown"].includes(String(d.deviceType))
    ? (String(d.deviceType) as DeviceType)
    : "unknown";
  const entry: DeviceVisitEntry = {
    event: "device_visit",
    timestamp: new Date().toISOString(),
    nickname: typeof body.nickname === "string" && body.nickname.trim() ? body.nickname.trim().slice(0, 30) : null,
    ip: getClientIp(request),
    deviceType,
    model: str(d.model),
    os: str(d.os),
    osVersion: str(d.osVersion, 15),
    browser: str(d.browser),
    browserVersion: str(d.browserVersion, 10),
    screenW: num(d.screenW),
    screenH: num(d.screenH),
    dpr: num(d.dpr),
    timezone: str(d.timezone, 50),
    language: str(d.language, 10),
    touch: bool(d.touch),
    cores: typeof d.cores === "number" && Number.isFinite(d.cores) ? d.cores : null,
    memoryGb: typeof d.memoryGb === "number" && Number.isFinite(d.memoryGb) ? d.memoryGb : null,
    userAgent: str(d.userAgent, 300),
  };
  appendVisitorLog(entry);
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