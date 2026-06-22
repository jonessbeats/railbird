# Backtest & Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/backtest` page that quantifies the handicap model's accuracy and calibration — retrospective replay over resolved races (instant) plus a zero-leakage forward ledger that grades predictions made on open races.

**Architecture:** Pure metric/grading math (`lib/backtest/*`, fully unit-tested) consumed by two data paths — a retrospective replay over RESOLVED races (Path A) and a durable forward ledger (Path B). Both emit the same `GradedRecord[]` into one metrics module and one page with a Retro/Live toggle. Charts are hand-rolled inline SVG; ledger storage is a thin interface (Upstash REST in prod, local JSON file in dev).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, `tsx` + Node built-in `node:test` runner (no new test deps), Upstash Redis REST (optional, env-gated).

## Global Constraints

- Node ≥ 20 (dev box runs Node 24); tests run via `tsx --test`.
- No new runtime dependencies. Upstash uses its REST API via `fetch` — do NOT add `@upstash/redis`.
- Path alias `@/*` → repo root (already in `tsconfig.json`).
- All metric/grading/predict code is **pure** (data in → data out, no I/O) so it is unit-testable.
- Every ledger/graded record carries `modelVersion`; metrics never mix versions.
- Match the existing neon/pixel Tailwind styling (`neon-green`, `neon-cyan`, `neon-gold`, `game-muted`, `game-border`, `retro-panel`, `pixel` classes).
- Handicap entry point is `handicap(pets, trackLength, entryFee, payoutBps, pool)` returning `HandicapResult[]`.
- Pet snapshots are built with `buildPetSnapshotWithStats(lbEntry, stats?)` (stats optional — leaderboard alone is enough).

## File Map

| File | Responsibility |
|------|----------------|
| `lib/backtest/version.ts` | `MODEL_VERSION` constant |
| `lib/backtest/types.ts` | `PredictionPick`, `PredictionRecord`, `EdgeOutcome`, `GradedRecord`, `CalibrationBin`, `BacktestMetrics` |
| `lib/backtest/predict.ts` | `predictRace()` — pure: handicaps → picks + edgePetId + eloPickPetId |
| `lib/backtest/grade.ts` | `buildGradedRecord()` — pure: prediction + finalRanking → graded record |
| `lib/backtest/metrics.ts` | `computeMetrics()` — pure: graded records → hit-rate, Brier, log-loss, calibration, EDGE ROI |
| `lib/backtest/store.ts` | `LedgerStore` interface, `FileLedgerStore`, `UpstashLedgerStore`, `getStore()` selector |
| `lib/backtest/ledger.ts` | `buildPrediction()`, `gradePending()` — forward-ledger orchestration |
| `lib/backtest/retro.ts` | `replayResolvedRace()` (pure), `runRetroBacktest()` (orchestrator) |
| `lib/api/gigaverse.ts` | +`fetchResolvedRaces()` cursor pagination helper |
| `app/api/ledger/snapshot/route.ts` | Trigger ledger snapshot of open races |
| `app/api/ledger/grade/route.ts` | Trigger grading of pending records |
| `components/backtest/StatTile.tsx` | Headline metric tile |
| `components/backtest/CalibrationChart.tsx` | Inline-SVG calibration plot |
| `components/backtest/ReliabilityTable.tsx` | Per-bin predicted/observed/count table |
| `components/backtest/EdgeTrackRecord.tsx` | EDGE picks list with ✓/✗ + running net |
| `components/backtest/SampleBadge.tsx` | Sample size + coverage + disclaimer |
| `app/backtest/page.tsx` | The page: tiles, chart, table, track record, Retro/Live toggle, methodology |
| `app/layout.tsx` | +nav link to `/backtest` |
| `.gitignore` | +`.railbird-ledger.json` |

---

## Task 1: Foundations — test runner, types, model version

**Files:**
- Modify: `package.json` (add `test` script)
- Create: `lib/backtest/version.ts`
- Create: `lib/backtest/types.ts`
- Test: `lib/backtest/__tests__/version.test.ts`

**Interfaces:**
- Produces: `MODEL_VERSION: string`; the type set listed below (consumed by every later task).

- [ ] **Step 1: Add the test script to `package.json`**

In the `"scripts"` block add:

```json
    "test": "tsx --test \"lib/backtest/__tests__/*.test.ts\""
```

- [ ] **Step 2: Write `lib/backtest/version.ts`**

```ts
// lib/backtest/version.ts
// Bump whenever the handicap model changes so metrics never mix model versions.
export const MODEL_VERSION = 'v1'
```

- [ ] **Step 3: Write `lib/backtest/types.ts`**

```ts
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
```

- [ ] **Step 4: Write the failing smoke test `lib/backtest/__tests__/version.test.ts`**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MODEL_VERSION } from '../version'

test('MODEL_VERSION is a non-empty string', () => {
  assert.equal(typeof MODEL_VERSION, 'string')
  assert.ok(MODEL_VERSION.length > 0)
})
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npm test`
Expected: 1 test passing, exit 0. (Confirms `tsx --test` + TS path resolution work.)

- [ ] **Step 6: Commit**

```bash
git add package.json lib/backtest/version.ts lib/backtest/types.ts lib/backtest/__tests__/version.test.ts
git commit -m "feat(backtest): test harness, shared types, model version"
```

---

## Task 2: `predictRace()` — handicaps → prediction picks

**Files:**
- Create: `lib/backtest/predict.ts`
- Test: `lib/backtest/__tests__/predict.test.ts`

**Interfaces:**
- Consumes: `HandicapResult` (`{ petId, winProb, evEnter? }` from `@/types/racing`), `PredictionPick` (Task 1).
- Produces: `predictRace(handicaps: HandicapResult[], pets: { petId: number; elo: number }[]): { picks: PredictionPick[]; edgePetId: number | null; eloPickPetId: number | null }`

- [ ] **Step 1: Write the failing test `lib/backtest/__tests__/predict.test.ts`**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { predictRace } from '../predict'
import type { HandicapResult } from '@/types/racing'

function h(petId: number, winProb: number, evEnter: number | undefined): HandicapResult {
  return { petId, winProb, fairOdds: 1 / winProb, rankDist: [], evEnter, valueRating: 0, revealPct: 50 }
}

test('picks mirror handicaps; edgePetId is max positive EV; eloPick is max ELO', () => {
  const handicaps = [h(1, 0.5, -0.01), h(2, 0.3, 0.04), h(3, 0.2, 0.02)]
  const pets = [{ petId: 1, elo: 1500 }, { petId: 2, elo: 1400 }, { petId: 3, elo: 1700 }]
  const { picks, edgePetId, eloPickPetId } = predictRace(handicaps, pets)

  assert.equal(picks.length, 3)
  assert.deepEqual(picks[0], { petId: 1, winProb: 0.5, evEnter: -0.01 })
  assert.equal(edgePetId, 2)        // 0.04 is the largest positive EV
  assert.equal(eloPickPetId, 3)     // ELO 1700
})

test('edgePetId null when no positive EV', () => {
  const handicaps = [h(1, 0.6, -0.01), h(2, 0.4, undefined)]
  const pets = [{ petId: 1, elo: 1500 }, { petId: 2, elo: 1400 }]
  const { edgePetId } = predictRace(handicaps, pets)
  assert.equal(edgePetId, null)
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx tsx --test lib/backtest/__tests__/predict.test.ts`
Expected: FAIL — `predictRace` not found / module missing.

- [ ] **Step 3: Write `lib/backtest/predict.ts`**

