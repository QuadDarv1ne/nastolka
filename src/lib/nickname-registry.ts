// Реестр занятых никнеймов (только серверная часть, Node API).
//
// Хранилище — JSON-файл data/nicknames.json рядом с остальными артефактами
// рантайма. БД в проекте нет, а требование «ник занят — не создавай его снова»
// должно переживать перезапуск и быть общим для всех устройств. Формат записи
// совпадает с подходом api-request-log.ts: обычный fs + аккуратная перезапись.
//
// Ключ записи — nicknameKey (нижний регистр, без диакритики и лишних пробелов),
// поэтому «Маша», «маша» и « Маша » — один и тот же занятый ник.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { nicknameKey, validateNickname } from "@/lib/nickname-rules";

export type NicknameRecord = {
  /** Ник как его ввёл владелец (оригинальный регистр) */
  nick: string;
  /** Когда занят впервые, ISO */
  since: string;
  /** Кто занял: deviceId из мультиплеера, если клиент его прислал */
  owner?: string;
};

export type NicknameRegistry = Record<string, NicknameRecord>;

const REGISTRY_FILE = resolve(process.env.NICKNAMES_FILE || "data/nicknames.json");

/** Разумный потолок: файл не должен расти бесконечно от скриптов-спамеров */
const MAX_REGISTRY_ENTRIES = 5000;

const ensureDir = () => {
  try {
    mkdirSync(dirname(REGISTRY_FILE), { recursive: true });
  } catch {
    // каталог уже есть или недоступен — чтение/запись сами сообщат об ошибке
  }
};

const isRecord = (value: unknown): value is NicknameRecord =>
  !!value && typeof value === "object" && typeof (value as NicknameRecord).nick === "string";

/**
 * Прочитать реестр. Битый или чужой файл не роняем — считаем реестр пустым,
 * иначе один испорченный файл заблокировал бы вход на сайт всем игрокам.
 */
export const readRegistry = (): NicknameRegistry => {
  if (!existsSync(REGISTRY_FILE)) return {};
  try {
    const parsed = JSON.parse(readFileSync(REGISTRY_FILE, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: NicknameRegistry = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isRecord(value)) result[key] = { nick: value.nick, since: value.since || "", owner: value.owner };
    }
    return result;
  } catch (error) {
    console.error("[nicknames] не удалось прочитать реестр, считаю его пустым:", error);
    return {};
  }
};

/** Записать реестр атомарно: во временный файл, затем rename поверх старого */
const writeRegistry = (registry: NicknameRegistry): boolean => {
  try {
    ensureDir();
    const tmp = `${REGISTRY_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(registry, null, 2), "utf8");
    renameSync(tmp, REGISTRY_FILE);
    return true;
  } catch (error) {
    console.error("[nicknames] не удалось записать реестр:", error);
    return false;
  }
};

export type AvailabilityResult =
  | { available: true; nick: string; normalized: string }
  | { available: false; nick: string; normalized: string; reason: "taken" | "invalid"; detail?: string };

/**
 * Свободен ли ник. `self` — идентификатор того же игрока: его собственный
 * ник не считается занятым, иначе смена ника на свой же ломалась бы.
 */
export const checkAvailability = (candidate: string, self?: string): AvailabilityResult => {
  const validation = validateNickname(candidate);
  const normalized = validation.normalized;
  if (!validation.valid) {
    return { available: false, nick: candidate, normalized, reason: "invalid", detail: validation.reason };
  }
  const key = nicknameKey(normalized);
  const taken = readRegistry()[key];
  if (taken && !(self && taken.owner && taken.owner === self)) {
    return { available: false, nick: normalized, normalized, reason: "taken" };
  }
  return { available: true, nick: normalized, normalized };
};

export type ClaimResult =
  | { ok: true; nick: string }
  | { ok: false; reason: "taken" | "invalid"; detail?: string; nick?: string };

/**
 * Занять ник. Проверка и запись в одном вызове — на сервере один процесс,
 * поэтому между чтением и записью конкурентной гонки с другим устройством нет.
 */
export const claimNickname = (candidate: string, owner?: string): ClaimResult => {
  const availability = checkAvailability(candidate, owner);
  if (!availability.available) {
    return availability.reason === "taken"
      ? { ok: false, reason: "taken", nick: availability.nick }
      : { ok: false, reason: "invalid", detail: availability.detail };
  }

  const registry = readRegistry();
  const key = nicknameKey(availability.normalized);
  if (Object.keys(registry).length >= MAX_REGISTRY_ENTRIES && !registry[key]) {
    console.error(`[nicknames] реестр переполнен (>= ${MAX_REGISTRY_ENTRIES}), новое занятие отклонено`);
    return { ok: false, reason: "invalid", detail: "registryFull" };
  }

  registry[key] = {
    nick: availability.normalized,
    since: registry[key]?.since || new Date().toISOString(),
    owner: owner || registry[key]?.owner,
  };

  if (!writeRegistry(registry)) return { ok: false, reason: "invalid", detail: "storageError" };
  return { ok: true, nick: availability.normalized };
};

/** Освободить ник (для тестов и будущей админки) */
export const releaseNickname = (candidate: string): boolean => {
  const registry = readRegistry();
  const key = nicknameKey(candidate);
  if (!registry[key]) return false;
  delete registry[key];
  return writeRegistry(registry);
};

/** Все занятые Ники — для списка в админке */
export const listNicknames = (): NicknameRecord[] => Object.values(readRegistry());
