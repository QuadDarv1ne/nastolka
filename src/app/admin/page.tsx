"use client";

import { useEffect, useMemo, useState } from "react";

type VisitorStats = {
  total: number;
  devices: Record<string, number>;
  countries: Record<string, number>;
  cities: Record<string, number>;
  browsers: Record<string, number>;
  operatingSystems: Record<string, number>;
  paths: Record<string, number>;
  languages: Record<string, number>;
  recent: Array<{
    timestamp: string;
    method: string;
    path: string;
    ip: string | null;
    country: string | null;
    city: string | null;
    device: string;
    os: string;
    browser: string;
    userAgent: string | null;
  }>;
};

type ThemeMode = "dark" | "blue" | "light";

const STORAGE_KEY = "nastolka-admin-token";
const THEME_STORAGE_KEY = "nastolka-admin-theme";
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60;

const themeStyles = {
  dark: {
    page: "bg-slate-950 text-slate-100",
    panel: "border-slate-800 bg-slate-900/80 shadow-[0_24px_80px_rgba(15,23,42,0.6)]",
    card: "border-slate-800 bg-slate-900/80",
    soft: "bg-slate-950/80",
    muted: "text-slate-400",
    accent: "text-cyan-400",
    accentButton: "bg-cyan-500 text-slate-950 hover:bg-cyan-400",
    secondaryButton: "border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500",
    input: "border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus:border-cyan-500",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    danger: "border-rose-500/40 bg-rose-500/10 text-rose-200",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    divider: "border-slate-700",
  },
  blue: {
    page: "bg-gradient-to-br from-sky-950 via-blue-950 to-indigo-950 text-sky-50",
    panel: "border-sky-700/70 bg-sky-900/70 shadow-[0_24px_80px_rgba(14,116,144,0.45)]",
    card: "border-sky-800/80 bg-sky-950/60",
    soft: "bg-sky-950/60",
    muted: "text-sky-200/80",
    accent: "text-cyan-300",
    accentButton: "bg-cyan-400 text-sky-950 hover:bg-cyan-300",
    secondaryButton: "border-sky-700/80 bg-sky-950/60 text-sky-50 hover:border-sky-500",
    input: "border-sky-700/80 bg-sky-950/60 text-white placeholder:text-sky-200/60 focus:border-cyan-300",
    badge: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
    danger: "border-rose-400/40 bg-rose-500/10 text-rose-100",
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
    divider: "border-sky-700/80",
  },
  light: {
    page: "bg-slate-100 text-slate-800",
    panel: "border-slate-200 bg-white/90 shadow-[0_20px_65px_rgba(15,23,42,0.12)]",
    card: "border-slate-200 bg-white",
    soft: "bg-slate-50",
    muted: "text-slate-500",
    accent: "text-cyan-700",
    accentButton: "bg-cyan-600 text-white hover:bg-cyan-500",
    secondaryButton: "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300",
    input: "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-500 focus:border-cyan-500",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    divider: "border-slate-200",
  },
} as const;

