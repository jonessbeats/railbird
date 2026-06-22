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
