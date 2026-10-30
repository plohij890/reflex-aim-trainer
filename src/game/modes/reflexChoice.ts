import { capturePointer, createCanvas, pointerPosition, releasePointer, startLoop } from '../engine'
import type { ReflexChoiceSettings } from '../settings'
import type { GameMode, GameResult, ProgressHandler } from '../types'

const BACKGROUND = '#101014'
const NEUTRAL = '#1f2937'
const STIMULUS = '#22c55e'
const HOME_FILL = '#151b24'
const HOME_RING = '#4c9aff'
const HOME_RING_READY = '#22c55e'
const HOME_DOT = '#2b3648'

const PADDING = 20
const GAP = 8
const DELAY_MIN = 800
const DELAY_MAX = 2000
const HOME_RADIUS_MIN = 48
const HOME_RADIUS_RATIO = 0.16
const ZONES_BOOST_AT = 15
const BOOSTED_ZONES = 8

type LayoutCount = ReflexChoiceSettings['zones'] | typeof BOOSTED_ZONES

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface Vec {
  x: number
  y: number
}

const GRID: Record<LayoutCount, { rows: number; cols: number }> = {
  2: { rows: 1, cols: 2 },
  4: { rows: 2, cols: 2 },
  6: { rows: 2, cols: 3 },
  8: { rows: 2, cols: 4 },
}

function layoutZones(width: number, height: number, count: LayoutCount): Rect[] {
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

function homeRadius(width: number, height: number): number {
  return Math.max(HOME_RADIUS_MIN, Math.min(width, height) * HOME_RADIUS_RATIO)
}

function startSession(
  container: HTMLElement,
  config: ReflexChoiceSettings,
  onResult: (r: GameResult) => void,
  onProgress?: ProgressHandler,
): () => void {
  const { canvas, ctx, destroy } = createCanvas(container)

  const reactions: number[] = []
  let errors = 0
  let phase: 'return' | 'waiting' | 'stimulus' = 'return'
  let stimulusAt = 0
  let nextStimulusAt = 0
  let activeZone = 0
  let pointer: Vec | null = null
  let finished = false
  let accumulated = 0

  function home(): Vec & { radius: number } {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    return { x: width / 2, y: height / 2, radius: homeRadius(width, height) }
  }

  function isHome(point: Vec | null): boolean {
    if (!point) return false

    const center = home()
    return Math.hypot(point.x - center.x, point.y - center.y) <= center.radius
  }

  function zoneCount(): LayoutCount {
    return accumulated >= ZONES_BOOST_AT ? BOOSTED_ZONES : config.zones
  }

  function scheduleNext(now: number): void {
    phase = 'waiting'
    nextStimulusAt = now + DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN)
  }

  function render(): void {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, width, height)

    const zones = layoutZones(width, height, zoneCount())
    for (let index = 0; index < zones.length; index += 1) {
      const zone = zones[index]
      if (!zone) continue

      const highlighted = phase === 'stimulus' && index === activeZone
      ctx.fillStyle = highlighted ? STIMULUS : NEUTRAL
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height)
    }

    // Стартовая зона: круг в центре вырезает дуги в прямоугольниках.
    const center = home()
    ctx.fillStyle = HOME_FILL
    ctx.beginPath()
    ctx.arc(center.x, center.y, center.radius, 0, Math.PI * 2)
    ctx.fill()

    // Кольцо подсвечивается, когда курсор находится в стартовой зоне.
    const ready = isHome(pointer)
    ctx.strokeStyle = ready ? HOME_RING_READY : HOME_RING
    ctx.lineWidth = ready ? 5 : 3
    ctx.beginPath()
    ctx.arc(center.x, center.y, center.radius, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = ready ? HOME_RING_READY : HOME_DOT
    ctx.beginPath()
    ctx.arc(center.x, center.y, 6, 0, Math.PI * 2)
    ctx.fill()
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
    const primary = hits === 0 ? null : Math.round(totalMs / countedAttempts)

    const accuracy = total === 0 ? 0 : Math.round((hits / total) * 100)
    const best = sorted[0]

    return {
      primary,
      primaryLabel: 'Avg reaction',
      unit: 'ms',
      secondary: [
        { label: 'Best attempt', value: best === undefined ? '—' : `${Math.round(best)} ms` },
        { label: 'Accuracy', value: `${accuracy}%` },
        { label: 'Hits', value: String(hits) },
        { label: 'Errors', value: String(errors) },
      ],
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (finished) return

    capturePointer(canvas, event)
    pointer = pointerPosition(canvas, event)

    const now = performance.now()

    // Возврат в центр не оценивается: клик здесь только фиксирует курсор.
    if (phase === 'return') return

    if (phase === 'waiting') {
      errors += 1
      scheduleNext(now)
      render()
      return
    }

    const zones = layoutZones(canvas.clientWidth, canvas.clientHeight, zoneCount())
    const zone = zones[activeZone]

    if (zone && !isHome(pointer) && contains(zone, pointer.x, pointer.y)) {
      reactions.push(now - stimulusAt)
    } else {
      errors += 1
    }

    phase = 'return'
    render()
  }

  function onPointerMove(event: PointerEvent): void {
    pointer = pointerPosition(canvas, event)
  }

  function onPointerRelease(event: PointerEvent): void {
    releasePointer(canvas, event)
  }

  function finish(): void {
    if (finished) return
    finished = true
    stopLoop()
    onResult(buildResult())
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerRelease)
  canvas.addEventListener('pointercancel', onPointerRelease)

  const stopLoop = startLoop((dt, now) => {
    accumulated += dt
    onProgress?.(accumulated, config.duration)

    if (accumulated >= config.duration) {
      finish()
      return
    }

    // Стимул появляется только пока курсор держится в стартовой зоне.
    if (phase === 'return' && isHome(pointer)) {
      scheduleNext(now)
    } else if (phase === 'waiting') {
      if (!isHome(pointer)) {
        phase = 'return'
      } else if (now >= nextStimulusAt) {
        phase = 'stimulus'
        stimulusAt = now
        activeZone = Math.floor(Math.random() * zoneCount())
      }
    }

    render()
  })

  return () => {
    finished = true
    stopLoop()
    canvas.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerRelease)
    canvas.removeEventListener('pointercancel', onPointerRelease)
    destroy()
  }
}

export function createReflexChoice(): GameMode {
  let teardown: (() => void) | null = null

  return {
    id: 'reflexChoice',
    title: 'Choice Reaction',
    mount(container, settings, onResult, onProgress) {
      teardown?.()
      teardown = startSession(container, settings as ReflexChoiceSettings, onResult, onProgress)
    },
    unmount() {
      teardown?.()
      teardown = null
    },
  }
}