const decodeAdminTokenExpiry = (token: string) => {
  try {
    const [encoded] = token.split(".");
    if (!encoded) {
      return 0;
    }

    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const json = decodeURIComponent(
      Array.from(binary, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")
    );
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : 0;
  } catch {
    return 0;
  }
};

export default function AdminPage() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [key, setKey] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
  const palette = themeStyles[theme];

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = window.sessionStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (savedTheme && savedTheme in themeStyles) {
        setTheme(savedTheme);
      }
    }
  }, []);

  const readStoredToken = () => {
    if (typeof window === "undefined") {
      return "";
    }

    return sessionStorage.getItem(STORAGE_KEY) || "";
  };

  const loadStats = async (tokenOrKey: string, mode: "token" | "key" = "token") => {
    setLoading(true);
    setError("");

    try {
      const headers: Record<string, string> = mode === "token" ? { "x-admin-token": tokenOrKey } : { "x-admin-key": tokenOrKey };
      const response = await fetch("/api/visitors", { headers });
      const body = await response.text();

      if (!response.ok) {
        throw new Error(body || "Unauthorized");
      }

      const json = JSON.parse(body) as VisitorStats;
      const expiresAt = mode === "token" ? decodeAdminTokenExpiry(tokenOrKey) || Date.now() + ADMIN_SESSION_TTL_MS : Date.now() + ADMIN_SESSION_TTL_MS;
      setStats(json);
      setSessionExpiresAt(expiresAt);
      setTimeLeftMs(Math.max(expiresAt - Date.now(), 0));
      setGeneratedUrl("");

      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY, tokenOrKey);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить статистику");
      setStats(null);
      setSessionExpiresAt(null);
      setTimeLeftMs(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const queryToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
    const savedToken = readStoredToken();

    if (queryToken) {
      void loadStats(queryToken, "token");
      return;
    }

    if (savedToken) {
      void loadStats(savedToken, "token");
    }
  }, []);

  useEffect(() => {
    if (!sessionExpiresAt) {
      return;
    }

    const tick = () => {
      const remaining = sessionExpiresAt - Date.now();
      setTimeLeftMs(Math.max(remaining, 0));

      if (remaining <= 0) {
        logout();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [sessionExpiresAt]);

  const deviceEntries = useMemo(() => Object.entries(stats?.devices ?? {}), [stats]);
  const countryEntries = useMemo(() => Object.entries(stats?.countries ?? {}), [stats]);
  const cityEntries = useMemo(() => Object.entries(stats?.cities ?? {}), [stats]);
  const browserEntries = useMemo(() => Object.entries(stats?.browsers ?? {}), [stats]);
  const osEntries = useMemo(() => Object.entries(stats?.operatingSystems ?? {}), [stats]);
  const pathEntries = useMemo(() => Object.entries(stats?.paths ?? {}), [stats]);
  const languageEntries = useMemo(() => Object.entries(stats?.languages ?? {}), [stats]);

  const onThemeChange = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
  };

  const onKeySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/token", {
        method: "POST",
        headers: {
          "x-admin-key": trimmedKey,
        },
      });

      const bodyText = await response.text();
      if (!response.ok) {
        throw new Error(bodyText || "Unauthorized");
      }

      const data = JSON.parse(bodyText) as { token?: string; url?: string };
      if (!data.token) {
        throw new Error("Секретная ссылка не была сгенерирована");
      }

      if (typeof window !== "undefined") {
        const nextPath = data.url ? new URL(data.url, window.location.origin).pathname + new URL(data.url, window.location.origin).search : "/admin";
        window.history.replaceState({}, "", nextPath);
      }

      setGeneratedUrl(data.url || "");
      await loadStats(data.token, "token");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось сгенерировать ссылку");
      setLoading(false);
      setStats(null);
    }
  };

  const onManualKeySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return;
    }

    await loadStats(trimmedKey, "key");
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.pathname);
    }

    setGeneratedUrl("");
    setStats(null);
    setKey("");
    setError("");
    setSessionExpiresAt(null);
    setTimeLeftMs(0);
  };

  const formattedTimeLeft = (() => {
    const totalSeconds = Math.max(Math.ceil(timeLeftMs / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
  })();

  const renderThemeToggle = () => (
    <div className={`flex items-center gap-2 rounded-full border p-1 ${palette.card} ${palette.divider}`}>
      {(["dark", "blue", "light"] as ThemeMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onThemeChange(mode)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
            theme === mode
              ? mode === "dark"
                ? "bg-slate-800 text-white"
                : mode === "blue"
                  ? "bg-cyan-500 text-sky-950"
                  : "bg-slate-200 text-slate-800"
              : "text-slate-500 hover:text-current"
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );

  if (stats && !error) {
    return (
      <main className={`min-h-screen px-4 py-8 transition-colors duration-200 ${palette.page}`}>
        <div className="mx-auto max-w-6xl space-y-6">
          <div className={`flex flex-col gap-4 rounded-2xl border p-5 md:flex-row md:items-center md:justify-between ${palette.panel}`}>
            <div>
              <p className={`text-xs uppercase tracking-[0.2em] ${palette.accent}`}>Admin dashboard</p>
              <h1 className="mt-2 text-3xl font-bold">Аналитика посещений</h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {renderThemeToggle()}
              <div className={`rounded-xl border px-3 py-2 text-xs ${palette.badge}`}>
                TTL: {formattedTimeLeft}
              </div>
              <button
                type="button"
                className={`rounded-xl border px-4 py-2 text-sm transition ${palette.secondaryButton}`}
                onClick={logout}
              >
                Выйти
              </button>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Всего запросов", value: stats.total, accent: true },
              { label: "Устройств", value: Object.keys(stats.devices).length },
              { label: "Стран", value: Object.keys(stats.countries).length },
              { label: "Городов", value: Object.keys(stats.cities).length },
            ].map((item) => (
              <div key={item.label} className={`rounded-2xl border p-4 ${palette.card}`}>
                <p className={`text-sm ${palette.muted}`}>{item.label}</p>
                <p className={`mt-2 text-3xl font-bold ${item.accent ? palette.accent : "font-semibold"}`}>{item.value}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className={`rounded-2xl border p-4 ${palette.card}`}>
              <h2 className="mb-3 text-lg font-semibold">Устройства</h2>
              <ul className="space-y-2">
                {deviceEntries.length > 0 ? deviceEntries.map(([device, count]) => (
                  <li key={device} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${palette.soft}`}>
                    <span className="capitalize">{device || "unknown"}</span>
                    <span className="font-semibold text-cyan-300">{count}</span>
                  </li>
                )) : <li className={`text-sm ${palette.muted}`}>Нет данных</li>}
              </ul>
            </div>

            <div className={`rounded-2xl border p-4 ${palette.card}`}>
              <h2 className="mb-3 text-lg font-semibold">Страны</h2>
              <ul className="space-y-2">
                {countryEntries.length > 0 ? countryEntries.map(([country, count]) => (
                  <li key={country} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${palette.soft}`}>
                    <span>{country || "unknown"}</span>
                    <span className="font-semibold text-cyan-300">{count}</span>
                  </li>
                )) : <li className={`text-sm ${palette.muted}`}>Нет данных</li>}
              </ul>
            </div>

            <div className={`rounded-2xl border p-4 ${palette.card}`}>
              <h2 className="mb-3 text-lg font-semibold">Города</h2>
              <ul className="space-y-2">
                {cityEntries.length > 0 ? cityEntries.map(([city, count]) => (
                  <li key={city} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${palette.soft}`}>
                    <span>{city || "unknown"}</span>
                    <span className="font-semibold text-cyan-300">{count}</span>
                  </li>
                )) : <li className={`text-sm ${palette.muted}`}>Нет данных</li>}
              </ul>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className={`rounded-2xl border p-4 ${palette.card}`}>
              <h2 className="mb-3 text-lg font-semibold">Браузеры</h2>
              <ul className="space-y-2">
                {browserEntries.length > 0 ? browserEntries.map(([browser, count]) => (
                  <li key={browser} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${palette.soft}`}>
                    <span>{browser || "unknown"}</span>
                    <span className="font-semibold text-cyan-300">{count}</span>
                  </li>
                )) : <li className={`text-sm ${palette.muted}`}>Нет данных</li>}
              </ul>
            </div>

            <div className={`rounded-2xl border p-4 ${palette.card}`}>
              <h2 className="mb-3 text-lg font-semibold">ОС</h2>
              <ul className="space-y-2">
                {osEntries.length > 0 ? osEntries.map(([os, count]) => (
                  <li key={os} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${palette.soft}`}>
                    <span>{os || "unknown"}</span>
                    <span className="font-semibold text-cyan-300">{count}</span>
                  </li>
                )) : <li className={`text-sm ${palette.muted}`}>Нет данных</li>}
              </ul>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className={`rounded-2xl border p-4 ${palette.card}`}>
              <h2 className="mb-3 text-lg font-semibold">Популярные пути</h2>
              <ul className="space-y-2">
                {pathEntries.length > 0 ? pathEntries.map(([path, count]) => (
                  <li key={path} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${palette.soft}`}>
                    <span className="truncate pr-2">{path || "unknown"}</span>
                    <span className="font-semibold text-cyan-300 whitespace-nowrap">{count}</span>
                  </li>
                )) : <li className={`text-sm ${palette.muted}`}>Нет данных</li>}
              </ul>
            </div>

            <div className={`rounded-2xl border p-4 ${palette.card}`}>
              <h2 className="mb-3 text-lg font-semibold">Языки</h2>
              <ul className="space-y-2">
                {languageEntries.length > 0 ? languageEntries.map(([language, count]) => (
                  <li key={language} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${palette.soft}`}>
                    <span>{language || "unknown"}</span>
                    <span className="font-semibold text-cyan-300">{count}</span>
                  </li>
                )) : <li className={`text-sm ${palette.muted}`}>Нет данных</li>}
              </ul>
            </div>
          </section>

          <section className={`rounded-2xl border p-4 ${palette.card}`}>
            <h2 className="mb-4 text-lg font-semibold">Последние запросы</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={palette.muted}>
                  <tr>
                    <th className="pb-3 pr-4">Время</th>
                    <th className="pb-3 pr-4">Путь</th>
                    <th className="pb-3 pr-4">IP</th>
                    <th className="pb-3 pr-4">Страна</th>
                    <th className="pb-3 pr-4">Город</th>
                    <th className="pb-3 pr-4">Устройство</th>
                    <th className="pb-3 pr-4">OS</th>
                    <th className="pb-3 pr-4">Браузер</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((entry, index) => (
                    <tr key={`${entry.timestamp}-${index}`} className={`border-t ${palette.divider}`}>
                      <td className="py-2 pr-4">{new Date(entry.timestamp).toLocaleString()}</td>
                      <td className="py-2 pr-4">{entry.path}</td>
                      <td className="py-2 pr-4">{entry.ip || "unknown"}</td>
                      <td className="py-2 pr-4">{entry.country || "unknown"}</td>
                      <td className="py-2 pr-4">{entry.city || "unknown"}</td>
                      <td className="py-2 pr-4">{entry.device}</td>
                      <td className="py-2 pr-4">{entry.os}</td>
                      <td className="py-2 pr-4">{entry.browser}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen px-4 py-10 transition-colors duration-200 ${palette.page}`}>
      <div className={`mx-auto max-w-xl rounded-3xl border p-6 shadow-[0_24px_80px_rgba(15,23,42,0.4)] ${palette.panel}`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.2em] ${palette.accent}`}>Admin access</p>
            <h1 className="mt-2 text-3xl font-bold">Статистика посетителей</h1>
          </div>
          {renderThemeToggle()}
        </div>

        <div className={`mb-5 rounded-2xl border p-3 text-sm ${palette.badge}`}>
          Генерация ключа: <span className="font-mono">openssl rand -base64 32</span>
        </div>

        <form onSubmit={onKeySubmit} className="space-y-4">
          <label className={`block text-sm font-medium ${palette.muted}`}>
            ADMIN_API_KEY для генерации защищённой ссылки
            <input
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="secret-key"
              className={`mt-2 w-full rounded-xl border px-3 py-2.5 text-base outline-none transition ${palette.input}`}
            />
          </label>

          <button
            type="submit"
            disabled={loading || !key.trim()}
            className={`w-full rounded-xl px-4 py-2.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${palette.accentButton}`}
          >
            {loading ? "Загрузка..." : "Создать секретную ссылку"}
          </button>
        </form>

        {generatedUrl ? (
          <div className={`mt-4 rounded-2xl border p-3 text-sm ${palette.success}`}>
            <p className="mb-2 font-medium">Секретная ссылка готова:</p>
            <a href={generatedUrl} className="break-all text-cyan-400 underline underline-offset-2">{generatedUrl}</a>
          </div>
        ) : null}

        <div className={`my-5 border-t ${palette.divider}`} />

        <form onSubmit={onManualKeySubmit} className="space-y-4">
          <label className={`block text-sm font-medium ${palette.muted}`}>
            Или открыть отчёт напрямую по ключу
            <input
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="secret-key"
              className={`mt-2 w-full rounded-xl border px-3 py-2.5 text-base outline-none transition ${palette.input}`}
            />
          </label>

          <button
            type="submit"
            disabled={loading || !key.trim()}
            className={`w-full rounded-xl border px-4 py-2.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${palette.secondaryButton}`}
          >
            {loading ? "Загрузка..." : "Открыть по ключу"}
          </button>
        </form>

        {error ? (
          <div className={`mt-4 rounded-2xl border p-3 text-sm ${palette.danger}`}>
            {error}
          </div>
        ) : null}
      </div>
    </main>
  );
}
