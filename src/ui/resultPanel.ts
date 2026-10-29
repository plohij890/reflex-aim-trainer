import { loadRecords, type ModeId } from '../game/records'
import type { GameResult } from '../game/types'

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

export function renderResultContent(result: GameResult | null, modeId: ModeId): DocumentFragment {
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
