import { get, set } from '../storage'

export type ModeId =
  | 'reflexSimple'
  | 'reflexChoice'
  | 'reflexGoNoGo'
  | 'aimGridshot'
  | 'aimPath'
  | 'aimRecoil'

export interface ModeRecord {
  best: number
  last: number
  plays: number
  updatedAt: string
}

export type Records = Partial<Record<ModeId, ModeRecord>>

export type RecordDirection = 'higher-is-better' | 'lower-is-better'

const KEY = 'records:v1'

// Режимы с временем реакции (direction: 'lower-is-better' в ModeInfo):
// рекорд 0 ms — след старого бага, когда пустая сессия писала primary = 0.
const TIME_MODE_IDS: readonly ModeId[] = ['reflexSimple', 'reflexChoice', 'reflexGoNoGo']

function isBrokenRecord(id: ModeId, record: ModeRecord): boolean {
  if (!Number.isFinite(record.best)) return true
  return TIME_MODE_IDS.includes(id) && record.best <= 0
}

export function loadRecords(): Records {
  const stored = get<Records | null>(KEY, {}) ?? {}
  const cleaned: Records = {}
  let changed = false

  for (const [id, record] of Object.entries(stored) as [ModeId, ModeRecord][]) {
    if (isBrokenRecord(id, record)) {
      changed = true
      continue
    }

    cleaned[id] = record
  }

  if (changed) set(KEY, cleaned)
  return cleaned
}

export function saveRecord(
  id: ModeId,
  value: number,
  direction: RecordDirection,
): ModeRecord {
  const records = loadRecords()
  const prev = records[id]

  const best =
    prev === undefined
      ? value
      : direction === 'higher-is-better'
        ? Math.max(prev.best, value)
        : Math.min(prev.best, value)

  const record: ModeRecord = {
    best,
    last: value,
    plays: (prev?.plays ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }

  records[id] = record
  set(KEY, records)

  return record
}
