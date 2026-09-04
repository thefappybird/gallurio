"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { XIcon, ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { resolveImageModalLayout, type ImageModalLayout } from "@/lib/page-builder/types";
import { CaptionLayout, SidebarLayout, CinemaLayout, SheetLayout } from "./imageModal";

// ---------------------------------------------------------------------------
// Shared fullscreen lightbox — used by CollectionPopup (Featured Work) and the
// Gallery grid/masonry blocks. Same image on the public page and the editor
// canvas (isomorphic, no server-only imports).
//
// This file is the SHELL: portal, backdrop, escape-to-close (native to
// DialogPrimitive), focus trap + focus restore (native to DialogPrimitive),
// body scroll lock (native to DialogPrimitive), arrow-key navigation, and the
// current-index/paging state machine. It has no visual opinion beyond the
// backdrop and the close button — the frame itself is one of four leaves in
// ./imageModal, chosen by `layout`. Leaves are presentational only.
// ---------------------------------------------------------------------------

export type LightboxImage = {
  id: string;
  publicId: string;
  alt: string;
  title?: string;
  caption?: string;
  date?: string;
  location?: string;
  client?: string;
  meta?: { label: string; value: string }[];
  tags?: string[];
  width?: number;
  height?: number;
};

/** Props every leaf (CaptionLayout/SidebarLayout/CinemaLayout/SheetLayout) receives. Presentational only — no state, no key handling, all navigation is derived and handed down by the shell. */
export type ImageModalLeafProps = {
  image: LightboxImage;
  images: LightboxImage[];
  index: number;
  total: number;
  /** true iff images.length > 1 — the only thing that gates showing nav chrome. */
  hasNav: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  /** true while a "next past the loaded end" request is in flight. */
  isPendingMore: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
  onClose: () => void;
  closeLabel: string;
  fullSizeAlt: string;
  /** Pre-resolved, localized. Already formatted — leaves render it verbatim. */
  prevLabel: string;
  nextLabel: string;
  counterText: string;
  filmstripLabel: string;
};

/** Every string this modal introduces beyond the pre-existing closeLabel/
 *  fullSizeAlt. All optional, defaulting to the current English so no call
 *  site breaks; callers resolve real translations at the page boundary (see
 *  GalleryChromeLabels in blockContext.ts) and thread them down. */
export type LightboxLabels = {
  close?: string;
  previous?: string;
  next?: string;
  /** Template with literal "{current}"/"{total}" tokens, e.g. "{current} / {total}". */
  counter?: string;
  /** aria-label for the cinema layout's filmstrip listbox. */
  filmstrip?: string;
};

type LightboxNewProps = {
  images: LightboxImage[];
  initialIndex?: number;
  onClose: () => void;
  layout?: ImageModalLayout;
  total?: number;
  hasMore?: boolean;
  onRequestMore?: () => Promise<void> | void;
  closeLabel?: string;
  fullSizeAlt?: string;
  labels?: LightboxLabels;
  /** Re-applied on the portaled root — see the comment above where it's
   *  consumed for why this can't be inferred instead. */
  brandVars?: Record<string, string>;
};

/** Legacy single-image call signature (CollectionPopup and other pre-refactor
 *  callers). Normalized to a one-item `images` array internally — one entry
 *  means no navigation, by construction, so this degrades exactly to the old
 *  single-photo behavior with no code path divergence. */
type LightboxLegacyProps = {
  image: LightboxImage;
  onClose: () => void;
  closeLabel?: string;
  fullSizeAlt?: string;
  brandVars?: Record<string, string>;
};

export type LightboxProps = LightboxNewProps | LightboxLegacyProps;

function isLegacyProps(props: LightboxProps): props is LightboxLegacyProps {
  return "image" in props;
}

const SCRIM_LAYOUTS: ReadonlySet<ImageModalLayout> = new Set(["caption", "cinema"]);

const BACKDROP_BY_LAYOUT: Record<ImageModalLayout, string> = {
  caption: "rgba(0,0,0,0.85)",
  sidebar: "rgba(0,0,0,0.85)",
  cinema: "rgba(0,0,0,0.92)",
  // Flat, theme-independent scrim — the sheet itself is brand-colored, not the
  // scrim. Deriving this from a token instead inverts on dark brand kits
  // (a light wash around a dark sheet), so it stays a literal rgba() always.
  sheet: "rgba(0,0,0,0.55)",
};

