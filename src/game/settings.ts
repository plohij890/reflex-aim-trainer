import { get, set } from '../storage'

export interface ReflexSimpleSettings {
  duration: number
  delayMin: number
  delayMax: number
  falseStartPenalty: number
}

export interface ReflexChoiceSettings {
  duration: number
  zones: 2 | 4 | 6
  errorPenalty: number
}

export interface ReflexGoNoGoSettings {
  duration: number
  noGoRatio: 0.2 | 0.3 | 0.5
  responseWindow: number
}

export interface AimGridshotSettings {
  duration: number
  targetSize: number
  targets: number
  gridSize: number
}

export interface AimPathSettings {
  duration: number
  ballRadius: number
  startRadius: number
  pathLength: number
  pathShape: 'horizontal' | 'vertical' | 'diagonal' | 'arc' | 'curve' | 'zigzag' | 'random'
  curveAmount: number
}

export interface AimRecoilSettings {
  duration: number
  targetRadius: number
  hp: number
  dps: number
  lifetime: number
  respawnDelay: number
  v0: number
  tau: number
  wobbleAmp: number
  wobbleFreq: number
  wobbleGrow: number
  pattern: 'up' | 'up_then_down' | 'random'
}

export type Settings = {
  reflexSimple: ReflexSimpleSettings
  reflexChoice: ReflexChoiceSettings
  reflexGoNoGo: ReflexGoNoGoSettings
  aimGridshot: AimGridshotSettings
  aimPath: AimPathSettings
  aimRecoil: AimRecoilSettings
}

export const DEFAULT_SETTINGS: Settings = {
  reflexSimple: {
    duration: 30,
    delayMin: 1000,
    delayMax: 3000,
    falseStartPenalty: 500,
  },
  reflexChoice: {
    duration: 30,
    zones: 4,
    errorPenalty: 300,
  },
  reflexGoNoGo: {
    duration: 30,
    noGoRatio: 0.3,
    responseWindow: 1000,
  },
  aimGridshot: {
    duration: 30,
    targetSize: 40,
    targets: 3,
    gridSize: 5,
  },
  aimPath: {
    duration: 30,
    ballRadius: 25,
    startRadius: 40,
    pathLength: 400,
    pathShape: 'random',
    curveAmount: 0.5,
  },
  aimRecoil: {
    duration: 30,
    targetRadius: 40,
    hp: 100,
    dps: 50,
    lifetime: 10,
    respawnDelay: 0.7,
    v0: 120,
    tau: 1.5,
    wobbleAmp: 60,
    wobbleFreq: 0.4,
    wobbleGrow: 2.0,
    pattern: 'up_then_down',
  },
}

const KEY = 'settings:v1'

const MIN_DURATION = 5
const MAX_DURATION = 300
const MIN_GRID_SIZE = 3
const MAX_GRID_SIZE = 10

const ZONE_OPTIONS: readonly ReflexChoiceSettings['zones'][] = [2, 4, 6]
const NO_GO_RATIO_OPTIONS: readonly ReflexGoNoGoSettings['noGoRatio'][] = [0.2, 0.3, 0.5]
const PATH_SHAPES: readonly AimPathSettings['pathShape'][] = [
  'horizontal',
  'vertical',
  'diagonal',
  'arc',
  'curve',
  'zigzag',
  'random',
]
const RECOIL_PATTERNS: readonly AimRecoilSettings['pattern'][] = ['up', 'up_then_down', 'random']

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(Math.max(numeric, min), max)
}

function pickOption<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

