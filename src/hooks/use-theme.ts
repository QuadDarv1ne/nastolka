// Простой переключатель темы без next-themes (для амверы и SSR-совместимости)
"use client"

import { useEffect, useState } from "react"

type Theme = "light" | "dark"

const STORAGE_KEY = "nastolka-theme"

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light"
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "dark" || saved === "light") return saved
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark"
  } catch {
    // ignore
  }
  return "light"
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") root.classList.add("dark")
    else root.classList.remove("dark")
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"))

  return { theme, toggle }
}
