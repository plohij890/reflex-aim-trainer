import { createCanvas, startLoop } from '../engine'
import type { ReflexChoiceSettings } from '../settings'
import type { GameMode, GameResult } from '../types'

const BACKGROUND = '#101014'
const NEUTRAL = '#1f2937'
const STIMULUS = '#22c55e'

const PADDING = 20
const GAP = 8
const DELAY_MIN = 800
const DELAY_MAX = 2000

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const GRID: Record<ReflexChoiceSettings['zones'], { rows: number; cols: number }> = {
  2: { rows: 1, cols: 2 },
  4: { rows: 2, cols: 2 },
  6: { rows: 2, cols: 3 },
}

function layoutZones(width: number, height: number, count: ReflexChoiceSettings['zones']): Rect[] {
  const { rows, cols } = GRID[count]
  const innerWidth = Math.max(0, width - PADDING * 2)
  const innerHeight = Math.max(0, height - PADDING * 2)
  const cellWidth = (innerWidth - GAP * (cols - 1)) / cols
  const cellHeight = (innerHeight - GAP * (rows - 1)) / rows

  const zones: Rect[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      zones.push({
        x: PADDING + col * (cellWidth + GAP),
        y: PADDING + row * (cellHeight + GAP),
        width: cellWidth,
        height: cellHeight,
      })
    }
  }

  return zones
}

function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

function startSession(
  container: HTMLElement,
  config: ReflexChoiceSettings,
  onResult: (r: GameResult) => void,
): () => void {
  const { canvas, ctx, destroy } = createCanvas(container)

  const reactions: number[] = []
  let errors = 0
  let phase: 'waiting' | 'stimulus' = 'waiting'
  let stimulusAt = 0
  let nextStimulusAt = 0
  let activeZone = 0
  let finished = false

  const endsAt = performance.now() + config.duration * 1000

  function scheduleNext(now: number): void {
    phase = 'waiting'
    nextStimulusAt = now + DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN)
  }

  function render(): void {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, width, height)

    const zones = layoutZones(width, height, config.zones)
    for (let index = 0; index < zones.length; index += 1) {
      const zone = zones[index]
      if (!zone) continue

      const highlighted = phase === 'stimulus' && index === activeZone
      ctx.fillStyle = highlighted ? STIMULUS : NEUTRAL
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height)
    }
  }

  function buildResult(): GameResult {
    const hits = reactions.length
    const total = hits + errors
    const sorted = [...reactions].sort((a, b) => a - b)

    // Штраф за ошибки тянет среднее как виртуальные попытки (как в Simple Reaction).
    const penaltyAttempts = config.errorPenalty > 0 ? errors : 0
    const penaltyMs = penaltyAttempts * config.errorPenalty
    const totalMs = reactions.reduce((sum, ms) => sum + ms, 0) + penaltyMs
    const countedAttempts = hits + penaltyAttempts
    const primary = hits === 0 ? 0 : Math.round(totalMs / countedAttempts)

    const accuracy = total === 0 ? 0 : Math.round((hits / total) * 100)
    const best = sorted[0]

    return {
      primary,
      primaryLabel: 'Avg reaction',
      unit: 'ms',
      secondary: [
        { label: 'Best', value: best === undefined ? '—' : `${Math.round(best)} ms` },
        { label: 'Accuracy', value: `${accuracy}%` },
        { label: 'Hits', value: String(hits) },
        { label: 'Errors', value: String(errors) },
      ],
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (finished) return

    const now = performance.now()

    if (phase === 'waiting') {
      errors += 1
      scheduleNext(now)
      render()
      return
    }

    const zones = layoutZones(canvas.clientWidth, canvas.clientHeight, config.zones)
    const zone = zones[activeZone]

    if (zone && contains(zone, event.offsetX, event.offsetY)) {
      reactions.push(now - stimulusAt)
    } else {
      errors += 1
    }

    scheduleNext(now)
    render()
  }

  function finish(): void {
    if (finished) return
    finished = true
    stopLoop()
    onResult(buildResult())
  }

  scheduleNext(performance.now())
  canvas.addEventListener('pointerdown', onPointerDown)

  const stopLoop = startLoop((_dt, now) => {
    if (now >= endsAt) {
      finish()
      return
    }

    if (phase === 'waiting' && now >= nextStimulusAt) {
      phase = 'stimulus'
      stimulusAt = now
      activeZone = Math.floor(Math.random() * config.zones)
    }

    render()
  })

  return () => {
    finished = true
    stopLoop()
    canvas.removeEventListener('pointerdown', onPointerDown)
    destroy()
  }
}

export function createReflexChoice(): GameMode {
  let teardown: (() => void) | null = null

  return {
    id: 'reflexChoice',
    title: 'Choice Reaction',
    mount(container, settings, onResult) {
      teardown?.()
      teardown = startSession(container, settings as ReflexChoiceSettings, onResult)
    },
    unmount() {
      teardown?.()
      teardown = null
    },
  }
}
