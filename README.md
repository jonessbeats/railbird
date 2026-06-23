# ▸ RAILBIRD — Gigling Racing Edge Finder

A form guide and **+EV picker** for [Gigling Racing](https://gigaverse.io) on Gigaverse.
RAILBIRD scores every pet in a race from on-chain ELO, rarity, stat ranges and form,
turns those scores into calibrated win probabilities, and flags races where the model's
fair odds beat the implied market — then proves the model honest with a backtest and a
zero-leakage forward ledger.

> Hackathon project. Next.js 14 App Router · TypeScript · Tailwind · viem.

---

## What it does

| Page | Route | Purpose |
|------|-------|---------|
| **Lobby** | `/` | Live & scheduled races with model win-probabilities and EDGE flags |
| **+EV** | `/value` | Feed of races with a positive expected-value entry, ranked by edge |
| **My Races** | `/my-races` | Your saved stable with live odds and per-pet race projections |
| **Leaderboard** | `/leaderboard` | ELO leaderboard, enriched with model metrics |
| **Backtest** | `/backtest` | Model accuracy & calibration — retrospective replay + live ledger |
| **Race detail** | `/race/[id]` | Full field analysis, payout preview, jackpot EV |
| **Pet detail** | `/gigling/[id]` | A single pet's form, stats and track affinity |

## How the model works

- **Handicap** (`lib/model/handicap.ts`) — base strength from ELO (dominant signal),
  rarity prior, distance-specific stat-range score, and Bayesian-smoothed win rate;
  a softmax over the field (z-score normalised) yields win probabilities. Fair odds,
  rank distribution (Plackett–Luce approximation) and EV are derived against the
  on-chain payout structure, including jackpot EV.
- **EDGE flag** — raised when a pet's expected value of *entering* is positive.
- **Track affinity** (`lib/model/trackAffinity.ts`) and form inference
  (`lib/model/infer.ts`) feed the strength score.

## Backtest & calibration

Two data paths feed one metrics engine (`lib/backtest/`):

- **Retrospective** — replays the model over already-resolved races (in-sample;
  carries ELO look-ahead, treated as calibration).
- **Live ledger** — records predictions on *open* races and grades them after they
  resolve, with **no leakage**. Stored via a thin interface: a local JSON file in dev,
  Upstash Redis (REST) in prod.

Metrics: favorite hit-rate vs random/ELO baselines, Brier score, log-loss, a 10-bin
reliability/calibration curve, and net ROI of following every EDGE flag. All metric
and grading code is pure and unit-tested (`npm test`).

## Data sources

- **Off-chain** — gigaverse.io racing API (`lib/api/gigaverse.ts`): lobby, races,
  leaderboard, pet stats. SWR-style cache in `lib/api/cache.ts`.
- **On-chain** — Abstract mainnet via viem (`lib/chain/petRacing.ts`): payout preview
  and jackpot config.
- **Realtime** — optional Pusher channels for live lobby/race ticks (degrades
  gracefully when unconfigured).

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

The app runs with **zero configuration** — it uses the public Abstract RPC, a local
file-backed ledger, and disables realtime when Pusher keys are absent.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (next lint) |
| `npm test` | Run the backtest unit suite (`tsx --test`) |

### Environment variables (all optional)

| Var | Default / fallback | Purpose |
|-----|--------------------|---------|
| `ABSTRACT_RPC_URL` | `https://api.mainnet.abs.xyz` | Abstract RPC for on-chain reads |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | falls back to a local JSON file | Persist the forward ledger (also accepts `KV_REST_API_URL` / `KV_REST_API_TOKEN`) |
| `NEXT_PUBLIC_PUSHER_APP_KEY` / `NEXT_PUBLIC_PUSHER_CLUSTER` | realtime disabled | Live lobby/race updates |

### Ledger maintenance (optional)

- `GET /api/ledger/snapshot` — record predictions for currently-open races.
- `GET /api/ledger/grade` — grade pending predictions whose races have resolved.

Wire these to a cron (or hit them during a demo) to grow the live `/backtest?mode=live`
track record.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · viem (Abstract) ·
`@tanstack/react-query` · pusher-js · `tsx` + Node `node:test`. No charting library —
the calibration plot is hand-rolled inline SVG.

## Project layout

```
app/                 routes (lobby, value, my-races, leaderboard, backtest, race, pet)
components/          UI, incl. components/backtest/* (stat tiles, calibration chart…)
lib/model/          handicap, infer, analyze, trackAffinity
lib/backtest/        predict · grade · metrics · store · ledger · retro (+ unit tests)
lib/api/            gigaverse API client + cache
lib/chain/          on-chain payout preview / jackpot (viem)
types/racing.ts     API + domain types
```
