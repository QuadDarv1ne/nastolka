"use client"

import { useEffect, useState, useCallback } from "react"

/* ═══════════════ Типы ═══════════════ */

interface VisitorEntry {
  timestamp: string; ip: string; deviceType: string; os: string; browser: string;
  browserVersion: string; country?: string; city?: string; language?: string;
  screenResolution?: string; touchSupport?: boolean; pagePath?: string;
  sessionId?: string; connectionType?: string
}
interface AnalyticsStats {
  total: number; byDevice: Record<string, number>; byOS: Record<string, number>;
  byBrowser: Record<string, number>; byCountry: Record<string, number>;
  byCity: Record<string, number>; byLanguage: Record<string, number>;
  byPage: Record<string, number>; byConnection: Record<string, number>;
  byHour: Record<string, number>; byNickname: Record<string, number>;
  byDeviceType: Record<string, number>; byTimezone: Record<string, number>;
  uniqueIPs: number; uniqueVisitors: number; uniquePages: number;
  recent: VisitorEntry[]
}

interface DeviceEntry {
  timestamp: string; ip: string; nickname?: string; deviceType: string
  os: string; osVersion?: string; browser: string; browserVersion: string
  engine?: string
  screenResolution?: string; availScreenSize?: string; viewportSize?: string
  pixelRatio?: number; colorDepth?: number; colorGamut?: string; orientation?: string
  touchSupport?: boolean; maxTouchPoints?: number
  connectionType?: string; downlink?: number; rtt?: number; saveData?: boolean
  cpuCores?: number; deviceMemory?: number
  batteryLevel?: string; batteryCharging?: boolean
  gpuVendor?: string; gpuRenderer?: string
  hasVibration?: boolean; hasGeolocation?: boolean; hasBluetooth?: boolean
  hasNFC?: boolean; hasUSB?: boolean; hasCamera?: boolean; hasGamepad?: boolean
  hasWakeLock?: boolean; hasShare?: boolean; hasClipboard?: boolean
  hasServiceWorker?: boolean; hasWebGL?: boolean
  prefersDarkMode?: boolean; prefersReducedMotion?: boolean
  prefersReducedTransparency?: boolean; prefersContrast?: string
  language?: string; languages?: string; platform?: string
  country?: string; city?: string; timezone?: string; clientTimezone?: string
  timezoneOffset?: number; doNotTrack?: string; pdfViewer?: boolean; webdriver?: boolean
  pagePath?: string; sessionId?: string; userAgent: string
}
interface GameEventEntry {
  timestamp: string; visitorId: string; nickname: string
  eventType: string; deviceType: string; pagePath: string
  data?: Record<string, unknown>
}
interface EventStats {
  total: number; byType: Record<string, number>
  byNickname: Record<string, number>; byHour: Record<string, number>
  recent: GameEventEntry[]
}
interface CustomWord { id: string; word: string; wordEn: string; category: string; difficulty: string }
type Tab = "analytics" | "words" | "devices" | "events" | "settings"
type Theme = "light" | "dark" | "blue"

/* ═══════════════ Темы ═══════════════ */

const THEMES: Record<Theme, { bg: string; card: string; border: string; text: string; muted: string; accent: string; accentText: string; button: string; header: string }> = {
  light: {
    bg: "bg-slate-50", card: "bg-white", border: "border-slate-200", text: "text-slate-900",
    muted: "text-slate-500", accent: "from-violet-500 to-indigo-600", accentText: "text-violet-600",
    button: "bg-violet-500 hover:bg-violet-600", header: "bg-white/80 border-slate-200"
  },
  dark: {
    bg: "bg-slate-950", card: "bg-slate-900", border: "border-slate-800", text: "text-slate-100",
    muted: "text-slate-400", accent: "from-violet-500 to-indigo-600", accentText: "text-violet-400",
    button: "bg-violet-600 hover:bg-violet-700", header: "bg-slate-900/80 border-slate-800"
  },
  blue: {
    bg: "bg-blue-950", card: "bg-blue-900", border: "border-blue-800", text: "text-blue-50",
    muted: "text-blue-300", accent: "from-cyan-400 to-blue-500", accentText: "text-cyan-400",
    button: "bg-cyan-500 hover:bg-cyan-600", header: "bg-blue-900/80 border-blue-800"
  },
}

