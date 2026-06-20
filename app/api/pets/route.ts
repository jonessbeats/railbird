// app/api/pets/route.ts
import { NextResponse } from 'next/server'
import { fetchPetsStatsBatch } from '@/lib/api/gigaverse'

export const revalidate = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const idsParam = searchParams.get('ids') ?? ''
  const ids = idsParam.split(',').map(Number).filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 })
  try {
    const stats = await fetchPetsStatsBatch(ids)
    return NextResponse.json({ stats })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
