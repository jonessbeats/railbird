// app/api/races/route.ts
import { NextResponse } from 'next/server'
import { fetchLobbySync, fetchRaces } from '@/lib/api/gigaverse'

export const revalidate = 30

export async function GET() {
  try {
    const data = await fetchLobbySync()
    const races = data.races ?? await fetchRaces(50)
    return NextResponse.json({ races })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