```ts
// lib/backtest/predict.ts
import type { HandicapResult } from '@/types/racing'
import type { PredictionPick } from './types'

export function predictRace(
  handicaps: HandicapResult[],
  pets: { petId: number; elo: number }[],
): { picks: PredictionPick[]; edgePetId: number | null; eloPickPetId: number | null } {
  const picks: PredictionPick[] = handicaps.map(hc => ({
    petId: hc.petId,
    winProb: hc.winProb,
    evEnter: hc.evEnter ?? null,
  }))

  const edge = [...handicaps]
    .filter(hc => (hc.evEnter ?? -Infinity) > 0)
    .sort((a, b) => (b.evEnter ?? 0) - (a.evEnter ?? 0))[0]
  const edgePetId = edge ? edge.petId : null

  const eloPick = [...pets].sort((a, b) => b.elo - a.elo)[0]
  const eloPickPetId = eloPick ? eloPick.petId : null

  return { picks, edgePetId, eloPickPetId }
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx tsx --test lib/backtest/__tests__/predict.test.ts`
Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/backtest/predict.ts lib/backtest/__tests__/predict.test.ts
git commit -m "feat(backtest): predictRace — handicaps to prediction picks"
```

---

## Task 3: `buildGradedRecord()` — grade a prediction against the result

**Files:**
- Create: `lib/backtest/grade.ts`
- Test: `lib/backtest/__tests__/grade.test.ts`

**Interfaces:**
- Consumes: `PredictionRecord`, `GradedRecord`, `EdgeOutcome` (Task 1).
- Produces: `buildGradedRecord(pred: PredictionRecord, finalRanking: number[], source: 'retro' | 'ledger'): GradedRecord`

- [ ] **Step 1: Write the failing test `lib/backtest/__tests__/grade.test.ts`**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGradedRecord } from '../grade'
import type { PredictionRecord } from '../types'

function pred(overrides: Partial<PredictionRecord> = {}): PredictionRecord {
  return {
    raceId: 1, modelVersion: 'v1', recordedAt: 0, trackLength: 1000,
    entryFee: '1000000000000000',          // 0.001 ETH
    pool: '5000000000000000',              // 0.005 ETH
    payoutBps: [6000, 3000, 1000],
    fieldSize: 4,
    picks: [
      { petId: 10, winProb: 0.5, evEnter: 0.002 },
      { petId: 20, winProb: 0.3, evEnter: -0.001 },
      { petId: 30, winProb: 0.2, evEnter: null },
    ],
    edgePetId: 10,
    eloPickPetId: 10,
    ...overrides,
  }
}

test('top pick wins, top-3 true, edge payout for 1st', () => {
  const g = buildGradedRecord(pred(), [10, 20, 30, 40], 'retro')
  assert.equal(g.winnerPetId, 10)
  assert.equal(g.topPickPetId, 10)
  assert.equal(g.topPickWon, true)
  assert.equal(g.topPickInTop3, true)
  assert.equal(g.source, 'retro')
  // edge pick #10 finished 1st → payout = pool * 6000/10000 = 0.003 ETH
  assert.equal(g.edgeOutcome?.rank, 0)
  assert.equal(g.edgeOutcome?.payoutWei, '3000000000000000')
  // net = 0.003 - 0.001 = 0.002 ETH
  assert.equal(g.edgeOutcome?.netWei, '2000000000000000')
})

test('top pick loses and out of money', () => {
  const g = buildGradedRecord(pred(), [20, 30, 40, 10], 'ledger')
  assert.equal(g.topPickWon, false)
  assert.equal(g.topPickInTop3, false)   // #10 finished 4th (index 3)
  // edge pick #10 finished 4th → no payout (only 3 paid)
  assert.equal(g.edgeOutcome?.rank, 3)
  assert.equal(g.edgeOutcome?.payoutWei, '0')
  assert.equal(g.edgeOutcome?.netWei, '-1000000000000000')
})

test('no edge pick → edgeOutcome null', () => {
  const g = buildGradedRecord(pred({ edgePetId: null }), [10, 20, 30, 40], 'retro')
  assert.equal(g.edgeOutcome, null)
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx tsx --test lib/backtest/__tests__/grade.test.ts`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Write `lib/backtest/grade.ts`**

```ts
// lib/backtest/grade.ts
import type { PredictionRecord, GradedRecord, EdgeOutcome } from './types'

function payoutForRank(rank: number, pool: string, payoutBps: number[]): bigint {
  if (rank < 0 || rank >= payoutBps.length) return 0n
  return (BigInt(pool) * BigInt(payoutBps[rank])) / 10000n
}

export function buildGradedRecord(
  pred: PredictionRecord,
  finalRanking: number[],
  source: 'retro' | 'ledger',
): GradedRecord {
  const winnerPetId = finalRanking[0]

  const sortedPicks = [...pred.picks].sort((a, b) => b.winProb - a.winProb)
  const topPickPetId = sortedPicks.length > 0 ? sortedPicks[0].petId : -1
  const topPickRank = finalRanking.indexOf(topPickPetId)
  const topPickWon = topPickRank === 0
  const topPickInTop3 = topPickRank >= 0 && topPickRank < 3

  let edgeOutcome: EdgeOutcome | null = null
  if (pred.edgePetId != null) {
    const rank = finalRanking.indexOf(pred.edgePetId)
    const payoutWei = payoutForRank(rank, pred.pool, pred.payoutBps)
    const netWei = payoutWei - BigInt(pred.entryFee)
    edgeOutcome = { rank, payoutWei: payoutWei.toString(), netWei: netWei.toString() }
  }

  return {
    ...pred,
    finalRanking,
    winnerPetId,
    topPickPetId,
    topPickWon,
    topPickInTop3,
    edgeOutcome,
    source,
  }
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx tsx --test lib/backtest/__tests__/grade.test.ts`
Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/backtest/grade.ts lib/backtest/__tests__/grade.test.ts
git commit -m "feat(backtest): buildGradedRecord — grade prediction vs final ranking"
```

---

## Task 4: `computeMetrics()` — aggregate metrics + calibration

**Files:**
- Create: `lib/backtest/metrics.ts`
- Test: `lib/backtest/__tests__/metrics.test.ts`

**Interfaces:**
- Consumes: `GradedRecord`, `CalibrationBin`, `BacktestMetrics` (Task 1); `weiToEth` from `@/lib/encode`.
- Produces: `computeMetrics(records: GradedRecord[]): BacktestMetrics`

- [ ] **Step 1: Write the failing test `lib/backtest/__tests__/metrics.test.ts`**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMetrics } from '../metrics'
import { buildGradedRecord } from '../grade'
import type { PredictionRecord } from '../types'

function pred(o: Partial<PredictionRecord>): PredictionRecord {
  return {
    raceId: 1, modelVersion: 'v1', recordedAt: 0, trackLength: 1000,
    entryFee: '1000000000000000', pool: '5000000000000000',
    payoutBps: [6000, 3000, 1000], fieldSize: 4,
    picks: [], edgePetId: null, eloPickPetId: null, ...o,
  }
}

// race A: top pick (#10, 0.5) wins. race B: top pick (#10, 0.5) loses to #20.
const recA = buildGradedRecord(pred({
  raceId: 1,
  picks: [{ petId: 10, winProb: 0.5, evEnter: 0.002 }, { petId: 20, winProb: 0.5, evEnter: null }],
  edgePetId: 10, eloPickPetId: 10,
}), [10, 20, 30, 40], 'retro')

const recB = buildGradedRecord(pred({
  raceId: 2,
  picks: [{ petId: 10, winProb: 0.5, evEnter: 0.002 }, { petId: 20, winProb: 0.5, evEnter: null }],
  edgePetId: 10, eloPickPetId: 10,
}), [20, 10, 30, 40], 'ledger')

test('hit-rate and baselines', () => {
  const m = computeMetrics([recA, recB])
  assert.equal(m.nRaces, 2)
  assert.equal(m.favoriteHitRate, 0.5)        // 1 of 2
  assert.equal(m.top3HitRate, 1)              // #10 finished 1st then 2nd
  assert.equal(m.randomBaseline, 0.25)        // 1/4
  assert.equal(m.eloBaseline, 0.5)            // ELO pick #10 won once
})

test('edge ROI from paid edge picks', () => {
  const m = computeMetrics([recA, recB])
  // A: edge #10 1st → +0.002; B: edge #10 2nd → payout 0.005*0.3=0.0015, net +0.0005
  // net total = 0.0025 ETH; entry total = 0.002 ETH → ROI = 1.25
  assert.equal(m.edgePicks, 2)
  assert.ok(Math.abs(m.edgeNetEth - 0.0025) < 1e-9)
  assert.ok(m.edgeRoi !== null && Math.abs(m.edgeRoi - 1.25) < 1e-9)
})

test('calibration bins sum to all picks', () => {
  const m = computeMetrics([recA, recB])
  const totalCount = m.calibration.reduce((s, b) => s + b.count, 0)
  assert.equal(totalCount, 4)                 // 2 picks * 2 races
  assert.equal(m.calibration.length, 10)
})

test('empty input is safe', () => {
  const m = computeMetrics([])
  assert.equal(m.nRaces, 0)
  assert.equal(m.favoriteHitRate, 0)
  assert.equal(m.edgeRoi, null)
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx tsx --test lib/backtest/__tests__/metrics.test.ts`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Write `lib/backtest/metrics.ts`**

