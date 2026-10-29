import { createCanvas, startLoop } from '../engine'
import type { ReflexGoNoGoSettings } from '../settings'
import type { GameMode, GameResult } from '../types'

const BACKGROUND = '#101014'
const GO_COLOR = '#22c55e'
const NO_GO_COLOR = '#ef4444'

const PAUSE_MIN = 700
const PAUSE_MAX = 1500
const MAX_NO_GO_STREAK = 3

interface Stimulus {
  type: 'go' | 'nogo'
  shownAt: number
  responded: boolean
}

function startSession(
  container: HTMLElement,
  config: ReflexGoNoGoSettings,
  onResult: (r: GameResult) => void,
): () => void {
  const { canvas, ctx, destroy } = createCanvas(container)

  const reactions: number[] = []
  let misses = 0
  let falseAlarms = 0
  let correctRejections = 0
  let noGoStreak = 0

  let current: Stimulus | null = null
  let pauseUntil = 0
  let finished = false

  const endsAt = performance.now() + config.duration * 1000

  function randomPause(): number {
    return PAUSE_MIN + Math.random() * (PAUSE_MAX - PAUSE_MIN)
  }

  function pickType(): Stimulus['type'] {
    const wantsNoGo = Math.random() < config.noGoRatio
    if (wantsNoGo && noGoStreak < MAX_NO_GO_STREAK) return 'nogo'
    return 'go'
  }

  function render(): void {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, width, height)

    if (!current) return

    const radius = Math.min(width, height) * 0.16
    const cx = width / 2
    const cy = height / 2

    if (current.type === 'go') {
      ctx.fillStyle = GO_COLOR
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = NO_GO_COLOR
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
    }
  }

  function buildResult(): GameResult {
    const hits = reactions.length
    const total = hits + misses + falseAlarms + correctRejections
    const primary = hits === 0 ? null : Math.round(reactions.reduce((sum, ms) => sum + ms, 0) / hits)
    const accuracy = total === 0 ? 0 : Math.round(((hits + correctRejections) / total) * 100)

    return {
      primary,
      primaryLabel: 'Avg reaction',
      unit: 'ms',
      secondary: [
        { label: 'Accuracy', value: `${accuracy}%` },
        { label: 'Hits', value: String(hits) },
        { label: 'Misses', value: String(misses) },
        { label: 'False alarms', value: String(falseAlarms) },
      ],
    }
  }

  function onPointerDown(): void {
    if (finished || current === null) return

    const now = performance.now()
    // Клик после закрытия окна не засчитываем: miss уже посчитает RAF-цикл.
    if (now - current.shownAt >= config.responseWindow) return

    current.responded = true

    if (current.type === 'go') {
      reactions.push(now - current.shownAt)
    } else {
      falseAlarms += 1
    }

    current = null
    pauseUntil = now + randomPause()
    render()
  }

  function finish(): void {
    if (finished) return
    finished = true
    stopLoop()
    onResult(buildResult())
  }

  pauseUntil = performance.now() + randomPause()
  canvas.addEventListener('pointerdown', onPointerDown)

  const stopLoop = startLoop((_dt, now) => {
    if (current && now - current.shownAt >= config.responseWindow) {
      if (!current.responded) {
        if (current.type === 'go') misses += 1
        else correctRejections += 1
      }
      current = null
      pauseUntil = now + randomPause()
    }

    if (now >= endsAt) {
      finish()
      return
    }

    if (current === null && now >= pauseUntil) {
      const type = pickType()
      noGoStreak = type === 'nogo' ? noGoStreak + 1 : 0
      current = { type, shownAt: now, responded: false }
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

export function createReflexGoNoGo(): GameMode {
  let teardown: (() => void) | null = null

  return {
    id: 'reflexGoNoGo',
    title: 'Go / No-Go',
    mount(container, settings, onResult) {
      teardown?.()
      teardown = startSession(container, settings as ReflexGoNoGoSettings, onResult)
    },
    unmount() {
      teardown?.()
      teardown = null
    },
  }
}
