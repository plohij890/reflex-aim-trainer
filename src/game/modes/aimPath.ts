import { capturePointer, createCanvas, pointerPosition, releasePointer, startLoop } from '../engine'
import type { AimPathSettings } from '../settings'
import type { GameMode, GameResult } from '../types'

const BACKGROUND = '#101014'
const PATH_COLOR = '#4c9aff'
const BALL_COLOR = '#22c55e'
const CURVE_STEPS = 48
const END_DOT_RADIUS = 5

type Shape = AimPathSettings['pathShape']

interface Vec {
  x: number
  y: number
}

function buildLine(length: number): Vec[] {
  return [
    { x: 0, y: 0 },
    { x: length, y: 0 },
  ]
}

function buildCurve(length: number, curveAmount: number): Vec[] {
  const sign = Math.random() < 0.5 ? -1 : 1
  const control = { x: length / 2, y: sign * curveAmount * length * 0.5 }

  const points: Vec[] = []
  for (let step = 0; step <= CURVE_STEPS; step += 1) {
    const t = step / CURVE_STEPS
    const mt = 1 - t
    points.push({
      x: 2 * mt * t * control.x + t * t * length,
      y: 2 * mt * t * control.y,
    })
  }

  return points
}

function buildZigzag(length: number): Vec[] {
  const segment = length / 3
  const angles = [Math.PI / 4, -Math.PI / 4, Math.PI / 4]

  const points: Vec[] = [{ x: 0, y: 0 }]
  let current: Vec = { x: 0, y: 0 }

  for (const angle of angles) {
    current = {
      x: current.x + Math.cos(angle) * segment,
      y: current.y + Math.sin(angle) * segment,
    }
    points.push(current)
  }

  return points
}

function pickShape(): Exclude<Shape, 'random'> {
  const shapes: readonly Exclude<Shape, 'random'>[] = ['line', 'curve', 'zigzag']
  return shapes[Math.floor(Math.random() * shapes.length)] ?? 'line'
}

function buildShape(shape: Exclude<Shape, 'random'>, config: AimPathSettings): Vec[] {
  switch (shape) {
    case 'curve':
      return buildCurve(config.pathLength, config.curveAmount)
    case 'zigzag':
      return buildZigzag(config.pathLength)
    default:
      return buildLine(config.pathLength)
  }
}

function placePoints(points: Vec[], width: number, height: number, margin: number): Vec[] {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const rangeX = width - margin * 2 - (maxX - minX)
  const rangeY = height - margin * 2 - (maxY - minY)

  const tx = (rangeX > 0 ? Math.random() * rangeX : rangeX / 2) + margin - minX
  const ty = (rangeY > 0 ? Math.random() * rangeY : rangeY / 2) + margin - minY

  return points.map((point) => ({ x: point.x + tx, y: point.y + ty }))
}

function buildCumulative(points: readonly Vec[]): number[] {
  const cumulative: number[] = [0]

  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const next = points[index]
    if (!prev || !next) continue
    cumulative.push((cumulative[index - 1] ?? 0) + Math.hypot(next.x - prev.x, next.y - prev.y))
  }

  return cumulative
}

