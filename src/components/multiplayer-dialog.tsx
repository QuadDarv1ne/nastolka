"use client"

import { useCallback, useEffect, useState } from "react"
import { Radio, Wifi, Copy, Check, Users, Crown, RefreshCw, Settings2, PlugZap, Globe } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createRoom,
  joinRoom,
  listLobbiesOnce,
  getManualMpUrl,
  setManualMpUrl,
  getPlayerName,
  setPlayerName,
  type MultiplayerClient,
  type LobbyInfo,
  type RoomMember,
} from "@/lib/multiplayer"
import { t, type Lang } from "@/lib/i18n"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConnect: (client: MultiplayerClient, role: "host" | "guest", code: string, syncMode: "host" | "sync", teamIndex: number) => void
  onDisconnect: () => void
  status: "disconnected" | "connecting" | "connected" | "error"
  members: number
  errorMessage: string | null
  /** Код активной комнаты (если подключены) — показывается даже после закрытия диалога */
  roomCode?: string | null
  /** Моя команда в комнате (если подключены) */
  myTeamIndex?: number | null
  /** Список участников комнаты с профилями устройств */
  roomMembers?: RoomMember[]
  lang: Lang
}

export function MultiplayerDialog({
  open,
  onOpenChange,
  onConnect,
  onDisconnect,
  status,
  members,
  errorMessage,
  roomCode,
  myTeamIndex,
  roomMembers,
  lang,
}: Props) {
  const [mode, setMode] = useState<"choose" | "create" | "join" | "lobbies">("choose")
  const [code, setCode] = useState("")
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [syncMode, setSyncMode] = useState<"host" | "sync">("host")
  const [lobbies, setLobbies] = useState<LobbyInfo[] | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [mpUrl, setMpUrl] = useState("")
  const [mpUrlSaved, setMpUrlSaved] = useState(false)
  /** Имя игрока (сохраняется в localStorage, отправляется на сервер) */
  const [playerName, setPlayerName] = useState("")

  // Подтягиваем сохранённые имя и адрес сервера (только на клиенте)
  useEffect(() => {
    setPlayerName(getPlayerName())
    setMpUrl(getManualMpUrl())
  }, [open])

  // Подтягиваем сохранённый адрес сервера (только на клиенте)
  useEffect(() => {
    setMpUrl(getManualMpUrl())
  }, [open])

  const handleSaveMpUrl = () => {
    setManualMpUrl(mpUrl)
    setMpUrlSaved(true)
    setTimeout(() => setMpUrlSaved(false), 1500)
  }

  const handleCreate = async () => {
    setConnecting(true)
    setLocalError(null)
    try {
      setPlayerName(playerName) // сохраняем имя перед подключением
      const client = await createRoom(syncMode)
      setCreatedCode(client.code)
      onConnect(client, "host", client.code, syncMode, client.teamIndex)
    } catch (e) {
      const msg = e instanceof Error ? e.message : t(lang, "mpErrorTitle")
      setLocalError(msg)
      console.error('[multiplayer] create error:', e)
    } finally {
      setConnecting(false)
    }
  }

  const handleJoin = async (joinCode: string) => {
    const normalized = joinCode.trim().toUpperCase()
    if (normalized.length !== 4) return
    setConnecting(true)
    setLocalError(null)
    try {
      setPlayerName(playerName) // сохраняем имя перед подключением
      // syncMode приходит от сервера (его задаёт хост комнаты), а не выбирается гостем
      const client = await joinRoom(normalized)
      onConnect(client, "guest", normalized, client.syncMode, client.teamIndex)
    } catch (e) {
      const msg = e instanceof Error ? e.message : t(lang, "mpErrorTitle")
      setLocalError(msg)
      console.error('[multiplayer] join error:', e)
    } finally {
      setConnecting(false)
    }
  }

  /* ─── Список открытых лобби (третий вид) ─── */
  const refreshLobbies = useCallback(async () => {
    try {
      const list = await listLobbiesOnce()
      setLobbies(list)
    } catch (e) {
      console.warn("[multiplayer] не удалось получить список лобби:", e)
      setLobbies([])
    }
  }, [])

  useEffect(() => {
    if (open && mode === "lobbies" && status !== "connected") {
      void refreshLobbies()
      const id = setInterval(() => void refreshLobbies(), 5000)
      return () => clearInterval(id)
    }
  }, [open, mode, status, refreshLobbies])

  const handleCopyCode = async () => {
    if (!createdCode) return
    try {
      await navigator.clipboard.writeText(createdCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const reset = () => {
    setMode("choose")
    setCode("")
    setCreatedCode(null)
    setCopied(false)
    setConnecting(false)
    setLocalError(null)
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto nice-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Radio className="h-6 w-6" />
            {t(lang, "mpTitle")}
          </DialogTitle>
          <DialogDescription>
            {t(lang, "mpDescription")}
          </DialogDescription>
        </DialogHeader>

        {status === "connected" && (
          <div className="rounded-2xl bg-emerald-500/10 p-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Check className="h-5 w-5" />
              <span className="font-bold">{t(lang, "mpConnected")}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <Users className="mr-1 inline h-4 w-4" />
              {members} {members === 1 ? t(lang, "mpPlayer") : t(lang, "mpPlayers")} {t(lang, "mpInRoom")}
            </div>
            {(roomCode || createdCode) && (
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">{t(lang, "mpRoomCode")} </span>
                <span className="font-mono font-bold">{roomCode || createdCode}</span>
              </div>
            )}
            {myTeamIndex !== null && myTeamIndex !== undefined && (
              <div className="mt-1 text-sm">
                <span className="text-muted-foreground">{t(lang, "mpMyTeam")}: </span>
                <span className="font-bold">{t(lang, "mpTeamAssigned")} #{myTeamIndex + 1}</span>
              </div>
            )}
            {/* Список участников комнаты: кто какой командой играет и с какого устройства */}
            {roomMembers && roomMembers.length > 0 && (
              <div className="mt-3 space-y-1.5 text-left">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t(lang, "mpMembersTitle")}
                </div>
                {roomMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-xl bg-card px-3 py-2"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-linear-to-br from-amber-400 to-orange-500 text-sm font-black text-white">
                      {m.teamIndex + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{m.profile.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {m.profile.model} · {m.profile.os} · {m.profile.browser}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {m.profile.deviceType === "phone" ? "📱" : m.profile.deviceType === "tablet" ? "📲" : "💻"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 text-rose-600 hover:text-rose-700 dark:text-rose-400"
              onClick={() => {
                onDisconnect()
                reset()
              }}
            >
              <PlugZap className="mr-2 h-4 w-4" />
              {t(lang, "mpDisconnect")}
            </Button>
          </div>
        )}

        {status === "error" && errorMessage && (
          <div className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            {errorMessage}
          </div>
        )}

        {status === "error" && errorMessage && (
          <div className="rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-400">
            {errorMessage}
          </div>
        )}

        {localError && (
          <div className="space-y-2 rounded-2xl bg-rose-500/10 p-4 text-sm">
            <div className="font-semibold text-rose-700 dark:text-rose-400">
              ⚠️ {t(lang, "mpErrorTitle")}
            </div>
            <div className="text-rose-600 dark:text-rose-400">{localError}</div>
            <div className="text-xs text-muted-foreground">
              {t(lang, "mpErrorHint")}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setLocalError(null)}
            >
              {t(lang, "mpErrorRetry")}
            </Button>
          </div>
        )}

        {status !== "connected" && mode === "choose" && (
          <div className="space-y-3">
            {/* Имя игрока — видно другим участникам комнаты */}
            <div>
              <Label className="mb-1.5 block text-sm font-semibold">{t(lang, "mpPlayerName")}</Label>
              <Input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
                onBlur={() => setPlayerName(playerName)}
                placeholder={t(lang, "mpPlayerNamePlaceholder")}
                className="text-sm"
                maxLength={20}
                autoCapitalize="words"
              />
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {t(lang, "mpPlayerNameHint")}
              </p>
            </div>

            {/* Выбор режима синхронизации */}
            <div className="rounded-2xl bg-muted/50 p-4">
              <Label className="mb-2 block text-sm font-semibold">{t(lang, "mpModeTitle")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSyncMode("host")}
                  className={`flex flex-col items-start gap-1 rounded-xl p-3 text-left transition ${
                    syncMode === "host"
                      ? "bg-linear-to-br from-amber-400 to-orange-500 text-white shadow"
                      : "bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <Crown className="h-5 w-5" />
                  <span className="text-sm font-bold">{t(lang, "mpModeHost")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSyncMode("sync")}
                  className={`flex flex-col items-start gap-1 rounded-xl p-3 text-left transition ${
                    syncMode === "sync"
                      ? "bg-linear-to-br from-sky-400 to-cyan-500 text-white shadow"
                      : "bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <RefreshCw className="h-5 w-5" />
                  <span className="text-sm font-bold">{t(lang, "mpModeSync")}</span>
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {syncMode === "host" ? t(lang, "mpModeHostHint") : t(lang, "mpModeSyncHint")}
              </p>
            </div>

            <Button
              size="lg"
              className="w-full font-bold"
              onClick={() => setMode("create")}
            >
              <Wifi className="mr-2 h-5 w-5" />
              {t(lang, "mpCreateRoom")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full font-bold"
              onClick={() => setMode("join")}
            >
              <Users className="mr-2 h-5 w-5" />
              {t(lang, "mpJoinByCode")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full font-bold"
              onClick={() => setMode("lobbies")}
            >
              <Globe className="mr-2 h-5 w-5" />
              {t(lang, "mpLobbiesTitle")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t(lang, "mpInfo")}
            </p>

            {/* Ручной адрес сервера — для нестандартных сетей */}
            <div className="rounded-2xl border border-dashed p-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center gap-2 text-sm font-semibold text-muted-foreground"
              >
                <Settings2 className="h-4 w-4" />
                {t(lang, "mpAdvanced")}
                {getManualMpUrl() && (
                  <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                    {getManualMpUrl()}
                  </span>
                )}
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-2">
                  <Label className="text-xs">{t(lang, "mpServerUrlLabel")}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={mpUrl}
                      onChange={(e) => setMpUrl(e.target.value)}
                      placeholder={t(lang, "mpServerUrlPlaceholder")}
                      className="text-sm"
                      inputMode="url"
                      autoCapitalize="off"
                      autoCorrect="off"
                    />
                    <Button size="sm" variant="secondary" onClick={handleSaveMpUrl}>
                      {mpUrlSaved ? <Check className="h-4 w-4" /> : t(lang, "mpSave")}
                    </Button>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {t(lang, "mpServerUrlHint")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {status !== "connected" && mode === "create" && !createdCode && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t(lang, "mpCreateDescription")}
            </p>
            <Button
              size="lg"
              className="w-full font-bold"
              onClick={handleCreate}
              disabled={connecting}
            >
              {connecting ? t(lang, "mpCreating") : t(lang, "mpCreateRoom")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setMode("choose")}
            >
              {t(lang, "mpBack")}
            </Button>
          </div>
        )}

        {createdCode && !connecting && status !== "connected" && mode === "create" && (
          <div className="space-y-3 text-center">
            <div className="rounded-2xl bg-linear-to-br from-amber-400 to-orange-500 p-6 text-white">
              <div className="text-xs font-semibold uppercase tracking-widest opacity-90">
                {t(lang, "mpRoomCode")}
              </div>
              <div className="my-2 text-5xl font-black tracking-[0.3em] tabular-nums">
                {createdCode}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full bg-white/20 font-semibold text-white hover:bg-white/30"
                onClick={handleCopyCode}
              >
                {copied ? <><Check className="mr-2 h-4 w-4" /> {t(lang, "mpCodeCopied")}</> : <><Copy className="mr-2 h-4 w-4" /> {t(lang, "mpCopyCode")}</>}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(lang, "mpCodeShareHint")}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={reset}
            >
              {t(lang, "mpStartOver")}
            </Button>
          </div>
        )}

        {status !== "connected" && mode === "join" && (
          <div className="space-y-3">
            <div>
              <Label className="mb-2 block">{t(lang, "mpRoomCodeLabel")}</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="ABCD"
                className="text-center text-2xl font-black tracking-[0.3em] tabular-nums"
                maxLength={4}
              />
            </div>
            <Button
              size="lg"
              className="w-full font-bold"
              onClick={() => void handleJoin(code)}
              disabled={connecting || code.trim().length !== 4}
            >
              {connecting ? t(lang, "mpJoining") : t(lang, "mpJoin")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setMode("choose")}
            >
              {t(lang, "mpBack")}
            </Button>
          </div>
        )}

        {status !== "connected" && mode === "lobbies" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t(lang, "mpLobbiesDescription")}</p>
              <Button variant="ghost" size="icon" onClick={() => void refreshLobbies()} aria-label={t(lang, "mpLobbiesRefresh")}>
                <RefreshCw className={`h-4 w-4 ${lobbies === null ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {lobbies === null && (
              <div className="rounded-2xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
                {t(lang, "mpLobbiesLoading")}
              </div>
            )}

            {lobbies !== null && lobbies.length === 0 && (
              <div className="rounded-2xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
                {t(lang, "mpLobbiesEmpty")}
              </div>
            )}

            {lobbies !== null && lobbies.length > 0 && (
              <div className="space-y-2">
                {lobbies.map((lobby) => (
                  <div
                    key={lobby.code}
                    className="flex items-center gap-3 rounded-2xl border bg-card p-3"
                  >
                    <div className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-linear-to-br from-amber-400 to-orange-500 font-mono text-lg font-black text-white">
                      {lobby.code}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-bold">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {lobby.members}/{lobby.max}
                        <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          lobby.status === "lobby"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : "bg-sky-500/15 text-sky-600"
                        }`}>
                          {lobby.status === "lobby" ? t(lang, "mpLobbyOpen") : t(lang, "mpLobbyPlaying")}
                        </span>
                      </div>
                      {lobby.teams.length > 0 && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {lobby.teams.map((tm) => `${tm.emoji} ${tm.name}`).join(" · ")}
                        </div>
                      )}
                      {/* Кто уже в комнате (имена + устройства) */}
                      {lobby.players && lobby.players.length > 0 && (
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                          {lobby.players.map((p) => p.profile.name).join(" · ")}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 font-bold"
                      disabled={connecting || lobby.members >= lobby.max}
                      onClick={() => void handleJoin(lobby.code)}
                    >
                      {t(lang, "mpLobbyJoin")}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setMode("choose")}
            >
              {t(lang, "mpBack")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
