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
  pathSpeed: number
  pathLength: number
  pathShape: 'line' | 'curve' | 'zigzag' | 'random'
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
    pathSpeed: 150,
    pathLength: 400,
    pathShape: 'curve',
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
    wobbleAmp: 40,
    wobbleFreq: 2.5,
    wobbleGrow: 2.0,
    pattern: 'up_then_down',
  },
}

const KEY = 'settings:v1'

export function loadSettings(): Settings {
  const saved = get<Partial<Settings> | null>(KEY, {}) ?? {}

  return {
    reflexSimple: { ...DEFAULT_SETTINGS.reflexSimple, ...saved.reflexSimple },
    reflexChoice: { ...DEFAULT_SETTINGS.reflexChoice, ...saved.reflexChoice },
    reflexGoNoGo: { ...DEFAULT_SETTINGS.reflexGoNoGo, ...saved.reflexGoNoGo },
    aimGridshot: { ...DEFAULT_SETTINGS.aimGridshot, ...saved.aimGridshot },
    aimPath: { ...DEFAULT_SETTINGS.aimPath, ...saved.aimPath },
    aimRecoil: { ...DEFAULT_SETTINGS.aimRecoil, ...saved.aimRecoil },
  }
}

export function saveSettings(settings: Settings): void {
  set(KEY, settings)
}