const LAYOUT_COMPONENTS: Record<ImageModalLayout, (props: ImageModalLeafProps) => ReactElement> = {
  caption: CaptionLayout,
  sidebar: SidebarLayout,
  cinema: CinemaLayout,
  sheet: SheetLayout,
};

const MODAL_STYLES = `
[data-lightbox-close]:focus-visible,
.pf-modal-arrow:focus-visible {
  outline: 2px solid var(--pf-color-accent, #f2f2f2);
  outline-offset: 2px;
}
.pf-modal-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  cursor: pointer;
  flex: 0 0 auto;
  transition: background 0.15s, color 0.15s, transform 0.1s;
}
.pf-modal-arrow:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.pf-modal-arrow:active:not(:disabled) {
  transform: scale(0.92);
}
.pf-modal-arrow[data-variant="scrim"] {
  background: rgba(255,255,255,0.12);
  color: #f2f2f2;
  border: 1px solid rgba(255,255,255,0.28);
}
.pf-modal-arrow[data-variant="scrim"]:hover:not(:disabled) {
  background: rgba(255,255,255,0.24);
}
.pf-modal-arrow[data-variant="brand"] {
  background: var(--pf-color-bg, #fff);
  color: var(--pf-color-fg, #111);
  border: 1px solid color-mix(in srgb, var(--pf-color-fg, #111) 20%, transparent);
}
.pf-modal-arrow[data-variant="brand"]:hover:not(:disabled) {
  background: var(--pf-color-fg, #111);
  color: var(--pf-color-bg, #fff);
}
.pf-modal-spin {
  animation: pf-modal-spin 0.8s linear infinite;
}
@keyframes pf-modal-spin {
  to { transform: rotate(360deg); }
}
`;

function FloatingCloseButton({
  onClick,
  label = "Close",
  variant,
}: {
  onClick: () => void;
  label?: string;
  variant: "scrim" | "brand";
}) {
  const colors =
    variant === "scrim"
      ? { bg: "rgba(255,255,255,0.12)", fg: "#f2f2f2", border: "rgba(255,255,255,0.28)", hoverBg: "#f2f2f2", hoverFg: "#111" }
      : { bg: "var(--pf-color-bg, #fff)", fg: "var(--pf-color-fg, #111)", border: "color-mix(in srgb, var(--pf-color-fg, #111) 20%, transparent)", hoverBg: "var(--pf-color-fg, #111)", hoverFg: "var(--pf-color-bg, #fff)" };
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      data-lightbox-close=""
      style={{
        position: "absolute",
        top: "10px",
        insetInlineEnd: "10px",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.fg,
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = colors.hoverBg;
        (e.currentTarget as HTMLButtonElement).style.color = colors.hoverFg;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = colors.bg;
        (e.currentTarget as HTMLButtonElement).style.color = colors.fg;
      }}
    >
      <XIcon aria-hidden style={{ width: "16px", height: "16px" }} />
    </button>
  );
}

/** Shared prev/next control — every leaf renders this instead of rolling its
 *  own so idle/hover/focus-visible/active/disabled/pending states stay in one
 *  place. `pending` shows a spinner in place of the chevron and marks
 *  aria-busy, used on "next" once it has advanced past the loaded end and is
 *  waiting on onRequestMore(). */
export function NavArrowButton({
  direction,
  onClick,
  disabled,
  pending,
  label,
  variant,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
  pending: boolean;
  label: string;
  variant: "scrim" | "brand";
}) {
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      className="pf-modal-arrow"
      data-variant={variant}
      data-direction={direction}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {pending ? (
        <Loader2Icon aria-hidden className="pf-modal-spin" style={{ width: "18px", height: "18px" }} />
      ) : (
        <Icon aria-hidden style={{ width: "18px", height: "18px" }} />
      )}
    </button>
  );
}

/** Resolves the delivery URL for a modal-sized rendition. Shared so every
 *  leaf requests the same width/fit unless it has a documented reason not to. */
export function modalImageSrc(publicId: string): string {
  return imageDeliveryUrl(publicId, { width: 2000, fit: "scale-down" });
}