/* ═══════════════ Главная страница ═══════════════ */

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("analytics")
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const savedAuth = localStorage.getItem("nastolka-admin-auth")
    if (savedAuth === "yes") setAuthed(true)
    const savedTheme = localStorage.getItem("nastolka-admin-theme") as Theme
    if (savedTheme && ["light", "dark", "blue"].includes(savedTheme)) setTheme(savedTheme)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const setAndSaveTheme = (t: Theme) => { setTheme(t); localStorage.setItem("nastolka-admin-theme", t) }

  const handleLogin = () => {
    if (password === "nastolka") { setAuthed(true); localStorage.setItem("nastolka-admin-auth", "yes"); setError("") }
    else setError("Неверный пароль")
  }
  const handleLogout = () => { setAuthed(false); localStorage.removeItem("nastolka-admin-auth") }
  const th = THEMES[theme]

  if (!authed) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${th.bg}`}>
        <div className={`w-full max-w-sm rounded-3xl ${th.card} p-8 shadow-2xl border ${th.border}`}>
          <h1 className={`mb-6 text-center text-2xl font-black ${th.text}`}>🔐 Админ-панель</h1>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="Пароль"
            className={`mb-3 w-full rounded-xl border ${th.border} ${th.bg} ${th.text} px-4 py-3 text-lg outline-none focus:border-violet-500`} />
          {error && <p className="mb-3 text-sm text-rose-500">{error}</p>}
          <button onClick={handleLogin} className={`w-full rounded-xl bg-gradient-to-br ${th.accent} px-4 py-3 text-lg font-bold text-white shadow-lg transition`}>Войти</button>
          <p className={`mt-4 text-center text-xs ${th.muted}`}>Подсказка: nastolka</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${th.bg} ${th.text}`}>
      {/* Шапка */}
      <div className={`sticky top-0 z-10 border-b ${th.border} ${th.header} backdrop-blur`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-black">🎛️ Настолка — Админ</h1>
          <div className="flex items-center gap-2">
            {/* Переключатель тем */}
            <div className={`flex gap-1 rounded-xl ${th.card} p-1 border ${th.border}`}>
              {(["light", "dark", "blue"] as Theme[]).map((t) => (
                <button key={t} onClick={() => setAndSaveTheme(t)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${theme === t ? `bg-gradient-to-br ${THEMES[t].accent} text-white` : th.muted}`}>
                  {t === "light" ? "☀️" : t === "dark" ? "🌙" : "🔵"}
                </button>
              ))}
            </div>
            <button onClick={handleLogout} className={`rounded-full ${th.card} border ${th.border} px-4 py-1.5 text-sm font-semibold ${th.muted} transition hover:${th.text}`}>Выйти</button>
          </div>
        </div>
        {/* Табы */}
        <div className="mx-auto flex max-w-6xl gap-1 px-4 pb-2">
          <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")} icon="📊" label="Аналитика" th={th} />
          <TabButton active={tab === "words"} onClick={() => setTab("words")} icon="📝" label="Слова" th={th} />
          <TabButton active={tab === "devices"} onClick={() => setTab("devices")} icon="📱" label="Устройства" th={th} />
          <TabButton active={tab === "events"} onClick={() => setTab("events")} icon="🎯" label="События" th={th} />
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")} icon="⚙️" label="Настройки" th={th} />
        </div>
      </div>

      {/* Контент */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {tab === "analytics" && <AnalyticsTab th={th} />}
        {tab === "words" && <WordsTab th={th} />}
        {tab === "devices" && <DevicesTab th={th} />}
        {tab === "events" && <EventsTab th={th} />}
        {tab === "settings" && <SettingsTab th={th} theme={theme} setTheme={setAndSaveTheme} />}
      </div>
    </div>
  )
}

/* ═══════════════ Tab: Аналитика ═══════════════ */

function AnalyticsTab({ th }: { th: typeof THEMES.light }) {
  const [stats, setStats] = useState<AnalyticsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const refresh = useCallback(() => {
    setLoading(true)
    fetch("/api/analytics").then((r) => r.json()).then((d) => { setStats(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    refresh()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh])

  const handleClear = async () => { if (!confirm("Удалить ВСЕ данные аналитики?")) return; await fetch("/api/admin/analytics", { method: "DELETE" }); refresh() }
  const handleExport = async () => { const res = await fetch("/api/admin/analytics"); const data = await res.json(); const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `analytics-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url) }

  if (loading) return <div className={`py-8 text-center text-lg ${th.muted}`}>Загрузка…</div>
  if (!stats) return <div className="py-8 text-center text-lg text-rose-500">Нет данных</div>

  return (
    <div className="space-y-6">
      {/* Кнопки */}
      <div className="flex flex-wrap gap-2">
        <button onClick={refresh} className={`rounded-xl ${th.card} border ${th.border} px-4 py-2 text-sm font-semibold ${th.muted} transition`}>🔄 Обновить</button>
        <button onClick={handleExport} className="rounded-xl bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-500 transition hover:bg-blue-500/20">📥 Экспорт</button>
        <button onClick={handleClear} className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-500/20">🗑 Очистить</button>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Всего визитов" value={stats.total} icon="👁" th={th} />
        <StatCard label="Уникальных IP" value={stats.uniqueIPs} icon="🌐" th={th} />
        <StatCard label="Посетителей" value={stats.uniqueVisitors} icon="👤" th={th} />
        <StatCard label="Страниц" value={stats.uniquePages} icon="📄" th={th} />
      </div>

      {/* График по часам */}
      <ChartCard title="🕐 Активность за 24 часа" th={th}>
        <HourChart data={stats.byHour} th={th} />
      </ChartCard>

      {/* Графики */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="📱 Устройства" th={th}><Bars data={stats.byDevice} total={stats.total} th={th} /></ChartCard>
        <ChartCard title="💻 ОС" th={th}><Bars data={stats.byOS} total={stats.total} th={th} /></ChartCard>
        <ChartCard title="🌐 Браузеры" th={th}><Bars data={stats.byBrowser} total={stats.total} th={th} /></ChartCard>
        <ChartCard title="🗣️ Языки" th={th}><Bars data={stats.byLanguage} total={stats.total} th={th} /></ChartCard>
      </div>

      {/* Страны, города, страницы, соединения */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.keys(stats.byCountry).length > 0 && <ChartCard title="🌍 Страны" th={th}><Bars data={stats.byCountry} total={stats.total} th={th} /></ChartCard>}
        {Object.keys(stats.byCity).length > 0 && <ChartCard title="🏙️ Города" th={th}><Bars data={stats.byCity} total={stats.total} th={th} /></ChartCard>}
        <ChartCard title="📄 Страницы" th={th}><Bars data={stats.byPage} total={stats.total} th={th} /></ChartCard>
        {Object.keys(stats.byConnection).length > 0 && <ChartCard title="📶 Соединение" th={th}><Bars data={stats.byConnection} total={stats.total} th={th} /></ChartCard>}
      </div>

      {/* Таблица последних визитов */}
      <ChartCard title={`🕐 ${showAll ? "Все" : "Последние 15"} визитов`} th={th}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className={`border-b ${th.border} text-left ${th.muted}`}>
                <th className="py-2 pr-2">Время</th><th className="py-2 pr-2">IP</th>
                <th className="py-2 pr-2">Устр.</th><th className="py-2 pr-2">ОС</th>
                <th className="py-2 pr-2">Браузер</th><th className="py-2 pr-2">Страна</th>
                <th className="py-2 pr-2">Город</th><th className="py-2 pr-2">Экран</th>
                <th className="py-2 pr-2">Соед.</th><th className="py-2 pr-2">Путь</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? stats.recent : stats.recent.slice(0, 15)).map((v, i) => (
                <tr key={i} className={`border-b ${th.border}/50 hover:bg-muted/30`}>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{new Date(v.timestamp).toLocaleString("ru-RU")}</td>
                  <td className="py-1.5 pr-2 font-mono">{v.ip}</td>
                  <td className="py-1.5 pr-2">{v.deviceType}</td>
                  <td className="py-1.5 pr-2">{v.os}</td>
                  <td className="py-1.5 pr-2">{v.browser} {v.browserVersion}</td>
                  <td className="py-1.5 pr-2">{v.country || "—"}</td>
                  <td className="py-1.5 pr-2">{v.city || "—"}</td>
                  <td className="py-1.5 pr-2 font-mono">{v.screenResolution || "—"}</td>
                  <td className="py-1.5 pr-2">{v.connectionType || "—"}</td>
                  <td className="py-1.5 pr-2 truncate max-w-[100px]">{v.pagePath || "/"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {stats.recent.length > 15 && (
          <button onClick={() => setShowAll(!showAll)} className={`mt-3 w-full rounded-xl ${th.card} border ${th.border} py-2 text-sm font-semibold ${th.muted} transition`}>
            {showAll ? "Скрыть" : `Показать все ${stats.recent.length}`}
          </button>
        )}
      </ChartCard>
    </div>
  )
}

/* ═══════════════ Tab: Слова ═══════════════ */

const CATEGORIES = [
  { id: "animals", label: "Животные" }, { id: "food", label: "Еда" },
  { id: "professions", label: "Профессии" }, { id: "sports", label: "Спорт" },
  { id: "objects", label: "Предметы" }, { id: "places", label: "Места" },
  { id: "nature", label: "Природа" }, { id: "movies", label: "Кино" },
  { id: "abstract", label: "Абстракции" }, { id: "everyday", label: "Бытовое" },
]
const DIFFICULTIES = [{ id: "easy", label: "Лёгкая" }, { id: "medium", label: "Средняя" }, { id: "hard", label: "Сложная" }]

function WordsTab({ th }: { th: typeof THEMES.light }) {
  const [words, setWords] = useState<CustomWord[]>([])
  const [loading, setLoading] = useState(true)
  const [newWord, setNewWord] = useState({ word: "", wordEn: "", category: "everyday", difficulty: "medium" })

  const refresh = useCallback(() => { setLoading(true); fetch("/api/admin/words").then((r) => r.json()).then((d) => { setWords(d.words || []); setLoading(false) }).catch(() => setLoading(false)) }, [])
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    refresh()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh])

  const handleAdd = async () => {
    if (!newWord.word.trim()) return
    await fetch("/api/admin/words", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newWord) })
    setNewWord({ word: "", wordEn: "", category: "everyday", difficulty: "medium" }); refresh()
  }
  const handleDelete = async (id: string) => { if (!confirm("Удалить слово?")) return; await fetch(`/api/admin/words?id=${id}`, { method: "DELETE" }); refresh() }

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl ${th.card} p-4 shadow-md border ${th.border}`}>
        <h2 className="mb-3 text-lg font-bold">➕ Добавить слово</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="text" value={newWord.word} onChange={(e) => setNewWord({ ...newWord, word: e.target.value })} placeholder="Слово (RU)"
            className={`rounded-xl border ${th.border} ${th.bg} ${th.text} px-3 py-2 outline-none focus:border-violet-500`} />
          <input type="text" value={newWord.wordEn} onChange={(e) => setNewWord({ ...newWord, wordEn: e.target.value })} placeholder="Word (EN)"
            className={`rounded-xl border ${th.border} ${th.bg} ${th.text} px-3 py-2 outline-none focus:border-violet-500`} />
          <select value={newWord.category} onChange={(e) => setNewWord({ ...newWord, category: e.target.value })}
            className={`rounded-xl border ${th.border} ${th.bg} ${th.text} px-3 py-2 outline-none focus:border-violet-500`}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={newWord.difficulty} onChange={(e) => setNewWord({ ...newWord, difficulty: e.target.value })}
            className={`rounded-xl border ${th.border} ${th.bg} ${th.text} px-3 py-2 outline-none focus:border-violet-500`}>
            {DIFFICULTIES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
        <button onClick={handleAdd} className={`mt-3 rounded-xl bg-gradient-to-br ${th.accent} px-6 py-2 font-bold text-white shadow-lg transition`}>Добавить</button>
      </div>

      <div className={`rounded-2xl ${th.card} p-4 shadow-md border ${th.border}`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">📝 Кастомные слова ({words.length})</h2>
          <button onClick={refresh} className={`rounded-xl ${th.card} border ${th.border} px-4 py-1.5 text-sm font-semibold ${th.muted}`}>🔄</button>
        </div>
        {loading ? <div className={`py-4 text-center ${th.muted}`}>Загрузка…</div> :
         words.length === 0 ? <div className={`py-8 text-center ${th.muted}`}>Нет кастомных слов. Добавьте первое!</div> : (
          <div className="space-y-2">
            {words.map((w) => (
              <div key={w.id} className={`flex items-center gap-3 rounded-xl ${th.bg === th.card ? "bg-muted/20" : "bg-black/10"} p-3 transition`}>
                <div className="flex-1">
                  <div className="font-bold">{w.word} <span className={th.muted}>/ {w.wordEn}</span></div>
                  <div className={`text-xs ${th.muted}`}>{CATEGORIES.find((c) => c.id === w.category)?.label || w.category} · {DIFFICULTIES.find((d) => d.id === w.difficulty)?.label || w.difficulty}</div>
                </div>
                <button onClick={() => handleDelete(w.id)} className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-sm font-semibold text-rose-500 transition hover:bg-rose-500/20">🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════ Tab: Устройства ═══════════════ */

function DevicesTab({ th }: { th: typeof THEMES.light }) {
  const [stats, setStats] = useState<AnalyticsStats | null>(null)
  const [devices, setDevices] = useState<DeviceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const refresh = useCallback(() => {
    setLoading(true)
    fetch("/api/analytics").then((r) => r.json()).then((d) => {
      setStats(d)
      // Преобразуем recent в DeviceEntry
      setDevices((d.recent || []).map((v: VisitorEntry) => v as unknown as DeviceEntry))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    refresh()
    const interval = setInterval(refresh, 30000)
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => clearInterval(interval)
  }, [refresh])

  if (loading) return <div className={`py-8 text-center text-lg ${th.muted}`}>Загрузка…</div>
  if (!stats) return <div className="py-8 text-center text-lg text-rose-500">Нет данных</div>

  const visibleDevices = showAll ? devices : devices.slice(0, 20)

  return (
    <div className="space-y-6">
      {/* Сводка по никнеймам */}
      {Object.keys(stats.byNickname || {}).length > 0 && (
        <ChartCard title="👥 Пользователи (никнеймы)" th={th}>
          <Bars data={stats.byNickname} total={stats.total} th={th} />
        </ChartCard>
      )}

      {/* Сводка по типам устройств */}
      <ChartCard title="📱 Типы устройств" th={th}>
        <Bars data={stats.byDeviceType || stats.byDevice || {}} total={stats.total} th={th} />
      </ChartCard>

      {/* Часовые пояса */}
      {Object.keys(stats.byTimezone || {}).length > 0 && (
        <ChartCard title="🌍 Часовые пояса" th={th}>
          <Bars data={stats.byTimezone} total={stats.total} th={th} />
        </ChartCard>
      )}

      {/* Таблица устройств */}
      <ChartCard title={`📱 ${showAll ? "Все" : "Последние"} ${visibleDevices.length} устройств`} th={th}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`border-b ${th.border} text-left ${th.muted}`}>
                <th className="py-1.5 pr-2">Время</th>
                <th className="py-1.5 pr-2">Ник</th>
                <th className="py-1.5 pr-2">IP</th>
                <th className="py-1.5 pr-2">Тип</th>
                <th className="py-1.5 pr-2">Модель</th>
                <th className="py-1.5 pr-2">ОС</th>
                <th className="py-1.5 pr-2">Версия</th>
                <th className="py-1.5 pr-2">Браузер</th>
                <th className="py-1.5 pr-2">Движок</th>
                <th className="py-1.5 pr-2">Экран</th>
                <th className="py-1.5 pr-2">Дост. экран</th>
                <th className="py-1.5 pr-2">Viewport</th>
                <th className="py-1.5 pr-2">DPR</th>
                <th className="py-1.5 pr-2">Глубина</th>
                <th className="py-1.5 pr-2">Гамут</th>
                <th className="py-1.5 pr-2">Ориент.</th>
                <th className="py-1.5 pr-2">CPU</th>
                <th className="py-1.5 pr-2">RAM</th>
                <th className="py-1.5 pr-2">Батарея</th>
                <th className="py-1.5 pr-2">Заряд</th>
                <th className="py-1.5 pr-2">Сеть</th>
                <th className="py-1.5 pr-2">Downlink</th>
                <th className="py-1.5 pr-2">RTT</th>
                <th className="py-1.5 pr-2">Save-Data</th>
                <th className="py-1.5 pr-2">Touch</th>
                <th className="py-1.5 pr-2">Touch pts</th>
                <th className="py-1.5 pr-2">Вибрация</th>
                <th className="py-1.5 pr-2">Гео</th>
                <th className="py-1.5 pr-2">Bluetooth</th>
                <th className="py-1.5 pr-2">NFC</th>
                <th className="py-1.5 pr-2">USB</th>
                <th className="py-1.5 pr-2">Камера</th>
                <th className="py-1.5 pr-2">Геймпад</th>
                <th className="py-1.5 pr-2">WakeLock</th>
                <th className="py-1.5 pr-2">Share</th>
                <th className="py-1.5 pr-2">Clipboard</th>
                <th className="py-1.5 pr-2">SW</th>
                <th className="py-1.5 pr-2">WebGL</th>
                <th className="py-1.5 pr-2">GPU Vendor</th>
                <th className="py-1.5 pr-2">GPU Renderer</th>
                <th className="py-1.5 pr-2">Тёмная</th>
                <th className="py-1.5 pr-2">Reduced Motion</th>
                <th className="py-1.5 pr-2">Reduced Transp.</th>
                <th className="py-1.5 pr-2">Contrast</th>
                <th className="py-1.5 pr-2">Язык</th>
                <th className="py-1.5 pr-2">Языки</th>
                <th className="py-1.5 pr-2">Платформа</th>
                <th className="py-1.5 pr-2">Страна</th>
                <th className="py-1.5 pr-2">Город</th>
                <th className="py-1.5 pr-2">Часовой пояс</th>
                <th className="py-1.5 pr-2">UTC offset</th>
                <th className="py-1.5 pr-2">DNT</th>
                <th className="py-1.5 pr-2">PDF Viewer</th>
                <th className="py-1.5 pr-2">WebDriver</th>
                <th className="py-1.5 pr-2">Страница</th>
                <th className="py-1.5 pr-2">Visitor ID</th>
                <th className="py-1.5 pr-2">User-Agent</th>
              </tr>
            </thead>
            <tbody>
              {visibleDevices.map((d: any, i: number) => (
                <tr key={i} className={`border-b ${th.border}/50 hover:bg-muted/30`}>
                  <td className="py-1 pr-2 whitespace-nowrap">{new Date(d.timestamp).toLocaleString("ru-RU")}</td>
                  <td className="py-1 pr-2 font-bold">{d.nickname || "—"}</td>
                  <td className="py-1 pr-2 font-mono">{d.ip}</td>
                  <td className="py-1 pr-2">{d.deviceType}</td>
                  <td className="py-1 pr-2">{d.deviceModel || "—"}</td>
                  <td className="py-1 pr-2">{d.os}</td>
                  <td className="py-1 pr-2">{d.osVersion || "—"}</td>
                  <td className="py-1 pr-2">{d.browser} {d.browserVersion}</td>
                  <td className="py-1 pr-2">{d.engine || "—"}</td>
                  <td className="py-1 pr-2 font-mono">{d.screenResolution || "—"}</td>
                  <td className="py-1 pr-2 font-mono">{d.availScreenSize || "—"}</td>
                  <td className="py-1 pr-2 font-mono">{d.viewportSize || "—"}</td>
                  <td className="py-1 pr-2">{d.pixelRatio || "—"}</td>
                  <td className="py-1 pr-2">{d.colorDepth || "—"}bit</td>
                  <td className="py-1 pr-2">{d.colorGamut || "—"}</td>
                  <td className="py-1 pr-2">{d.orientation || "—"}</td>
                  <td className="py-1 pr-2">{d.cpuCores || "—"}</td>
                  <td className="py-1 pr-2">{d.deviceMemory ? `${d.deviceMemory}GB` : "—"}</td>
                  <td className="py-1 pr-2">{d.batteryLevel || "—"}</td>
                  <td className="py-1 pr-2">{d.batteryCharging ? "⚡" : "🔋"}</td>
                  <td className="py-1 pr-2">{d.connectionType || "—"}</td>
                  <td className="py-1 pr-2">{d.downlink ? `${d.downlink}Mb/s` : "—"}</td>
                  <td className="py-1 pr-2">{d.rtt ? `${d.rtt}ms` : "—"}</td>
                  <td className="py-1 pr-2">{d.saveData ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.touchSupport ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.maxTouchPoints || "—"}</td>
                  <td className="py-1 pr-2">{d.hasVibration ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.hasGeolocation ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.hasBluetooth ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.hasNFC ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.hasUSB ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.hasCamera ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.hasGamepad ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.hasWakeLock ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.hasShare ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.hasClipboard ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.hasServiceWorker ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.hasWebGL ? "✓" : "—"}</td>
                  <td className="py-1 pr-2 truncate max-w-[100px]" title={d.gpuVendor}>{d.gpuVendor || "—"}</td>
                  <td className="py-1 pr-2 truncate max-w-[120px]" title={d.gpuRenderer}>{d.gpuRenderer || "—"}</td>
                  <td className="py-1 pr-2">{d.prefersDarkMode ? "🌙" : "☀️"}</td>
                  <td className="py-1 pr-2">{d.prefersReducedMotion ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.prefersReducedTransparency ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.prefersContrast || "—"}</td>
                  <td className="py-1 pr-2">{d.language || "—"}</td>
                  <td className="py-1 pr-2 truncate max-w-[80px]">{d.languages || "—"}</td>
                  <td className="py-1 pr-2">{d.platform || "—"}</td>
                  <td className="py-1 pr-2">{d.country || "—"}</td>
                  <td className="py-1 pr-2">{d.city || "—"}</td>
                  <td className="py-1 pr-2 truncate max-w-[100px]">{d.clientTimezone || d.timezone || "—"}</td>
                  <td className="py-1 pr-2">{d.timezoneOffset !== undefined ? `${d.timezoneOffset}min` : "—"}</td>
                  <td className="py-1 pr-2">{d.doNotTrack || "—"}</td>
                  <td className="py-1 pr-2">{d.pdfViewer ? "✓" : "—"}</td>
                  <td className="py-1 pr-2">{d.webdriver ? "⚠️" : "—"}</td>
                  <td className="py-1 pr-2 truncate max-w-[60px]">{d.pagePath || "/"}</td>
                  <td className="py-1 pr-2 truncate max-w-[80px] font-mono text-[10px]">{d.sessionId?.slice(0, 12) || "—"}</td>
                  <td className="py-1 pr-2 truncate max-w-[200px] font-mono text-[10px]" title={d.userAgent}>{d.userAgent?.slice(0, 50)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {devices.length > 20 && (
          <button onClick={() => setShowAll(!showAll)} className={`mt-3 w-full rounded-xl ${th.card} border ${th.border} py-2 text-sm font-semibold ${th.muted}`}>
            {showAll ? "Скрыть" : `Показать все ${devices.length}`}
          </button>
        )}
      </ChartCard>
    </div>
  )
}

/* ═══════════════ Tab: События ═══════════════ */

function EventsTab({ th }: { th: typeof THEMES.light }) {
  const [stats, setStats] = useState<EventStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const refresh = useCallback(() => {
    setLoading(true)
    fetch("/api/events").then((r) => r.json()).then((d) => { setStats(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    refresh()
    const interval = setInterval(refresh, 15000)
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => clearInterval(interval)
  }, [refresh])

  const handleClear = async () => {
    if (!confirm("Удалить все события?")) return
    await fetch("/api/events", { method: "DELETE" })
    refresh()
  }

  if (loading) return <div className={`py-8 text-center text-lg ${th.muted}`}>Загрузка…</div>
  if (!stats) return <div className="py-8 text-center text-lg text-rose-500">Нет данных</div>

  const eventIcons: Record<string, string> = {
    page_view: "👁", dice_roll: "🎲", scored: "✅", skipped: "❌",
    chip_used: "💎", game_start: "🚀", game_over: "🏆", word_shown: "👁",
    word_swapped: "🔄", replay_round: "🔁", undo_round: "↩️",
    mp_connect: "🔗", mp_disconnect: "🔌", board_open: "🗺️", board_close: "🗺️",
    hint_used: "💡", lang_change: "🌐", theme_change: "🎨", nickname_set: "👤",
  }

  const visibleEvents = showAll ? stats.recent : stats.recent.slice(0, 25)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button onClick={refresh} className={`rounded-xl ${th.card} border ${th.border} px-4 py-2 text-sm font-semibold ${th.muted}`}>🔄 Обновить</button>
        <button onClick={handleClear} className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-500">🗑 Очистить</button>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Всего событий" value={stats.total} icon="🎯" th={th} />
        <StatCard label="Уникальных пользователей" value={Object.keys(stats.byNickname || {}).length} icon="👥" th={th} />
        <StatCard label="Типов событий" value={Object.keys(stats.byType || {}).length} icon="📋" th={th} />
        <StatCard label="За последний час" value={Object.values(stats.byHour || {}).slice(-1)[0] || 0} icon="⏰" th={th} />
      </div>

      {/* По типам */}
      <ChartCard title="📋 События по типам" th={th}>
        <Bars data={stats.byType || {}} total={stats.total} th={th} />
      </ChartCard>

      {/* По никнеймам */}
      {Object.keys(stats.byNickname || {}).length > 0 && (
        <ChartCard title="👥 События по пользователям" th={th}>
          <Bars data={stats.byNickname} total={stats.total} th={th} />
        </ChartCard>
      )}

      {/* Лента событий */}
      <ChartCard title={`🎯 ${showAll ? "Все" : "Последние"} ${visibleEvents.length} событий`} th={th}>
        <div className="space-y-1.5">
          {visibleEvents.map((e, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-xl ${th.bg === th.card ? "bg-muted/20" : "bg-black/10"} px-3 py-2 text-xs`}>
              <span className="text-lg">{eventIcons[e.eventType] || "❓"}</span>
              <div className="min-w-0 flex-1">
                <span className="font-bold">{e.eventType}</span>
                {e.nickname && <span className={th.muted}> · {e.nickname}</span>}
                {e.data && Object.keys(e.data).length > 0 && (
                  <span className={th.muted}> · {JSON.stringify(e.data).slice(0, 80)}</span>
                )}
              </div>
              <span className={`shrink-0 ${th.muted} whitespace-nowrap`}>{new Date(e.timestamp).toLocaleTimeString("ru-RU")}</span>
            </div>
          ))}
        </div>
        {stats.recent.length > 25 && (
          <button onClick={() => setShowAll(!showAll)} className={`mt-3 w-full rounded-xl ${th.card} border ${th.border} py-2 text-sm font-semibold ${th.muted}`}>
            {showAll ? "Скрыть" : `Показать все ${stats.recent.length}`}
          </button>
        )}
      </ChartCard>
    </div>
  )
}

