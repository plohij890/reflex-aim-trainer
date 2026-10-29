export type Tab = 'reflex' | 'aim'

export type Route =
  | 'reflex'
  | 'aim'
  | 'reflex/simple'
  | 'reflex/choice'
  | 'reflex/gonogo'
  | 'aim/gridshot'
  | 'aim/path'
  | 'aim/recoil'

export const TAB_HOME: Record<Tab, Route> = {
  reflex: 'reflex',
  aim: 'aim',
}

const ROUTES: readonly string[] = [
  'reflex',
  'aim',
  'reflex/simple',
  'reflex/choice',
  'reflex/gonogo',
  'aim/gridshot',
  'aim/path',
  'aim/recoil',
]

function isRoute(value: string): value is Route {
  return ROUTES.includes(value)
}

export function parseHash(hash: string): Route | null {
  const [, tab, mode] = /^#\/([\w-]+)(?:\/([\w-]+))?$/.exec(hash) ?? []
  if (!tab) return null
  const route = mode ? `${tab}/${mode}` : tab
  return isRoute(route) ? route : null
}

export function navigate(route: Route): void {
  location.hash = `#/${route}`
}

export function onRouteChange(cb: (route: Route | null) => void): () => void {
  const handler = (): void => {
    cb(parseHash(location.hash))
  }

  window.addEventListener('hashchange', handler)
  window.addEventListener('load', handler)

  return () => {
    window.removeEventListener('hashchange', handler)
    window.removeEventListener('load', handler)
  }
}
