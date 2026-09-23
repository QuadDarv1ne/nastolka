import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";

const normalize = (value?: string | null) => value?.trim() || null;

export const getAdminApiKey = () => normalize(process.env.ADMIN_API_KEY);
export const getAdminSecret = () => normalize(process.env.ADMIN_SECRET) || getAdminApiKey();

export const createAdminToken = (ttlMs = 1000 * 60 * 60 * 24) => {
  const secret = getAdminSecret();
  if (!secret) return null;

  const payload = {
    type: "nastolka-admin",
    exp: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
};

export const verifyAdminToken = (token?: string | null) => {
  const normalized = normalize(token);
  if (!normalized) return false;

  const secret = getAdminSecret();
  if (!secret) return false;

  const [encoded, signature] = normalized.split(".");
  if (!encoded || !signature) return false;

  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  if (expected !== signature) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
};

export const isAdminRequest = (request: NextRequest) => {
  const configKey = getAdminApiKey();
  if (!configKey) return false;

  const fromHeader = normalize(request.headers.get("x-admin-key"));
  const fromTokenHeader = normalize(request.headers.get("x-admin-token"));
  const tokenFromQuery = normalize(request.nextUrl.searchParams.get("token"));
  const bearer = request.headers.get("authorization") ?? "";
  const fromBearer = normalize(bearer.replace(/^Bearer\s+/i, ""));
  const provided = fromHeader || fromBearer || fromTokenHeader || tokenFromQuery;

  if (provided === configKey) return true;
  if (verifyAdminToken(provided)) return true;

  return false;
};

export const requireAdminAccess = (request: NextRequest) => {
  if (!isAdminRequest(request)) {
    return {
      ok: false,
      status: 401,
      body: {
        error: "Unauthorized",
        message: "Admin access required. Send x-admin-key, x-admin-token, Authorization: Bearer <ADMIN_API_KEY>, or a valid secret link token.",
      },
    } as const;
  }

  return { ok: true, status: 200 } as const;
};
