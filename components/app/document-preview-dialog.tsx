"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Screen-reader dialog name; not rendered visibly. */
  title: string;
  closeLabel: string;
  /** Natural (unscaled) px size of `children`; the dialog scales it to fit the viewport. */
  naturalSize?: { width: number; height: number };
  children: React.ReactNode;
};

const MAX_SCALE = 3;

function fitScale({ width, height }: { width: number; height: number }) {
  if (typeof window === "undefined") return 1;
  return Math.min(
    (window.innerHeight * 0.9) / height,
    (window.innerWidth * 0.92) / width,
    MAX_SCALE
  );
}

/**
 * Cinema-scrim viewer for a fixed-size document (A4 previews and the like).
 * The child renders at its natural size and is enlarged with a CSS transform,
 * so tiny-px layouts stay pixel-identical to the small preview, just bigger.
 */
export function DocumentPreviewDialog({
  open,
  onOpenChange,
  title,
  closeLabel,
  naturalSize = { width: 288, height: 407 },
  children,
}: Props) {
  const { width, height } = naturalSize;
  const [scale, setScale] = React.useState(() => fitScale({ width, height }));

  React.useEffect(() => {
    if (!open) return;
    const update = () => setScale(fitScale({ width, height }));
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, [open, width, height]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Theme-independent scrim, same literal-black treatment as the portfolio Lightbox. */}
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[70] bg-black/90 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        {/* Popup spans the viewport but ignores pointer events so a click beside the
            document reaches the backdrop and dismisses. */}
        <DialogPrimitive.Popup className="pointer-events-none fixed inset-0 z-[70] grid place-items-center outline-none">
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="pointer-events-auto fixed end-3 top-3 inline-flex size-11 items-center justify-center rounded-[var(--radius)] text-white outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white active:bg-white/25"
          >
            <XIcon className="size-5" aria-hidden />
          </DialogPrimitive.Close>
          <div
            className="pointer-events-auto relative overflow-hidden"
            style={{ width: width * scale, height: height * scale }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ width, height, transform: `scale(${scale})` }}
            >
              {children}
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
