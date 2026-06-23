import type { TrackAffinity, TrackType } from '@/lib/model/trackAffinity'

interface TrackAffinityBadgeProps {
  affinity: TrackAffinity
  currentTrack?: TrackType   // highlight if current race matches best
  compact?: boolean          // just the best-track badge, no bars
}

const TRACK_COLOR: Record<TrackType, { label: string; active: string; glow: string }> = {
  SPRINT:  { label: 'SPR', active: '#00cfff', glow: 'rgba(0,207,255,0.6)' },
  MID:     { label: 'MID', active: '#00ff88', glow: 'rgba(0,255,136,0.5)' },
  STAMINA: { label: 'STA', active: '#b06aff', glow: 'rgba(176,106,255,0.5)' },
}

const TRACKS: TrackType[] = ['SPRINT', 'MID', 'STAMINA']

export function TrackAffinityBadge({ affinity, currentTrack, compact = false }: TrackAffinityBadgeProps) {
  const matchesCurrent = currentTrack && affinity.best === currentTrack
  const best = TRACK_COLOR[affinity.best]

  if (compact) {
    return (
      <span
        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 pixel"
        style={{
          color: matchesCurrent ? best.active : '#3a3a5c',
          border: `1px solid ${matchesCurrent ? best.active + '60' : '#1e1e3a'}`,
          boxShadow: matchesCurrent ? `0 0 4px ${best.glow}` : undefined,
        }}
        title={`Best on ${affinity.best} tracks`}
      >
        {best.label}
      </span>
    )
  }

  const scores: Record<TrackType, number> = {
    SPRINT: affinity.sprint,
    MID:    affinity.mid,
    STAMINA: affinity.stamina,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-game-muted uppercase tracking-widest">Track Affinity</span>
        {matchesCurrent && (
          <span
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{ color: best.active, textShadow: `0 0 6px ${best.glow}` }}
          >
            ✓ TRACK MATCH
          </span>
        )}
      </div>
      <div className="flex gap-[3px]">
        {TRACKS.map(track => {
          const cfg = TRACK_COLOR[track]
          const score = scores[track]
          const isBest = track === affinity.best
          const isCurrent = track === currentTrack
          return (
            <div key={track} className="flex-1">
              <div className="flex justify-between items-center mb-0.5">
                <span
                  className="text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: isBest ? cfg.active : '#3a3a5c' }}
                >
                  {cfg.label}
                </span>
                {isCurrent && (
                  <span className="text-[8px] text-game-muted">now</span>
                )}
              </div>
              <div className="h-1 bg-game-border overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${score}%`,
                    background: isBest ? cfg.active : `${cfg.active}44`,
                    boxShadow: isBest ? `0 0 4px ${cfg.glow}` : undefined,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
