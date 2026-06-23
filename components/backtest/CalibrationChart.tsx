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
