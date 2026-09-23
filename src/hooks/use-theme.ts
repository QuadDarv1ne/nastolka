// Простой переключатель темы без next-themes (для амверы и SSR-совместимости)
"use client"

import { useEffect, useState } from "react"
import { readItem, writeItem } from "@/lib/storage"

type Theme = "light" | "dark"

const STORAGE_KEY = "nastolka-theme"

/**
 * Default theme used for SSR AND the first client render.
 * The actual saved/system theme is loaded in useEffect after hydration
 * to prevent React hydration mismatches and avoid visual flash.
 */
const DEFAULT_THEME: Theme = "light"

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME
  const saved = readItem(STORAGE_KEY)
  if (saved === "dark" || saved === "light") return saved
  try {
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark"
  } catch {
    // ignore
  }
  return DEFAULT_THEME
}

export function useTheme() {
  // Always start with DEFAULT_THEME so SSR and first client render match
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)

  // After hydration, load the actual theme from localStorage/system preference
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = getStoredTheme()
    if (stored !== theme) setTheme(stored)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") root.classList.add("dark")
    else root.classList.remove("dark")
    writeItem(STORAGE_KEY, theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"))

  return { theme, toggle }
}
