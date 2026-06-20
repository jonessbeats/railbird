// types/racing.ts

export type Rarity = 'uncommon' | 'rare' | 'epic' | 'legendary' | 'relic' | 'giga'
export type Faction = 'none' | 'crusader' | 'overseer' | 'athena' | 'archon' | 'foxglove' | 'summoner' | 'chobo' | 'gigus'
export type Gender = 'male' | 'female'
// NOTE: API uses raceTemp (not extraParamIds/extraParamVals) with values 'hot'|'cold'|'average'
// 'snowing' not observed in live data; spec-documented 4th value unconfirmed
export type Weather = 'hot' | 'cold' | 'average' | 'snowing'
export type PetWeatherPref = 'hot' | 'cold' | 'average'    // pet preference (3-way)
export type ItemsMode = 'none' | 'dung' | 'butterflies' | 'all'
// API phase is numeric: 0=IDLE, 1=OPEN, 2=RESOLVING, 3=RESOLVED, 4=CANCELLED
// phaseName string is also returned alongside numeric phase
export type RacePhase = 'OPEN' | 'RESOLVING' | 'RESOLVED' | 'CANCELLED' | 'IDLE'
export type RacePhaseNum = 0 | 1 | 2 | 3 | 4

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

// Raw API shapes (gigaverse.io) — verified against live API 2026-06-20
// Base URL: https://gigaverse.io/api/racing

// GET /races?limit=N  →  { success, latestRaceId, races: ApiRaceSummary[] }
// GET /race/{id}       →  ApiRaceDetail (with success wrapper)
// POST /lobby/sync     →  { success, message, latestRaceId, races: ApiRaceSummary[], pageInfo, recentWinnerRaces, recentJackpotWins }
export interface ApiRaceSummary {
  raceId: number                      // number, not string
  phase: RacePhaseNum                 // numeric: 1=OPEN, 2=RESOLVING, 3=RESOLVED, 4=CANCELLED
  phaseName: string                   // "OPEN" | "RESOLVING" | "RESOLVED" | "CANCELLED"
  createdAt: number                   // unix seconds
  raceStart: number                   // unix seconds, 0 if not yet started
  cancelledAt: number                 // unix seconds, 0 if not cancelled
  fieldSize: number                   // max entrants
  trackLength: number                 // in metres (e.g. 500, 1000, 1200, 3000)
  petCount: number                    // current filled slots (was filledSlots in spec)
  entryFee: string                    // wei as string (e.g. "0" or "500000000000000")
  pool: string                        // prize pool wei string (was prizePool in spec)
  creator: string                     // owner address
  createdTxHash: string | null
  broadcastTxHash: string | null
  joinHook: string | null
  isPrivate: boolean
  entries: ApiEntry[]
  finalRanking: number[] | null       // ordered petIds from 1st to last (index 0 = winner)
  finishTimes: number[] | null        // ms finish times, parallel to finalRanking
  payoutBps: number[]                 // basis-points per rank, e.g. [5500, 3000, 1500]
  creatorFeeBps: number
  protocolFeeBps: number
  protocolFeeBpsJuiced: number
  protocolFeeFloorWei: string
  jackpotBps: number
  jackpotWinnableBps: number
  jackpotMaxChanceBps: number
  jackpotTargetEntryFee: string
  creatorFeeAccruedWei: string
  raceParams: Record<string, unknown> // always {} in observed data — extraParamIds/Vals do NOT exist
  raceTemp: 'hot' | 'cold' | 'average' | null  // weather condition; null when OPEN
  joinHookPolicy: ApiJoinHookPolicy
  source?: {
    type: string
    planId: string | null
    displayName: string | null
    txHash: string | null
    onchainCronCreated: boolean
    creatorMismatch: boolean
  }
}

export interface ApiJoinHookPolicy {
  kind: 'none' | 'allowlist' | string
  address?: string
  allowlist?: string[]
  presetPetIds?: number[]
}

// GET /race/{id}  →  { success, ...ApiRaceDetail }
export interface ApiRaceDetail extends ApiRaceSummary {
  nextRaceId?: number
  racePets: number[]                  // array of petIds in the race
  petOwners: Record<string, string>   // petId string → ownerAddress
  petPayouts: Record<string, unknown>
  hasClaimed: boolean
  playerPayout: string
  playerRacePayout: string
  playerJackpotPayout: string
  jackpot: {
    balance: string
    entryBps: number
    winnableBps: number
    maxChanceBps: number
    maxChanceBpsJuiced: number
    targetEntryFee: string
  }
}

