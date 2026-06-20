import { NextResponse } from 'next/server'
import { fetchPetsStatsBatch } from '@/lib/api/gigaverse'
import { buildPetSnapshot } from '@/lib/model/infer'

export const revalidate = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const idsParam = searchParams.get('ids') ?? ''
  const ids = idsParam.split(',').map(Number).filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 })
  try {
    const raws = await fetchPetsStatsBatch(ids)
    const snapshots = raws.map(raw => buildPetSnapshot(raw))
    return NextResponse.json({ snapshots })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
