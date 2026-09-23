"use client";

import { useMemo, useState } from "react";

type VisitorStats = {
  total: number;
  devices: Record<string, number>;
  countries: Record<string, number>;
  cities: Record<string, number>;
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

const STORAGE_KEY = "nastolka-admin-key";

export default function AdminPage() {
  const [key, setKey] = useState<string>("");
  const [storedKey, setStoredKey] = useState<string>("" );
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const loadStats = async (adminKey: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/visitors", {
        headers: {
          "x-admin-key": adminKey,
        },
      });

      const body = await response.text();
      if (!response.ok) {
        throw new Error(body || "Unauthorized");
      }

      const json = JSON.parse(body) as VisitorStats;
      setStats(json);
      setStoredKey(adminKey);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY, adminKey);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить статистику");
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const deviceEntries = useMemo(() => Object.entries(stats?.devices ?? {}), [stats]);
  const countryEntries = useMemo(() => Object.entries(stats?.countries ?? {}), [stats]);
  const cityEntries = useMemo(() => Object.entries(stats?.cities ?? {}), [stats]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadStats(key.trim());
  };

  const activeKey = storedKey || (typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) || "" : "");

  if (!activeKey && !stats) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-cyan-400">Admin access</p>
          <h1 className="mb-6 text-2xl font-bold">Статистика посетителей</h1>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              Введите ADMIN_API_KEY
              <input
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="secret-key"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-500"
              />
            </label>

            <button
              type="submit"
              disabled={loading || !key.trim()}
              className="w-full rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Загрузка..." : "Открыть отчёт"}
            </button>
          </form>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  if (stats && !error) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Admin dashboard</p>
              <h1 className="mt-2 text-3xl font-bold">Аналитика посещений</h1>
            </div>

            <button
              type="button"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              onClick={() => {
                if (typeof window !== "undefined") {
                  sessionStorage.removeItem(STORAGE_KEY);
                }
                setStoredKey("");
                setStats(null);
                setKey("");
                setError("");
              }}
            >
              Выйти
            </button>
          </div>

          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Всего запросов</p>
              <p className="mt-2 text-3xl font-bold text-cyan-400">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Устройств</p>
              <p className="mt-2 text-lg font-semibold">{Object.keys(stats.devices).length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Стран</p>
              <p className="mt-2 text-lg font-semibold">{Object.keys(stats.countries).length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Городов</p>
              <p className="mt-2 text-lg font-semibold">{Object.keys(stats.cities).length}</p>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold">Устройства</h2>
              <ul className="space-y-2">
                {deviceEntries.length > 0 ? deviceEntries.map(([device, count]) => (
                  <li key={device} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm">
                    <span className="capitalize">{device || "unknown"}</span>
                    <span className="font-semibold text-cyan-300">{count}</span>
                  </li>
                )) : <li className="text-sm text-slate-400">Нет данных</li>}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold">Страны</h2>
              <ul className="space-y-2">
                {countryEntries.length > 0 ? countryEntries.map(([country, count]) => (
                  <li key={country} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm">
                    <span>{country || "unknown"}</span>
                    <span className="font-semibold text-cyan-300">{count}</span>
                  </li>
                )) : <li className="text-sm text-slate-400">Нет данных</li>}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold">Города</h2>
              <ul className="space-y-2">
                {cityEntries.length > 0 ? cityEntries.map(([city, count]) => (
                  <li key={city} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm">
                    <span>{city || "unknown"}</span>
                    <span className="font-semibold text-cyan-300">{count}</span>
                  </li>
                )) : <li className="text-sm text-slate-400">Нет данных</li>}
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-4 text-lg font-semibold">Последние запросы</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-400">
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
                    <tr key={`${entry.timestamp}-${index}`} className="border-t border-slate-800 text-slate-200">
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

  return null;
}
