'use client'

import Link from 'next/link'
import { useStable } from '@/lib/stable'

export function MyPetNav() {
  const { pets } = useStable()

  if (pets.length === 0) return null

  return (
    <Link
      href="/my-races"
      className="flex items-center gap-1.5 px-3 py-1 text-xs tracking-widest uppercase neon-green border border-neon-green/30 hover:border-neon-green/60 hover:bg-neon-green/5 transition-colors pixel cursor-pointer"
      title="Your stable"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-neon-green inline-block" style={{ boxShadow: '0 0 4px rgba(0,255,136,0.8)' }} />
      Stable {pets.length > 1 ? `· ${pets.length}` : `#${pets[0]}`}
    </Link>
  )
}
