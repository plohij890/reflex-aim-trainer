const NS = 'aimtrainer:'

export function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function set<T>(key: string, value: T): void {
  localStorage.setItem(NS + key, JSON.stringify(value))
}

export function remove(key: string): void {
  localStorage.removeItem(NS + key)
}
