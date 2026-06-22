# RAILBIRD — Model Validation: Backtest & Calibration (Design)

**Date:** 2026-06-22
**Status:** Approved for planning
**Author:** brainstorming session (jonessbeats + Claude)

## Goal

Prove the RAILBIRD handicap model actually finds edge. Today the product *asserts* win
probabilities, fair odds, and EDGE flags but never shows whether those predictions are
correct. This adds a `/backtest` page that quantifies model accuracy and calibration, so a
judge (or user) can see the track record at a glance — even when the live market shows no
open edge.

This serves two GIGATHON categories: **Player Tools & Analytics** (the headline metrics)
and **Educational** (the methodology section explains how the model and the metrics work).

## Background / Why now

A tour of the running app (2026-06-22) confirmed:
- The model works — the race detail page produces win%, EDGE bars, and a coherent analysis
  panel (e.g. race #12862 → `CONTESTED · MED CONF`).
- But credibility is nowhere quantified. When the market is thin (observed: 3 open races,
  `/value` empty), the product has nothing to show about its own quality.

A backtest page fixes exactly that gap: the model's track record is visible at all times.

## Data feasibility (validated against the live API)

- `fetchRaces(limit)` returns races including **RESOLVED** ones.
- Each RESOLVED race carries `finalRanking: number[]` (petIds ordered 1st→last, index 0 =
  winner), `finishTimes`, `payoutBps: number[]`, `pool`, `trackLength`, `entryFee`,
  `raceTemp`, and full `entries`.
- Entrant ELO comes from the already-warmed leaderboard cache (top-1000), so replaying the
  model over hundreds of past races needs few or no new network calls.
- `lobby/sync` paginates via `pageInfo.nextCursor`, letting us gather a few hundred resolved
  races for a statistically meaningful sample.

## Approach (decided)

**Hybrid: retrospective headline + forward-ledger seed.**

- **Path A — Retrospective (instant, in-sample):** replay the model over resolved races now.
  Rich charts today. Carries a *look-ahead leakage* caveat: the leaderboard ELO is current
  (post-race), so the model implicitly "knows" later results. Disclosed honestly in the UI.
- **Path B — Forward ledger (durable, zero-leakage):** snapshot predictions on *open* races
  at time T, grade them after they resolve. No leakage. Sample accrues over time (thin for
  the first days — that's expected and labeled).

Both paths feed the **same metrics module** and the **same page** (a Retrospective / Live
toggle).

## Architecture

### Decisions locked
- **Retro sample size:** target ~200–400 resolved races via `lobby/sync` cursor pagination;
  result cached ~10 min.
- **Charts:** hand-rolled inline SVG, zero new dependencies (matches the existing
  no-chart-lib stack).
- **Storage:** thin `store` interface. Uses Upstash Redis / Vercel KV when `KV_*` /
  `UPSTASH_*` env vars are present; falls back to a local JSON file (`.railbird-ledger.json`,
  gitignored) in dev so it works with zero setup.
- **Model version:** a `MODEL_VERSION` constant stamped on every record. Metrics never mix
  records from different model versions.

### Modules (new — `lib/backtest/*`)

| File | Responsibility |
|------|----------------|
| `lib/backtest/types.ts` | `PredictionRecord`, `GradedRecord`, `BacktestMetrics`, `CalibrationBin` |
| `lib/backtest/metrics.ts` | Pure math: hit-rate, top-3, Brier, log-loss, calibration binning, EDGE ROI. Shared by A + B. No I/O. |
| `lib/backtest/retro.ts` | Gather resolved races, replay `handicap()`, emit `GradedRecord[]`. |
| `lib/backtest/store.ts` | `store` interface + Upstash impl + file impl + env-based selector. |
| `lib/backtest/ledger.ts` | `recordOpenRaces()` (snapshot) and `gradePending()` (settle) on top of `store`. |
| `lib/backtest/version.ts` | `MODEL_VERSION` constant. |

### Record shapes

```ts
interface PredictionRecord {
  raceId: number
  modelVersion: string
  recordedAt: number          // unix seconds (open-race snapshot time)
  trackLength: number
  entryFee: string            // wei
  pool: string                // wei at snapshot time
  payoutBps: number[]
  fieldSize: number
  picks: { petId: number; winProb: number; evEnter: number | null }[]
  edgePetId: number | null    // model's flagged EDGE pick, if any
}

interface GradedRecord extends PredictionRecord {
  finalRanking: number[]      // actual, index 0 = winner
  winnerPetId: number
  topPickPetId: number        // argmax winProb
  topPickWon: boolean
  topPickInTop3: boolean
  edgeOutcome: { rank: number; payoutWei: string; netWei: string } | null
  source: 'retro' | 'ledger'
}
```

### Path A — Retrospective replay (`retro.ts`)

1. Page through `lobby/sync` (cursor) collecting races until ~200–400 with
   `phaseName === 'RESOLVED'` and non-null `finalRanking` (exclude `CANCELLED`).
2. For each race: build entrant snapshots from the warmed leaderboard cache. Record
   `coverage = pets_with_data / entrants`.
3. Require ≥ 2 pets with data and `coverage ≥ 0.75`; otherwise tag the race low-coverage and
   exclude it from headline metrics (still counted in a coverage report).
4. Run `handicap(pets, trackLength, entryFee, payoutBps, pool)` → predicted winProbs.
5. Emit a `GradedRecord` (`source: 'retro'`) per qualifying race.

### Path B — Forward ledger (`ledger.ts` + `store.ts`)

- **Snapshot** `recordOpenRaces()`: for each currently OPEN race not already recorded (key
  `${raceId}:${MODEL_VERSION}`), compute predictions and persist a `PredictionRecord`.
  Triggered primarily by the API route `app/api/ledger/snapshot/route.ts` (callable by an
  external cron); the existing server warmer may invoke it via dynamic `import()` to avoid a
  static `gigaverse.ts → backtest → gigaverse.ts` import cycle.
- **Grade** `gradePending()`: for each pending record, `fetchRace(raceId)`; if RESOLVED,
  build the `GradedRecord` and persist to the graded set; if CANCELLED, drop. Triggered by
  `app/api/ledger/grade/route.ts` (same dynamic-import note for the warmer).

### Metrics (`metrics.ts`)

Given `GradedRecord[]`:
- **Favorite hit-rate** — % where top pick finished 1st. Plus two baselines: random
  (`mean 1/fieldSize`) and ELO-only (highest-ELO pet).
- **Top-3 / podium hit-rate.**
- **Brier score** (winner-vs-field, mean over races of `Σ_pets (p − o)²`) and **log-loss**.
- **Calibration bins** — predicted winProb bucketed (deciles); each bin returns
  `{ predictedMean, observedRate, count }`.
- **EDGE ROI / net** — over records with an `edgePetId` and `entryFee > 0`: simulate
  entering that pet; `payout = pool * payoutBps[rank] / 10000` when the pet finished in the
  money. Report `Σ net ETH` and `ROI %`.
- **Sample size & coverage** — n races, n pets, mean coverage, excluded count.

All functions are pure (records in → numbers out) and unit-tested with hand-computed
fixtures.

## UI — `app/backtest/page.tsx`

Retro neon/pixel styling consistent with the existing pages.

- **Header tiles** (`StatTile`): favorite hit-rate (with baseline deltas), Brier, EDGE ROI.
- **Calibration chart** (`CalibrationChart`, inline SVG): predicted vs observed, diagonal
  reference line, point size ∝ bin count.
- **Reliability table** (`ReliabilityTable`): per-bin predicted / observed / count.
- **EDGE track record** (`EdgeTrackRecord`): list of EDGE picks with ✓/✗ and running net.
- **Mode toggle:** Retrospective (in-sample, leakage disclaimer) vs Live ledger (zero-leak,
  "N graded since <date>").
- **Methodology footer:** how predictions and each metric are computed + the leakage caveat.
  Doubles as the Educational-category artifact.
- **Nav link** added in `app/layout.tsx`.

### Components (new — `components/backtest/*`)
`StatTile.tsx`, `CalibrationChart.tsx`, `ReliabilityTable.tsx`, `EdgeTrackRecord.tsx`,
`SampleBadge.tsx`.

## Error handling / edge cases

- Too few resolved races → seed/empty state explaining the page fills as races resolve.
- Pet missing from leaderboard → excluded from headline metrics; surfaced in coverage report.
- CANCELLED races excluded everywhere.
- Free races (`entryFee == 0`) excluded from ROI (ROI undefined) but kept for hit-rate /
  calibration.
- Empty forward ledger → "collecting since <ts>, N graded so far".
- Model-version change → old-version records filtered out of current metrics (stamp-based).

## Testing

- `metrics.ts` — unit tests on hand-computed fixtures for hit-rate, top-3, Brier, log-loss,
  calibration binning, and EDGE ROI (pure math; TDD-friendly).
- `retro.ts` — replay test over a fixture set of fake resolved races + a fake leaderboard.
- `store.ts` — file-impl round-trip test (record → read → grade → read graded).

## Scope boundaries (out of scope here)

- Fixing the bare lobby race cards (favorites/EDGE not rendering on `/`) — real but separate;
  tracked as a follow-up.
- Per-pet or per-track-type backtest breakdowns — possible v2, not in this spec.
- Historical point-in-time ELO reconstruction — infeasible with the current API; the forward
  ledger is the leak-free answer instead.

## Files touched

- New: `lib/backtest/{types,metrics,retro,store,ledger,version}.ts`
- New: `app/backtest/page.tsx`, `app/api/ledger/{snapshot,grade}/route.ts`
- New: `components/backtest/{StatTile,CalibrationChart,ReliabilityTable,EdgeTrackRecord,SampleBadge}.tsx`
- New tests: `lib/backtest/__tests__/*`
- Modify: `app/layout.tsx` (nav link), `.gitignore` (`.railbird-ledger.json`), optionally
  `lib/api/gigaverse.ts` warmer (hook snapshot/grade via dynamic import)
