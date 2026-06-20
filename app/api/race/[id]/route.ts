// app/api/race/[id]/route.ts
import { NextResponse } from 'next/server'
import { fetchRace } from '@/lib/api/gigaverse'
import { previewPayouts } from '@/lib/chain/petRacing'

export const revalidate = 15

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const [race, payout] = await Promise.all([
      fetchRace(params.id),
      previewPayouts(params.id),
    ])
    return NextResponse.json({ race, payout })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
