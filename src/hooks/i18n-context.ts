"use client"

// React Context для языка — чтобы не прокидывать lang через props каждой функции.

import { createContext, useContext } from "react"
import type { Lang } from "@/lib/i18n"
import { t as translate, type StringKey } from "@/lib/i18n"

interface I18nContextValue {
  lang: Lang
  t: (key: StringKey) => string
}

// Default to "ru" (DEFAULT_LANG) so server-rendered HTML matches the first client render.
// The actual saved language is loaded in useLang() AFTER hydration via useEffect,
// preventing React hydration mismatches.
export const I18nContext = createContext<I18nContextValue>({
  lang: "ru",
  t: (key) => translate("ru", key),
})

export function useI18n() {
  return useContext(I18nContext)
}
