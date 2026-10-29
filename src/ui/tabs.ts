import { TAB_HOME, navigate, type Tab } from '../router'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'reflex', label: 'Reflex' },
  { id: 'aim', label: 'Aim' },
]

export function renderTabs(activeTab: Tab): HTMLElement {
  const nav = document.createElement('nav')
  nav.className = 'tabs'

  for (const tab of TABS) {
    const isActive = tab.id === activeTab
    const button = document.createElement('button')
    button.type = 'button'
    button.className = isActive ? 'tab is-active' : 'tab'
    button.textContent = tab.label
    if (isActive) button.setAttribute('aria-current', 'page')
    button.addEventListener('click', () => navigate(TAB_HOME[tab.id]))
    nav.append(button)
  }

  return nav
}
