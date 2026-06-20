// lib/realtime/pusher.ts
// Pusher singleton factory — client-side only
// Gracefully returns null if NEXT_PUBLIC_PUSHER_APP_KEY is not configured.

import Pusher from 'pusher-js'

let pusherInstance: Pusher | null = null

export function getPusher(): Pusher | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY
  if (!key) return null

  if (pusherInstance) return pusherInstance
  pusherInstance = new Pusher(key, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'mt1',
  })
  return pusherInstance
}

/** Subscribe to the shared racing lobby channel.
 *  Returns an unsubscribe function (safe to call even when Pusher is not configured). */
export function subscribeToLobby(
  onRaceUpdated: (data: unknown) => void,
  onSnapshot: (data: unknown) => void,
): () => void {
  const p = getPusher()
  if (!p) return () => undefined

  const channel = p.subscribe('racing.lobby')
  channel.bind('race-updated', onRaceUpdated)
  channel.bind('lobby-snapshot', onSnapshot)
  return () => {
    channel.unbind_all()
    p.unsubscribe('racing.lobby')
  }
}

/** Subscribe to a per-race channel for live tick updates. */
export function subscribeToRace(
  raceId: string | number,
  onTick: (data: unknown) => void,
  onBroadcast: (data: unknown) => void,
): () => void {
  const p = getPusher()
  if (!p) return () => undefined

  const channelName = `race-${raceId}`
  const channel = p.subscribe(channelName)
  channel.bind('tick-advanced', onTick)
  channel.bind('race-broadcast', onBroadcast)
  return () => {
    channel.unbind_all()
    p.unsubscribe(channelName)
  }
}
