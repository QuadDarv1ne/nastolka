"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square, Play, Pause, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Компонент записи песни для способа «Песнями».
 * Использует MediaRecorder API для записи аудио с микрофона.
 * После записи можно прослушать и удалить.
 * Автоочищается при смене слова.
 */

interface SongRecorderProps {
  /** Причина для очистки (ID слова) — запись очищается при изменении */
  resetKey?: string
  lang: "ru" | "en"
}

export function SongRecorder({ resetKey, lang }: SongRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const t = (ru: string, en: string) => lang === "ru" ? ru : en

  // Очистка при смене resetKey — через requestAnimationFrame
  useEffect(() => {
    if (!resetKey) return
    const id = requestAnimationFrame(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setIsRecording(false)
      setIsPlaying(false)
      setError(null)
      audioChunksRef.current = []
    })
    return () => cancelAnimationFrame(id)
  }, [resetKey])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  function cleanup() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioUrl(null)
    setIsRecording(false)
    setIsPlaying(false)
    setError(null)
    audioChunksRef.current = []
  }

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setHasPermission(true)

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        // Останавливаем дорожки
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
        }
      }

      recorder.start()
      setIsRecording(true)
    } catch (e) {
      const err = e as Error
      if (err.name === "NotAllowedError") {
        setError(t("Нет доступа к микрофону. Разрешите доступ в настройках браузера.", "No microphone access. Please allow in browser settings."))
      } else if (err.name === "NotFoundError") {
        setError(t("Микрофон не найден.", "Microphone not found."))
      } else {
        setError(t("Ошибка записи: ", "Recording error: ") + err.message)
      }
      setHasPermission(false)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  function playRecording() {
    if (!audioUrl) return
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => setIsPlaying(false)
    }
    audioRef.current.play()
    setIsPlaying(true)
  }

  function pausePlayback() {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  function deleteRecording() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioUrl(null)
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    audioChunksRef.current = []
  }

  return (
    <div className="mt-4 rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/20">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-400">
        <Mic className="h-4 w-4" />
        {t("Запись песни", "Song recording")}
      </div>

      {error && (
        <div className="mb-2 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {!isRecording && !audioUrl && (
        <Button
          size="sm"
          variant="outline"
          className="w-full border-rose-300 text-rose-600 hover:bg-rose-100 dark:border-rose-700 dark:text-rose-400"
          onClick={startRecording}
        >
          <Mic className="mr-2 h-4 w-4" />
          {t("Начать запись", "Start recording")}
        </Button>
      )}

      {isRecording && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-rose-600">
            <span className="h-3 w-3 animate-pulse rounded-full bg-rose-500" />
            {t("Идёт запись...", "Recording...")}
          </div>
          <Button
            size="sm"
            className="w-full bg-rose-500 hover:bg-rose-600"
            onClick={stopRecording}
          >
            <Square className="mr-2 h-4 w-4" />
            {t("Остановить", "Stop")}
          </Button>
        </div>
      )}

      {!isRecording && audioUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={isPlaying ? pausePlayback : playRecording}
            >
              {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {isPlaying ? t("Пауза", "Pause") : t("Прослушать", "Play")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={deleteRecording}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs"
            onClick={startRecording}
          >
            {t("Записать заново", "Record again")}
          </Button>
        </div>
      )}
    </div>
  )
}
