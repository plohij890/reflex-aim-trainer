import './styles.css'
import { MODES, modeIdForRoute } from './game/modes/index'
import type { ModeId } from './game/records'
import { TAB_HOME, navigate, onRouteChange, parseHash, type Route, type Tab } from './router'
import { renderModeCard } from './ui/modeCard'
import { disposeModeScreen, renderModeScreen } from './ui/modeScreen'
import { renderTabs } from './ui/tabs'

function tabOf(route: Route): Tab {
  return route.startsWith('reflex') ? 'reflex' : 'aim'
}

function renderHeader(activeTab: Tab): HTMLElement {
  const header = document.createElement('header')
  header.className = 'header'
  header.append(renderTabs(activeTab))
  return header
}

function renderList(tab: Tab): HTMLElement {
  const main = document.createElement('main')
  main.className = 'list-view'

  const heading = document.createElement('h1')
  heading.textContent = tab === 'reflex' ? 'Reflex' : 'Aim'

  const grid = document.createElement('div')
  grid.className = 'modes'
  grid.append(
    ...MODES[tab].map((mode) =>
      renderModeCard({ id: mode.route, title: mode.title, description: mode.description }),
    ),
  )

  main.append(heading, grid)
  return main
}

function renderModeView(modeId: ModeId): HTMLElement {
  const main = document.createElement('main')
  main.className = 'mode-view'
  renderModeScreen(main, modeId)
  return main
}

function render(route: Route | null): void {
  disposeModeScreen()

  if (route === null) {
    navigate(TAB_HOME.reflex)
    return
  }

  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const tab = tabOf(route)
  const modeId = modeIdForRoute(route)

  app.replaceChildren(renderHeader(tab), modeId ? renderModeView(modeId) : renderList(tab))
}

onRouteChange(render)
render(parseHash(location.hash))
