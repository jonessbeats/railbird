'use client'
// components/LiveLobby.tsx
// Shows a live indicator when connected to the Pusher lobby channel.
// Renders nothing if NEXT_PUBLIC_PUSHER_APP_KEY is not configured.

import { useEffect, useState } from 'react'
import { subscribeToLobby } from '@/lib/realtime/pusher'

interface LiveLobbyProps {
  initialCount: number
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function LiveLobby({ initialCount }: LiveLobbyProps) {
  const [connected, setConnected] = useState(false)
  const [updateCount, setUpdateCount] = useState(0)

  useEffect(() => {
    // subscribeToLobby returns a no-op if the key is not configured
    const unsub = subscribeToLobby(
      () => { setUpdateCount(c => c + 1) },
      () => { setUpdateCount(c => c + 1) },
    )

    // If no key, getPusher() returns null and unsub is a no-op —
    // we stay in the disconnected (hidden) state.
    const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY
    if (key) setConnected(true)

    return unsub
  }, [])

  if (!connected) return null

  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Live
      {updateCount > 0 && (
        <span className="text-slate-500 ml-1">({updateCount} updates)</span>
      )}
    </span>
  )
}
