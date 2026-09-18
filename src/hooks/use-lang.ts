"use client"

import { useEffect, useState } from "react"
import { getInitialLang, saveLang, type Lang } from "@/lib/i18n"

/** Хук для переключения языка интерфейса */
export function useLang() {
  const [lang, setLang] = useState<Lang>(getInitialLang)

  useEffect(() => {
    saveLang(lang)
  }, [lang])

  const toggle = () => setLang((l) => (l === "ru" ? "en" : "ru"))
  return { lang, setLang, toggle }
}