// Entry within a race (in both /races list and /race/{id})
export interface ApiEntry {
  petId: number
  ownerAddress: string                // was "owner" in spec — actual field is "ownerAddress"
  slot: number                        // 0-indexed slot position
  joinedAt: number                    // unix seconds
  juiced: boolean
  protoSurcharge: string              // wei surcharge string
  // NOTE: rank and msFinishTime are NOT on entries; they live in
  // finalRanking[] and finishTimes[] arrays on the race object
}

// GET /pets/{id}/stats  →  { success, stats: ApiPetStats }
// GET /pets/stats?ids=a,b  →  { success, stats: ApiPetStats[] }
// NOTE: no elo, rarity, faction, gender here — those come from leaderboard
export interface ApiPetStats {
  petId: number
  totalRaces: number                  // was racesRun in spec
  wins: number
  podiums: number
  jackpotWins: number
  weiSpent: string
  weiWon: string
  weiNet: string
  recent: ApiRecentRace[]             // was recentRaces in spec — field is "recent"
}

// Recent race entry on a pet's stats — completely different from spec
export interface ApiRecentRace {
  raceId: number                      // number not string
  phase: RacePhaseNum
  rank: number | null                 // 0-indexed (0 = 1st); null if race not yet resolved
  payoutKind: 'placement' | null
  weiEntry: string
  weiRaceAmount: string
  weiJackpotAmount: string
  weiPayout: string
  settledAt: number                   // unix seconds
  // NOTE: no trackLength, extraParamIds, extraParamVals, entryFee, or fieldSize here
}

// GET /leaderboard/elo?limit=N  →  { success, message, entries: ApiLeaderboardEntry[], hasMore }
export interface ApiLeaderboardEntry {
  rank: number
  petId: number
  elo: number
  eloRaceCount: number
  racesRun: number
  wins: number
  rarity: number                      // integer enum, not string (6=Giga, 5=Relic, etc.)
  faction: number                     // integer enum, not string (5=Foxglove, 7=Chobo, etc.)
  gender: 'Male' | 'Female'          // capitalized, not lowercase
  ownerAddress: string
  rarityName: string                  // human-readable e.g. "Giga"
  factionName: string                 // human-readable e.g. "Foxglove"
  racePublic: ApiRacePublic
  ownerSummary: ApiOwnerSummary
}

export interface ApiRacePublic {
  id: number
  racesRun: number
  maxRaces: number
  revealsPerStat: { start: number; speed: number; stamina: number; finish: number }
  startRange: { min: number; max: number }
  speedRange: { min: number; max: number }
  staminaRange: { min: number; max: number }
  finishRange: { min: number; max: number }
  traits: ApiTrait[]
  elo: number
  eloRaceCount: number
  wins: number
}

export interface ApiTrait {
  id: string
  name: string
  tier: number | null
}

export interface ApiOwnerSummary {
  username: string
  hasNoob: boolean
  noobId: number | null
  headSheetUrl: string
  bodySheetUrl: string
  energyValue: number | null
  maxEnergy: number | null
  romCount: number
  petCount: number
  gigabitCount: number | null
  factionId: number
  isJuiced: boolean
  juicedSeconds: number
  topRacingGigling: {
    petId: number
    name: string
    rarity: number
    faction: number
    gender: string
    elo: number
  } | null
}

// GET /stats  →  { success, data: ApiGlobalStats }
export interface ApiGlobalStats {
  totalRacesCreated: number
  racesByPhase: Record<string, number>
  totalEntries: number
  uniqueRacers: number
  totalJackpotWinsCount: number
  totalJackpotPaidOutWei: string
  totalEntryFeeVolumeWei: string
  totalProtocolFeesWei: string
  totalCreatorFeesLifetimeWei: string
  uniqueCreators: number
  phaseNames: Record<string, string>
}

// POST /lobby/sync wrapper
export interface ApiLobbySyncResponse {
  success: boolean
  message: string
  latestRaceId: number
  races: ApiRaceSummary[]
  pageInfo: { hasMore: boolean; nextCursor: string; limit: number }
  recentWinnerRaces: ApiRaceSummary[]
  recentJackpotWins: unknown[]
}

// Removed: ApiPayoutEntry — payouts are now payoutBps: number[] on the race
// (basis points per rank position, not per-rank wei amounts)
