'use client'

import { useEffect, useState } from 'react'

const KEY = 'railbird:my-pet-id'

export function MyPetInRace({ petIds }: { petIds: number[] }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const id = Number(localStorage.getItem(KEY))
    setShow(!!id && petIds.includes(id))
  }, [petIds])

  if (!show) return null

  return (
    <span
      className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 pixel"
      style={{
        color: '#0a0a14',
        background: '#00ff88',
        boxShadow: '0 0 6px rgba(0,255,136,0.7)',
      }}
    >
      ◉ You
    </span>
  )
}
