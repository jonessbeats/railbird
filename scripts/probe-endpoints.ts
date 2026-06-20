// scripts/probe-endpoints.ts
// Run: npx tsx scripts/probe-endpoints.ts
const BASE = 'https://gigaverse.io/api/racing'

async function get(path: string) {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) { console.error(`FAIL ${path}: ${r.status}`); return null }
  return r.json()
}

async function post(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) { console.error(`FAIL POST ${path}: ${r.status}`); return null }
  return r.json()
}

async function main() {
  console.log('=== /races?limit=3 ===')
  const races = await get('/races?limit=3')
  console.log(JSON.stringify(races, null, 2))

  const raceId = races?.[0]?.raceId ?? races?.races?.[0]?.raceId
  if (raceId) {
    console.log(`\n=== /race/${raceId} ===`)
    const race = await get(`/race/${raceId}`)
    console.log(JSON.stringify(race, null, 2))

    console.log(`\n=== /race-state?raceId=${raceId} ===`)
    const state = await get(`/race-state?raceId=${raceId}`)
    console.log(JSON.stringify(state, null, 2))

    const petId = race?.entries?.[0]?.petId
    if (petId) {
      console.log(`\n=== /pets/${petId}/stats ===`)
      const pet = await get(`/pets/${petId}/stats`)
      console.log(JSON.stringify(pet, null, 2))

      console.log(`\n=== /pets/stats?ids=${petId} ===`)
      const batchPet = await get(`/pets/stats?ids=${petId}`)
      console.log(JSON.stringify(batchPet, null, 2))
    }
  }

  console.log('\n=== POST /lobby/sync ===')
  const lobby = await post('/lobby/sync', {})
  console.log(JSON.stringify(lobby, null, 2))

  console.log('\n=== /leaderboard/elo?limit=3 ===')
  const lb = await get('/leaderboard/elo?limit=3')
  console.log(JSON.stringify(lb, null, 2))

  console.log('\n=== /stats ===')
  const stats = await get('/stats')
  console.log(JSON.stringify(stats, null, 2))

  console.log('\n=== /scheduled ===')
  const sched = await get('/scheduled')
  console.log(JSON.stringify(sched, null, 2))
}

main().catch(console.error)