/* ═══════════════ Tab: Настройки ═══════════════ */

function SettingsTab({ th, theme, setTheme }: { th: typeof THEMES.light; theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <div className="space-y-4">
      {/* Темы */}
      <div className={`rounded-2xl ${th.card} p-6 shadow-md border ${th.border}`}>
        <h2 className="mb-4 text-lg font-bold">🎨 Тема оформления</h2>
        <div className="grid grid-cols-3 gap-3">
          {(["light", "dark", "blue"] as Theme[]).map((t) => (
            <button key={t} onClick={() => setTheme(t)}
              className={`rounded-2xl border-2 p-4 text-center transition ${theme === t ? "border-violet-500 ring-2 ring-violet-500/30" : th.border}`}>
              <div className="mb-2 text-3xl">{t === "light" ? "☀️" : t === "dark" ? "🌙" : "🔵"}</div>
              <div className="font-bold">{t === "light" ? "Светлая" : t === "dark" ? "Тёмная" : "Синяя"}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Информация */}
      <div className={`rounded-2xl ${th.card} p-6 shadow-md border ${th.border}`}>
        <h2 className="mb-4 text-lg font-bold">⚙️ Система</h2>
        <div className="space-y-3 text-sm">
          <SettingRow label="Версия" value="v49" th={th} />
          <SettingRow label="Next.js" value="16.1.3" th={th} />
          <SettingRow label="Режим" value="standalone" th={th} />
          <SettingRow label="Аналитика" value="JSON + ip-api.com геолокация" th={th} />
          <SettingRow label="Слова" value="JSON (custom-words.json)" th={th} />
          <SettingRow label="Дедупликация" value="visitorId + pagePath" th={th} />
          <SettingRow label="PWA" value="✓ manifest.json" th={th} />
        </div>
      </div>

      <div className={`rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-400/30`}>
        <p className="text-sm text-amber-600 dark:text-amber-400">⚠️ Для production рекомендуется JWT-аутентификация, rate limiting и PostgreSQL вместо JSON-файлов.</p>
      </div>
    </div>
  )
}

/* ═══════════════ Компоненты ═══════════════ */

function TabButton({ active, onClick, icon, label, th }: { active: boolean; onClick: () => void; icon: string; label: string; th: typeof THEMES.light }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${active ? `bg-gradient-to-br ${th.accent} text-white shadow-md` : `${th.card} ${th.muted} hover:${th.text}`}`}>
      <span>{icon}</span><span>{label}</span>
    </button>
  )
}

function StatCard({ label, value, icon, th }: { label: string; value: number; icon: string; th: typeof THEMES.light }) {
  return (
    <div className={`rounded-2xl ${th.card} p-4 shadow-md border ${th.border}`}>
      <div className="mb-2 text-2xl">{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className={`text-xs ${th.muted}`}>{label}</div>
    </div>
  )
}

function ChartCard({ title, th, children }: { title: string; th: typeof THEMES.light; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl ${th.card} p-4 shadow-md border ${th.border}`}>
      <h3 className="mb-3 text-base font-bold">{title}</h3>
      {children}
    </div>
  )
}