```ts
// lib/backtest/metrics.ts
import type { GradedRecord, CalibrationBin, BacktestMetrics } from './types'
import { weiToEth } from '@/lib/encode'

const N_BINS = 10

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}
function probSum(r: GradedRecord): number {
  return r.picks.reduce((s, p) => s + p.winProb, 0)
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

function buildCalibration(records: GradedRecord[]): CalibrationBin[] {
  const bins = Array.from({ length: N_BINS }, (_, i) => ({
    lo: i / N_BINS, hi: (i + 1) / N_BINS, preds: [] as number[], wins: 0,
  }))
  for (const r of records) {
    const total = Math.max(probSum(r), 1e-9)
    for (const p of r.picks) {
      const norm = p.winProb / total
      let idx = Math.floor(norm * N_BINS)
      if (idx >= N_BINS) idx = N_BINS - 1
      if (idx < 0) idx = 0
      bins[idx].preds.push(norm)
      if (p.petId === r.winnerPetId) bins[idx].wins += 1
    }
  }
  return bins.map(b => ({
    lo: b.lo, hi: b.hi,
    predictedMean: b.preds.length ? mean(b.preds) : 0,
    observedRate: b.preds.length ? b.wins / b.preds.length : 0,
    count: b.preds.length,
  }))
}

export function computeMetrics(records: GradedRecord[]): BacktestMetrics {
  const n = records.length
  // Races where the actual winner had model data (winner ∈ picks) — needed for Brier/log-loss.
  const scored = records.filter(r => r.picks.some(p => p.petId === r.winnerPetId))

  const favoriteHitRate = mean(records.map(r => (r.topPickWon ? 1 : 0)))
  const top3HitRate = mean(records.map(r => (r.topPickInTop3 ? 1 : 0)))
  const randomBaseline = mean(records.map(r => (r.fieldSize > 0 ? 1 / r.fieldSize : 0)))
  const eloBaseline = mean(records.map(
    r => (r.eloPickPetId != null && r.eloPickPetId === r.winnerPetId ? 1 : 0),
  ))

  const brier = mean(scored.map(r => {
    const total = Math.max(probSum(r), 1e-9)
    return r.picks.reduce((s, p) => {
      const norm = p.winProb / total
      const o = p.petId === r.winnerPetId ? 1 : 0
      return s + (norm - o) ** 2
    }, 0)
  }))

  const logLoss = mean(scored.map(r => {
    const total = Math.max(probSum(r), 1e-9)
    const winnerPick = r.picks.find(p => p.petId === r.winnerPetId)!
    const p = clamp(winnerPick.winProb / total, 1e-6, 1 - 1e-6)
    return -Math.log(p)
  }))

  const calibration = buildCalibration(scored)

  const edgeRecords = records.filter(
    r => r.edgeOutcome != null && BigInt(r.entryFee) > 0n,
  )
  const edgeNetWei = edgeRecords.reduce((s, r) => s + BigInt(r.edgeOutcome!.netWei), 0n)
  const edgeEntryWei = edgeRecords.reduce((s, r) => s + BigInt(r.entryFee), 0n)
  const edgeNetEth = weiToEth(edgeNetWei.toString())
  const edgeRoi = edgeEntryWei > 0n ? Number(edgeNetWei) / Number(edgeEntryWei) : null

  const nPets = records.reduce((s, r) => s + r.picks.length, 0)
  const meanCoverage = mean(records.map(
    r => (r.fieldSize > 0 ? r.picks.length / r.fieldSize : 0),
  ))

  return {
    nRaces: n, nPets, favoriteHitRate, randomBaseline, eloBaseline,
    top3HitRate, brier, logLoss, calibration,
    edgeNetEth, edgeRoi, edgePicks: edgeRecords.length, meanCoverage,
  }
}
```

> Note on `weiToEth`: defined in `lib/encode.ts` as `weiToEth(wei: string): number`. It guards empty/zero input. Negative wei strings (net losses) are valid `BigInt` inputs.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx tsx --test lib/backtest/__tests__/metrics.test.ts`
Expected: 4 tests passing.

- [ ] **Step 5: Confirm `weiToEth` handles negative wei strings**

Run: `npx tsx -e "import('./lib/encode.ts').then(m => console.log(m.weiToEth('-1000000000000000')))"`
Expected: `-0.001`. If it returns `NaN`/throws, fix `weiToEth` to wrap `BigInt(wei || '0')` (it already should) — negative decimal strings are valid for `BigInt`.

- [ ] **Step 6: Commit**

```bash
git add lib/backtest/metrics.ts lib/backtest/__tests__/metrics.test.ts
git commit -m "feat(backtest): computeMetrics — hit-rate, Brier, log-loss, calibration, EDGE ROI"
```

---

## Task 5: Ledger store — interface, file impl, Upstash impl, selector

**Files:**
- Create: `lib/backtest/store.ts`
- Modify: `.gitignore` (add `.railbird-ledger.json`)
- Test: `lib/backtest/__tests__/store.test.ts`

**Interfaces:**
- Consumes: `PredictionRecord`, `GradedRecord` (Task 1).
- Produces:
  - `interface LedgerStore { recordPrediction(rec): Promise<void>; getPending(): Promise<PredictionRecord[]>; removePending(raceId, modelVersion): Promise<void>; addGraded(rec): Promise<void>; getGraded(): Promise<GradedRecord[]> }`
  - `class FileLedgerStore implements LedgerStore` (constructor `(file?: string)`)
  - `class UpstashLedgerStore implements LedgerStore`
  - `getStore(): LedgerStore` (Upstash if env present, else file)

- [ ] **Step 1: Add `.railbird-ledger.json` to `.gitignore`**

Append a line:

```
.railbird-ledger.json
```

- [ ] **Step 2: Write the failing test `lib/backtest/__tests__/store.test.ts`**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { FileLedgerStore } from '../store'
import { buildGradedRecord } from '../grade'
import type { PredictionRecord } from '../types'

function pred(raceId: number): PredictionRecord {
  return {
    raceId, modelVersion: 'v1', recordedAt: 0, trackLength: 1000,
    entryFee: '0', pool: '0', payoutBps: [10000], fieldSize: 2,
    picks: [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }],
    edgePetId: null, eloPickPetId: 1,
  }
}

test('file store round-trips pending → graded, dedupes by raceId+version', async () => {
  const file = path.join(os.tmpdir(), `railbird-ledger-${Date.now()}.json`)
  const store = new FileLedgerStore(file)
  try {
    await store.recordPrediction(pred(1))
    await store.recordPrediction(pred(1))          // duplicate ignored
    await store.recordPrediction(pred(2))
    assert.equal((await store.getPending()).length, 2)

    const g = buildGradedRecord(pred(1), [1, 2], 'ledger')
    await store.addGraded(g)
    await store.removePending(1, 'v1')

    assert.equal((await store.getPending()).length, 1)
    assert.equal((await store.getGraded()).length, 1)
    assert.equal((await store.getGraded())[0].winnerPetId, 1)
  } finally {
    await fs.rm(file, { force: true })
  }
})
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `npx tsx --test lib/backtest/__tests__/store.test.ts`
Expected: FAIL — module/class missing.

- [ ] **Step 4: Write `lib/backtest/store.ts`**

```ts
// lib/backtest/store.ts
import { promises as fs } from 'fs'
import path from 'path'
import type { PredictionRecord, GradedRecord } from './types'