// Приводит настройки из localStorage к безопасным пределам: битое значение не должно ломать режим.
export function normalizeSettings(settings: Settings): Settings {
  const simple = settings.reflexSimple
  const choice = settings.reflexChoice
  const goNoGo = settings.reflexGoNoGo
  const gridshot = settings.aimGridshot
  const path = settings.aimPath
  const recoil = settings.aimRecoil

  const delayMin = clampNumber(simple.delayMin, 100, 10000, DEFAULT_SETTINGS.reflexSimple.delayMin)
  const delayMax = clampNumber(simple.delayMax, 100, 10000, DEFAULT_SETTINGS.reflexSimple.delayMax)
  const gridSize = clampNumber(
    gridshot.gridSize,
    MIN_GRID_SIZE,
    MAX_GRID_SIZE,
    DEFAULT_SETTINGS.aimGridshot.gridSize,
  )

  return {
    reflexSimple: {
      duration: clampNumber(simple.duration, MIN_DURATION, MAX_DURATION, DEFAULT_SETTINGS.reflexSimple.duration),
      delayMin,
      delayMax: Math.max(delayMax, delayMin),
      falseStartPenalty: clampNumber(
        simple.falseStartPenalty,
        0,
        5000,
        DEFAULT_SETTINGS.reflexSimple.falseStartPenalty,
      ),
    },
    reflexChoice: {
      duration: clampNumber(choice.duration, MIN_DURATION, MAX_DURATION, DEFAULT_SETTINGS.reflexChoice.duration),
      zones: pickOption(choice.zones, ZONE_OPTIONS, DEFAULT_SETTINGS.reflexChoice.zones),
      errorPenalty: clampNumber(choice.errorPenalty, 0, 5000, DEFAULT_SETTINGS.reflexChoice.errorPenalty),
    },
    reflexGoNoGo: {
      duration: clampNumber(goNoGo.duration, MIN_DURATION, MAX_DURATION, DEFAULT_SETTINGS.reflexGoNoGo.duration),
      noGoRatio: pickOption(goNoGo.noGoRatio, NO_GO_RATIO_OPTIONS, DEFAULT_SETTINGS.reflexGoNoGo.noGoRatio),
      responseWindow: clampNumber(
        goNoGo.responseWindow,
        100,
        10000,
        DEFAULT_SETTINGS.reflexGoNoGo.responseWindow,
      ),
    },
    aimGridshot: {
      duration: clampNumber(gridshot.duration, MIN_DURATION, MAX_DURATION, DEFAULT_SETTINGS.aimGridshot.duration),
      targetSize: clampNumber(gridshot.targetSize, 8, 400, DEFAULT_SETTINGS.aimGridshot.targetSize),
      targets: clampNumber(gridshot.targets, 1, gridSize * gridSize, DEFAULT_SETTINGS.aimGridshot.targets),
      gridSize,
    },
    aimPath: {
      duration: clampNumber(path.duration, MIN_DURATION, MAX_DURATION, DEFAULT_SETTINGS.aimPath.duration),
      ballRadius: clampNumber(path.ballRadius, 5, 200, DEFAULT_SETTINGS.aimPath.ballRadius),
      startRadius: clampNumber(path.startRadius, 5, 300, DEFAULT_SETTINGS.aimPath.startRadius),
      pathLength: clampNumber(path.pathLength, 50, 5000, DEFAULT_SETTINGS.aimPath.pathLength),
      pathShape: pickOption(path.pathShape, PATH_SHAPES, DEFAULT_SETTINGS.aimPath.pathShape),
      curveAmount: clampNumber(path.curveAmount, 0.1, 1, DEFAULT_SETTINGS.aimPath.curveAmount),
    },
    aimRecoil: {
      duration: clampNumber(recoil.duration, MIN_DURATION, MAX_DURATION, DEFAULT_SETTINGS.aimRecoil.duration),
      targetRadius: clampNumber(recoil.targetRadius, 10, 300, DEFAULT_SETTINGS.aimRecoil.targetRadius),
      hp: clampNumber(recoil.hp, 1, 100000, DEFAULT_SETTINGS.aimRecoil.hp),
      dps: clampNumber(recoil.dps, 1, 10000, DEFAULT_SETTINGS.aimRecoil.dps),
      lifetime: clampNumber(recoil.lifetime, 0, MAX_DURATION, DEFAULT_SETTINGS.aimRecoil.lifetime),
      respawnDelay: clampNumber(recoil.respawnDelay, 0, 30, DEFAULT_SETTINGS.aimRecoil.respawnDelay),
      v0: clampNumber(recoil.v0, 1, 5000, DEFAULT_SETTINGS.aimRecoil.v0),
      tau: clampNumber(recoil.tau, 0.1, 60, DEFAULT_SETTINGS.aimRecoil.tau),
      wobbleAmp: clampNumber(recoil.wobbleAmp, 0, 1000, DEFAULT_SETTINGS.aimRecoil.wobbleAmp),
      wobbleFreq: clampNumber(recoil.wobbleFreq, 0, 10, DEFAULT_SETTINGS.aimRecoil.wobbleFreq),
      wobbleGrow: clampNumber(recoil.wobbleGrow, 0.1, 60, DEFAULT_SETTINGS.aimRecoil.wobbleGrow),
      pattern: pickOption(recoil.pattern, RECOIL_PATTERNS, DEFAULT_SETTINGS.aimRecoil.pattern),
    },
  }
}

export function loadSettings(): Settings {
  const saved = get<Partial<Settings> | null>(KEY, {}) ?? {}

  return normalizeSettings({
    reflexSimple: { ...DEFAULT_SETTINGS.reflexSimple, ...saved.reflexSimple },
    reflexChoice: { ...DEFAULT_SETTINGS.reflexChoice, ...saved.reflexChoice },
    reflexGoNoGo: { ...DEFAULT_SETTINGS.reflexGoNoGo, ...saved.reflexGoNoGo },
    aimGridshot: { ...DEFAULT_SETTINGS.aimGridshot, ...saved.aimGridshot },
    aimPath: { ...DEFAULT_SETTINGS.aimPath, ...saved.aimPath },
    aimRecoil: { ...DEFAULT_SETTINGS.aimRecoil, ...saved.aimRecoil },
  })
}

export function saveSettings(settings: Settings): void {
  set(KEY, settings)
}
