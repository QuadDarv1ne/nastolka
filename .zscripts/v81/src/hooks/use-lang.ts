"use client"
import { useEffect, useState } from "react"
import type { Lang } from "@/lib/i18n"
import { getInitialLang, saveLang } from "@/lib/i18n"

export function useLang() {
  const [lang, setLang] = useState<Lang>(getInitialLang)
  useEffect(() => { saveLang(lang) }, [lang])
  const toggle = () => setLang((l) => (l === "ru" ? "en" : "ru"))
  return { lang, setLang, toggle }
}
