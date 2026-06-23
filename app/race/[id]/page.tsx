// app/race/[id]/page.tsx
import { notFound } from 'next/navigation'
import { fetchRace, fetchPetsStatsBatch, fetchLeaderboardForPets } from '@/lib/api/gigaverse'
import { buildPetSnapshotWithStats } from '@/lib/model/infer'
import { handicap } from '@/lib/model/handicap'
import { weiToEth, effectivePoolWei } from '@/lib/encode'
import { PetCard } from '@/components/PetCard'
import { PayoutPreview } from '@/components/PayoutPreview'
import { WeatherIcon } from '@/components/WeatherIcon'
import { RaceAnalysisPanel } from '@/components/RaceAnalysisPanel'
import { analyzeRace } from '@/lib/model/analyze'
import { classifyTrack, computeTrackAffinity } from '@/lib/model/trackAffinity'
import { MyPetLiveOdds } from '@/components/MyPetLiveOdds'
import { MyPetMarker } from '@/components/MyPetMarker'
import type { PayoutPreview as PayoutPreviewType, ApiLeaderboardEntry } from '@/types/racing'

// Dynamic param route; cached fetches + 8s revalidate keep live races fresh without re-fetching every hit.
export const revalidate = 8

const PHASE_MAP: Record<number, string> = {
  0: 'IDLE', 1: 'OPEN', 2: 'RESOLVING', 3: 'RESOLVED', 4: 'CANCELLED',
}
const PHASE_COLOR: Record<string, string> = {
  OPEN:       'bg-neon-green/10 text-neon-green border-neon-green/40',
  RESOLVING:  'bg-neon-gold/10  text-neon-gold  border-neon-gold/40',
  RESOLVED:   'bg-game-panel    text-game-muted border-game-border',
  CANCELLED:  'bg-neon-pink/10  text-neon-pink  border-neon-pink/30',
  IDLE:       'bg-game-panel    text-game-muted border-game-border',
  UNKNOWN:    'bg-game-panel    text-game-muted border-game-border',
}

