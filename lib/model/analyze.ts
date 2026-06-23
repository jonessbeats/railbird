import type { HandicapResult } from '@/types/racing'
import type { PetSnapshotWithStats } from './infer'

export interface RaceAnalysis {
  type: 'edge' | 'walkover' | 'contested' | 'open' | 'insufficient'
  headline: string
  oneliner: string        // compact label for lobby cards
  summary: string         // full sentence for race detail
  factors: string[]       // bullet points
  valuePlay: { petId: number; evEth: number } | null
  unknownPets: number     // entrants with no leaderboard data
  confidence: 'high' | 'medium' | 'low'
}

function trackCategory(len: number): 'sprint' | 'mid' | 'stamina' {
  if (len <= 600)  return 'sprint'
  if (len <= 1500) return 'mid'
  return 'stamina'
}

export function analyzeRace(
  handicaps: HandicapResult[],
  pets: PetSnapshotWithStats[],
  trackLength: number,
  totalEntrants: number,
): RaceAnalysis {
  const unknownPets = totalEntrants - handicaps.length
  const sorted = [...handicaps].sort((a, b) => b.winProb - a.winProb)
  const top    = sorted[0]
  const second = sorted[1]
  const track  = trackCategory(trackLength)

  // Best EV play
  const edgeCandidates = handicaps
    .filter(h => (h.evEnter ?? -Infinity) > 0)
    .sort((a, b) => (b.evEnter ?? 0) - (a.evEnter ?? 0))
  const valuePlay = edgeCandidates[0]
    ? { petId: edgeCandidates[0].petId, evEth: edgeCandidates[0].evEnter! }
    : null

  // Confidence: how much of the field do we have data for + avg reveal
  const dataRatio  = handicaps.length / Math.max(totalEntrants, 1)
  const avgReveal  = handicaps.length > 0
    ? handicaps.reduce((s, h) => s + h.revealPct, 0) / handicaps.length
    : 0
  const confidence: RaceAnalysis['confidence'] =
    dataRatio >= 0.8 && avgReveal >= 60 ? 'high'
    : dataRatio >= 0.5 || avgReveal >= 35 ? 'medium'
    : 'low'

  // --- Determine race type & headline ---
  let type:     RaceAnalysis['type']
  let headline: string
  let summary:  string

  if (handicaps.length < 2) {
    type     = 'insufficient'
    headline = 'THIN DATA'
    summary  = unknownPets > 0
      ? `${unknownPets} of ${totalEntrants} entrants have no race history — analysis unavailable.`
      : 'Not enough leaderboard data to analyze this field.'
  } else if (valuePlay) {
    type     = 'edge'
    headline = 'EDGE FOUND'
    const p  = pets.find(p => p.petId === valuePlay.petId)
    summary  = `Pet #${valuePlay.petId}${p ? ` (${p.rarity}, ELO ${p.elo})` : ''} shows positive EV — entry fee justified by current pool size.`
  } else if (top && top.winProb > 0.44) {
    type     = 'walkover'
    headline = 'WALKOVER'
    const p  = pets.find(p => p.petId === top.petId)
    summary  = `#${top.petId}${p ? ` (ELO ${p.elo}, ${(p.winRate * 100).toFixed(0)}% WR)` : ''} is a clear favorite at ${(top.winProb * 100).toFixed(1)}% — field unlikely to challenge.`
  } else if (top && second && (top.winProb - second.winProb) < 0.08) {
    type     = 'contested'
    headline = 'CONTESTED'
    const spread = ((top.winProb - (sorted[Math.min(2, sorted.length - 1)]?.winProb ?? second.winProb)) * 100).toFixed(0)
    summary  = `Top ${Math.min(3, sorted.length)} contenders within ${spread}% of each other — high-variance outcome, no dominant play.`
  } else {
    type     = 'open'
    headline = 'OPEN RACE'
    summary  = top
      ? `#${top.petId} leads at ${(top.winProb * 100).toFixed(1)}% but the field is competitive — no clear favorite.`
      : 'Field is evenly matched with no obvious standout.'
  }

  // --- Build key factors list ---
  const factors: string[] = []

  // Track note
  if (track === 'sprint')  factors.push(`${trackLength}m sprint — volatile, early position critical`)
  else if (track === 'mid') factors.push(`${trackLength}m balanced track — speed + finish matter equally`)
  else                      factors.push(`${trackLength}m stamina test — pace setters risk fading late`)

  // Field quality
  if (pets.length > 0) {
    const avgElo = Math.round(pets.reduce((s, p) => s + p.elo, 0) / pets.length)
    if (avgElo > 1600)      factors.push(`Strong field — avg ELO ${avgElo}`)
    else if (avgElo < 1300) factors.push(`Weak field — avg ELO ${avgElo}`)
    else                    factors.push(`Mixed field — avg ELO ${avgElo}`)
  }

  // Rookies
  const rookies = pets.filter(p => p.racesRun < 10).length
  if (rookies > 0)
    factors.push(`${rookies} rookie${rookies > 1 ? 's' : ''} (< 10 races) — results unpredictable`)

  // Low data reveal
  const lowReveal = pets.filter(p => p.revealPct < 30).length
  if (lowReveal > 0)
    factors.push(`${lowReveal} pet${lowReveal > 1 ? 's' : ''} with < 30% stat reveal — model estimates`)

  // Unknown pets
  if (unknownPets > 0)
    factors.push(`${unknownPets} entrant${unknownPets > 1 ? 's' : ''} with no history — hidden risk`)

  // EV note
  if (valuePlay) {
    const pct = (valuePlay.evEth * 100).toFixed(1)
    factors.push(`#${valuePlay.petId} → +${pct}% EV on current prize pool`)
  } else if (handicaps.length >= 2 && handicaps.every(h => (h.evEnter ?? 0) <= 0)) {
    factors.push('No edge found — pool does not cover entry fee in expectation')
  }

  // --- Compact one-liner for lobby ---
  const trackTag = track === 'sprint' ? 'SPRINT' : track === 'stamina' ? 'STAMINA' : 'MID'
  const confTag  = confidence === 'high' ? '' : confidence === 'medium' ? ' · MED DATA' : ' · LOW DATA'
  const oneliner = valuePlay
    ? `EDGE · #${valuePlay.petId} +${(valuePlay.evEth * 100).toFixed(1)}% EV`
    : `${headline} · ${trackTag}${confTag}`

  return { type, headline, oneliner, summary, factors, valuePlay, unknownPets, confidence }
}
