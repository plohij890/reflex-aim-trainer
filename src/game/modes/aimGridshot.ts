import { capturePointer, createCanvas, releasePointer, startLoop } from '../engine'
import type { AimGridshotSettings } from '../settings'
import type { GameMode, GameResult } from '../types'

const BACKGROUND = '#101014'
const TARGET_COLOR = '#ef4444'
const PADDING = 40

interface Target {
  x: number
  y: number
  cellIndex: number
}

interface Point {
  x: number
  y: number
}

function startSession(
  container: HTMLElement,
  config: AimGridshotSettings,
  onResult: (r: GameResult) => void,
): () => void {
  const { canvas, ctx, destroy } = createCanvas(container)

  const radius = config.targetSize / 2
  const cellCount = config.gridSize * config.gridSize
  const targets: Target[] = []
  const freeCells: number[] = Array.from({ length: cellCount }, (_, index) => index)

  let hits = 0
  let misses = 0
  let pointer: Point | null = null
  let width = canvas.clientWidth
  let height = canvas.clientHeight
  let finished = false
  let accumulated = 0

  // Интервалы между попаданиями: первый считается от старта сессии.
  const intervals: number[] = []
  let lastHitAt = performance.now()

  function cellCenter(cellIndex: number): Point {
    const cellWidth = Math.max(0, width - PADDING * 2) / config.gridSize
    const cellHeight = Math.max(0, height - PADDING * 2) / config.gridSize
    const col = cellIndex % config.gridSize
    const row = Math.floor(cellIndex / config.gridSize)

    return {
      x: PADDING + (col + 0.5) * cellWidth,
      y: PADDING + (row + 0.5) * cellHeight,
    }
  }

  function takeCell(cellIndex: number): void {
    const at = freeCells.indexOf(cellIndex)
    if (at === -1) return

    const last = freeCells.pop()
    if (last !== undefined && at < freeCells.length) {
      freeCells[at] = last
    }
  }

  function isUnderCursor(point: Point): boolean {
    if (!pointer) return false
    return Math.hypot(pointer.x - point.x, pointer.y - point.y) < radius
  }

  function spawnTarget(): void {
    const available = freeCells.filter((cellIndex) => !isUnderCursor(cellCenter(cellIndex)))
    const pool = available.length > 0 ? available : freeCells
    const cellIndex = pool[Math.floor(Math.random() * pool.length)]
    if (cellIndex === undefined) return

    takeCell(cellIndex)
    const center = cellCenter(cellIndex)
    targets.push({ x: center.x, y: center.y, cellIndex })
  }

  function render(): void {
    const currentWidth = canvas.clientWidth
    const currentHeight = canvas.clientHeight

    if (currentWidth !== width || currentHeight !== height) {
      width = currentWidth
      height = currentHeight
      for (const target of targets) {
        const center = cellCenter(target.cellIndex)
        target.x = center.x
        target.y = center.y
      }
    }

    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = TARGET_COLOR
    for (const target of targets) {
      ctx.beginPath()
      ctx.arc(target.x, target.y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function buildResult(): GameResult {
    const total = hits + misses
    const accuracy = total === 0 ? 0 : Math.round((hits / total) * 100)
    const avgTime = intervals.length === 0
      ? '—'
      : `${Math.round(intervals.reduce((sum, ms) => sum + ms, 0) / intervals.length)} ms`

    return {
      primary: hits === 0 ? null : hits,
      primaryLabel: 'Hits',
      unit: 'pts',
      secondary: [
        { label: 'Accuracy', value: `${accuracy}%` },
        { label: 'Avg time per hit', value: avgTime },
        { label: 'Misses', value: String(misses) },
      ],
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (finished) return

    capturePointer(canvas, event)

    pointer = { x: event.offsetX, y: event.offsetY }

    // При пересечении кругов берём ближайшую к клику цель, а не первую в массиве.
    let hitIndex = -1
    let bestDistance = Number.POSITIVE_INFINITY

    for (let index = 0; index < targets.length; index += 1) {
      const candidate = targets[index]
      if (!candidate) continue

      const distance = Math.hypot(candidate.x - event.offsetX, candidate.y - event.offsetY)
      if (distance < radius && distance < bestDistance) {
        bestDistance = distance
        hitIndex = index
      }
    }

    if (hitIndex === -1) {
      misses += 1
      render()
      return
    }

    const target = targets[hitIndex]
    if (target) {
      targets.splice(hitIndex, 1)
      freeCells.push(target.cellIndex)
    }

    hits += 1
    const now = performance.now()
    intervals.push(now - lastHitAt)
    lastHitAt = now
    spawnTarget()
    render()
  }

  function onPointerMove(event: PointerEvent): void {
    pointer = { x: event.offsetX, y: event.offsetY }
  }

  function onPointerRelease(event: PointerEvent): void {
    releasePointer(canvas, event)
  }

  function onPointerCancel(event: PointerEvent): void {
    releasePointer(canvas, event)
    pointer = null
  }

  function finish(): void {
    if (finished) return
    finished = true
    stopLoop()
    onResult(buildResult())
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerRelease)
  canvas.addEventListener('pointercancel', onPointerCancel)

  for (let index = 0; index < config.targets; index += 1) {
    spawnTarget()
  }

  const stopLoop = startLoop((dt) => {
    accumulated += dt
    if (accumulated >= config.duration) {
      finish()
      return
    }

    render()
  })

  return () => {
    finished = true
    stopLoop()
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerRelease)
    canvas.removeEventListener('pointercancel', onPointerCancel)
    destroy()
  }
}

export function createAimGridshot(): GameMode {
  let teardown: (() => void) | null = null

  return {
    id: 'aimGridshot',
    title: 'Gridshot',
    mount(container, settings, onResult) {
      teardown?.()
      teardown = startSession(container, settings as AimGridshotSettings, onResult)
    },
    unmount() {
      teardown?.()
      teardown = null
    },
  }
}
