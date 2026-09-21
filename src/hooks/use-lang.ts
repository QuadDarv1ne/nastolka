"use client"

import { useEffect, useState } from "react"
import { DEFAULT_LANG, getInitialLang, saveLang, type Lang } from "@/lib/i18n"

/** Хук для переключения языка интерфейса */
export function useLang() {
  // Always start with DEFAULT_LANG on both server AND first client render
  // to avoid React hydration mismatches. The actual saved language is
  // loaded in a useEffect AFTER hydration completes.
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG)

  // After hydration, load the actual language from localStorage
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = getInitialLang()
    if (saved !== lang) setLang(saved)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    saveLang(lang)
  }, [lang])

  const toggle = () => setLang((l) => (l === "ru" ? "en" : "ru"))
  return { lang, setLang, toggle }
}
