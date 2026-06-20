// app/api/pet/[id]/route.ts
import { NextResponse } from 'next/server'
import { fetchPetStats } from '@/lib/api/gigaverse'

export const revalidate = 60

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const stats = await fetchPetStats(Number(params.id))
    return NextResponse.json({ stats })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
