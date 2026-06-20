// lib/model/infer.ts
import type { ApiLeaderboardEntry, ApiPetStats, PetSnapshot, RaceResult } from '@/types/racing'
import { rarityFromInt, factionFromInt } from '@/lib/encode'

// Returns 0–100: how much of the stat profile has been revealed
// Based on racesRun vs maxRaces and revealsPerStat thresholds
export function revealPercent(entry: ApiLeaderboardEntry): number {
  const pub = entry.racePublic
  if (!pub) return 0
  // Average how many stat ranges are fully revealed (min===max means pinpointed)
  const stats = [pub.startRange, pub.speedRange, pub.staminaRange, pub.finishRange]
  const revealed = stats.filter(r => r && r.min === r.max).length
  // Partial reveal: use races run vs a reasonable threshold (15 races to "know" a pet)
  const byRaces = Math.min(100, Math.round((pub.racesRun / Math.max(pub.maxRaces, 30)) * 100))
  const byStats = Math.round((revealed / 4) * 100)
  return Math.max(byRaces, byStats)
}

// Build PetSnapshot from leaderboard entry + optional pet stats
// leaderboard is the primary source for rarity/faction/gender/ELO/stat ranges
// pet stats add win/podium counts for win-rate signal
export function buildPetSnapshot(
  lb: ApiLeaderboardEntry,
  stats?: ApiPetStats,
): PetSnapshot {
  // Convert recent races to RaceResult (conditions unknown — use empty factionStretchMix)
  const history: RaceResult[] = (stats?.recent ?? [])
    .filter(r => r.rank !== null && r.phase === 3) // only resolved races
    .map(r => ({
      raceId: String(r.raceId),
      rank: (r.rank ?? 0) + 1, // convert 0-indexed to 1-based
      msFinishTime: 0,          // not available from pet stats endpoint
      trackLength: 0,           // not available from pet stats endpoint
      weather: null,
      itemsMode: 'none' as const,
      factionStretchMix: {},
      entryFee: r.weiEntry,
      fieldSize: 8,             // default; not available from pet stats endpoint
    }))

  return {
    petId: lb.petId,
    rarity: rarityFromInt(lb.rarity),
    faction: factionFromInt(lb.faction),
    gender: lb.gender.toLowerCase() as 'male' | 'female',
    elo: lb.elo,
    racesRun: lb.racesRun,
    history,
  }
}

// Build PetSnapshot from leaderboard entry with stat range data attached as metadata
// Returns extended snapshot with stat ranges for use in handicap model
export interface PetSnapshotWithStats extends PetSnapshot {
  startRange: { min: number; max: number }
  speedRange: { min: number; max: number }
  staminaRange: { min: number; max: number }
  finishRange: { min: number; max: number }
  winRate: number      // wins / racesRun (0-1)
  podiumRate: number   // podiums / racesRun (0-1)
  revealPct: number    // 0-100
  traits: { id: string; name: string; tier: number | null }[]
}

export function buildPetSnapshotWithStats(
  lb: ApiLeaderboardEntry,
  stats?: ApiPetStats,
): PetSnapshotWithStats {
  const base = buildPetSnapshot(lb, stats)
  const pub = lb.racePublic
  const racesRun = lb.racesRun || 1
  return {
    ...base,
    startRange: pub?.startRange ?? { min: 50, max: 100 },
    speedRange: pub?.speedRange ?? { min: 50, max: 100 },
    staminaRange: pub?.staminaRange ?? { min: 50, max: 100 },
    finishRange: pub?.finishRange ?? { min: 50, max: 100 },
    winRate: lb.wins / racesRun,
    podiumRate: (stats?.podiums ?? 0) / racesRun,
    revealPct: revealPercent(lb),
    traits: pub?.traits ?? [],
  }
}

// Win rate with Bayesian shrinkage toward prior (rarity-based)
// Prevents small-sample pets from appearing too strong or too weak
export function smoothedWinRate(
  wins: number,
  racesRun: number,
  priorWinRate: number,
  priorStrength = 5, // equivalent observations of prior
): number {
  return (wins + priorStrength * priorWinRate) / (racesRun + priorStrength)
}
