import type { NextRequest } from "next/server";

const normalize = (value?: string | null) => value?.trim() || null;

export const getAdminApiKey = () => normalize(process.env.ADMIN_API_KEY);

export const isAdminRequest = (request: NextRequest) => {
  const configKey = getAdminApiKey();
  if (!configKey) return false;

  const fromHeader = normalize(request.headers.get("x-admin-key"));
  const bearer = request.headers.get("authorization") ?? "";
  const fromBearer = normalize(bearer.replace(/^Bearer\s+/i, ""));
  const provided = fromHeader || fromBearer;

  return !!provided && provided === configKey;
};

export const requireAdminAccess = (request: NextRequest) => {
  if (!isAdminRequest(request)) {
    return {
      ok: false,
      status: 401,
      body: {
        error: "Unauthorized",
        message: "Admin access required. Send x-admin-key or Authorization: Bearer <ADMIN_API_KEY>.",
      },
    } as const;
  }

  return { ok: true, status: 200 } as const;
};
