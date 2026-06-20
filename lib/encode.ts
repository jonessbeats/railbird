// lib/encode.ts
import type { Faction, Rarity } from '@/types/racing'

// Faction integer → string (leaderboard returns integers; spec §2.5 IDs confirmed correct)
const FACTION_INT_MAP: Record<number, Faction> = {
  0: 'none', 1: 'crusader', 2: 'overseer', 3: 'athena',
  4: 'archon', 5: 'foxglove', 6: 'summoner', 7: 'chobo', 8: 'gigus',
}

// Rarity integer → string (1-indexed from live leaderboard: 1=uncommon…6=giga)
const RARITY_INT_MAP: Record<number, Rarity> = {
  1: 'uncommon', 2: 'rare', 3: 'epic', 4: 'legendary', 5: 'relic', 6: 'giga',
}

export function factionFromInt(n: number): Faction {
  return FACTION_INT_MAP[n] ?? 'none'
}

export function rarityFromInt(n: number): Rarity {
  return RARITY_INT_MAP[n] ?? 'uncommon'
}

export function rarityOrdinal(r: string): number {
  return { uncommon: 0, rare: 1, epic: 2, legendary: 3, relic: 4, giga: 5 }[r.toLowerCase()] ?? 0
}

export function normalizeRarity(r: string): Rarity {
  const map: Record<string, Rarity> = {
    uncommon: 'uncommon', rare: 'rare', epic: 'epic',
    legendary: 'legendary', relic: 'relic', giga: 'giga',
  }
  return map[r.toLowerCase()] ?? 'uncommon'
}

export function normalizeFaction(f: string): Faction {
  const map: Record<string, Faction> = {
    none: 'none', crusader: 'crusader', overseer: 'overseer', athena: 'athena',
    archon: 'archon', foxglove: 'foxglove', summoner: 'summoner', chobo: 'chobo', gigus: 'gigus',
  }
  return map[f?.toLowerCase()] ?? 'none'
}

export function weiToEth(wei: string): number {
  return Number(BigInt(wei || '0')) / 1e18
}

export function distanceBucket(trackLength: number): 'short' | 'medium' | 'long' {
  if (trackLength <= 400) return 'short'
  if (trackLength <= 800) return 'medium'
  return 'long'
}

// Weighted stat score for a distance bucket
// leaderboard provides min/max stat ranges — we use mean as point estimate
export function statScoreForDistance(
  start: { min: number; max: number },
  speed: { min: number; max: number },
  stamina: { min: number; max: number },
  finish: { min: number; max: number },
  trackLength: number,
): number {
  const mean = (r: { min: number; max: number }) => (r.min + r.max) / 2
  const bucket = distanceBucket(trackLength)
  if (bucket === 'short') return mean(start) * 0.5 + mean(speed) * 0.5
  if (bucket === 'medium') return mean(start) * 0.2 + mean(speed) * 0.4 + mean(stamina) * 0.2 + mean(finish) * 0.2
  return mean(stamina) * 0.4 + mean(finish) * 0.4 + mean(speed) * 0.2
}