export function Lightbox(props: LightboxProps) {
  const legacy = isLegacyProps(props);
  const images = legacy ? [props.image] : props.images;
  const layout = legacy ? "caption" : resolveImageModalLayout(props.layout);
  const total = legacy ? images.length : props.total ?? images.length;
  const hasMoreProp = legacy ? false : props.hasMore ?? false;
  const onRequestMore = legacy ? undefined : props.onRequestMore;
  const { onClose, brandVars } = props;
  const labels = legacy ? undefined : props.labels;
  const closeLabel = props.closeLabel ?? labels?.close ?? "Close";
  const fullSizeAlt = props.fullSizeAlt ?? "Full size photo";
  const prevLabel = labels?.previous ?? "Previous image";
  const nextLabel = labels?.next ?? "Next image";
  const counterTemplate = labels?.counter ?? "{current} / {total}";
  const filmstripLabel = labels?.filmstrip ?? "Photo filmstrip";
  const initialIndexRaw = legacy ? 0 : props.initialIndex ?? 0;

  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(initialIndexRaw, 0), Math.max(images.length - 1, 0))
  );
  const [isPendingMore, setIsPendingMore] = useState(false);
  const prevLengthRef = useRef(images.length);

  // Auto-advance once a requested page lands (images grew) while a "next past
  // the loaded end" request was in flight.
  useEffect(() => {
    if (isPendingMore && images.length > prevLengthRef.current) {
      setCurrentIndex((i) => Math.min(i + 1, images.length - 1));
      setIsPendingMore(false);
    }
    prevLengthRef.current = images.length;
  }, [images.length, isPendingMore]);

  // Derived, not stored: if the caller learns there's nothing more while a
  // request is in flight (e.g. the fetch resolved with hasMore now false
  // without the array growing), the spinner drops immediately on that same
  // render instead of waiting on another effect pass.
  const pendingMore = isPendingMore && hasMoreProp;

  const hasNav = images.length > 1;
  const canGoPrev = currentIndex > 0;
  const atLoadedEnd = currentIndex >= images.length - 1;
  const canGoNext = !atLoadedEnd || hasMoreProp;

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex((i) => Math.min(i + 1, images.length - 1));
      return;
    }
    if (hasMoreProp && onRequestMore && !isPendingMore) {
      setIsPendingMore(true);
      Promise.resolve(onRequestMore()).catch(() => setIsPendingMore(false));
    }
  }, [currentIndex, images.length, hasMoreProp, onRequestMore, isPendingMore]);

  const onSelect = useCallback(
    (i: number) => {
      setCurrentIndex(Math.min(Math.max(i, 0), Math.max(images.length - 1, 0)));
    },
    [images.length]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!hasNav) return;
    if (e.key === "ArrowLeft") {
      if (canGoPrev) {
        e.preventDefault();
        goPrev();
      }
    } else if (e.key === "ArrowRight") {
      if (canGoNext) {
        e.preventDefault();
        goNext();
      }
    }
  }

  const currentImage = images[currentIndex] ?? images[0];
  const LeafComponent = LAYOUT_COMPONENTS[layout];
  const closeVariant: "scrim" | "brand" = SCRIM_LAYOUTS.has(layout) ? "scrim" : "brand";
  const counterText = counterTemplate
    .replace("{current}", String(currentIndex + 1))
    .replace("{total}", String(total));

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: BACKDROP_BY_LAYOUT[layout],
          }}
        />
        <DialogPrimitive.Popup
          aria-label={currentImage?.title || currentImage?.alt || fullSizeAlt}
          onKeyDown={handleKeyDown}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 201,
            display: "flex",
            // Re-apply brand vars: the Portal escapes the page wrapper that sets
            // them (same reason ContactModal does this). No brandVars means no
            // per-tenant color here — the var(--pf-color-*, <literal>) fallbacks
            // already on every leaf are the correct degradation, not a second
            // inferred source of truth.
            ...(brandVars as CSSProperties),
          }}
        >
          <style>{MODAL_STYLES}</style>
          <FloatingCloseButton onClick={onClose} label={closeLabel} variant={closeVariant} />
          {currentImage ? (
            <LeafComponent
              image={currentImage}
              images={images}
              index={currentIndex}
              total={total}
              hasNav={hasNav}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              isPendingMore={pendingMore}
              onPrev={goPrev}
              onNext={goNext}
              onSelect={onSelect}
              onClose={onClose}
              closeLabel={closeLabel}
              fullSizeAlt={fullSizeAlt}
              prevLabel={prevLabel}
              nextLabel={nextLabel}
              counterText={counterText}
              filmstripLabel={filmstripLabel}
            />
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
