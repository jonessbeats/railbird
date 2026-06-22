// lib/backtest/types.ts

export interface PredictionPick {
  petId: number
  winProb: number          // 0–1, as produced by handicap()
  evEnter: number | null   // ETH EV of entering this pet; null if unknown
}

export interface PredictionRecord {
  raceId: number
  modelVersion: string
  recordedAt: number       // unix seconds (snapshot time / race start for retro)
  trackLength: number
  entryFee: string         // wei
  pool: string             // wei at prediction time
  payoutBps: number[]      // basis points per finishing rank
  fieldSize: number
  picks: PredictionPick[]  // one per entrant with model data
  edgePetId: number | null // model's flagged EDGE pick (max positive EV), if any
  eloPickPetId: number | null // highest-ELO entrant (baseline pick)
}

export interface EdgeOutcome {
  rank: number             // 0-indexed finishing position of the edge pick (-1 if not found)
  payoutWei: string
  netWei: string           // payoutWei - entryFee
}

export interface GradedRecord extends PredictionRecord {
  finalRanking: number[]   // actual order, index 0 = winner
  winnerPetId: number
  topPickPetId: number     // argmax winProb among picks
  topPickWon: boolean
  topPickInTop3: boolean
  edgeOutcome: EdgeOutcome | null
  source: 'retro' | 'ledger'
}

export interface CalibrationBin {
  lo: number               // bin lower edge (inclusive)
  hi: number               // bin upper edge (exclusive, except last)
  predictedMean: number    // mean predicted winProb in bin
  observedRate: number     // fraction of picks in bin that actually won
  count: number            // number of picks in bin
}

export interface BacktestMetrics {
  nRaces: number
  nPets: number
  favoriteHitRate: number  // P(top pick finished 1st)
  randomBaseline: number   // mean 1/fieldSize
  eloBaseline: number      // P(highest-ELO pet finished 1st)
  top3HitRate: number
  brier: number
  logLoss: number
  calibration: CalibrationBin[]
  edgeNetEth: number       // total net ETH from following EDGE flags (paid races)
  edgeRoi: number | null   // edgeNetWei / edgeEntryWei; null if no paid edge picks
  edgePicks: number
  meanCoverage: number     // mean (picks / fieldSize)
}
