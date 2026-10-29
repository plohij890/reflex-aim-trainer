export function createCanvas(container: HTMLElement): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  destroy: () => void
} {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context is not available')

  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1
    const width = container.clientWidth
    const height = container.clientHeight

    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    // setTransform сбрасывает масштаб, иначе scale множится на каждом resize.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
  }

  container.append(canvas)
  resize()
  window.addEventListener('resize', resize)

  return {
    canvas,
    ctx,
    destroy: () => {
      window.removeEventListener('resize', resize)
      canvas.remove()
    },
  }
}

export function capturePointer(canvas: HTMLCanvasElement, event: PointerEvent): void {
  // Синтетические события и потерянные указатели не имеют активного pointerId.
  try {
    canvas.setPointerCapture(event.pointerId)
  } catch {
    // Без захвата события всё равно придут, пока курсор над canvas.
  }
}

export function pointerPosition(canvas: HTMLCanvasElement, event: PointerEvent): { x: number; y: number } {
  // offsetX/offsetY считаются от target'а события; на window-слушателе target может быть любым.
  const rect = canvas.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

export function releasePointer(canvas: HTMLCanvasElement, event: PointerEvent): void {
  try {
    canvas.releasePointerCapture(event.pointerId)
  } catch {
    // Указатель мог быть уже освобождён (pointercancel) — это не ошибка.
  }
}

export function startLoop(cb: (dt: number, now: number) => void): () => void {
  let raf = 0
  let prev = performance.now()
  let stopped = false

  const frame = (now: number): void => {
    if (stopped) return

    // Ограничиваем dt: после сворачивания вкладки кадр может прийти с огромной дельтой.
    const dt = Math.min((now - prev) / 1000, 0.1)
    prev = now

    cb(dt, now)
    if (stopped) return

    raf = requestAnimationFrame(frame)
  }

  raf = requestAnimationFrame(frame)

  return () => {
    stopped = true
    cancelAnimationFrame(raf)
  }
}

export function drawCountdown(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  secondsLeft: 3 | 2 | 1,
): void {
  ctx.clearRect(0, 0, w, h)

  ctx.fillStyle = '#e6edf3'
  ctx.font = `600 ${Math.round(Math.min(w, h) * 0.28)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(secondsLeft), w / 2, h / 2)
}
