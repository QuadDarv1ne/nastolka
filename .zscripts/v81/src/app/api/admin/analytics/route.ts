import { NextRequest, NextResponse } from "next/server"
import { join } from "node:path"
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs"

const DATA_FILE = join(process.cwd(), "analytics-data.json")

/** GET — экспорт всех данных в JSON */
export async function GET() {
  try {
    if (!existsSync(DATA_FILE)) {
      return NextResponse.json({ data: [] })
    }
    const data = JSON.parse(readFileSync(DATA_FILE, "utf-8"))
    return NextResponse.json({ data, total: data.length })
  } catch {
    return NextResponse.json({ data: [], total: 0 })
  }
}

/** DELETE — очистить все данные аналитики */
export async function DELETE() {
  try {
    if (existsSync(DATA_FILE)) {
      unlinkSync(DATA_FILE)
    }
    return NextResponse.json({ ok: true, message: "Данные аналитики удалены" })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Ошибка удаления" }, { status: 500 })
  }
}
