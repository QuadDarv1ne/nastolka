"use client"

import { useState } from "react"
import { Radio, Wifi, X, Copy, Check, Users, Crown, RefreshCw } from "lucide-react"
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
import { createRoom, joinRoom, type MultiplayerClient } from "@/lib/multiplayer"
import { t, type Lang } from "@/lib/i18n"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConnect: (client: MultiplayerClient, role: "host" | "guest", code: string, syncMode: "host" | "sync") => void
  status: "disconnected" | "connecting" | "connected" | "error"
  members: number
  errorMessage: string | null
  lang: Lang
}

export function MultiplayerDialog({
  open,
  onOpenChange,
  onConnect,
  status,
  members,
  errorMessage,
  lang,
}: Props) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose")
  const [code, setCode] = useState("")
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [syncMode, setSyncMode] = useState<"host" | "sync">("host")

  const handleCreate = async () => {
    setConnecting(true)
    setLocalError(null)
    try {
      const client = await createRoom(syncMode)
      setCreatedCode(client.code)
      onConnect(client, "host", client.code, syncMode)
    } catch (e) {
      const msg = e instanceof Error ? e.message : t(lang, "mpErrorTitle")
      setLocalError(msg)
      console.error('[multiplayer] create error:', e)
    } finally {
      setConnecting(false)
    }
  }

  const handleJoin = async () => {
    if (code.trim().length !== 4) return
    setConnecting(true)
    setLocalError(null)
    try {
      const client = await joinRoom(code.trim().toUpperCase(), syncMode)
      onConnect(client, "guest", code.trim().toUpperCase(), syncMode)
    } catch (e) {
      const msg = e instanceof Error ? e.message : t(lang, "mpErrorTitle")
      setLocalError(msg)
      console.error('[multiplayer] join error:', e)
    } finally {
      setConnecting(false)
    }
  }

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
              {members} {members === 1 ? t(lang, "mpPlayer") : t(lang, "mpPlayers")} {lang === "ru" ? "в комнате" : "in room"}
            </div>
            {createdCode && (
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">{t(lang, "mpRoomCode")} </span>
                <span className="font-mono font-bold">{createdCode}</span>
              </div>
            )}
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

        {status === "disconnected" && mode === "choose" && (
          <div className="space-y-3">
            {/* Выбор режима синхронизации */}
            <div className="rounded-2xl bg-muted/50 p-4">
              <Label className="mb-2 block text-sm font-semibold">{t(lang, "mpModeTitle")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSyncMode("host")}
                  className={`flex flex-col items-start gap-1 rounded-xl p-3 text-left transition ${
                    syncMode === "host"
                      ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow"
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
                      ? "bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow"
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
            <p className="text-xs text-muted-foreground">
              {t(lang, "mpInfo")}
            </p>
          </div>
        )}

        {status === "disconnected" && mode === "create" && !createdCode && (
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

        {status === "disconnected" && mode === "create" && createdCode && (
          <div className="space-y-3 text-center">
            <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white">
              <div className="text-xs font-semibold uppercase tracking-widest opacity-90">
                {lang === "ru" ? "Код комнаты" : "Room code"}
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

        {status === "disconnected" && mode === "join" && (
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
              onClick={handleJoin}
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
      </DialogContent>
    </Dialog>
  )
}

// Иконка X добавлена в импорт, чтобы не удалять при неиспользовании (символический импорт)
void X
