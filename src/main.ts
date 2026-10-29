import './styles.css'
import {
  TAB_HOME,
  navigate,
  onRouteChange,
  parseHash,
  type Route,
  type Tab,
} from './router'
import { renderModeCard, type ModeMeta } from './ui/modeCard'
import { renderTabs } from './ui/tabs'

const MODES: Record<Tab, readonly ModeMeta[]> = {
  reflex: [
    {
      id: 'reflex/simple',
      title: 'Simple Reaction',
      description: 'Кликни, как только изменится цвет. Тренирует чистую скорость реакции.',
    },
    {
      id: 'reflex/choice',
      title: 'Choice Reaction',
      description: 'Подсветилась зона — кликни по ней. Реакция с выбором.',
    },
    {
      id: 'reflex/gonogo',
      title: 'Go / No-Go',
      description: 'Кликай только на зелёные стимулы. Тренирует торможение.',
    },
  ],
  aim: [
    {
      id: 'aim/gridshot',
      title: 'Gridshot',
      description: 'Статичные цели по сетке. Скорость + точность.',
    },
    {
      id: 'aim/path',
      title: 'Path Tracking',
      description: 'Веди шарик по линии, не отпуская ЛКМ. Плавность руки.',
    },
    {
      id: 'aim/recoil',
      title: 'Recoil Tracking',
      description: 'Держи прицел на движущейся цели и сжигай её HP. Spray control.',
    },
  ],
}

const MODE_BY_ROUTE = new Map<Route, ModeMeta>(
  Object.values(MODES)
    .flat()
    .map((mode): [Route, ModeMeta] => [mode.id, mode]),
)

function tabOf(route: Route): Tab {
  return route.startsWith('reflex') ? 'reflex' : 'aim'
}

function renderHeader(activeTab: Tab): HTMLElement {
  const header = document.createElement('header')
  header.className = 'header'
  header.append(renderTabs(activeTab))
  return header
}

function renderModeList(tab: Tab): HTMLElement {
  const main = document.createElement('main')
  main.className = 'list-view'

  const heading = document.createElement('h1')
  heading.textContent = tab === 'reflex' ? 'Reflex' : 'Aim'

  const grid = document.createElement('div')
  grid.className = 'modes'
  grid.append(...MODES[tab].map(renderModeCard))

  main.append(heading, grid)
  return main
}

function renderModeScreen(route: Route): HTMLElement {
  const mode = MODE_BY_ROUTE.get(route)

  const main = document.createElement('main')
  main.className = 'mode-screen'

  const heading = document.createElement('h1')
  heading.textContent = mode?.title ?? route

  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'back'
  back.textContent = 'Назад'
  back.addEventListener('click', () => navigate(TAB_HOME[tabOf(route)]))

  main.append(heading, back)
  return main
}

function render(route: Route | null): void {
  if (route === null) {
    navigate(TAB_HOME.reflex)
    return
  }

  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const tab = tabOf(route)
  app.replaceChildren(
    renderHeader(tab),
    route === tab ? renderModeList(tab) : renderModeScreen(route),
  )
}

onRouteChange(render)
render(parseHash(location.hash))
