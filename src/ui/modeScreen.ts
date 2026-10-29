import { createCanvas, drawCountdown, startLoop } from '../game/engine'
import { getMode, getModeInfo } from '../game/modes/index'
import { loadRecords, saveRecord, type ModeId } from '../game/records'
import { loadSettings } from '../game/settings'
import type { GameMode, GameResult } from '../game/types'
import { TAB_HOME, navigate } from '../router'

let activeDispose: (() => void) | null = null

export function disposeModeScreen(): void {
  activeDispose?.()
  activeDispose = null
}

function formatValue(value: number, unit: GameResult['unit']): string {
  switch (unit) {
    case 'ms':
      return `${Math.round(value)} ms`
    case '%':
      return `${Math.round(value * 10) / 10}%`
    case 'pts':
      return `${Math.round(value * 10) / 10} pts`
    default:
      return `${Math.round(value * 100) / 100}`
  }
}

function renderResultContent(result: GameResult | null, modeId: ModeId): DocumentFragment {
  const fragment = document.createDocumentFragment()

  if (result === null) {
    const heading = document.createElement('h1')
    heading.textContent = 'Режим в разработке'
    fragment.append(heading)
    return fragment
  }

  const value = document.createElement('p')
  value.className = 'result-primary'
  value.textContent = formatValue(result.primary, result.unit)

  const label = document.createElement('p')
  label.className = 'result-label'
  label.textContent = result.primaryLabel

  fragment.append(value, label)

  if (result.secondary && result.secondary.length > 0) {
    const list = document.createElement('dl')
    list.className = 'result-secondary'

    for (const item of result.secondary) {
      const term = document.createElement('dt')
      term.textContent = item.label
      const description = document.createElement('dd')
      description.textContent = item.value
      list.append(term, description)
    }

    fragment.append(list)
  }

  const best = loadRecords()[modeId]
  if (best !== undefined) {
    const bestLine = document.createElement('p')
    bestLine.className = 'result-best'
    bestLine.textContent = `Best: ${formatValue(best.best, result.unit)}`
    fragment.append(bestLine)
  }

  return fragment
}

function createButton(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

function actionsRow(...buttons: HTMLButtonElement[]): HTMLElement {
  const row = document.createElement('div')
  row.className = 'actions'
  row.append(...buttons)
  return row
}

export function renderModeScreen(container: HTMLElement, modeId: ModeId): void {
  const info = getModeInfo(modeId)
  if (!info) return

  const { tab, title } = info

  disposeModeScreen()

  let stopCountdown: (() => void) | null = null
  let canvasHandle: { destroy: () => void } | null = null
  let mounted: GameMode | null = null
  let result: GameResult | null = null

  function teardown(): void {
    stopCountdown?.()
    stopCountdown = null
    mounted?.unmount()
    mounted = null
    canvasHandle?.destroy()
    canvasHandle = null
  }

  function back(): void {
    navigate(TAB_HOME[tab])
  }

  function showReady(): void {
    container.replaceChildren()

    const panel = document.createElement('div')
    panel.className = 'mode-panel'

    const heading = document.createElement('h1')
    heading.textContent = title

    panel.append(
      heading,
      actionsRow(
        createButton('Начать', 'btn btn--primary', startRun),
        createButton('Назад', 'btn', back),
      ),
    )

    container.append(panel)
  }

  function showResult(): void {
    container.replaceChildren()

    const panel = document.createElement('div')
    panel.className = 'mode-panel'

    panel.append(
      renderResultContent(result, modeId),
      actionsRow(
        createButton('Ещё раз', 'btn btn--primary', startRun),
        createButton('Назад', 'btn', back),
      ),
    )

    container.append(panel)
  }

  function startRun(): void {
    teardown()
    result = null

    container.replaceChildren()

    const stage = document.createElement('div')
    stage.className = 'stage'
    container.append(stage)

    const handle = createCanvas(stage)
    canvasHandle = handle

    let elapsed = 0

    stopCountdown = startLoop((dt) => {
      elapsed += dt
      const left = Math.ceil(3 - elapsed)

      if (left <= 0) {
        teardown()
        runMode()
        return
      }

      if (left === 1 || left === 2 || left === 3) {
        drawCountdown(handle.ctx, handle.canvas.clientWidth, handle.canvas.clientHeight, left)
      }
    })
  }

  function runMode(): void {
    const mode = getMode(modeId)
    if (!mode) {
      showResult()
      return
    }

    container.replaceChildren()

    const stage = document.createElement('div')
    stage.className = 'stage'
    container.append(stage)

    mounted = mode
    mode.mount(stage, loadSettings()[modeId], handleResult)
  }

  function handleResult(r: GameResult): void {
    teardown()
    saveRecord(modeId, r.primary, r.unit === 'ms' ? 'lower-is-better' : 'higher-is-better')
    result = r
    showResult()
  }

  activeDispose = teardown
  showReady()
}
