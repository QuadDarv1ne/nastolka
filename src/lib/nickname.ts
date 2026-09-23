"use client"

// Глобальный никнейм игрока: обязателен при первом заходе на сайт,
// сохраняется в localStorage и используется в мультиплеере (кто за каким
// устройством) и в аналитике визитов (кто заходил).

import { readItem, writeItem } from "@/lib/storage"

const NICKNAME_STORAGE_KEY = "nastolka-nickname-v1"
export const NICKNAME_MAX_LENGTH = 20

/** Прочитать сохранённый никнейм ("" если нет) */
export function getNickname(): string {
  if (typeof window === "undefined") return ""
  return (readItem(NICKNAME_STORAGE_KEY) || "").trim()
}

/** Сохранить никнейм */
export function saveNickname(nickname: string): void {
  if (typeof window === "undefined") return
  writeItem(NICKNAME_STORAGE_KEY, nickname.trim().slice(0, NICKNAME_MAX_LENGTH))
}

/** Есть ли сохранённый никнейм (для обязательной модалки первого входа) */
export function hasNickname(): boolean {
  return getNickname().length > 0
}

/** Сгенерировать случайный никнейм (кнопка «Мне повезёт») */
export function randomNickname(): string {
  const adjectives = ["Весёлый", "Быстрый", "Хитрый", "Смелый", "Дикий", "Лютый", "Яркий", "Тёплый", "Злой", "Мудрый"]
  const nouns = ["Лис", "Медведь", "Волк", "Тигр", "Ёж", "Кит", "Сокол", "Барс", "Зубр", "Крот"]
  const a = adjectives[Math.floor(Math.random() * adjectives.length)]
  const n = nouns[Math.floor(Math.random() * nouns.length)]
  return `${a} ${n}`
}
