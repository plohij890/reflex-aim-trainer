import { createCanvas, drawCountdown, startLoop } from '../game/engine'
import { getMode, getModeInfo } from '../game/modes/index'
import { saveRecord, type ModeId } from '../game/records'
import { loadSettings } from '../game/settings'
import type { GameMode, GameResult } from '../game/types'
import { TAB_HOME, navigate } from '../router'
import { renderResultContent } from './resultPanel'

let activeDispose: (() => void) | null = null

export function disposeModeScreen(): void {
  activeDispose?.()
  activeDispose = null
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