const KEY_PENDING = 'railbird:ledger:pending'
const KEY_GRADED = 'railbird:ledger:graded'

export interface LedgerStore {
  recordPrediction(rec: PredictionRecord): Promise<void>
  getPending(): Promise<PredictionRecord[]>
  removePending(raceId: number, modelVersion: string): Promise<void>
  addGraded(rec: GradedRecord): Promise<void>
  getGraded(): Promise<GradedRecord[]>
}

const keyOf = (r: { raceId: number; modelVersion: string }) => `${r.raceId}:${r.modelVersion}`

interface LedgerData { pending: PredictionRecord[]; graded: GradedRecord[] }

export class FileLedgerStore implements LedgerStore {
  constructor(private file = path.join(process.cwd(), '.railbird-ledger.json')) {}

  private async read(): Promise<LedgerData> {
    try {
      const raw = await fs.readFile(this.file, 'utf8')
      const d = JSON.parse(raw)
      return { pending: d.pending ?? [], graded: d.graded ?? [] }
    } catch {
      return { pending: [], graded: [] }
    }
  }
  private async write(d: LedgerData): Promise<void> {
    await fs.writeFile(this.file, JSON.stringify(d), 'utf8')
  }

  async recordPrediction(rec: PredictionRecord): Promise<void> {
    const d = await this.read()
    const exists = d.pending.some(r => keyOf(r) === keyOf(rec))
      || d.graded.some(r => keyOf(r) === keyOf(rec))
    if (!exists) { d.pending.push(rec); await this.write(d) }
  }
  async getPending(): Promise<PredictionRecord[]> { return (await this.read()).pending }
  async removePending(raceId: number, modelVersion: string): Promise<void> {
    const d = await this.read()
    d.pending = d.pending.filter(r => !(r.raceId === raceId && r.modelVersion === modelVersion))
    await this.write(d)
  }
  async addGraded(rec: GradedRecord): Promise<void> {
    const d = await this.read()
    if (!d.graded.some(r => keyOf(r) === keyOf(rec))) { d.graded.push(rec); await this.write(d) }
  }
  async getGraded(): Promise<GradedRecord[]> { return (await this.read()).graded }
}

// Upstash Redis via REST (no SDK dependency). Stores each list as a JSON string.
export class UpstashLedgerStore implements LedgerStore {
  constructor(
    private url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '',
    private token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '',
  ) {}

