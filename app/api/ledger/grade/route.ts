// app/api/ledger/grade/route.ts
import { NextResponse } from 'next/server'
import { fetchRace } from '@/lib/api/gigaverse'
import { gradePending } from '@/lib/backtest/ledger'
import { getStore } from '@/lib/backtest/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const graded = await gradePending(getStore(), id => fetchRace(id))
    return NextResponse.json({ graded })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
