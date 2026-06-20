import { NextResponse } from 'next/server'
import { fetchPetStats } from '@/lib/api/gigaverse'
import { buildPetSnapshot } from '@/lib/model/infer'

export const revalidate = 60

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const raw = await fetchPetStats(Number(params.id))
    const snapshot = buildPetSnapshot(raw)
    return NextResponse.json({ raw, snapshot })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