function Bars({ data, total, th }: { data: Record<string, number>; total: number; th: typeof THEMES.light }) {
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return <div className={`py-3 text-center text-sm ${th.muted}`}>Нет данных</div>
  return (
    <div className="space-y-1.5">
      {sorted.map(([key, count]) => (
        <div key={key} className="flex items-center gap-2 text-sm">
          <span className="w-32 shrink-0 truncate font-medium">{key}</span>
          <div className={`relative h-6 flex-1 overflow-hidden rounded-full ${th.bg === th.card ? "bg-muted" : "bg-black/20"}`}>
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }} />
          </div>
          <span className={`w-10 shrink-0 text-right font-mono ${th.muted}`}>{count}</span>
        </div>
      ))}
    </div>
  )
}

function HourChart({ data, th }: { data: Record<string, number>; th: typeof THEMES.light }) {
  const entries = Object.entries(data)
  const max = Math.max(...entries.map(([, v]) => v), 1)
  return (
    <div className="flex items-end gap-1" style={{ height: 120 }}>
      {entries.map(([hour, count]) => {
        const h = new Date(hour + ":00:00Z").getHours()
        return (
          <div key={hour} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${h}:00 — ${count} визитов`}>
            <div className={`text-[10px] font-mono ${th.muted}`}>{count > 0 ? count : ""}</div>
            <div className="w-full rounded-t bg-gradient-to-t from-violet-500 to-indigo-400 transition-all" style={{ height: `${(count / max) * 80}px` }} />
            <div className={`text-[9px] ${th.muted}`}>{h}</div>
          </div>
        )
      })}
    </div>
  )
}

function SettingRow({ label, value, th }: { label: string; value: string; th: typeof THEMES.light }) {
  return (
    <div className={`flex items-center justify-between border-b ${th.border}/50 py-2`}>
      <span className={th.muted}>{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  )
}