function pointAt(points: readonly Vec[], cumulative: readonly number[], distance: number): Vec {
  const first = points[0]
  if (!first) return { x: 0, y: 0 }
  if (distance <= 0) return first

  const last = points[points.length - 1] ?? first
  if (distance >= (cumulative[cumulative.length - 1] ?? 0)) return last

  let index = 1
  while (index < cumulative.length && (cumulative[index] ?? 0) < distance) index += 1

  const prevDistance = cumulative[index - 1] ?? 0
  const nextDistance = cumulative[index] ?? prevDistance
  const from = points[index - 1] ?? first
  const to = points[index] ?? from
  const span = nextDistance - prevDistance
  const t = span > 0 ? (distance - prevDistance) / span : 0

  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

function startSession(
  container: HTMLElement,
  config: AimPathSettings,
  onResult: (r: GameResult) => void,
): () => void {
  const { canvas, ctx, destroy } = createCanvas(container)

  let points: Vec[] = []
  let localPoints: Vec[] = []
  let cumulative: number[] = []
  let totalLength = 0
  let traveled = 0
  let captured = false
  let pressed = false
  let pointer: Vec | null = null

  let completed = 0
  let broken = 0
  let onPathMs = 0
  let activeMs = 0
  let deviationSum = 0
  let deviationFrames = 0
  let finished = false
  let accumulated = 0

  const margin = Math.max(config.startRadius, config.ballRadius) + 10

  function placeCurrentPath(): void {
    points = placePoints(localPoints, canvas.clientWidth, canvas.clientHeight, margin)
    cumulative = buildCumulative(points)
    totalLength = cumulative[cumulative.length - 1] ?? 0
  }

  function spawnSlider(): void {
    const shape = config.pathShape === 'random' ? pickShape() : config.pathShape
    localPoints = buildShape(shape, config)
    placeCurrentPath()
    traveled = 0
    captured = false
  }

  function onResize(): void {
    if (finished) return

    // Перенос не меняет длину пути, поэтому traveled остаётся валидным.
    placeCurrentPath()
    render()
  }

  function ballPosition(): Vec {
    return pointAt(points, cumulative, traveled)
  }

  function render(): void {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, width, height)

    const start = points[0]
    const end = points[points.length - 1]
    if (!start || !end) return

    ctx.strokeStyle = PATH_COLOR
    ctx.lineWidth = 6
    ctx.lineJoin = 'round'
    ctx.beginPath()
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.stroke()

    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(start.x, start.y, config.startRadius, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = PATH_COLOR
    ctx.beginPath()
    ctx.arc(end.x, end.y, END_DOT_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    const ball = ballPosition()
    ctx.fillStyle = BALL_COLOR
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, config.ballRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  function buildResult(): GameResult {
    const percent = activeMs > 0 ? Math.round((onPathMs / activeMs) * 100) : 0
    const deviation = deviationFrames > 0 ? `${Math.round(deviationSum / deviationFrames)} px` : '—'

    return {
      primary: percent,
      primaryLabel: 'Time on path',
      unit: '%',
      secondary: [
        { label: 'Completed', value: String(completed) },
        { label: 'Broken', value: String(broken) },
        { label: 'Avg deviation', value: deviation },
      ],
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (finished) return

    capturePointer(canvas, event)

    pointer = pointerPosition(canvas, event)
    pressed = true

    if (captured) return

    const start = points[0]
    if (start && Math.hypot(pointer.x - start.x, pointer.y - start.y) < config.startRadius) {
      captured = true
      traveled = 0
    }
  }

  function onPointerRelease(event: PointerEvent): void {
    releasePointer(canvas, event)

    if (!pressed) return
    pressed = false

    if (!captured) return

    captured = false

    // Отпускание ровно на финише — это завершение, а не обрыв.
    if (traveled >= totalLength - 1) completed += 1
    else broken += 1

    spawnSlider()
  }

  function onPointerMove(event: PointerEvent): void {
    pointer = pointerPosition(canvas, event)
  }

  function finish(): void {
    if (finished) return
    finished = true
    stopLoop()
    onResult(buildResult())
  }

  spawnSlider()
  canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerRelease)
  window.addEventListener('pointercancel', onPointerRelease)
  window.addEventListener('resize', onResize)

  const stopLoop = startLoop((dt) => {
    accumulated += dt
    if (accumulated >= config.duration) {
      finish()
      return
    }

    if (captured && pressed && pointer) {
      traveled += config.pathSpeed * dt

      const ball = ballPosition()
      const distance = Math.hypot(pointer.x - ball.x, pointer.y - ball.y)

      activeMs += dt * 1000
      deviationSum += distance
      deviationFrames += 1
      if (distance < config.ballRadius) onPathMs += dt * 1000

      if (traveled >= totalLength) {
        completed += 1
        spawnSlider()
      }
    }

    render()
  })

  return () => {
    finished = true
    stopLoop()
    canvas.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerRelease)
    window.removeEventListener('pointercancel', onPointerRelease)
    window.removeEventListener('resize', onResize)
    destroy()
  }
}

export function createAimPath(): GameMode {
  let teardown: (() => void) | null = null

  return {
    id: 'aimPath',
    title: 'Path Tracking',
    mount(container, settings, onResult) {
      teardown?.()
      teardown = startSession(container, settings as AimPathSettings, onResult)
    },
    unmount() {
      teardown?.()
      teardown = null
    },
  }
}
