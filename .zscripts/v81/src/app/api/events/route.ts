import { NextRequest, NextResponse } from "next/server"
import { join } from "node:path"
import { readFileSync, writeFileSync, existsSync } from "node:fs"

const DATA_FILE = join(process.cwd(), "events-data.json")

interface GameEvent {
  timestamp: string
  visitorId: string
  nickname: string
  eventType: string  // dice_roll, scored, skipped, chip_used, game_start, game_over, team_win, word_shown, word_swapped, replay_round
  deviceType: string
  pagePath: string
  data?: Record<string, unknown> // дополнительные данные события
}

function readEvents(): GameEvent[] {
  try {
    if (!existsSync(DATA_FILE)) return []
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"))
  } catch { return [] }
}

function writeEvents(events: GameEvent[]) {
  try {
    if (events.length > 5000) events = events.slice(-5000)
    writeFileSync(DATA_FILE, JSON.stringify(events, null, 2), "utf-8")
  } catch {}
}

export async function GET() {
  const events = readEvents()
  const stats = {
    total: events.length,
    byType: {} as Record<string, number>,
    byNickname: {} as Record<string, number>,
    byHour: {} as Record<string, number>,
    recent: events.slice(-100).reverse(),
  }
  for (const e of events) {
    stats.byType[e.eventType] = (stats.byType[e.eventType] || 0) + 1
    if (e.nickname) stats.byNickname[e.nickname] = (stats.byNickname[e.nickname] || 0) + 1
    const hour = e.timestamp.slice(0, 13)
    stats.byHour[hour] = (stats.byHour[hour] || 0) + 1
  }
  return NextResponse.json(stats)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const event: GameEvent = {
      timestamp: new Date().toISOString(),
      visitorId: body.visitorId || "unknown",
      nickname: body.nickname || "",
      eventType: body.eventType || "unknown",
      deviceType: body.deviceType || "unknown",
      pagePath: body.pagePath || "/",
      data: body.data,
    }
    const events = readEvents()
    events.push(event)
    writeEvents(events)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    writeFileSync(DATA_FILE, "[]", "utf-8")
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
