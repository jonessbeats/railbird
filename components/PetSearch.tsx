'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function PetSearch() {
  const router = useRouter()
  const [value, setValue] = useState('')

  const go = () => {
    const id = value.trim().replace(/^#/, '')
    if (/^\d+$/.test(id)) {
      router.push(`/gigling/${id}`)
      setValue('')
    }
  }

  return (
    <div className="flex items-center">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && go()}
        placeholder="Pet ID..."
        className="w-24 px-2 py-1 text-[11px] font-mono uppercase tracking-wider bg-game-surface border border-game-border text-[#d0d0e8] placeholder:text-game-muted focus:outline-none focus:border-neon-cyan/50 transition-colors pixel"
      />
      <button
        onClick={go}
        className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-game-bg bg-neon-cyan hover:bg-neon-cyan/80 transition-colors pixel cursor-pointer"
      >
        ›
      </button>
    </div>
  )
}
