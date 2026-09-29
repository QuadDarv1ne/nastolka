"use client"
import { useState, useEffect } from "react"
import { Radio, Wifi, X, Copy, Check, Users, Crown, RefreshCw, LogOut, AlertCircle, Signal, Monitor, Smartphone, Tablet, Globe, Activity } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createRoom, joinRoom, watchLobbies, type MultiplayerClient, type LobbyInfo, type DeviceInfoOut } from "@/lib/multiplayer"

/** Генерирует device info для передачи на сервер */
function getDeviceInfo(playerName?: string) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  const isMobile = /Mobile|iPhone|Android.*Mobile|Windows Phone/i.test(ua)
  const isTablet = /iPad|Tablet|Silk/i.test(ua) || (!isMobile && /Android/.test(ua))
  const deviceType = isTablet ? "tablet" : isMobile ? "phone" : "desktop"
  let os = "unknown"
  if (/Windows NT 10/.test(ua)) os = "Windows"
  else if (/Mac OS X/.test(ua)) os = "macOS"
  else if (/Android/.test(ua)) os = "Android"
  else if (/iPhone|iPad/.test(ua)) os = "iOS"
  else if (/Linux/.test(ua)) os = "Linux"
  let browser = "unknown"
  if (/Edg/.test(ua)) browser = "Edge"
  else if (/OPR|Opera/.test(ua)) browser = "Opera"
  else if (/Firefox/.test(ua)) browser = "Firefox"
  else if (/Chrome/.test(ua) && !/Edg/.test(ua)) browser = "Chrome"
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = "Safari"
  let deviceId = ""
  try {
    deviceId = localStorage.getItem("nastolka-device-id") || ""
    if (!deviceId) {
      deviceId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem("nastolka-device-id", deviceId)
    }
  } catch {}
  return {
    deviceId, deviceType, os, browser,
    screenResolution: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "unknown",
    userAgent: ua,
    language: typeof navigator !== "undefined" ? navigator.language : "unknown",
    playerName,
  }
}
import { t, type Lang } from "@/lib/i18n"

interface Props {
  open: boolean; onOpenChange: (v: boolean) => void
  onConnect: (client: MultiplayerClient, role: "host" | "guest", code: string, syncMode: "host" | "sync") => void
  status: "disconnected" | "connecting" | "connected" | "error"
  members: number; errorMessage: string | null; lang: Lang
  roomCode?: string | null
  /** Round-trip time в ms — индикатор качества связи */
  rttMs?: number
  /** Список подключённых устройств с инфо */
  devices?: DeviceInfoOut[]
  /** Номер активной попытки реконнекта (0 = нет) */
  reconnectAttempt?: number
  onDisconnect?: () => void
}

