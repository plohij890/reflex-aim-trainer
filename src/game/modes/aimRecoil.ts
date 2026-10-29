import { createCanvas, startLoop } from '../engine'
import type { AimRecoilSettings } from '../settings'
import type { GameMode, GameResult } from '../types'

const BACKGROUND = '#101014'
const TARGET_COLOR = '#e6edf3'
const BAR_WIDTH = 60
const BAR_HEIGHT = 6
const BAR_RADIUS = 3
const BAR_OFFSET = 14
const PEAK_TAU_FACTOR = 2
const FALL_SPEED_FACTOR = 0.3

type Pattern = 'up' | 'up_then_down'

interface Vec {
  x: number
  y: number
}

interface Target {
  x0: number
  y0: number
  spawnedAt: number
  capturedAt: number | null
  hp: number
  hpMax: number
  phase: number
  pattern: Pattern
}

interface Rgb {
  r: number
  g: number
  b: number
}

const LOW_COLOR: Rgb = { r: 239, g: 68, b: 68 }
const MID_COLOR: Rgb = { r: 245, g: 158, b: 11 }
const HIGH_COLOR: Rgb = { r: 34, g: 197, b: 94 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function mix(from: Rgb, to: Rgb, t: number): Rgb {
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
  }
}

function hpColor(fraction: number): string {
  const value = clamp(fraction, 0, 1)
  const from = value <= 0.5 ? LOW_COLOR : MID_COLOR
  const to = value <= 0.5 ? MID_COLOR : HIGH_COLOR
  const t = value <= 0.5 ? value * 2 : (value - 0.5) * 2
  const color = mix(from, to, t)

  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

function pickPattern(config: AimRecoilSettings): Pattern {
  if (config.pattern === 'random') return Math.random() < 0.5 ? 'up' : 'up_then_down'
  return config.pattern
}

function startSession(
  container: HTMLElement,
  config: AimRecoilSettings,
  onResult: (r: GameResult) => void,
): () => void {
  const { canvas, ctx, destroy } = createCanvas(container)

  let target: Target | null = null
  let nextSpawnAt = 0
  let pressed = false
  let pointer: Vec | null = null

  let kills = 0
  let misses = 0
  let ttkSum = 0
  let ttkCount = 0
  let activeMs = 0
  let onTargetMs = 0
  let finished = false

  const endsAt = performance.now() + config.duration * 1000

  function spawnTarget(now: number): void {
    const pattern = pickPattern(config)
    const margin = config.targetRadius + 20
    const barSpace = BAR_OFFSET + BAR_HEIGHT + 2

    // Спавним с запасом сверху под полный подъём паттерна: иначе цель прилипает к верхнему краю.
    const maxRise = pattern === 'up'
      ? config.v0 * config.tau
      : config.v0 * config.tau * (1 - Math.exp(-PEAK_TAU_FACTOR))

    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const top = config.targetRadius + barSpace + maxRise
    const bottom = height - margin
    const y0 = top >= bottom
      ? Math.max(config.targetRadius + barSpace, height / 2)
      : top + Math.random() * (bottom - top)

    target = {
      x0: margin + Math.random() * Math.max(0, width - margin * 2),
      y0,
      spawnedAt: now,
      capturedAt: null,
      hp: config.hp,
      hpMax: config.hp,
      phase: Math.random() * Math.PI * 2,
      pattern,
    }
  }

  function verticalOffset(pattern: Pattern, seconds: number): number {
    const peakTime = PEAK_TAU_FACTOR * config.tau

    if (pattern === 'up') {
      return -config.v0 * config.tau * (1 - Math.exp(-seconds / config.tau))
    }

    const riseTime = Math.min(seconds, peakTime)
    const rise = config.v0 * config.tau * (1 - Math.exp(-riseTime / config.tau))
    const fall = seconds > peakTime ? FALL_SPEED_FACTOR * config.v0 * (seconds - peakTime) : 0

    return -rise + fall
  }

  function targetPosition(current: Target, seconds: number): Vec {
    const x = current.x0 + config.wobbleAmp * (1 + seconds / config.wobbleGrow) * Math.sin(
      config.wobbleFreq * Math.PI * 2 * seconds + current.phase,
    )
    const y = current.y0 + verticalOffset(current.pattern, seconds)

    // Держим цель в пределах canvas (иначе она уезжает за край) и оставляем сверху место под HP-бар.
    const barSpace = BAR_OFFSET + BAR_HEIGHT + 2
    return {
      x: clamp(x, config.targetRadius, canvas.clientWidth - config.targetRadius),
      y: clamp(y, config.targetRadius + barSpace, canvas.clientHeight - config.targetRadius),
    }
  }

  function secondsSinceCapture(current: Target, now: number): number {
    return current.capturedAt === null ? 0 : (now - current.capturedAt) / 1000
  }

  function drawHpBar(position: Vec, hp: number, hpMax: number): void {
    const width = canvas.clientWidth
    const x = clamp(position.x - BAR_WIDTH / 2, 2, width - BAR_WIDTH - 2)
    // Бар не должен обрезаться сверху, если цель прижата к верхнему краю.
    const y = Math.max(2, position.y - config.targetRadius - BAR_OFFSET)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.beginPath()
    ctx.roundRect(x, y, BAR_WIDTH, BAR_HEIGHT, BAR_RADIUS)
    ctx.fill()

    const fraction = clamp(hp / hpMax, 0, 1)
    if (fraction <= 0) return

    ctx.fillStyle = hpColor(fraction)
    ctx.beginPath()
    ctx.roundRect(x, y, BAR_WIDTH * fraction, BAR_HEIGHT, BAR_RADIUS)
    ctx.fill()
  }

  function render(now: number): void {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, width, height)

    if (!target) return

    const position = targetPosition(target, secondsSinceCapture(target, now))

    ctx.fillStyle = TARGET_COLOR
    ctx.beginPath()
    ctx.arc(position.x, position.y, config.targetRadius, 0, Math.PI * 2)
    ctx.fill()

    if (target.capturedAt !== null) drawHpBar(position, target.hp, target.hpMax)
  }

  function buildResult(): GameResult {
    const percent = activeMs > 0 ? Math.round((onTargetMs / activeMs) * 100) : 0
    const avgTtk = ttkCount > 0 ? `${Math.round(ttkSum / ttkCount)} ms` : '—'

    return {
      primary: kills,
      primaryLabel: 'Kills',
      unit: 'pts',
      secondary: [
        { label: 'Avg TTK', value: avgTtk },
        { label: 'Time on target', value: `${percent}%` },
        { label: 'Misses', value: String(misses) },
      ],
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (finished) return

    pointer = { x: event.offsetX, y: event.offsetY }
    pressed = true

    if (!target || target.capturedAt !== null) return

    const position = targetPosition(target, 0)
    if (Math.hypot(pointer.x - position.x, pointer.y - position.y) < config.targetRadius) {
      target.capturedAt = performance.now()
    }
  }

  function onPointerMove(event: PointerEvent): void {
    pointer = { x: event.offsetX, y: event.offsetY }
  }

  function onPointerUp(): void {
    pressed = false
  }

  function finish(): void {
    if (finished) return
    finished = true
    stopLoop()
    onResult(buildResult())
  }

  spawnTarget(performance.now())
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)

  const stopLoop = startLoop((dt, now) => {
    if (now >= endsAt) {
      finish()
      return
    }

    if (!target) {
      if (now >= nextSpawnAt) spawnTarget(now)
      render(now)
      return
    }

    if (target.capturedAt !== null) {
      const seconds = (now - target.capturedAt) / 1000
      const position = targetPosition(target, seconds)

      if (pressed && pointer) {
        activeMs += dt * 1000

        const distance = Math.hypot(pointer.x - position.x, pointer.y - position.y)
        if (distance < config.targetRadius) {
          onTargetMs += dt * 1000
          target.hp -= config.dps * dt
        }
      }

      if (target.hp <= 0) {
        kills += 1
        ttkSum += now - target.capturedAt
        ttkCount += 1
        target = null
        nextSpawnAt = now + config.respawnDelay * 1000
      } else if (config.lifetime > 0 && seconds > config.lifetime) {
        misses += 1
        target = null
        nextSpawnAt = now + config.respawnDelay * 1000
      }
    }

    render(now)
  })

  return () => {
    finished = true
    stopLoop()
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    destroy()
  }
}

export function createAimRecoil(): GameMode {
  let teardown: (() => void) | null = null

  return {
    id: 'aimRecoil',
    title: 'Recoil Tracking',
    mount(container, settings, onResult) {
      teardown?.()
      teardown = startSession(container, settings as AimRecoilSettings, onResult)
    },
    unmount() {
      teardown?.()
      teardown = null
    },
  }
}
