// types/racing.ts

export type Rarity = 'uncommon' | 'rare' | 'epic' | 'legendary' | 'relic' | 'giga'
export type Faction = 'none' | 'crusader' | 'overseer' | 'athena' | 'archon' | 'foxglove' | 'summoner' | 'chobo' | 'gigus'
export type Gender = 'male' | 'female'
export type Weather = 'hot' | 'cold' | 'rainy' | 'snowing' // race param 200
export type PetWeatherPref = 'hot' | 'cold' | 'average'    // pet preference (3-way)
export type ItemsMode = 'none' | 'dung' | 'butterflies' | 'all'
export type RacePhase = 'OPEN' | 'RUNNING' | 'RESOLVED' | 'CANCELLED'

export interface RaceResult {
  raceId: string
  rank: number             // 1-based
  msFinishTime: number
  trackLength: number
  weather: Weather | null
  itemsMode: ItemsMode
  factionStretchMix: Partial<Record<Faction, number>> // fraction 0-1
  entryFee: string         // ETH wei as string
  fieldSize: number
}

export interface PetSnapshot {
  petId: number
  name?: string
  rarity: Rarity
  faction: Faction
  gender: Gender
  elo: number
  racesRun: number
  history: RaceResult[]    // last ≤15 races with conditions
}

export interface RaceConditions {
  trackLength: number
  weather: Weather | null
  itemsMode: ItemsMode
  factionStretchMix: Partial<Record<Faction, number>>
}

export interface PayoutPreview {
  entryFee: string
  fieldSize: number
  prizePool: string
  payouts: { rank: number; amount: string; probability?: number }[]
  jackpotEligible: boolean
  jackpotPool?: string
  jackpotChanceBps?: number
  jackpotWinnableBps?: number
}

export interface HandicapResult {
  petId: number
  winProb: number          // 0-1
  fairOdds: number         // 1/winProb
  rankDist: number[]       // P(rank=1), P(rank=2), … indexed from 0
  evEnter?: number         // ETH: Σ P(rank=k)*payout_k - entryFee
  valueRating: number      // winProb * fairOdds vs implied market odds
  revealPct: number        // 0-100: how much history we have
}

// Raw API shapes (gigaverse.io)
export interface ApiRaceSummary {
  raceId: string
  phase: RacePhase
  entryFee: string
  prizePool: string
  filledSlots: number
  fieldSize: number
  trackLength: number
  extraParamIds: number[]
  extraParamVals: number[]
  createdAt: number
}

export interface ApiRaceDetail extends ApiRaceSummary {
  entries: ApiEntry[]
  payouts?: ApiPayoutEntry[]
}

export interface ApiEntry {
  petId: number
  owner: string
  rank?: number
  msFinishTime?: number
}

export interface ApiPayoutEntry {
  rank: number
  amount: string
}

export interface ApiPetStats {
  petId: number
  elo: number
  racesRun: number
  rarity: string
  faction: string
  gender: string
  recentRaces: ApiRecentRace[]
}

export interface ApiRecentRace {
  raceId: string
  rank: number
  msFinishTime: number
  trackLength: number
  extraParamIds: number[]
  extraParamVals: number[]
  entryFee: string
  fieldSize: number
}

export interface ApiLeaderboardEntry {
  petId: number
  elo: number
  rarity: string
  faction: string
  gender: string
  racesRun: number
  winRate?: number
}
