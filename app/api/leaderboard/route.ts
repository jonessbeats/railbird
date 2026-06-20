// app/api/leaderboard/route.ts
import { NextResponse } from 'next/server'
import { fetchLeaderboard } from '@/lib/api/gigaverse'

export const revalidate = 120

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  try {
    const data = await fetchLeaderboard({
      limit: Number(searchParams.get('limit') ?? 50),
      offset: Number(searchParams.get('offset') ?? 0),
      factions: searchParams.get('factions') ?? undefined,
      rarities: searchParams.get('rarities') ?? undefined,
      genders: searchParams.get('genders') ?? undefined,
    })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
