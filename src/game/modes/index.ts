import type { Route, Tab } from '../../router'
import type { ModeId } from '../records'
import type { GameMode } from '../types'
import { createReflexSimple } from './reflexSimple'
import { createReflexChoice } from './reflexChoice'
import { createReflexGoNoGo } from './reflexGoNoGo'
import { createAimGridshot } from './aimGridshot'
import { createAimPath } from './aimPath'

export interface ModeInfo {
  id: ModeId
  route: Route
  tab: Tab
  title: string
  description: string
}

const MODE_LIST: readonly ModeInfo[] = [
  {
    id: 'reflexSimple',
    route: 'reflex/simple',
    tab: 'reflex',
    title: 'Simple Reaction',
    description: 'Кликни, как только изменится цвет. Тренирует чистую скорость реакции.',
  },
  {
    id: 'reflexChoice',
    route: 'reflex/choice',
    tab: 'reflex',
    title: 'Choice Reaction',
    description: 'Подсветилась зона — кликни по ней. Реакция с выбором.',
  },
  {
    id: 'reflexGoNoGo',
    route: 'reflex/gonogo',
    tab: 'reflex',
    title: 'Go / No-Go',
    description: 'Кликай только на зелёные стимулы. Тренирует торможение.',
  },
  {
    id: 'aimGridshot',
    route: 'aim/gridshot',
    tab: 'aim',
    title: 'Gridshot',
    description: 'Статичные цели по сетке. Скорость + точность.',
  },
  {
    id: 'aimPath',
    route: 'aim/path',
    tab: 'aim',
    title: 'Path Tracking',
    description: 'Веди шарик по линии, не отпуская ЛКМ. Плавность руки.',
  },
  {
    id: 'aimRecoil',
    route: 'aim/recoil',
    tab: 'aim',
    title: 'Recoil Tracking',
    description: 'Держи прицел на движущейся цели и сжигай её HP. Spray control.',
  },
]

export const MODES: Record<Tab, readonly ModeInfo[]> = {
  reflex: MODE_LIST.filter((mode) => mode.tab === 'reflex'),
  aim: MODE_LIST.filter((mode) => mode.tab === 'aim'),
}

const BY_ID = new Map<ModeId, ModeInfo>(MODE_LIST.map((mode) => [mode.id, mode]))
const BY_ROUTE = new Map<Route, ModeId>(MODE_LIST.map((mode) => [mode.route, mode.id]))

export function getModeInfo(id: ModeId): ModeInfo | null {
  return BY_ID.get(id) ?? null
}

export function modeIdForRoute(route: Route): ModeId | null {
  return BY_ROUTE.get(route) ?? null
}

const MODE_FACTORIES: Partial<Record<ModeId, () => GameMode>> = {
  reflexSimple: createReflexSimple,
  reflexChoice: createReflexChoice,
  reflexGoNoGo: createReflexGoNoGo,
  aimGridshot: createAimGridshot,
  aimPath: createAimPath,
}

const instances = new Map<ModeId, GameMode>()

export function getMode(id: ModeId): GameMode | null {
  const existing = instances.get(id)
  if (existing) return existing

  const factory = MODE_FACTORIES[id]
  if (!factory) return null

  const mode = factory()
  instances.set(id, mode)
  return mode
}
