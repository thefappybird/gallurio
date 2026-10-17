"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

const KEY_STEP = 32

function viewportMax(min: number) {
  if (typeof window === "undefined") return min
  return Math.max(min, Math.floor(window.innerWidth * 0.9))
}

export function useSheetResize({
  storageKey,
  defaultWidth,
  min = 360,
}: {
  storageKey: string
  defaultWidth: number
  min?: number
}) {
  // Callback ref + getter keep the element out of render-time ref reads.
  const elRef = React.useRef<HTMLDivElement | null>(null)
  const attachSheet = React.useCallback((node: HTMLDivElement | null) => {
    elRef.current = node
  }, [])
  const getSheet = React.useCallback(() => elRef.current, [])
  const clamp = React.useCallback(
    (w: number) => Math.min(Math.max(w, min), viewportMax(min)),
    [min]
  )
  // The sheet only mounts client-side after opening (portal), so reading
  // storage in the initializer cannot cause a hydration mismatch.
  const [width, setWidth] = React.useState(() => {
    if (typeof window === "undefined") return defaultWidth
    try {
      const stored = Number(window.localStorage.getItem(storageKey))
      if (Number.isFinite(stored) && stored > 0) return clamp(stored)
    } catch {
      // storage blocked: keep the default
    }
    return defaultWidth
  })
  const [max, setMax] = React.useState(() => viewportMax(min))

  React.useEffect(() => {
    const onResize = () => {
      setMax(viewportMax(min))
      setWidth((w) => clamp(w))
    }
    window.addEventListener("resize", onResize, { passive: true })
    return () => window.removeEventListener("resize", onResize)
  }, [min, clamp])
  const style = { "--sheet-w": `${width}px` } as React.CSSProperties
  const commit = React.useCallback(
    (w: number) => {
      const next = clamp(w)
      setWidth(next)
      try {
        window.localStorage.setItem(storageKey, String(next))
      } catch {
        // storage blocked: width still applies for this session
      }
      return next
    },
    [clamp, storageKey]
  )

  // Spread onto the sheet: { ref, style }.
  const sheetProps = { ref: attachSheet, style }

  return { sheetProps, getSheet, width, min, max, clamp, commit }
}

export type SheetResize = ReturnType<typeof useSheetResize>

export function SheetResizeHandle({ resize }: { resize: SheetResize }) {
  const t = useTranslations("common")
  // Per-drag scratch state lives in refs: pointermove must never set React
  // state, or every pixel of travel would re-render the whole sheet.
  const drag = React.useRef<{ latest: number; raf: number } | null>(null)

  // Unmount mid-drag (sheet closed, route change) would leave text selection
  // disabled page-wide and a frame callback pointing at a gone sheet.
  React.useEffect(
    () => () => {
      const d = drag.current
      if (!d) return
      if (d.raf) cancelAnimationFrame(d.raf)
      drag.current = null
      document.body.style.userSelect = ""
    },
    []
  )

  const flush = () => {
    const d = drag.current
    if (!d) return
    resize.getSheet()?.style.setProperty("--sheet-w", `${d.latest}px`)
  }

  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    if (d.raf) cancelAnimationFrame(d.raf)
    flush()
    drag.current = null
    resize.getSheet()?.removeAttribute("data-resizing")
    document.body.style.userSelect = ""
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    resize.commit(d.latest)
  }

  return (
    <div
      role="separator"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        drag.current = { latest: resize.width, raf: 0 }
        resize.getSheet()?.setAttribute("data-resizing", "")
        document.body.style.userSelect = "none"
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        d.latest = resize.clamp(window.innerWidth - e.clientX)
        if (d.raf) return
        d.raf = requestAnimationFrame(() => {
          d.raf = 0
          flush()
        })
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      aria-orientation="vertical"
      aria-label={t("resizePanel")}
      // Right sheets stay on the physical right even in RTL (ar), so their
      // resize edge is the physical left: `left-0` is deliberate, not `start-0`.
      className="group absolute inset-y-0 left-0 z-10 hidden w-2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-transparent after:transition-colors hover:after:bg-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:after:bg-brand active:after:bg-brand sm:block"
      aria-valuenow={resize.width}
      aria-valuemin={resize.min}
      aria-valuemax={resize.max}
      tabIndex={0}
      onKeyDown={(e) => {
        // Sheets are physical-right, so the handle sits on the physical left:
        // ArrowLeft drags the edge left (grow), ArrowRight shrinks.
        const next =
          e.key === "ArrowLeft"
            ? resize.width + KEY_STEP
            : e.key === "ArrowRight"
              ? resize.width - KEY_STEP
              : e.key === "Home"
                ? resize.min
                : e.key === "End"
                  ? resize.max
                  : null
        if (next === null) return
        e.preventDefault()
        resize.commit(next)
      }}
    >
      {/* Decorative sash grip, always visible; the whole separator stays the hit target.
          Kept inside the edge: some sheets clip overflow (invoice theme). */}
      <span
        aria-hidden="true"
        data-slot="sheet-resize-grip"
        className="pointer-events-none absolute left-0.5 top-1/2 flex h-7 w-1.5 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full bg-background ring-1 ring-foreground/15 transition-colors group-hover:ring-brand group-focus-visible:ring-brand group-active:ring-brand"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1 rounded-full bg-muted-foreground/60 transition-colors group-hover:bg-brand group-focus-visible:bg-brand group-active:bg-brand"
          />
        ))}
      </span>
    </div>
  )
}
