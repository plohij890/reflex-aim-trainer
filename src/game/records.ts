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

export function loadRecords(): Records {
  return get<Records | null>(KEY, {}) ?? {}
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
