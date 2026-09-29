import { NextRequest, NextResponse } from "next/server"
import { join } from "node:path"
import { readFileSync, writeFileSync, existsSync } from "node:fs"

const DATA_FILE = join(process.cwd(), "custom-words.json")

interface CustomWord {
  id: string
  word: string
  wordEn: string
  category: string
  difficulty: string
}

function readWords(): CustomWord[] {
  try {
    if (!existsSync(DATA_FILE)) return []
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"))
  } catch {
    return []
  }
}

function writeWords(words: CustomWord[]) {
  writeFileSync(DATA_FILE, JSON.stringify(words, null, 2), "utf-8")
}

/** GET — список всех кастомных слов */
export async function GET() {
  const words = readWords()
  return NextResponse.json({ words, total: words.length })
}

/** POST — добавить новое слово */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const words = readWords()
    const newWord: CustomWord = {
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      word: body.word?.trim() || "",
      wordEn: body.wordEn?.trim() || "",
      category: body.category || "everyday",
      difficulty: body.difficulty || "medium",
    }
    if (!newWord.word) {
      return NextResponse.json({ ok: false, error: "Слово не указано" }, { status: 400 })
    }
    words.push(newWord)
    writeWords(words)
    return NextResponse.json({ ok: true, word: newWord })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Ошибка" }, { status: 500 })
  }
}

/** DELETE — удалить слово по id */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ ok: false, error: "ID не указан" }, { status: 400 })

    const words = readWords()
    const filtered = words.filter((w) => w.id !== id)
    if (filtered.length === words.length) {
      return NextResponse.json({ ok: false, error: "Слово не найдено" }, { status: 404 })
    }
    writeWords(filtered)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Ошибка" }, { status: 500 })
  }
}

/** PUT — обновить слово */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const words = readWords()
    const idx = words.findIndex((w) => w.id === body.id)
    if (idx < 0) return NextResponse.json({ ok: false, error: "Не найдено" }, { status: 404 })

    words[idx] = {
      ...words[idx],
      word: body.word?.trim() || words[idx].word,
      wordEn: body.wordEn?.trim() || words[idx].wordEn,
      category: body.category || words[idx].category,
      difficulty: body.difficulty || words[idx].difficulty,
    }
    writeWords(words)
    return NextResponse.json({ ok: true, word: words[idx] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Ошибка" }, { status: 500 })
  }
}
