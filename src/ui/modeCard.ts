import type { Route } from '../router'

export interface ModeMeta {
  id: Route
  title: string
  description: string
}

export function renderModeCard(mode: ModeMeta): HTMLElement {
  const card = document.createElement('a')
  card.className = 'mode-card'
  card.href = `#/${mode.id}`

  const title = document.createElement('h2')
  title.textContent = mode.title

  const description = document.createElement('p')
  description.textContent = mode.description

  card.append(title, description)
  return card
}
