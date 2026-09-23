"use client";

import { useEffect, useMemo, useState } from "react";

type VisitorStats = {
  total: number;
  uniqueIps: number;
  knownCountries: number;
  knownCities: number;
  devices: Record<string, number>;
  countries: Record<string, number>;
  cities: Record<string, number>;
  browsers: Record<string, number>;
  operatingSystems: Record<string, number>;
  paths: Record<string, number>;
  languages: Record<string, number>;
  methods: Record<string, number>;
  referers: Record<string, number>;
  hosts: Record<string, number>;
  recent: Array<{
    timestamp: string;
    method: string;
    path: string;
    query: string | null;
    ip: string | null;
    country: string | null;
    city: string | null;
    device: string;
    os: string;
    browser: string;
    userAgent: string | null;
    referer: string | null;
    language: string | null;
    forwardedHost: string | null;
  }>;
};

/** Отчёт по устройствам (?view=devices) — полные профили device_visit */
type DeviceStats = {
  total: number;
  uniqueIps: number;
  uniqueNicknames: number;
  byModel: Record<string, number>;
  byOs: Record<string, number>;
  byBrowser: Record<string, number>;
  byDeviceType: Record<string, number>;
  byScreen: Record<string, number>;
  byTimezone: Record<string, number>;
  byLanguage: Record<string, number>;
  byTouch: Record<string, number>;
  byNickname: Record<string, number>;
  recent: Array<{
    timestamp: string;
    nickname: string | null;
    ip: string | null;
    deviceType: string;
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
    page: "bg-linear-to-br from-sky-950 via-blue-950 to-indigo-950 text-sky-50",
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

const buildChartData = (entries: Array<[string, number]>) => {
  if (!entries.length) {
    return [] as Array<{ label: string; value: number; percent: number }>;
  }

  const sorted = [...entries].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(...sorted.map(([, value]) => value), 1);

  return sorted.map(([label, value]) => ({
    label: label || "unknown",
    value,
    percent: (value / max) * 100,
  }));
};

function StatBarChart({
  title,
  entries,
  palette,
}: {
  title: string;
  entries: Array<[string, number]>;
  palette: (typeof themeStyles)[ThemeMode];
}) {
  const chartData = useMemo(() => buildChartData(entries), [entries]);

  return (
    <div className={`rounded-2xl border p-4 ${palette.card}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${palette.badge}`}>
          Top 6
        </span>
      </div>

      <div className="space-y-3">
        {chartData.length > 0 ? (
          chartData.map((item) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate pr-2">{item.label}</span>
                <span className="font-semibold text-cyan-300">{item.value}</span>
              </div>
              <div className={`h-2.5 overflow-hidden rounded-full ${palette.soft}`}>
                <div
                  className="h-full rounded-full bg-linear-to-r from-cyan-400 via-sky-400 to-blue-500"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className={`text-sm ${palette.muted}`}>Нет данных</p>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [key, setKey] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  /** Активная вкладка: обзор запросов или устройства */
  const [tab, setTab] = useState<"overview" | "devices">("overview");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
  const palette = themeStyles[theme];

  useEffect(() => {
    try {
      const savedTheme = window.sessionStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (savedTheme && savedTheme in themeStyles) {
        setTheme(savedTheme);
      }
    } catch {
      // sessionStorage недоступен (приватный режим / блокировка) — просто дефолт
    }
  }, []);

  const readStoredToken = () => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  };

  const loadStats = async (tokenOrKey: string, mode: "token" | "key" = "token") => {
    setLoading(true);
    setError("");

    try {
      const headers: Record<string, string> = mode === "token" ? { "x-admin-token": tokenOrKey } : { "x-admin-key": tokenOrKey };
      // Загружаем оба отчёта параллельно: обзор запросов + устройства
      const [overviewRes, devicesRes] = await Promise.all([
        fetch("/api/visitors", { headers }),
        fetch("/api/visitors?view=devices&limit=100", { headers }),
      ]);
      const body = await overviewRes.text();

      if (!overviewRes.ok) {
        throw new Error(body || "Unauthorized");
      }

      const json = JSON.parse(body) as VisitorStats;
      const deviceJson = devicesRes.ok ? ((await devicesRes.json()) as DeviceStats) : null;
      const expiresAt = mode === "token" ? decodeAdminTokenExpiry(tokenOrKey) || Date.now() + ADMIN_SESSION_TTL_MS : Date.now() + ADMIN_SESSION_TTL_MS;
      setStats(json);
      setDeviceStats(deviceJson);
      setSessionExpiresAt(expiresAt);
      setTimeLeftMs(Math.max(expiresAt - Date.now(), 0));
      setGeneratedUrl("");

      try {
        sessionStorage.setItem(STORAGE_KEY, tokenOrKey);
      } catch {
        // приватный режим — сессия просто не переживёт перезагрузку вкладки
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить статистику");
      setStats(null);
      setDeviceStats(null);
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
  const methodEntries = useMemo(() => Object.entries(stats?.methods ?? {}), [stats]);
  const refererEntries = useMemo(() => Object.entries(stats?.referers ?? {}), [stats]);
  const hostEntries = useMemo(() => Object.entries(stats?.hosts ?? {}), [stats]);

  const onThemeChange = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    try {
      window.sessionStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // ignore
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

  const refreshStats = () => {
    const storedToken = readStoredToken();
    if (storedToken) {
      void loadStats(storedToken, "token");
    }
  };

  const logout = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.pathname);
    } catch {
      // ignore
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
          className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all duration-200 ring-1 ring-transparent ${
            theme === mode
              ? mode === "dark"
                ? "bg-slate-800 text-white shadow-lg shadow-slate-600/20 ring-cyan-400/70"
                : mode === "blue"
                  ? "bg-cyan-400 text-sky-950 shadow-lg shadow-cyan-500/30 ring-cyan-300"
                  : "bg-slate-200 text-slate-800 shadow-lg shadow-slate-300/30 ring-cyan-500/50"
              : "text-slate-500 hover:text-current hover:bg-white/5"
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );

  const themeBadgeLabel =
    theme === "dark" ? "Dark" : theme === "blue" ? "Blue" : "Light";

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
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${palette.badge}`}>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-linear-to-r from-cyan-400 to-blue-500" />
                Theme: {themeBadgeLabel}
              </div>
              {renderThemeToggle()}
              <div className={`rounded-xl border px-3 py-2 text-xs ${palette.badge}`}>
                TTL: {formattedTimeLeft}
              </div>
              <button
                type="button"
                className={`rounded-xl border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${palette.secondaryButton}`}
                onClick={refreshStats}
                disabled={loading}
              >
                {loading ? "Обновление..." : "Обновить"}
              </button>
              <button
                type="button"
                className={`rounded-xl border px-4 py-2 text-sm transition ${palette.secondaryButton}`}
                onClick={logout}
              >
                Выйти
              </button>
            </div>
          </div>

          {/* Переключатель вкладок: Обзор запросов / Устройства */}
          <div className="flex gap-2">
            {(
              [
                { id: "overview", label: "Обзор запросов" },
                { id: "devices", label: "Устройства" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  tab === item.id ? palette.accentButton : palette.secondaryButton
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
          <>
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Всего запросов", value: stats.total, accent: true },
              { label: "Уникальных IP", value: stats.uniqueIps },
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

          <section className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Геолокация: страны", value: stats.knownCountries, detail: `из ${stats.total} событий` },
              { label: "Геолокация: города", value: stats.knownCities, detail: `из ${stats.total} событий` },
              { label: "Последняя активность", value: stats.recent[0] ? new Date(stats.recent[0].timestamp).toLocaleString() : "Нет данных", detail: stats.recent[0]?.ip || "IP неизвестен" },
            ].map((item) => (
              <div key={item.label} className={`rounded-2xl border p-4 ${palette.card}`}>
                <p className={`text-sm ${palette.muted}`}>{item.label}</p>
                <p className="mt-2 truncate text-xl font-bold">{item.value}</p>
                <p className={`mt-1 text-xs ${palette.muted}`}>{item.detail}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <StatBarChart title="Устройства" entries={deviceEntries} palette={palette} />
            <StatBarChart title="Страны" entries={countryEntries} palette={palette} />
            <StatBarChart title="Города" entries={cityEntries} palette={palette} />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <StatBarChart title="Браузеры" entries={browserEntries} palette={palette} />
            <StatBarChart title="ОС" entries={osEntries} palette={palette} />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <StatBarChart title="Популярные пути" entries={pathEntries} palette={palette} />
            <StatBarChart title="Языки" entries={languageEntries} palette={palette} />
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <StatBarChart title="HTTP-методы" entries={methodEntries} palette={palette} />
            <StatBarChart title="Источники перехода" entries={refererEntries} palette={palette} />
            <StatBarChart title="Хосты" entries={hostEntries} palette={palette} />
          </section>

          <section className={`rounded-2xl border p-4 ${palette.card}`}>
            <h2 className="mb-4 text-lg font-semibold">Последние запросы</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={palette.muted}>
                  <tr>
                    <th className="pb-3 pr-4">Время</th>
                    <th className="pb-3 pr-4">Метод</th>
                    <th className="pb-3 pr-4">Путь</th>
                    <th className="pb-3 pr-4">Query</th>
                    <th className="pb-3 pr-4">IP</th>
                    <th className="pb-3 pr-4">Страна</th>
                    <th className="pb-3 pr-4">Город</th>
                    <th className="pb-3 pr-4">Устройство</th>
                    <th className="pb-3 pr-4">OS</th>
                    <th className="pb-3 pr-4">Браузер</th>
                    <th className="pb-3 pr-4">Источник</th>
                    <th className="pb-3 pr-4">User-Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((entry, index) => (
                    <tr key={`${entry.timestamp}-${index}`} className={`border-t ${palette.divider}`}>
                      <td className="py-2 pr-4">{new Date(entry.timestamp).toLocaleString()}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{entry.method}</td>
                      <td className="py-2 pr-4">{entry.path}</td>
                      <td className="max-w-48 truncate py-2 pr-4">{entry.query || "-"}</td>
                      <td className="py-2 pr-4">{entry.ip || "unknown"}</td>
                      <td className="py-2 pr-4">{entry.country || "unknown"}</td>
                      <td className="py-2 pr-4">{entry.city || "unknown"}</td>
                      <td className="py-2 pr-4">{entry.device}</td>
                      <td className="py-2 pr-4">{entry.os}</td>
                      <td className="py-2 pr-4">{entry.browser}</td>
                      <td className="max-w-48 truncate py-2 pr-4">{entry.referer || "direct"}</td>
                      <td className="max-w-72 truncate py-2 pr-4 text-xs">{entry.userAgent || "unknown"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          </>
          )}

          {/* ─────────── Вкладка «Устройства»: полные профили device_visit ─────────── */}
          {tab === "devices" && (
          <>
            {!deviceStats || deviceStats.total === 0 ? (
              <section className={`rounded-2xl border p-8 text-center ${palette.card}`}>
                <p className="text-lg font-semibold">Данных по устройствам пока нет</p>
                <p className={`mt-2 text-sm ${palette.muted}`}>
                  Полный профиль устройства отправляется на сервер при заходе на сайт после ввода никнейма.
                </p>
              </section>
            ) : (
              <>
                <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  {[
                    { label: "Визитов устройств", value: deviceStats.total, accent: true },
                    { label: "Уникальных IP", value: deviceStats.uniqueIps },
                    { label: "Никнеймов", value: deviceStats.uniqueNicknames },
                    { label: "Моделей", value: Object.keys(deviceStats.byModel).length },
                    { label: "Часовых поясов", value: Object.keys(deviceStats.byTimezone).length },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-2xl border p-4 ${palette.card}`}>
                      <p className={`text-sm ${palette.muted}`}>{item.label}</p>
                      <p className={`mt-2 text-3xl font-bold ${item.accent ? palette.accent : "font-semibold"}`}>{item.value}</p>
                    </div>
                  ))}
                </section>

                <section className="grid gap-6 lg:grid-cols-3">
                  <StatBarChart title="Типы устройств" entries={Object.entries(deviceStats.byDeviceType)} palette={palette} />
                  <StatBarChart title="Модели" entries={Object.entries(deviceStats.byModel)} palette={palette} />
                  <StatBarChart title="ОС + версии" entries={Object.entries(deviceStats.byOs)} palette={palette} />
                </section>

                <section className="grid gap-6 lg:grid-cols-3">
                  <StatBarChart title="Браузеры + версии" entries={Object.entries(deviceStats.byBrowser)} palette={palette} />
                  <StatBarChart title="Экраны (W×H @DPR)" entries={Object.entries(deviceStats.byScreen)} palette={palette} />
                  <StatBarChart title="Часовые пояса" entries={Object.entries(deviceStats.byTimezone)} palette={palette} />
                </section>

                <section className="grid gap-6 lg:grid-cols-3">
                  <StatBarChart title="Языки интерфейса" entries={Object.entries(deviceStats.byLanguage)} palette={palette} />
                  <StatBarChart title="Ввод: touch / мышь" entries={Object.entries(deviceStats.byTouch)} palette={palette} />
                  <StatBarChart title="Игроки (по никнеймам)" entries={Object.entries(deviceStats.byNickname).filter(([n]) => n)} palette={palette} />
                </section>

                <section className={`rounded-2xl border p-4 ${palette.card}`}>
                  <h2 className="mb-4 text-lg font-semibold">Последние визиты устройств</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className={palette.muted}>
                        <tr>
                          <th className="pb-3 pr-4">Время</th>
                          <th className="pb-3 pr-4">Никнейм</th>
                          <th className="pb-3 pr-4">Тип</th>
                          <th className="pb-3 pr-4">Модель</th>
                          <th className="pb-3 pr-4">ОС</th>
                          <th className="pb-3 pr-4">Браузер</th>
                          <th className="pb-3 pr-4">Экран</th>
                          <th className="pb-3 pr-4">Часовой пояс</th>
                          <th className="pb-3 pr-4">CPU/RAM</th>
                          <th className="pb-3 pr-4">IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deviceStats.recent.map((v, index) => (
                          <tr key={`${v.timestamp}-${index}`} className={`border-t ${palette.divider}`}>
                            <td className="py-2 pr-4">{new Date(v.timestamp).toLocaleString()}</td>
                            <td className="py-2 pr-4 font-bold">{v.nickname || "—"}</td>
                            <td className="py-2 pr-4">{v.deviceType === "phone" ? "📱" : v.deviceType === "tablet" ? "📲" : v.deviceType === "desktop" ? "💻" : "?"}</td>
                            <td className="py-2 pr-4">{v.model || "unknown"}</td>
                            <td className="py-2 pr-4">{v.os}{v.osVersion ? ` ${v.osVersion}` : ""}</td>
                            <td className="py-2 pr-4">{v.browser}{v.browserVersion ? ` ${v.browserVersion}` : ""}</td>
                            <td className="py-2 pr-4">{v.screenW ? `${v.screenW}×${v.screenH} @${v.dpr}x` : "—"}</td>
                            <td className="py-2 pr-4">{v.timezone || "—"}</td>
                            <td className="py-2 pr-4">{v.cores ? `${v.cores} ядер` : "—"}{v.memoryGb ? ` / ${v.memoryGb} ГБ` : ""}</td>
                            <td className="py-2 pr-4">{v.ip || "unknown"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
          )}
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
          <div className="flex items-center gap-2">
            <div className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${palette.badge}`}>
              {themeBadgeLabel}
            </div>
            {renderThemeToggle()}
          </div>
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
