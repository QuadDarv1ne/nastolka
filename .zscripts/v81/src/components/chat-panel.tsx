"use client"
import { useEffect, useRef, useState } from "react"
import { MessageSquare, Send, Trash2, Lock, Zap, X, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/hooks/i18n-context"
import { t as translate, type Lang, type StringKey } from "@/lib/i18n"
import type { MultiplayerClient, ChatMessage } from "@/lib/multiplayer"
import { playChatNotification } from "@/lib/sounds"

interface Props {
  client: MultiplayerClient | null
  /** Текущая фаза игры — определяет, заблокирован ли чат */
  phase: string
  /** Локальное имя игрока для подсветки своих сообщений */
  selfDeviceId: string
  lang: Lang
}

/** Допустимые emoji-реакции */
const REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "🎉"] as const

/** Ключи быстрых фраз */
const QUICK_PHRASES: StringKey[] = [
  "qpReady", "qpWait", "qpGo", "qpGoodLuck", "qpWellPlayed", "qpAgain", "qpBrb", "qpLol", "qpGg",
]

/** Чат видим только в мультиплеере. Блокируется во время игры (фазы ready/playing/.../round_end). Разблокируется в setup и game_over. */
export function ChatPanel({ client, phase, selfDeviceId, lang }: Props) {
  const { t } = useI18n()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [unreadCount, setUnreadCount] = useState(0)
  const [openReactionFor, setOpenReactionFor] = useState<string | null>(null)
  const [showQuickPhrases, setShowQuickPhrases] = useState(false)
  const [typingPeers, setTypingPeers] = useState<Record<string, { playerName: string; ts: number }>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  // Чат заблокирован во время игры — разрешён только в setup и game_over
  const isBlocked = phase !== "setup" && phase !== "game_over"

  // Подписка на события чата
  useEffect(() => {
    if (!client) return
    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      // Звук уведомления для чужих сообщений
      if (msg.deviceId !== selfDeviceId) {
        playChatNotification()
        // Если чат заблокирован — увеличить счётчик непрочитанных
        if (isBlocked) {
          setUnreadCount((c) => c + 1)
        }
        // Снять typing-индикатор для этого устройства
        setTypingPeers((prev) => {
          if (!prev[msg.deviceId]) return prev
          const next = { ...prev }
          delete next[msg.deviceId]
          return next
        })
      }
    }
    const onHistory = (payload: { messages: ChatMessage[] }) => {
      setMessages(payload.messages)
    }
    const onCleared = () => {
      setMessages([])
      setUnreadCount(0)
    }
    const onUpdated = (updated: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    }
    const onTyping = (payload: { playerName: string; deviceId: string }) => {
      if (payload.deviceId === selfDeviceId) return
      setTypingPeers((prev) => ({
        ...prev,
        [payload.deviceId]: { playerName: payload.playerName, ts: Date.now() },
      }))
    }
    const onStopTyping = (payload: { deviceId: string }) => {
      setTypingPeers((prev) => {
        if (!prev[payload.deviceId]) return prev
        const next = { ...prev }
        delete next[payload.deviceId]
        return next
      })
    }
    client.on("chat-message", onMessage)
    client.on("chat-history", onHistory)
    client.on("chat-cleared", onCleared)
    client.on("chat-message-updated", onUpdated)
    client.on("chat-typing", onTyping)
    client.on("chat-stop-typing", onStopTyping)
    client.requestChatHistory()
    return () => {
      client.off("chat-message", onMessage)
      client.off("chat-history", onHistory)
      client.off("chat-cleared", onCleared)
      client.off("chat-message-updated", onUpdated)
      client.off("chat-typing", onTyping)
      client.off("chat-stop-typing", onStopTyping)
    }
  }, [client, selfDeviceId, isBlocked])

  // Авто-очистка typing-индикаторов через 3.5 сек после последнего события
  useEffect(() => {
    if (Object.keys(typingPeers).length === 0) return
    const id = setInterval(() => {
      const now = Date.now()
      setTypingPeers((prev) => {
        const next: typeof prev = {}
        let changed = false
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.ts < 3500) {
            next[k] = v
          } else {
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 500)
    return () => clearInterval(id)
  }, [typingPeers])

  // При разблокировке чата — обнулить счётчик непрочитанных
  useEffect(() => {
    if (!isBlocked && unreadCount > 0) {
      const id = requestAnimationFrame(() => setUnreadCount(0))
      return () => cancelAnimationFrame(id)
    }
  }, [isBlocked, unreadCount])

  // Автоскролл вниз при новых сообщениях (только если чат разблокирован)
  useEffect(() => {
    if (scrollRef.current && !isBlocked) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isBlocked])

  // Typing-индикатор: debounce — отправляем событие не чаще, чем раз в 1.5 сек
  const lastTypingSentRef = useRef(0)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setInput(v)
    if (!client || isBlocked) return
    // Отправить typing, если прошло > 1.5 сек с прошлого раза, и поле не пустое
    const now = Date.now()
    if (v.trim() && now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now
      client.sendChatTyping()
    } else if (!v.trim() && lastTypingSentRef.current > 0) {
      lastTypingSentRef.current = 0
      client.sendChatStopTyping()
    }
  }

  const handleSend = (text?: string) => {
    const value = (text ?? input).trim()
    if (!value || !client || isBlocked) return
    client.sendChat(value)
    setInput("")
    lastTypingSentRef.current = 0
    client.sendChatStopTyping()
    setShowQuickPhrases(false)
  }

  const handleClear = () => {
    if (!client) return
    if (confirm(t("chatClearConfirm"))) {
      client.clearChat()
    }
  }

  const handleReaction = (messageId: string, emoji: string) => {
    if (!client) return
    client.toggleChatReaction(messageId, emoji)
    setOpenReactionFor(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Закрытие панелей при клике вне
  useEffect(() => {
    if (!openReactionFor && !showQuickPhrases) return
    const onClick = () => {
      setOpenReactionFor(null)
      setShowQuickPhrases(false)
    }
    // Delay чтобы не закрыть сразу же кликом, открывшим панель
    const id = setTimeout(() => window.addEventListener("click", onClick), 100)
    return () => {
      clearTimeout(id)
      window.removeEventListener("click", onClick)
    }
  }, [openReactionFor, showQuickPhrases])

  if (!client) {
    return (
      <div className="flex w-full flex-col rounded-2xl border border-dashed border-border bg-card/50 shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span>{t("chatTitle")}</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-semibold">{t("chatNoClient")}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("chatNoClientHint")}</p>
          </div>
        </div>
      </div>
    )
  }

  // Активные «печатающие» игроки
  const typingList = Object.values(typingPeers)
  const typingText = typingList.length === 0
    ? null
    : typingList.length === 1
      ? `${typingList[0].playerName} ${t("chatTyping")}`
      : typingList.length === 2
        ? `${typingList[0].playerName} и ${typingList[1].playerName} ${t("chatTyping")}`
        : `${typingList.length} ${lang === "ru" ? "человек печатают…" : "people typing…"}`

  return (
    <div className="flex w-full flex-col rounded-2xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span>{t("chatTitle")}</span>
          {isBlocked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <Lock className="h-3 w-3" />
              {lang === "ru" ? "заблокирован" : "locked"}
            </span>
          ) : unreadCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {lang === "ru" ? "новые!" : "new!"}
            </span>
          ) : null}
          {unreadCount > 0 && isBlocked && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white shadow">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {!isBlocked && messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={t("chatClear")}
          >
            <Trash2 className="h-3 w-3" />
            {t("chatClear")}
          </button>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className={`max-h-[240px] min-h-[120px] overflow-y-auto nice-scroll p-3 ${isBlocked ? "opacity-50" : ""}`}
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[100px] items-center justify-center text-center text-xs text-muted-foreground">
            {isBlocked ? t("chatBlockedHint") : t("chatEmpty")}
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isSelf = msg.deviceId === selfDeviceId
              const reactions = msg.reactions || {}
              return (
                <div
                  key={msg.id}
                  className={`group relative flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                >
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {isSelf ? t("chatYouLabel") : msg.playerName}
                    <span className="ml-1.5 font-normal opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString(
                        lang === "ru" ? "ru-RU" : "en-US",
                        { hour: "2-digit", minute: "2-digit" }
                      )}
                    </span>
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                      isSelf
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                  {/* Реакции */}
                  {Object.keys(reactions).length > 0 && (
                    <div className={`mt-0.5 flex flex-wrap gap-1 ${isSelf ? "justify-end" : "justify-start"}`}>
                      {Object.entries(reactions).map(([emoji, deviceIds]) => {
                        if (deviceIds.length === 0) return null
                        const selfReacted = deviceIds.includes(selfDeviceId)
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => !isBlocked && handleReaction(msg.id, emoji)}
                            disabled={isBlocked}
                            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition ${
                              selfReacted
                                ? "bg-violet-500/20 text-violet-700 ring-1 ring-violet-500/40 dark:text-violet-300"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            } ${isBlocked ? "cursor-default" : "cursor-pointer"}`}
                          >
                            <span>{emoji}</span>
                            {deviceIds.length > 0 && <span className="tabular-nums">{deviceIds.length}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {/* Кнопка добавления реакции — появляется при наведении */}
                  {!isBlocked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenReactionFor(openReactionFor === msg.id ? null : msg.id)
                      }}
                      className="absolute top-3 opacity-0 transition group-hover:opacity-100"
                      style={{ [isSelf ? 'left' : 'right']: 0, top: '0.75rem' } as React.CSSProperties}
                      aria-label={lang === "ru" ? "Добавить реакцию" : "Add reaction"}
                    >
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-muted text-[10px] text-muted-foreground hover:bg-foreground hover:text-background">
                        +
                      </span>
                    </button>
                  )}
                  {/* Панель выбора реакции */}
                  {!isBlocked && openReactionFor === msg.id && (
                    <div
                      className="absolute z-10 flex gap-0.5 rounded-full bg-card p-1 shadow-lg ring-1 ring-border"
                      style={{ [isSelf ? 'right' : 'left']: 0, top: '2.5rem' } as React.CSSProperties}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {REACTIONS.map((emoji) => {
                        const reacted = (reactions[emoji] || []).includes(selfDeviceId)
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleReaction(msg.id, emoji)}
                            className={`grid h-7 w-7 place-items-center rounded-full text-base transition hover:scale-125 ${reacted ? "bg-violet-500/20 ring-1 ring-violet-500/40" : "hover:bg-muted"}`}
                          >
                            {emoji}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {/* Typing-индикатор */}
            {typingText && !isBlocked && (
              <div className="flex items-center gap-1.5 px-1 text-[11px] italic text-muted-foreground">
                <span className="flex gap-0.5">
                  <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                </span>
                {typingText}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      {isBlocked ? (
        <div className="border-t border-border px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Lock className="h-3.5 w-3.5" />
            {t("chatBlocked")}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{t("chatBlockedHint")}</p>
        </div>
      ) : (
        <div className="relative border-t border-border p-2.5">
          {/* Панель быстрых фраз */}
          {showQuickPhrases && (
            <div
              className="absolute bottom-full left-2 right-2 mb-1 rounded-2xl border border-border bg-card p-2 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("chatQuickPhrases")}</span>
                <button
                  type="button"
                  onClick={() => setShowQuickPhrases(false)}
                  className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PHRASES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSend(translate(lang, key))}
                    className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold transition hover:bg-foreground hover:text-background"
                  >
                    {translate(lang, key)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                setShowQuickPhrases((v) => !v)
                setOpenReactionFor(null)
              }}
              className="shrink-0"
              aria-label={t("chatQuickPhrases")}
            >
              <Zap className="h-3.5 w-3.5" />
            </Button>
            <Input
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={t("chatPlaceholder")}
              maxLength={500}
              className="flex-1 text-sm"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="font-semibold"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="ml-1 hidden sm:inline">{t("chatSend")}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