/** Иконка качества связи по RTT */
function RttIndicator({ rttMs, lang }: { rttMs: number; lang: Lang }) {
  if (!rttMs) return null
  let color = "text-emerald-500"
  let label = lang === "ru" ? "Отлично" : "Excellent"
  if (rttMs > 300) { color = "text-rose-500"; label = lang === "ru" ? "Плохо" : "Poor" }
  else if (rttMs > 100) { color = "text-amber-500"; label = lang === "ru" ? "Средне" : "Fair" }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-bold ${color}`} title={`${lang === "ru" ? "Пинг" : "Ping"}: ${rttMs}ms`}>
      <Signal className="h-3 w-3" />
      {rttMs}ms · {label}
    </span>
  )
}

/** Иконка типа устройства */
function DeviceIcon({ type }: { type: string }) {
  if (type === "phone") return <Smartphone className="h-3.5 w-3.5" />
  if (type === "tablet") return <Tablet className="h-3.5 w-3.5" />
  if (type === "desktop" || type === "laptop") return <Monitor className="h-3.5 w-3.5" />
  return <Globe className="h-3.5 w-3.5" />
}

export function MultiplayerDialog({ open, onOpenChange, onConnect, status, members, errorMessage, lang, roomCode, rttMs, devices, reconnectAttempt, onDisconnect }: Props) {
  const [mode, setMode] = useState<"choose" | "create" | "join" | "lobbies">("choose")
  const [code, setCode] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [syncMode, setSyncMode] = useState<"host" | "sync">("host")
  const [copied, setCopied] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [hostName, setHostName] = useState("")
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([])
  const [lobbyWatcher, setLobbyWatcher] = useState<{ stop: () => void } | null>(null)

  useEffect(() => {
    if (mode === "lobbies" && !lobbyWatcher) {
      watchLobbies((list) => setLobbies(list)).then((w) => setLobbyWatcher(w))
    }
    if (mode !== "lobbies" && lobbyWatcher) {
      lobbyWatcher.stop()
      setLobbyWatcher(null)
    }
  }, [mode, lobbyWatcher])

  useEffect(() => {
    return () => { if (lobbyWatcher) lobbyWatcher.stop() }
  }, [lobbyWatcher])

  const handleCreate = async () => {
    setConnecting(true); setLocalError(null)
    try {
      const client = await createRoom(syncMode, { open: createOpen, hostName: hostName || "???", teamCount: 2, targetScore: 10, device: getDeviceInfo(hostName || undefined) })
      onConnect(client, "host", client.code, syncMode)
    } catch (e) { setLocalError(e instanceof Error ? e.message : t(lang, "mpErrorTitle")) }
    finally { setConnecting(false) }
  }

  const handleJoin = async (joinCode?: string) => {
    const finalCode = (joinCode || code).trim().toUpperCase()
    if (finalCode.length < 4) return
    setConnecting(true); setLocalError(null)
    try {
      const client = await joinRoom(finalCode, syncMode, getDeviceInfo())
      onConnect(client, "guest", finalCode, syncMode)
    } catch (e) { setLocalError(e instanceof Error ? e.message : t(lang, "mpErrorTitle")) }
    finally { setConnecting(false) }
  }

  const handleCopyCode = async () => {
    if (!roomCode) return
    try { await navigator.clipboard.writeText(roomCode); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto nice-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl"><Radio className="h-6 w-6" />{t(lang, "mpTitle")}</DialogTitle>
          <DialogDescription>{t(lang, "mpDescription")}</DialogDescription>
        </DialogHeader>

        {localError && <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">{localError}</div>}
        {errorMessage && <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">{errorMessage}</div>}

        {/* ── Выбор режима ── */}
        {mode === "choose" && (
          <div className="space-y-3">
            <Button size="lg" className="w-full font-bold" onClick={() => setMode("create")}>
              <Crown className="mr-2 h-5 w-5" />{t(lang, "mpCreateRoom")}
            </Button>
            <Button size="lg" variant="outline" className="w-full font-bold" onClick={() => setMode("join")}>
              <Radio className="mr-2 h-5 w-5" />{t(lang, "mpJoinByCode")}
            </Button>
            <Button size="lg" variant="outline" className="w-full font-bold" onClick={() => setMode("lobbies")}>
              <Users className="mr-2 h-5 w-5" />{t(lang, "mpOpenLobbies")}
            </Button>
          </div>
        )}

        {/* ── Создание комнаты ── */}
        {mode === "create" && (
          <div className="space-y-3">
            {roomCode ? (
              <div className="rounded-2xl bg-emerald-500/10 p-4 ring-1 ring-emerald-400/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{t(lang, "mpRoomActive")}</div>
                    <div className="text-2xl font-black tracking-[0.3em]">{roomCode}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={handleCopyCode}>{copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}</Button>
                </div>
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={createOpen} onChange={(e) => setCreateOpen(e.target.checked)} className="h-4 w-4 rounded" />
                  {t(lang, "mpOpenRoom")}
                </label>
                {createOpen && (
                  <Input value={hostName} onChange={(e) => setHostName(e.target.value.slice(0, 20))} placeholder={t(lang, "mpHostName")} className="text-sm" />
                )}
                <Button size="lg" className="w-full font-bold" onClick={handleCreate} disabled={connecting}>
                  {connecting ? t(lang, "mpCreating") : t(lang, "mpCreateRoom")}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setMode("choose")}>{t(lang, "mpBack")}</Button>
          </div>
        )}

        {/* ── Ввод кода ── */}
        {mode === "join" && (
          <div className="space-y-3">
            <div>
              <Label className="mb-2 block">{t(lang, "mpRoomCodeLabel")}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))} placeholder="ABCD" className="text-center text-2xl font-black tracking-[0.3em] tabular-nums" maxLength={4} />
            </div>
            <Button size="lg" className="w-full font-bold" onClick={() => handleJoin()} disabled={connecting || code.trim().length !== 4}>
              {connecting ? t(lang, "mpJoining") : t(lang, "mpJoin")}
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setMode("choose")}>{t(lang, "mpBack")}</Button>
          </div>
        )}

        {/* ── Открытые лобби ── */}
        {mode === "lobbies" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t(lang, "mpOpenLobbies")}</Label>
              <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>{t(lang, "mpBack")}</Button>
            </div>
            {lobbies.length === 0 ? (
              <div className="rounded-2xl bg-muted/40 p-8 text-center text-sm text-muted-foreground">{t(lang, "mpNoOpenLobbies")}</div>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto nice-scroll">
                {lobbies.map((lobby) => (
                  <button key={lobby.code} onClick={() => { handleJoin(lobby.code); setMode("choose") }}
                    className="flex w-full items-center justify-between rounded-2xl border-2 border-border bg-card p-4 text-left transition hover:border-violet-500 hover:bg-muted/30">
                    <div>
                      <div className="text-2xl font-black tracking-[0.3em]">{lobby.code}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{t(lang, "mpHost")}: {lobby.hostName} · {lobby.teamCount} {t(lang, "teamsLabel")} · {t(lang, "targetLabel")}: {lobby.targetScore}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{lobby.members}/{lobby.maxMembers}</span>
                      <div className="flex -space-x-1">
                        {Array.from({ length: lobby.members }).map((_, i) => (<span key={i} className="h-6 w-6 rounded-full bg-violet-500 ring-2 ring-card" />))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Активная комната ── */}
        {(status === "connected" || status === "connecting" || roomCode) && (
          <div className="mt-4 space-y-3">
            <div className={`rounded-2xl p-4 ring-1 ${reconnectAttempt && reconnectAttempt > 0 ? "bg-amber-500/10 ring-amber-400/30" : "bg-emerald-500/10 ring-emerald-400/30"}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className={`flex items-center gap-2 text-sm font-bold ${reconnectAttempt && reconnectAttempt > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {reconnectAttempt && reconnectAttempt > 0 ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {lang === "ru" ? "Переподключение…" : "Reconnecting…"}
                      </>
                    ) : (
                      <>
                        <Wifi className="h-4 w-4" />{t(lang, "mpRoomActive")}
                      </>
                    )}
                  </div>
                  {roomCode && <div className="mt-1 text-2xl font-black tracking-[0.3em]">{roomCode}</div>}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{members} {members === 1 ? t(lang, "mpPlayer") : t(lang, "mpPlayers")} {t(lang, "mpInRoom")}</span>
                    {rttMs !== undefined && rttMs > 0 && <RttIndicator rttMs={rttMs} lang={lang} />}
                    {reconnectAttempt && reconnectAttempt > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        {lang === "ru" ? `попытка ${reconnectAttempt}/6` : `attempt ${reconnectAttempt}/6`}
                      </span>
                    )}
                  </div>
                </div>
                {onDisconnect && (
                  <Button variant="outline" size="sm" onClick={onDisconnect} className="border-rose-400/30 text-rose-600 hover:bg-rose-500/10">
                    <LogOut className="mr-1.5 h-4 w-4" />{t(lang, "mpDisconnect")}
                  </Button>
                )}
              </div>
            </div>

            {/* Список подключённых устройств */}
            {devices && devices.length > 0 && (
              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {lang === "ru" ? "Подключённые игроки" : "Connected players"}
                </div>
                <div className="space-y-1.5">
                  {devices.map((d, i) => (
                    <div key={d.socketId || i} className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-1.5 text-xs">
                      <DeviceIcon type={d.deviceType} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{d.playerName}</span>
                          {i === 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400" title={lang === "ru" ? "Хост" : "Host"}>
                              <Crown className="h-2.5 w-2.5" />
                              {lang === "ru" ? "хост" : "host"}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {d.os} · {d.browser}
                          {d.ipPrefix && <span className="ml-1 opacity-70">· 🌐 {d.ipPrefix}</span>}
                          {d.canvasFingerprint && <span className="ml-1 opacity-50" title={lang === "ru" ? "Fingerprint" : "Fingerprint"}>· 🔐 {d.canvasFingerprint}</span>}
                        </div>
                      </div>
                      {d.status === "away" && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400" title={lang === "ru" ? "Отошёл" : "Away"}>
                          <Activity className="h-2.5 w-2.5" />
                          {lang === "ru" ? "отошёл" : "away"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Обрыв связи ── */}
        {status === "error" && errorMessage && (
          <div className="mt-4 rounded-2xl bg-rose-500/10 p-4 ring-1 ring-rose-400/30">
            <div className="flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4" />{errorMessage}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
