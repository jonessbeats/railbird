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
import { unstable_cache } from 'next/cache'

// Heavy retro replay (pages resolved races via POST lobby/sync + deep leaderboard
// scans, which the data cache can't fully store) — the cold compute is ~10s+, so
// memoize the whole result in Next's persistent cache for 10min. Retro metrics move
// slowly (resolved races accrue gradually), and a smaller sample keeps the cold
// (cache-miss) compute bounded without materially changing the calibration.
const getRetroRecords = unstable_cache(
  async () => runRetroBacktest(600),
  ['retro-backtest-600', MODEL_VERSION],
  { revalidate: 600 },
)

export const revalidate = 60
// The cold (cache-miss) retro compute over ~300 races + leaderboard scans can take
// ~15-25s; allow up to 60s (Vercel Hobby max) so it never times out. Cached 10 min.
export const maxDuration = 60

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
      records = await getRetroRecords()
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
