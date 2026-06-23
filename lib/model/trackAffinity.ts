import type { PetSnapshotWithStats } from './infer'

export type TrackType = 'SPRINT' | 'MID' | 'STAMINA'

export function classifyTrack(lengthM: number): TrackType {
  if (lengthM <= 600)  return 'SPRINT'
  if (lengthM <= 1500) return 'MID'
  return 'STAMINA'
}

export interface TrackAffinity {
  sprint:  number   // 0-100 relative score
  mid:     number
  stamina: number
  best:    TrackType
}

export function computeTrackAffinity(pet: PetSnapshotWithStats): TrackAffinity {
  const avg = (r: { min: number; max: number }) => (r.min + r.max) / 2
  const s  = avg(pet.startRange)
  const sp = avg(pet.speedRange)
  const st = avg(pet.staminaRange)
  const f  = avg(pet.finishRange)

  // Sprint: explosive start + closing kick
  const rawSprint  = s * 0.35 + f * 0.35 + sp * 0.2  + st * 0.1
  // Stamina: endurance + sustained pace
  const rawStamina = st * 0.40 + sp * 0.35 + f * 0.15 + s * 0.1
  // Mid: balanced across all
  const rawMid     = s * 0.2  + sp * 0.3  + st * 0.3  + f * 0.2

  const max = Math.max(rawSprint, rawMid, rawStamina)
  const norm = (v: number) => Math.round((v / max) * 100)

  const sprint  = norm(rawSprint)
  const mid     = norm(rawMid)
  const stamina = norm(rawStamina)

  const best: TrackType =
    sprint >= mid && sprint >= stamina ? 'SPRINT'
    : stamina >= mid                   ? 'STAMINA'
    : 'MID'

  return { sprint, mid, stamina, best }
}
