'use client'

import { useEffect, useState } from 'react'

const KEY = 'railbird:my-pet-id'

export function MyPetMarker({ petId }: { petId: number }) {
  const [ismine, setIsMine] = useState(false)

  useEffect(() => {
    setIsMine(localStorage.getItem(KEY) === String(petId))
  }, [petId])

  if (!ismine) return null

  return (
    <div
      className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 pixel inline-block"
      style={{
        color: '#0a0a14',
        background: '#00ff88',
        boxShadow: '0 0 8px rgba(0,255,136,0.7)',
      }}
    >
      ◉ Your Pet
    </div>
  )
}