  private async cmd<T>(command: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Upstash ${command[0]} → ${res.status}`)
    const json = await res.json()
    return json.result as T
  }
  private async getList<T>(key: string): Promise<T[]> {
    const raw = await this.cmd<string | null>(['GET', key])
    if (!raw) return []
    try { return JSON.parse(raw) as T[] } catch { return [] }
  }
  private async setList<T>(key: string, list: T[]): Promise<void> {
    await this.cmd(['SET', key, JSON.stringify(list)])
  }

  async recordPrediction(rec: PredictionRecord): Promise<void> {
    const [pending, graded] = await Promise.all([
      this.getList<PredictionRecord>(KEY_PENDING),
      this.getList<GradedRecord>(KEY_GRADED),
    ])
    const exists = pending.some(r => keyOf(r) === keyOf(rec))
      || graded.some(r => keyOf(r) === keyOf(rec))
    if (!exists) { pending.push(rec); await this.setList(KEY_PENDING, pending) }
  }
  async getPending(): Promise<PredictionRecord[]> { return this.getList<PredictionRecord>(KEY_PENDING) }
  async removePending(raceId: number, modelVersion: string): Promise<void> {
    const pending = await this.getList<PredictionRecord>(KEY_PENDING)
    await this.setList(KEY_PENDING,
      pending.filter(r => !(r.raceId === raceId && r.modelVersion === modelVersion)))
  }
  async addGraded(rec: GradedRecord): Promise<void> {
    const graded = await this.getList<GradedRecord>(KEY_GRADED)
    if (!graded.some(r => keyOf(r) === keyOf(rec))) {
      graded.push(rec); await this.setList(KEY_GRADED, graded)
    }
  }
  async getGraded(): Promise<GradedRecord[]> { return this.getList<GradedRecord>(KEY_GRADED) }
}

let _store: LedgerStore | null = null
export function getStore(): LedgerStore {
  if (_store) return _store
  const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)
  _store = hasUpstash ? new UpstashLedgerStore() : new FileLedgerStore()
  return _store
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npx tsx --test lib/backtest/__tests__/store.test.ts`
Expected: 1 test passing.

- [ ] **Step 6: Commit**

```bash
git add lib/backtest/store.ts lib/backtest/__tests__/store.test.ts .gitignore
git commit -m "feat(backtest): ledger store — file + Upstash REST + selector"
```

---

## Task 6: Forward ledger — `buildPrediction()` + `gradePending()`

**Files:**
- Create: `lib/backtest/ledger.ts`
- Test: `lib/backtest/__tests__/ledger.test.ts`

**Interfaces:**
- Consumes: `LedgerStore` (Task 5), `buildGradedRecord` (Task 3), `MODEL_VERSION` (Task 1), `ApiRaceSummary` from `@/types/racing`, `PredictionRecord`/`PredictionPick` (Task 1).
- Produces:
  - `buildPrediction(race: ApiRaceSummary, picks: PredictionPick[], edgePetId: number | null, eloPickPetId: number | null, now?: number): PredictionRecord`
  - `gradePending(store: LedgerStore, fetchRaceById: (id: number) => Promise<ApiRaceSummary>): Promise<number>`

- [ ] **Step 1: Write the failing test `lib/backtest/__tests__/ledger.test.ts`**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { buildPrediction, gradePending } from '../ledger'
import { FileLedgerStore } from '../store'
import type { ApiRaceSummary } from '@/types/racing'

function race(o: Partial<ApiRaceSummary>): ApiRaceSummary {
  return {
    raceId: 1, phase: 3, phaseName: 'OPEN', createdAt: 0, raceStart: 0, cancelledAt: 0,
    fieldSize: 2, trackLength: 1000, petCount: 2, entryFee: '0', pool: '0',
    creator: '0x', createdTxHash: null, broadcastTxHash: null, joinHook: null, isPrivate: false,
    entries: [{ petId: 1, ownerAddress: '0x', slot: 0, joinedAt: 0, juiced: false, protoSurcharge: '0' },
              { petId: 2, ownerAddress: '0x', slot: 1, joinedAt: 0, juiced: false, protoSurcharge: '0' }],
    finalRanking: null, finishTimes: null, payoutBps: [10000],
    creatorFeeBps: 0, protocolFeeBps: 0, protocolFeeBpsJuiced: 0, protocolFeeFloorWei: '0',
    jackpotBps: 0, jackpotWinnableBps: 0, jackpotMaxChanceBps: 0, jackpotTargetEntryFee: '0',
    creatorFeeAccruedWei: '0', raceParams: {}, raceTemp: null,
    joinHookPolicy: {} as ApiRaceSummary['joinHookPolicy'],
    ...o,
  }
}

test('buildPrediction stamps model version and copies race fields', () => {
  const p = buildPrediction(
    race({ raceId: 7 }),
    [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }],
    null, 1, 1234,
  )
  assert.equal(p.raceId, 7)
  assert.equal(p.modelVersion, 'v1')
  assert.equal(p.recordedAt, 1234)
  assert.equal(p.picks.length, 2)
  assert.equal(p.eloPickPetId, 1)
})

test('gradePending settles resolved, drops cancelled, leaves open', async () => {
  const file = path.join(os.tmpdir(), `railbird-ledger-${Date.now()}.json`)
  const store = new FileLedgerStore(file)
  try {
    await store.recordPrediction(buildPrediction(
      race({ raceId: 1 }), [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }], null, 1))
    await store.recordPrediction(buildPrediction(
      race({ raceId: 2 }), [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }], null, 1))
    await store.recordPrediction(buildPrediction(
      race({ raceId: 3 }), [{ petId: 1, winProb: 0.6, evEnter: null }, { petId: 2, winProb: 0.4, evEnter: null }], null, 1))

    const fetchRaceById = async (id: number): Promise<ApiRaceSummary> => {
      if (id === 1) return race({ raceId: 1, phaseName: 'RESOLVED', finalRanking: [1, 2] })
      if (id === 2) return race({ raceId: 2, phaseName: 'CANCELLED' })
      return race({ raceId: 3, phaseName: 'OPEN' })
    }

    const graded = await gradePending(store, fetchRaceById)
    assert.equal(graded, 1)                              // only race 1 resolved
    assert.equal((await store.getGraded()).length, 1)
    assert.equal((await store.getPending()).length, 1)   // race 3 still open (2 cancelled & dropped)
    assert.equal((await store.getPending())[0].raceId, 3)
  } finally {
    await fs.rm(file, { force: true })
  }
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx tsx --test lib/backtest/__tests__/ledger.test.ts`
Expected: FAIL — module/functions missing.

- [ ] **Step 3: Write `lib/backtest/ledger.ts`**

```ts
// lib/backtest/ledger.ts
import type { LedgerStore } from './store'
import { buildGradedRecord } from './grade'
import { MODEL_VERSION } from './version'
import type { ApiRaceSummary } from '@/types/racing'
import type { PredictionRecord, PredictionPick } from './types'

export function buildPrediction(
  race: ApiRaceSummary,
  picks: PredictionPick[],
  edgePetId: number | null,
  eloPickPetId: number | null,
  now = Math.floor(Date.now() / 1000),
): PredictionRecord {
  return {
    raceId: race.raceId,
    modelVersion: MODEL_VERSION,
    recordedAt: now,
    trackLength: race.trackLength,
    entryFee: race.entryFee,
    pool: race.pool,
    payoutBps: race.payoutBps,
    fieldSize: race.fieldSize,
    picks,
    edgePetId,
    eloPickPetId,
  }
}

export async function gradePending(
  store: LedgerStore,
  fetchRaceById: (id: number) => Promise<ApiRaceSummary>,
): Promise<number> {
  const pending = await store.getPending()
  let graded = 0
  for (const rec of pending) {
    let race: ApiRaceSummary
    try {
      race = await fetchRaceById(rec.raceId)
    } catch {
      continue                                   // transient fetch failure → retry next run
    }
    if (race.phaseName === 'CANCELLED') {
      await store.removePending(rec.raceId, rec.modelVersion)
      continue
    }
    if (race.phaseName === 'RESOLVED' && race.finalRanking && race.finalRanking.length > 0) {
      await store.addGraded(buildGradedRecord(rec, race.finalRanking, 'ledger'))
      await store.removePending(rec.raceId, rec.modelVersion)
      graded++
    }
  }
  return graded
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx tsx --test lib/backtest/__tests__/ledger.test.ts`
Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/backtest/ledger.ts lib/backtest/__tests__/ledger.test.ts
git commit -m "feat(backtest): forward ledger — buildPrediction + gradePending"
```

---

## Task 7: Retrospective replay + resolved-race fetch helper

**Files:**
- Modify: `lib/api/gigaverse.ts` (add `fetchResolvedRaces`)
- Create: `lib/backtest/retro.ts`
- Test: `lib/backtest/__tests__/retro.test.ts`

**Interfaces:**
- Consumes: `fetchLobbySync`, `fetchLeaderboardForPets` (existing in `gigaverse.ts`); `buildPetSnapshotWithStats` (`@/lib/model/infer`); `handicap` (`@/lib/model/handicap`); `predictRace` (Task 2); `buildGradedRecord` (Task 3); `buildPrediction` (Task 6).
- Produces:
  - `fetchResolvedRaces(target?: number, maxPages?: number): Promise<ApiRaceSummary[]>`
  - `replayResolvedRace(race: ApiRaceSummary, snapshotMap: Map<number, PetSnapshotWithStats>): GradedRecord | null`
  - `runRetroBacktest(target?: number): Promise<GradedRecord[]>`

- [ ] **Step 1: Write the failing test `lib/backtest/__tests__/retro.test.ts`** (covers the pure `replayResolvedRace`)

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { replayResolvedRace } from '../retro'
import { buildPetSnapshotWithStats } from '@/lib/model/infer'
import type { ApiRaceSummary, ApiLeaderboardEntry } from '@/types/racing'
import type { PetSnapshotWithStats } from '@/lib/model/infer'

function lb(petId: number, elo: number): ApiLeaderboardEntry {
  return {
    rank: 0, petId, elo, eloRaceCount: 50, racesRun: 50, wins: 10,
    rarity: 3, faction: 1, gender: 'Male', ownerAddress: '0x',
    rarityName: 'Epic', factionName: 'Crusader',
    racePublic: { id: petId, racesRun: 50 } as ApiLeaderboardEntry['racePublic'],
    ownerSummary: {} as ApiLeaderboardEntry['ownerSummary'],
  }
}

function resolvedRace(petIds: number[], finalRanking: number[]): ApiRaceSummary {
  return {
    raceId: 99, phase: 3, phaseName: 'RESOLVED', createdAt: 0, raceStart: 100, cancelledAt: 0,
    fieldSize: petIds.length, trackLength: 1000, petCount: petIds.length, entryFee: '0', pool: '0',
    creator: '0x', createdTxHash: null, broadcastTxHash: null, joinHook: null, isPrivate: false,
    entries: petIds.map((petId, slot) => ({
      petId, ownerAddress: '0x', slot, joinedAt: 0, juiced: false, protoSurcharge: '0',
    })),
    finalRanking, finishTimes: null, payoutBps: [10000],
    creatorFeeBps: 0, protocolFeeBps: 0, protocolFeeBpsJuiced: 0, protocolFeeFloorWei: '0',
    jackpotBps: 0, jackpotWinnableBps: 0, jackpotMaxChanceBps: 0, jackpotTargetEntryFee: '0',
    creatorFeeAccruedWei: '0', raceParams: {}, raceTemp: null,
    joinHookPolicy: {} as ApiRaceSummary['joinHookPolicy'],
  }
}

test('replay produces a graded record with a top pick and winner', () => {
  const snapshotMap = new Map<number, PetSnapshotWithStats>([
    [1, buildPetSnapshotWithStats(lb(1, 1800), undefined)],
    [2, buildPetSnapshotWithStats(lb(2, 1400), undefined)],
    [3, buildPetSnapshotWithStats(lb(3, 1300), undefined)],
    [4, buildPetSnapshotWithStats(lb(4, 1200), undefined)],
  ])
  const g = replayResolvedRace(resolvedRace([1, 2, 3, 4], [1, 2, 3, 4]), snapshotMap)
  assert.ok(g)
  assert.equal(g!.winnerPetId, 1)
  assert.equal(g!.picks.length, 4)
  assert.equal(g!.source, 'retro')
  assert.equal(g!.topPickPetId, 1)        // highest ELO should be model favorite here
})

test('replay returns null when coverage below threshold', () => {
  const snapshotMap = new Map<number, PetSnapshotWithStats>([
    [1, buildPetSnapshotWithStats(lb(1, 1800), undefined)],
  ])
  // 1 of 4 entrants known → coverage 0.25 < 0.75
  const g = replayResolvedRace(resolvedRace([1, 2, 3, 4], [1, 2, 3, 4]), snapshotMap)
  assert.equal(g, null)
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx tsx --test lib/backtest/__tests__/retro.test.ts`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Add `fetchResolvedRaces` to `lib/api/gigaverse.ts`**

Insert after `fetchScheduled` (near the other fetchers):

```ts
// Page through lobby/sync collecting RESOLVED races (with finalRanking) up to `target`.
export async function fetchResolvedRaces(target = 300, maxPages = 30): Promise<ApiRaceSummary[]> {
  const out: ApiRaceSummary[] = []
  let cursor: string | undefined
  for (let i = 0; i < maxPages && out.length < target; i++) {
    let res: ApiLobbySyncResponse
    try {
      res = await fetchLobbySync(cursor)
    } catch {
      break
    }
    const pages = [...(res.races ?? []), ...(res.recentWinnerRaces ?? [])]
    for (const r of pages) {
      if (r.phaseName === 'RESOLVED' && r.finalRanking && r.finalRanking.length > 0) out.push(r)
    }
    if (!res.pageInfo?.hasMore || !res.pageInfo?.nextCursor) break
    cursor = res.pageInfo.nextCursor
  }
  // De-dupe by raceId (recentWinnerRaces can overlap pages)
  const seen = new Set<number>()
  return out.filter(r => (seen.has(r.raceId) ? false : (seen.add(r.raceId), true))).slice(0, target)
}
```

- [ ] **Step 4: Write `lib/backtest/retro.ts`**

```ts
// lib/backtest/retro.ts
import { fetchResolvedRaces, fetchLeaderboardForPets } from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats } from '@/lib/model/infer'
import { handicap } from '@/lib/model/handicap'
import { predictRace } from './predict'
import { buildGradedRecord } from './grade'
import { buildPrediction } from './ledger'
import type { ApiRaceSummary, ApiLeaderboardEntry } from '@/types/racing'
import type { PetSnapshotWithStats } from '@/lib/model/infer'
import type { GradedRecord } from './types'

const MIN_COVERAGE = 0.75

export function replayResolvedRace(
  race: ApiRaceSummary,
  snapshotMap: Map<number, PetSnapshotWithStats>,
): GradedRecord | null {
  if (!race.finalRanking || race.finalRanking.length === 0) return null

  const entrantIds = race.entries.map(e => e.petId)
  const pets = entrantIds
    .map(id => snapshotMap.get(id))
    .filter((p): p is PetSnapshotWithStats => Boolean(p))

  const coverage = race.fieldSize > 0 ? pets.length / race.fieldSize : 0
  if (pets.length < 2 || coverage < MIN_COVERAGE) return null

  const handicaps = handicap(pets, race.trackLength, race.entryFee, race.payoutBps, race.pool)
  const { picks, edgePetId, eloPickPetId } = predictRace(
    handicaps,
    pets.map(p => ({ petId: p.petId, elo: p.elo })),
  )
  const pred = buildPrediction(
    race, picks, edgePetId, eloPickPetId, race.raceStart || Math.floor(Date.now() / 1000),
  )
  return buildGradedRecord(pred, race.finalRanking, 'retro')
}

export async function runRetroBacktest(target = 300): Promise<GradedRecord[]> {
  const races = await fetchResolvedRaces(target)
  const entrantIds = [...new Set(races.flatMap(r => r.entries.map(e => e.petId)))]
  if (entrantIds.length === 0) return []

  const lbEntries = await fetchLeaderboardForPets(entrantIds)
  const lbMap = new Map<number, ApiLeaderboardEntry>(lbEntries.map(e => [e.petId, e]))

  const snapshotMap = new Map<number, PetSnapshotWithStats>()
  for (const id of entrantIds) {
    const lb = lbMap.get(id)
    if (lb) snapshotMap.set(id, buildPetSnapshotWithStats(lb, undefined))
  }

  return races
    .map(r => replayResolvedRace(r, snapshotMap))
    .filter((g): g is GradedRecord => g !== null)
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npx tsx --test lib/backtest/__tests__/retro.test.ts`
Expected: 2 tests passing.

- [ ] **Step 6: Runtime-verify the resolved-race fetch against the live API**

Run: `npx tsx -e "import('./lib/api/gigaverse.ts').then(async m => { const r = await m.fetchResolvedRaces(40); console.log('resolved:', r.length, 'sample finalRanking:', r[0]?.finalRanking?.slice(0,3)) })"`
Expected: prints a non-zero count and a sample `finalRanking` array. If count is 0, the resolved races are not in `lobby/sync` — switch `fetchResolvedRaces` to page `fetchRaces(limit)` (which returns recent races across phases) instead, filtering `phaseName === 'RESOLVED' && finalRanking`. Re-run until non-zero.

- [ ] **Step 7: Commit**

```bash
git add lib/api/gigaverse.ts lib/backtest/retro.ts lib/backtest/__tests__/retro.test.ts
git commit -m "feat(backtest): retrospective replay + fetchResolvedRaces helper"
```

---

## Task 8: API routes — ledger snapshot + grade

**Files:**
- Create: `app/api/ledger/snapshot/route.ts`
- Create: `app/api/ledger/grade/route.ts`

**Interfaces:**
- Consumes: `getStore` (Task 5), `buildPrediction`/`gradePending` (Task 6), `predictRace` (Task 2), `fetchRaces`/`fetchRace`/`fetchLeaderboardForPets` (gigaverse), `buildPetSnapshotWithStats` (infer), `handicap` (handicap).
- Produces: `GET /api/ledger/snapshot` → `{ recorded: number }`; `GET /api/ledger/grade` → `{ graded: number }`.

- [ ] **Step 1: Write `app/api/ledger/snapshot/route.ts`**

```ts
// app/api/ledger/snapshot/route.ts
import { NextResponse } from 'next/server'
import { fetchRaces, fetchLeaderboardForPets } from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats } from '@/lib/model/infer'
import { handicap } from '@/lib/model/handicap'
import { predictRace } from '@/lib/backtest/predict'
import { buildPrediction } from '@/lib/backtest/ledger'
import { getStore } from '@/lib/backtest/store'
import type { ApiLeaderboardEntry } from '@/types/racing'
import type { PetSnapshotWithStats } from '@/lib/model/infer'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const all = await fetchRaces(50)
    const open = all.filter(r => r.phaseName === 'OPEN' && r.entries.length >= 2)
    if (open.length === 0) return NextResponse.json({ recorded: 0 })

    const entrantIds = [...new Set(open.flatMap(r => r.entries.map(e => e.petId)))]
    const lbEntries = await fetchLeaderboardForPets(entrantIds)
    const lbMap = new Map<number, ApiLeaderboardEntry>(lbEntries.map(e => [e.petId, e]))
    const snap = new Map<number, PetSnapshotWithStats>()
    for (const id of entrantIds) {
      const lb = lbMap.get(id)
      if (lb) snap.set(id, buildPetSnapshotWithStats(lb, undefined))
    }

    const store = getStore()
    let recorded = 0
    for (const race of open) {
      const pets = race.entries
        .map(e => snap.get(e.petId))
        .filter((p): p is PetSnapshotWithStats => Boolean(p))
      if (pets.length < 2) continue
      const handicaps = handicap(pets, race.trackLength, race.entryFee, race.payoutBps, race.pool)
      const { picks, edgePetId, eloPickPetId } = predictRace(
        handicaps, pets.map(p => ({ petId: p.petId, elo: p.elo })),
      )
      await store.recordPrediction(buildPrediction(race, picks, edgePetId, eloPickPetId))
      recorded++
    }
    return NextResponse.json({ recorded })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
```

- [ ] **Step 2: Write `app/api/ledger/grade/route.ts`**

```ts
// app/api/ledger/grade/route.ts
import { NextResponse } from 'next/server'
import { fetchRace } from '@/lib/api/gigaverse'
import { gradePending } from '@/lib/backtest/ledger'
import { getStore } from '@/lib/backtest/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const graded = await gradePending(getStore(), id => fetchRace(id))
    return NextResponse.json({ graded })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
```

> Note: `fetchRace(id)` returns `ApiRaceDetail` which extends `ApiRaceSummary`, so it satisfies `gradePending`'s `(id) => Promise<ApiRaceSummary>` signature.

- [ ] **Step 3: Verify routes compile + run live**

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds, no TS errors.

Then with the dev server running (`npm run dev`):
Run: `curl -s http://localhost:3000/api/ledger/snapshot && echo && curl -s http://localhost:3000/api/ledger/grade`
Expected: `{"recorded":N}` then `{"graded":M}` (N≥0, M≥0). A `.railbird-ledger.json` file appears in the repo root.

- [ ] **Step 4: Commit**

```bash
git add app/api/ledger/snapshot/route.ts app/api/ledger/grade/route.ts
git commit -m "feat(backtest): ledger snapshot + grade API routes"
```

---

## Task 9: Presentational components

**Files:**
- Create: `components/backtest/StatTile.tsx`
- Create: `components/backtest/CalibrationChart.tsx`
- Create: `components/backtest/ReliabilityTable.tsx`
- Create: `components/backtest/EdgeTrackRecord.tsx`
- Create: `components/backtest/SampleBadge.tsx`

**Interfaces:**
- Consumes: `BacktestMetrics`, `CalibrationBin`, `GradedRecord` (Task 1); `weiToEth` (`@/lib/encode`).
- Produces: the five named React components (default-free named exports) used by the page in Task 10.

- [ ] **Step 1: Write `components/backtest/StatTile.tsx`**

```tsx
// components/backtest/StatTile.tsx
export function StatTile({
  label, value, sub, accent = 'neon-green',
}: {
  label: string
  value: string
  sub?: string
  accent?: 'neon-green' | 'neon-cyan' | 'neon-gold'
}) {
  return (
    <div className="retro-panel p-4 flex flex-col gap-1">
      <span className="text-[10px] text-game-muted uppercase tracking-widest">{label}</span>
      <span className={`text-2xl font-bold font-mono ${accent}`}>{value}</span>
      {sub && <span className="text-[10px] text-game-muted tracking-widest">{sub}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Write `components/backtest/CalibrationChart.tsx`** (inline SVG, no deps)

```tsx
// components/backtest/CalibrationChart.tsx
import type { CalibrationBin } from '@/lib/backtest/types'

export function CalibrationChart({ bins }: { bins: CalibrationBin[] }) {
  const S = 280, PAD = 28
  const x = (v: number) => PAD + v * (S - 2 * PAD)
  const y = (v: number) => S - PAD - v * (S - 2 * PAD)
  const maxCount = Math.max(1, ...bins.map(b => b.count))
  const points = bins.filter(b => b.count > 0)

  return (
    <div className="retro-panel p-4">
      <div className="text-[10px] text-game-muted uppercase tracking-widest mb-3">
        Calibration · predicted vs observed win rate
      </div>
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[320px] mx-auto">
        {/* axes */}
        <line x1={PAD} y1={S - PAD} x2={S - PAD} y2={S - PAD} stroke="#2a2a3a" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={S - PAD} stroke="#2a2a3a" />
        {/* perfect-calibration diagonal */}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#3a3a4a" strokeDasharray="4 4" />
        {/* bin points, radius ∝ count */}
        {points.map((b, i) => (
          <circle
            key={i}
            cx={x(b.predictedMean)}
            cy={y(b.observedRate)}
            r={3 + 6 * (b.count / maxCount)}
            fill="rgba(0,255,140,0.18)"
            stroke="#00ff8c"
          />
        ))}
        <text x={x(0.5)} y={S - 6} textAnchor="middle" fontSize="9" fill="#6a6a7a">predicted →</text>
        <text x={10} y={y(0.5)} textAnchor="middle" fontSize="9" fill="#6a6a7a"
          transform={`rotate(-90 10 ${y(0.5)})`}>observed →</text>
      </svg>
    </div>
  )
}
```

- [ ] **Step 3: Write `components/backtest/ReliabilityTable.tsx`**

```tsx
// components/backtest/ReliabilityTable.tsx
import type { CalibrationBin } from '@/lib/backtest/types'

export function ReliabilityTable({ bins }: { bins: CalibrationBin[] }) {
  const rows = bins.filter(b => b.count > 0)
  return (
    <div className="retro-panel overflow-hidden">
      <div className="px-4 py-2 text-[10px] text-game-muted uppercase tracking-widest border-b border-game-border">
        Reliability by predicted-probability bin
      </div>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-game-muted text-[10px] uppercase tracking-widest">
            <th className="px-4 py-2 text-left">Bin</th>
            <th className="px-4 py-2 text-right">Predicted</th>
            <th className="px-4 py-2 text-right">Observed</th>
            <th className="px-4 py-2 text-right">n</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b, i) => (
            <tr key={i} className="border-t border-game-border/40">
              <td className="px-4 py-1.5 text-game-muted">
                {(b.lo * 100).toFixed(0)}–{(b.hi * 100).toFixed(0)}%
              </td>
              <td className="px-4 py-1.5 text-right neon-cyan">{(b.predictedMean * 100).toFixed(1)}%</td>
              <td className="px-4 py-1.5 text-right neon-green">{(b.observedRate * 100).toFixed(1)}%</td>
              <td className="px-4 py-1.5 text-right text-game-muted">{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Write `components/backtest/EdgeTrackRecord.tsx`**

```tsx
// components/backtest/EdgeTrackRecord.tsx
import type { GradedRecord } from '@/lib/backtest/types'
import { weiToEth } from '@/lib/encode'

export function EdgeTrackRecord({ records }: { records: GradedRecord[] }) {
  const edges = records.filter(r => r.edgeOutcome != null)
  if (edges.length === 0) {
    return (
      <div className="retro-panel p-4 text-[10px] text-game-muted uppercase tracking-widest">
        No EDGE flags in this sample yet.
      </div>
    )
  }
  let running = 0
  return (
    <div className="retro-panel overflow-hidden">
      <div className="px-4 py-2 text-[10px] text-game-muted uppercase tracking-widest border-b border-game-border">
        EDGE track record
      </div>
      <table className="w-full text-xs font-mono">
        <tbody>
          {edges.map(r => {
            const won = r.edgeOutcome!.rank === 0
            const net = weiToEth(r.edgeOutcome!.netWei)
            running += net
            return (
              <tr key={`${r.raceId}:${r.modelVersion}`} className="border-t border-game-border/40">
                <td className="px-4 py-1.5 text-game-muted">#{r.raceId}</td>
                <td className="px-4 py-1.5">#{r.edgePetId}</td>
                <td className={`px-4 py-1.5 ${won ? 'neon-green' : 'text-game-muted'}`}>
                  {won ? '✓ WON' : `${r.edgeOutcome!.rank >= 0 ? `P${r.edgeOutcome!.rank + 1}` : '—'}`}
                </td>
                <td className={`px-4 py-1.5 text-right ${net >= 0 ? 'neon-green' : 'text-red-400'}`}>
                  {net >= 0 ? '+' : ''}{net.toFixed(4)}
                </td>
                <td className={`px-4 py-1.5 text-right ${running >= 0 ? 'neon-gold' : 'text-red-400'}`}>
                  {running >= 0 ? '+' : ''}{running.toFixed(4)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Write `components/backtest/SampleBadge.tsx`**

```tsx
// components/backtest/SampleBadge.tsx
export function SampleBadge({
  nRaces, meanCoverage, mode,
}: {
  nRaces: number
  meanCoverage: number
  mode: 'retro' | 'live'
}) {
  return (
    <div className="flex items-center gap-3 text-[10px] text-game-muted uppercase tracking-widest">
      <span><span className="neon-green font-bold">{nRaces}</span> races</span>
      <span><span className="neon-cyan font-bold">{(meanCoverage * 100).toFixed(0)}%</span> coverage</span>
      {mode === 'retro'
        ? <span className="text-neon-gold">in-sample · ELO look-ahead</span>
        : <span className="neon-green">live · zero-leakage</span>}
    </div>
  )
}
```

- [ ] **Step 6: Verify components typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (No unit tests — these are presentational; they are exercised by the page screenshot in Task 10.)

- [ ] **Step 7: Commit**

```bash
git add components/backtest/
git commit -m "feat(backtest): stat tile, calibration chart, reliability table, edge record, sample badge"
```

---

## Task 10: `/backtest` page + nav link

**Files:**
- Create: `app/backtest/page.tsx`
- Modify: `app/layout.tsx` (add nav link)

**Interfaces:**
- Consumes: `runRetroBacktest` (Task 7), `getStore` (Task 5), `computeMetrics` (Task 4), `MODEL_VERSION` (Task 1), all Task 9 components.

- [ ] **Step 1: Write `app/backtest/page.tsx`**

```tsx
// app/backtest/page.tsx
import { runRetroBacktest } from '@/lib/backtest/retro'
import { getStore } from '@/lib/backtest/store'
import { computeMetrics } from '@/lib/backtest/metrics'
import { MODEL_VERSION } from '@/lib/backtest/version'
import { StatTile } from '@/components/backtest/StatTile'
import { CalibrationChart } from '@/components/backtest/CalibrationChart'
import { ReliabilityTable } from '@/components/backtest/ReliabilityTable'
import { EdgeTrackRecord } from '@/components/backtest/EdgeTrackRecord'
import { SampleBadge } from '@/components/backtest/SampleBadge'
import type { GradedRecord } from '@/lib/backtest/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function pct(x: number) { return `${(x * 100).toFixed(1)}%` }

export default async function BacktestPage({
  searchParams,
}: {
  searchParams: { mode?: string }
}) {
  const mode: 'retro' | 'live' = searchParams.mode === 'live' ? 'live' : 'retro'

  let records: GradedRecord[] = []
  try {
    if (mode === 'retro') {
      records = await runRetroBacktest(300)
    } else {
      records = (await getStore().getGraded()).filter(r => r.modelVersion === MODEL_VERSION)
    }
  } catch {
    records = []
  }

  const m = computeMetrics(records)
  const roi = m.edgeRoi

  return (
    <div>
      <div className="mb-6 border-b border-game-border pb-4">
        <p className="text-[10px] text-game-muted uppercase tracking-widest mb-1">// model validation</p>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold tracking-widest uppercase neon-green">Backtest</h1>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
            <a href="/backtest?mode=retro"
              className={`px-3 py-1 border ${mode === 'retro' ? 'neon-green border-neon-green/40' : 'text-game-muted border-game-border'}`}>
              Retrospective
            </a>
            <a href="/backtest?mode=live"
              className={`px-3 py-1 border ${mode === 'live' ? 'neon-green border-neon-green/40' : 'text-game-muted border-game-border'}`}>
              Live ledger
            </a>
          </div>
        </div>
        <div className="mt-3">
          <SampleBadge nRaces={m.nRaces} meanCoverage={m.meanCoverage} mode={mode} />
        </div>
      </div>

      {m.nRaces === 0 ? (
        <div className="retro-panel p-16 text-center text-game-muted text-xs uppercase tracking-widest">
          {mode === 'live'
            ? '[ Ledger is collecting — graded races will appear here as they resolve ]'
            : '[ No resolved races available to backtest right now ]'}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatTile label="Favorite hit-rate" value={pct(m.favoriteHitRate)}
              sub={`vs ${pct(m.randomBaseline)} random · ${pct(m.eloBaseline)} ELO-only`} accent="neon-green" />
            <StatTile label="Brier score" value={m.brier.toFixed(3)}
              sub={`log-loss ${m.logLoss.toFixed(3)} · lower = better`} accent="neon-cyan" />
            <StatTile label="EDGE ROI"
              value={roi === null ? '—' : `${roi >= 0 ? '+' : ''}${(roi * 100).toFixed(1)}%`}
              sub={`${m.edgePicks} picks · net ${m.edgeNetEth >= 0 ? '+' : ''}${m.edgeNetEth.toFixed(4)} ETH`}
              accent="neon-gold" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CalibrationChart bins={m.calibration} />
            <ReliabilityTable bins={m.calibration} />
          </div>

          <EdgeTrackRecord records={records} />
        </div>
      )}

      <div className="mt-8 retro-panel p-4 text-[10px] text-game-muted leading-relaxed tracking-wide">
        <div className="uppercase tracking-widest neon-cyan mb-2">// methodology</div>
        <p className="mb-2">
          The model scores each entrant from leaderboard ELO, rarity, and track/condition fit, then
          a softmax over the field yields win probabilities; fair odds and EV are derived against the
          on-chain payout structure. An EDGE is flagged when a pet&apos;s expected value of entering is
          positive.
        </p>
        <p className="mb-2">
          <span className="neon-green">Hit-rate</span> = share of races whose top pick finished 1st.
          <span className="neon-green"> Brier</span>/<span className="neon-green">log-loss</span> score the
          full probability vector. <span className="neon-green">Calibration</span> bins predictions and
          compares predicted vs observed win frequency. <span className="neon-green">EDGE ROI</span> is the
          net return of entering every flagged EDGE pick on paid races.
        </p>
        <p>
          <span className="text-neon-gold">Retrospective</span> uses current leaderboard ELO on already-resolved
          races, so it carries a look-ahead bias (ELO already reflects those results) — treat it as in-sample
          calibration. <span className="neon-green">Live ledger</span> records predictions on open races and grades
          them after they resolve, with no leakage. Model version: <span className="font-mono">{MODEL_VERSION}</span>.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the nav link in `app/layout.tsx`**

The nav uses `next/link` `Link`. Add a Backtest link styled like the Leaderboard sibling,
immediately after the `/leaderboard` `<Link>…</Link>` block (after its closing `</Link>` on
the line before `</div>` that closes the links group):

```tsx
              <Link
                href="/backtest"
                className="px-3 py-1 text-xs tracking-widest uppercase text-game-muted hover:text-[#d0d0e8] hover:bg-game-panel transition-colors border border-transparent hover:border-game-border cursor-pointer"
              >
                Backtest
              </Link>
```

- [ ] **Step 3: Build + typecheck**

Run: `npm run build 2>&1 | tail -25`
Expected: build succeeds; `/backtest` listed in the route output.

- [ ] **Step 4: Screenshot the page (visual confirmation)**

With the dev server running, create `shot_backtest.mjs` in the repo root:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.setViewportSize({ width: 1280, height: 1000 });
await page.goto('http://localhost:3000/backtest', { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shot_backtest.png', fullPage: true });
await page.goto('http://localhost:3000/backtest?mode=live', { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'shot_backtest_live.png', fullPage: true });
console.log('OK');
await browser.close();
```

Run: `node shot_backtest.mjs`
Then **look at** `shot_backtest.png` and `shot_backtest_live.png`. Expected: header with Retro/Live toggle, three stat tiles, a calibration scatter near the diagonal, a reliability table, and the methodology panel. The live tab shows the collecting/empty state if the ledger has no graded races yet. A blank frame = launch failure — investigate before claiming done.

- [ ] **Step 5: Commit**

```bash
git add app/backtest/page.tsx app/layout.tsx
git commit -m "feat(backtest): /backtest page with retro/live toggle, calibration, methodology"
```

---

## Task 11: Full-suite green + optional warmer hook

**Files:**
- Modify (optional): `lib/api/gigaverse.ts` (warmer hook for ledger)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests across `version`, `predict`, `grade`, `metrics`, `store`, `ledger`, `retro` pass.

- [ ] **Step 2: (Optional) Hook ledger snapshot/grade into the existing warmer**

In `lib/api/gigaverse.ts`, inside the existing `warm()` function (the `setInterval` block near the bottom), add dynamic-import calls so the ledger self-updates without a static import cycle:

```ts
    // keep the forward ledger fresh (dynamic import avoids a static cycle)
    import('@/lib/backtest/ledger').then(async ({ gradePending }) => {
      const { getStore } = await import('@/lib/backtest/store')
      await gradePending(getStore(), id => fetchRace(id)).catch(() => {})
    }).catch(() => {})
```

> Snapshotting open races is heavier (needs leaderboard + handicap); leave that to the `/api/ledger/snapshot` route (call it from an external cron or manually during the demo) to keep the warmer light. Grading is cheap and safe to run on the interval.

- [ ] **Step 3: Verify build still succeeds**

Run: `npm run build 2>&1 | tail -15`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add lib/api/gigaverse.ts
git commit -m "feat(backtest): grade forward ledger on server warm interval"
```

---

## Done criteria

- `npm test` green across all backtest modules.
- `npm run build` succeeds with `/backtest`, `/api/ledger/snapshot`, `/api/ledger/grade` in the route list.
- `/backtest` renders headline tiles, a calibration chart, reliability table, EDGE track record, and methodology — retro tab populated, live tab collecting.
- `.railbird-ledger.json` is gitignored; predictions persist via the store.
