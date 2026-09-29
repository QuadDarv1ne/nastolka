"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, X } from "lucide-react"

/**
 * AdminFAB — плавающая кнопка в правом нижнем углу.
 * Маленькая иконка замка, при клике открывает окно ввода пароля.
 * Если пароль верный — редирект на /admin.
 *
 * Не показывается на /admin (там уже есть своя форма).
 */
export function AdminFAB() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [hidden, setHidden] = useState(false)

  // Не показываем на /admin
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (window.location.pathname === "/admin") setHidden(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  if (hidden) return null

  const handleSubmit = () => {
    if (password === "nastolka") {
      localStorage.setItem("nastolka-admin-auth", "yes")
      router.push("/admin")
    } else {
      setError("Неверный пароль")
    }
  }

  return (
    <>
      {/* Модальное окно ввода пароля */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { setOpen(false); setError(""); setPassword("") }}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <Lock className="h-5 w-5 text-violet-500" />
                Вход в админку
              </h3>
              <button
                onClick={() => { setOpen(false); setError(""); setPassword("") }}
                className="rounded-full bg-muted p-1.5 transition hover:bg-muted/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError("") }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Пароль"
              autoFocus
              className="mb-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 outline-none focus:border-violet-500"
            />
            {error && <p className="mb-3 text-sm text-rose-500">{error}</p>}
            <button
              onClick={handleSubmit}
              className="w-full rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 px-4 py-2.5 font-bold text-white shadow-lg transition hover:from-violet-700 hover:to-indigo-800"
            >
              Войти
            </button>
          </div>
        </div>
      )}

      {/* Плавающая кнопка — замок в правом нижнем углу */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Вход в админку"
        className="group fixed bottom-4 right-4 z-40 grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-600/80 to-indigo-700/80 text-white shadow-lg backdrop-blur transition hover:from-violet-600 hover:to-indigo-700 hover:shadow-xl sm:h-12 sm:w-12"
      >
        {/* Полупрозрачная, незаметная по умолчанию, при hover — яркая */}
        <Lock className="h-4 w-4 opacity-60 transition group-hover:opacity-100 sm:h-5 sm:w-5" />
      </button>
    </>
  )
}
