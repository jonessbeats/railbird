// lib/encode.ts
import type { Faction, ItemsMode, Weather } from '@/types/racing'

// extraParamIds encoding per spec §2.5
const ITEMS_MAP: Record<number, ItemsMode> = { 0: 'none', 1: 'dung', 2: 'butterflies', 3: 'all' }
const WEATHER_MAP: Record<number, Weather> = { 0: 'hot', 1: 'cold', 2: 'rainy', 3: 'snowing' }
const FACTION_MAP: Record<number, Faction> = {
  0: 'none', 1: 'crusader', 2: 'overseer', 3: 'athena',
  4: 'archon', 5: 'foxglove', 6: 'summoner', 7: 'chobo', 8: 'gigus',
}

export function decodeExtraParams(ids: number[], vals: number[]): {
  itemsMode: ItemsMode; weather: Weather | null; faction: Faction | null
} {
  let itemsMode: ItemsMode = 'none'
  let weather: Weather | null = null
  let faction: Faction | null = null

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]; const val = vals[i]
    if (id === 100) itemsMode = ITEMS_MAP[val] ?? 'none'
    else if (id === 200) weather = WEATHER_MAP[val] ?? null
    else if (id === 300) faction = FACTION_MAP[val] ?? null
  }
  return { itemsMode, weather, faction }
}

export function rarityOrdinal(r: string): number {
  return { uncommon: 0, rare: 1, epic: 2, legendary: 3, relic: 4, giga: 5 }[r.toLowerCase()] ?? 0
}

export function normalizeRarity(r: string): import('@/types/racing').Rarity {
  const map: Record<string, import('@/types/racing').Rarity> = {
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
