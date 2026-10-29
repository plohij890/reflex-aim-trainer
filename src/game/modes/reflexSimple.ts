import { capturePointer, createCanvas, releasePointer, startLoop } from '../engine'
import type { ReflexSimpleSettings } from '../settings'
import type { GameMode, GameResult, ProgressHandler } from '../types'

const BACKGROUND = '#101014'
const STIMULUS = '#22c55e'

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined

  const mid = Math.floor(values.length / 2)
  const upper = values[mid]
  if (upper === undefined) return undefined
  if (values.length % 2 === 1) return upper

  const lower = values[mid - 1]
  return lower === undefined ? upper : (lower + upper) / 2
}

function startSession(
  container: HTMLElement,
  config: ReflexSimpleSettings,
  onResult: (r: GameResult) => void,
  onProgress?: ProgressHandler,
): () => void {
  const { canvas, ctx, destroy } = createCanvas(container)

  const reactions: number[] = []
  let falseStarts = 0
  let phase: 'waiting' | 'stimulus' = 'waiting'
  let stimulusAt = 0
  let nextStimulusAt = 0
  let finished = false
  let accumulated = 0

  const randomDelay = (): number =>
    config.delayMin + Math.random() * (config.delayMax - config.delayMin)

  function scheduleNext(now: number): void {
    phase = 'waiting'
    nextStimulusAt = now + randomDelay()
  }

  function render(): void {
    ctx.fillStyle = phase === 'stimulus' ? STIMULUS : BACKGROUND
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  }

  function buildResult(): GameResult {
    const attempts = reactions.length
    const sorted = [...reactions].sort((a, b) => a - b)

    // Фальстарт не попадает в попытки, но при штрафе тянет среднее как виртуальная попытка.
    const penaltyAttempts = config.falseStartPenalty > 0 ? falseStarts : 0
    const penaltyMs = penaltyAttempts * config.falseStartPenalty
    const totalMs = reactions.reduce((sum, ms) => sum + ms, 0) + penaltyMs
    const countedAttempts = attempts + penaltyAttempts
    const primary = attempts === 0 ? null : Math.round(totalMs / countedAttempts)

    const best = sorted[0]
    const mid = median(sorted)

    return {
      primary,
      primaryLabel: 'Avg reaction',
      unit: 'ms',
      secondary: [
        { label: 'Best attempt', value: best === undefined ? '—' : `${Math.round(best)} ms` },
        { label: 'Median', value: mid === undefined ? '—' : `${Math.round(mid)} ms` },
        { label: 'Attempts', value: String(attempts) },
        { label: 'False starts', value: String(falseStarts) },
      ],
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (finished) return

    capturePointer(canvas, event)

    const now = performance.now()

    if (phase === 'waiting') {
      falseStarts += 1
      scheduleNext(now)
      return
    }

    reactions.push(now - stimulusAt)
    scheduleNext(now)
    render()
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

  scheduleNext(performance.now())
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerup', onPointerRelease)
  canvas.addEventListener('pointercancel', onPointerRelease)

  const stopLoop = startLoop((dt, now) => {
    accumulated += dt
    onProgress?.(accumulated, config.duration)

    if (accumulated >= config.duration) {
      finish()
      return
    }

    if (phase === 'waiting' && now >= nextStimulusAt) {
      phase = 'stimulus'
      stimulusAt = now
    }

    render()
  })

  return () => {
    finished = true
    stopLoop()
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointerup', onPointerRelease)
    canvas.removeEventListener('pointercancel', onPointerRelease)
    destroy()
  }
}

export function createReflexSimple(): GameMode {
  let teardown: (() => void) | null = null

  return {
    id: 'reflexSimple',
    title: 'Simple Reaction',
    mount(container, settings, onResult, onProgress) {
      teardown?.()
      teardown = startSession(container, settings as ReflexSimpleSettings, onResult, onProgress)
    },
    unmount() {
      teardown?.()
      teardown = null
    },
  }
}
