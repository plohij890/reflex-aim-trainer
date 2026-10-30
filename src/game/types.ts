export interface GameResult {
  primary: number | null
  primaryLabel: string
  secondary?: { label: string; value: string }[]
  unit?: 'ms' | '%' | 'pts' | ''
}

export type ProgressHandler = (elapsed: number, duration: number) => void

export interface GameMode {
  id: string
  title: string
  mount(
    container: HTMLElement,
    settings: unknown,
    onResult: (r: GameResult) => void,
    onProgress?: ProgressHandler,
  ): void
  unmount(): void
}
