"use client"

import { useEffect, useState } from "react"
import { t, type Lang } from "@/lib/i18n"

/**
 * NicknamePrompt — модальное окно при первом заходе на сайт.
 * Обязательный ввод никнейма. Сохраняется в localStorage.
 * Показывается только если nickname не задан.
 */
export function NicknamePrompt({ lang }: { lang: Lang }) {
  const [show, setShow] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem("nastolka-nickname")
        if (!saved) {
          setShow(true)
        }
      } catch {
        setShow(true)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError(lang === "ru" ? "Минимум 2 символа" : "At least 2 characters")
      return
    }
    if (trimmed.length > 20) {
      setError(lang === "ru" ? "Максимум 20 символов" : "Maximum 20 characters")
      return
    }
    try {
      localStorage.setItem("nastolka-nickname", trimmed)
    } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="mx-4 w-full max-w-sm rounded-3xl bg-card p-8 shadow-2xl">
        <div className="mb-2 text-center text-5xl">👋</div>
        <h2 className="mb-2 text-center text-2xl font-black">
          {lang === "ru" ? "Добро пожаловать!" : "Welcome!"}
        </h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {lang === "ru"
            ? "Введите ваш никнейм для игры:"
            : "Enter your nickname to play:"}
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value.slice(0, 20)); setError("") }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={lang === "ru" ? "Игрок" : "Player"}
          autoFocus
          maxLength={20}
          className="mb-3 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-lg text-center font-bold outline-none focus:border-violet-500"
        />
        {error && <p className="mb-3 text-center text-sm text-rose-500">{error}</p>}
        <button
          onClick={handleSubmit}
          className="w-full rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 px-4 py-3 text-lg font-bold text-white shadow-lg transition hover:from-violet-700 hover:to-indigo-800"
        >
          {lang === "ru" ? "Начать играть" : "Start playing"}
        </button>
      </div>
    </div>
  )
}

/** Получить сохранённый никнейм */
export function getNickname(): string {
  try {
    return localStorage.getItem("nastolka-nickname") || ""
  } catch {
    return ""
  }
}