export default async function RaceDetailPage({ params }: { params: { id: string } }) {
  let race
  try {
    race = await fetchRace(params.id)
  } catch {
    notFound()
  }

  const petIds: number[] = race.entries?.length
    ? race.entries.map(e => e.petId)
    : (race.racePets ?? [])

  const poolWei = effectivePoolWei(
    race.pool, race.entryFee, race.petCount, (race.protocolFeeBps ?? 0) + (race.creatorFeeBps ?? 0),
  )
  const prizePoolEth = weiToEth(poolWei)
  const payoutPreview: PayoutPreviewType = {
    entryFee: race.entryFee ?? '0',
    fieldSize: race.fieldSize,
    prizePool: poolWei,
    payouts: (race.payoutBps ?? []).map((bps, i) => ({
      rank: i + 1,
      amount: String(BigInt(Math.round((bps / 10000) * prizePoolEth * 1e18))),
    })),
    jackpotEligible: (race.jackpot?.balance ?? '0') !== '0',
    jackpotPool: race.jackpot?.balance,
  }

  const snapshots: ReturnType<typeof buildPetSnapshotWithStats>[] = []

  if (petIds.length > 0) {
    try {
      const [lbEntries, petStatsArr] = await Promise.all([
        fetchLeaderboardForPets(petIds),
        fetchPetsStatsBatch(petIds),
      ])
      const lbByPetId = new Map<number, ApiLeaderboardEntry>(lbEntries.map(e => [e.petId, e]))
      const statsByPetId = new Map(petStatsArr.map(s => [s.petId, s]))
      for (const petId of petIds) {
        const lb = lbByPetId.get(petId)
        const stats = statsByPetId.get(petId)
        if (!lb) continue
        try { snapshots.push(buildPetSnapshotWithStats(lb, stats)) } catch { /* skip */ }
      }
    } catch (e) {
      console.error('Enrichment fetch failed:', e)
    }
  }

  const handicaps = snapshots.length > 0
    ? handicap(snapshots, race.trackLength, race.entryFee ?? '0', race.payoutBps ?? [], poolWei)
    : []

  const sortedByWinProb = [...handicaps].sort((a, b) => b.winProb - a.winProb)
  const analysis = analyzeRace(handicaps, snapshots, race.trackLength, petIds.length)

  const entryFeeEth = weiToEth(race.entryFee ?? '0')
  const weather = race.raceTemp ?? null
  const phase = race.phaseName ?? PHASE_MAP[race.phase] ?? 'UNKNOWN'
  const phaseClass = PHASE_COLOR[phase] ?? PHASE_COLOR.UNKNOWN
  const TRACK_TYPE =
    race.trackLength <= 600  ? 'SPRINT'
    : race.trackLength <= 1500 ? 'MID-DIST'
    : 'STAMINA'
  const raceTrackType = classifyTrack(race.trackLength)
  // Win% is normalised over pets that have ALREADY joined, so a partly-empty field
  // inflates them (1 entrant => 100%). Warn until the field fills.
  const filledCount = race.petCount ?? petIds.length
  const fieldNotFull = phase === 'OPEN' && race.fieldSize > 0 && filledCount < race.fieldSize
  const fillRatio = race.fieldSize > 0 ? filledCount / race.fieldSize : 1

  return (
    <div>
      {/* ── MY PET LIVE ODDS (client — polls /api/race-odds every 20s) ── */}
      <MyPetLiveOdds raceId={params.id} />

      {/* ── RACE HEADER ── */}
      <div className="mb-6 retro-panel overflow-hidden">
        <div className="px-4 py-2 bg-game-panel border-b border-game-border flex items-center justify-between">
          <span className="text-[10px] text-game-muted uppercase tracking-widest">// race detail</span>
          <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-widest pixel border ${phaseClass}`}>
            {phase}
          </span>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="text-[10px] text-game-muted uppercase tracking-widest mb-0.5">Race ID</div>
              <h1 className="text-3xl font-bold tracking-widest neon-green">#{params.id}</h1>
            </div>
            {weather && (
              <div className="flex items-center gap-2 text-xs text-game-muted uppercase tracking-widest">
                <WeatherIcon weather={weather} />
                <span>{weather}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border border-game-border divide-x divide-game-border">
            <div className="px-3 py-2">
              <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">Track</div>
              <div className="text-xs font-bold tracking-wider">{race.trackLength}m</div>
              <div className="text-[9px] text-game-muted uppercase tracking-widest mt-0.5">{TRACK_TYPE}</div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">Field</div>
              <div className="text-xs font-bold tracking-wider">
                <span className="neon-cyan">{race.petCount ?? petIds.length}</span>
                <span className="text-game-muted">/{race.fieldSize}</span>
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">Entry</div>
              <div className="text-xs font-bold tracking-wider">
                {entryFeeEth > 0
                  ? <><span className="neon-gold">{entryFeeEth.toFixed(4)}</span><span className="text-game-muted text-[9px] ml-1">ETH</span></>
                  : <span className="neon-green">FREE</span>}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[9px] text-game-muted uppercase tracking-widest mb-0.5">Pool</div>
              <div className="text-xs font-bold tracking-wider">
                <span className="neon-green">{prizePoolEth.toFixed(4)}</span>
                <span className="text-game-muted text-[9px] ml-1">ETH</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PROVISIONAL-ODDS WARNING (field not full) ── */}
      {fieldNotFull && (
        <div className="mb-6 retro-panel px-4 py-3 border-neon-gold/40 bg-neon-gold/5">
          <div className="flex items-start gap-2">
            <span className="text-neon-gold text-sm leading-none mt-0.5">⚠</span>
            <div className="text-[11px] leading-relaxed tracking-wide">
              <span className="text-neon-gold font-bold uppercase tracking-widest">
                Field filling · {filledCount}/{race.fieldSize}
              </span>
              <span className="text-game-muted">
                {' '}— win% are provisional. The model splits probability across pets that
                have joined so far, so they read high while the field is partly empty
                {fillRatio < 0.5 ? ' (very rough right now)' : ''}. They sharpen as the
                field fills — near-final once it&apos;s nearly full.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── FINAL RESULTS ── */}
      {race.finalRanking && race.finalRanking.length > 0 && (
        <div className="mb-6 retro-panel overflow-hidden">
          <div className="px-4 py-2 bg-game-panel border-b border-game-border">
            <span className="text-[10px] text-game-muted uppercase tracking-widest">Final Results</span>
          </div>
          <div className="divide-y divide-game-border/40">
            {race.finalRanking.map((petId, i) => {
              const rankColors = ['neon-gold', 'text-[#c0c0c0]', 'text-[#cd7f32]']
              const rankLabels = ['1ST', '2ND', '3RD']
              return (
                <div key={petId} className="px-4 py-2.5 flex items-center gap-3">
                  <span className={`text-[10px] font-bold w-8 uppercase tracking-widest ${rankColors[i] ?? 'text-game-muted'}`}>
                    {rankLabels[i] ?? `#${i + 1}`}
                  </span>
                  <span className="text-sm font-mono">Pet {petId}</span>
                  {race.finishTimes?.[i] !== undefined && (
                    <span className="text-[10px] text-game-muted ml-auto font-mono">
                      {(race.finishTimes[i] / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── STARTING GRID ── */}
      {sortedByWinProb.length > 0 && (
        <div className="mb-6 retro-panel overflow-hidden">
          <div className="px-4 py-2 bg-game-panel border-b border-game-border flex items-center justify-between">
            <span className="text-[10px] text-game-muted uppercase tracking-widest">Starting Grid</span>
            <span className="text-[10px] text-game-muted uppercase tracking-widest">model prediction</span>
          </div>
          <div className="divide-y divide-game-border/30">
            {sortedByWinProb.map((h, i) => {
              const snap = snapshots.find(s => s.petId === h.petId)
              const pct = (h.winProb * 100).toFixed(1)
              const isEdge = h.evEnter !== undefined && h.evEnter > 0
              const affinity = snap ? computeTrackAffinity(snap) : null
              const trackMatch = affinity?.best === raceTrackType
              return (
                <div key={h.petId} className={`px-4 py-2.5 flex items-center gap-3 ${isEdge ? 'bg-neon-green/[0.03]' : ''}`}>
                  <span className={`text-[10px] font-bold w-5 text-right tracking-widest shrink-0 ${
                    i === 0 ? 'neon-gold' : i === 1 ? 'text-[#c0c0c0]' : i === 2 ? 'text-[#cd7f32]' : 'text-game-muted'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold font-mono">#{h.petId}</span>
                      {snap && <span className="text-[10px] text-game-muted uppercase tracking-widest">{snap.rarity}</span>}
                      <MyPetMarker petId={h.petId} />
                      {isEdge && (
                        <span className="text-[9px] neon-green uppercase tracking-widest px-1 border border-neon-green/40 pixel">+EV</span>
                      )}
                      {trackMatch && (
                        <span className="text-[9px] neon-cyan uppercase tracking-widest px-1 border border-neon-cyan/40 pixel">
                          {raceTrackType}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-game-border overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            background: isEdge ? '#00ff88' : '#00cfff',
                            boxShadow: isEdge ? '0 0 6px rgba(0,255,136,0.5)' : '0 0 4px rgba(0,207,255,0.4)',
                          }}
                        />
                      </div>
                      <span className={`text-[11px] font-bold font-mono w-10 text-right ${isEdge ? 'neon-green' : 'neon-cyan'}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  {snap && (
                    <div className="text-right text-[10px] text-game-muted shrink-0">
                      ELO <span className="neon-cyan font-bold">{snap.elo}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── FIELD CARDS ── */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] text-game-muted uppercase tracking-widest">Field</span>
            <span className="text-[10px] neon-cyan font-bold">{petIds.length} entrant{petIds.length !== 1 ? 's' : ''}</span>
          </div>
          {petIds.length === 0 ? (
            <div className="retro-panel p-6 text-center text-game-muted text-xs uppercase tracking-widest">
              [ NO ENTRANTS YET ]
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {petIds.map(petId => {
                const pet = snapshots.find(s => s.petId === petId)
                const h = handicaps.find(hh => hh.petId === petId)
                if (pet && h) {
                  const seedRank = sortedByWinProb.findIndex(hh => hh.petId === petId) + 1
                  return (
                    <div key={petId} className="relative">
                      <div className="absolute -top-2 left-2 z-10">
                        <MyPetMarker petId={petId} />
                      </div>
                      <PetCard pet={pet} h={h} rank={seedRank} raceTrackType={raceTrackType} />
                    </div>
                  )
                }
                return (
                  <div key={petId} className="retro-panel p-4">
                    <div className="text-[10px] text-game-muted uppercase tracking-widest mb-1">Unknown</div>
                    <p className="text-sm font-bold font-mono">#{petId}</p>
                    <p className="text-[10px] text-game-muted mt-1 uppercase tracking-widest">No race history — handicap unavailable</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── SIDEBAR ── */}
        <div className="space-y-4">
          <RaceAnalysisPanel analysis={analysis} />

          {payoutPreview.payouts.length > 0 && (
            <PayoutPreview payout={payoutPreview} />
          )}

          {/* Race metadata */}
          <div className="retro-panel overflow-hidden">
            <div className="px-4 py-2 bg-game-panel border-b border-game-border">
              <span className="text-[10px] text-game-muted uppercase tracking-widest">Race Info</span>
            </div>
            <div className="divide-y divide-game-border/40">
              {([
                ['Race ID',    `#${params.id}`],
                ['Field Size', `${race.fieldSize} slots`],
                ['Track',      `${race.trackLength}m ${TRACK_TYPE}`],
                ...(race.creatorFeeBps > 0
                  ? [['Creator Fee', `${(race.creatorFeeBps / 100).toFixed(1)}%`] as [string, string]]
                  : []),
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="px-4 py-2 flex justify-between items-center">
                  <span className="text-[10px] text-game-muted uppercase tracking-widest">{label}</span>
                  <span className="text-[10px] font-bold font-mono tracking-wider">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
