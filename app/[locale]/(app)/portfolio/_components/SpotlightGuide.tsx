"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useElementRect, type ElementRect } from "./useElementRect";
import { useIsRtl } from "@/lib/i18n/rtl";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SpotlightStep = {
  id: string;
  /**
   * i18n key suffix used to look up step.title / step.body in the guide
   * namespace. When omitted (e.g. ad-hoc test fixtures), the literal
   * `title`/`body` fields are rendered as-is.
   */
  slug?: string;
  anchorId?: string;
  /**
   * Optional second region highlighted alongside the primary anchor.
   * The tooltip still positions relative to the primary anchor.
   */
  secondaryAnchorId?: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
  /** When true the highlighted element is interactive; parent tracks satisfaction. */
  gated?: boolean;
  /**
   * Drag-interaction step where the drop target would otherwise be blocked.
   * WITHOUT a `secondaryAnchorId`, ALL overlay layers are pointer-events:none so
   * the user can drag freely across the whole viewport. WITH a `secondaryAnchorId`
   * (e.g. drag from the blocks panel to the canvas), interaction is CONFINED:
   * blockers tile the perimeter of the two cutouts' union so the surrounding
   * chrome is unclickable, while both highlighted regions stay live for the drag.
   */
  passthrough?: boolean;
};

export type SpotlightGuideProps = {
  open: boolean;
  steps: SpotlightStep[];
  stepIndex: number;
  onStepChange: (next: number) => void;
  /** True when the current gated step's condition has been satisfied. */
  gateSatisfied: boolean;
  onSkip: (dontShowAgain: boolean) => void;
  onFinish: (dontShowAgain: boolean) => void;
  /**
   * Optional scope element for anchor queries. When the guide runs inside a
   * SandboxEditorGuide overlay that coexists with the real editor shell, both
   * shells render the same `data-tour-id` attributes. Passing the sandbox
   * container element here scopes `useElementRect`'s querySelector to that
   * subtree, ensuring the cutout targets the correct (guide's own) element.
   */
  queryRoot?: Element | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

/** Padding (px) added around the anchor element's bounding rect for the cutout. */
const CUTOUT_PADDING = 6;
/** Minimum gap (px) between the tooltip edge and the viewport. */
const VIEWPORT_MARGIN = 12;
/** Approximate tooltip dimensions used to keep it on-screen before paint. */
const TOOLTIP_W = 320;
const TOOLTIP_H = 200;

// ─── Geometry helpers ────────────────────────────────────────────────────────

type Position = { top: number; left: number };

/**
 * Calculate the tooltip's top/left so it sits next to the cutout rect
 * on the preferred side, clamped to stay within the viewport.
 */
export function calcTooltipPosition(
  rect: ElementRect,
  placement: SpotlightStep["placement"] = "bottom",
  vpW: number,
  vpH: number,
  isRtl = false
): Position {
  // The side a step prefers ("left"/"right") is direction-relative: in RTL the
  // visual sides swap. The top/left math below works in viewport coords, so
  // swapping the preference is all that's needed to mirror the tooltip.
  if (isRtl) {
    if (placement === "left") placement = "right";
    else if (placement === "right") placement = "left";
  }

  const pad = CUTOUT_PADDING;
  const margin = VIEWPORT_MARGIN;
  const w = TOOLTIP_W;
  const h = TOOLTIP_H;

  let top = 0;
  let left = 0;

  // Preferred positions relative to the cutout rect (padded)
  const above = rect.top - pad - h - margin;
  const below = rect.bottom + pad + margin;
  const toLeft = rect.left - pad - w - margin;
  const toRight = rect.right + pad + margin;

  // Horizontal center with the anchor
  const hCenter = rect.left + rect.width / 2 - w / 2;
  // Vertical center with the anchor
  const vCenter = rect.top + rect.height / 2 - h / 2;

  switch (placement) {
    case "top":
      top = above >= margin ? above : below;
      left = hCenter;
      break;
    case "bottom":
      top = below + h <= vpH - margin ? below : above;
      left = hCenter;
      break;
    case "left":
      top = vCenter;
      left = toLeft >= margin ? toLeft : toRight;
      break;
    case "right":
      top = vCenter;
      left = toRight + w <= vpW - margin ? toRight : toLeft;
      break;
    default:
      top = below + h <= vpH - margin ? below : above;
      left = hCenter;
  }

  // Clamp to viewport
  top = Math.max(margin, Math.min(top, vpH - h - margin));
  left = Math.max(margin, Math.min(left, vpW - w - margin));

  return { top, left };
}

// ─── SVG Cutout Dim ──────────────────────────────────────────────────────────

/**
 * Renders the full-screen dim with a rectangular cutout hole using an SVG
 * clip-path approach (a filled rect minus a smaller rect).
 *
 * When `gated` is true, pointer-events are disabled on the cutout region so
 * clicks pass through to the element below; the scrim still blocks elsewhere.
 *
 * When `passthrough` is true the drag is unblocked: with no secondary cutout
 * ALL overlay layers are pointer-events:none (drag anywhere); with a secondary
 * cutout the drag is CONFINED — perimeter blockers around the two cutouts' union
 * keep the surrounding chrome unclickable while both holes stay live. The dim is
 * still rendered for visual context either way.
 *
 * When `secondaryRect` is provided, a second transparent hole is punched in
 * the mask alongside the primary cutout (tooltip positioning is unaffected —
 * it stays relative to the primary rect).
 */
function DimWithCutout({
  rect,
  secondaryRect,
  gated,
  passthrough,
  suppressHole,
}: {
  rect: ElementRect | null;
  secondaryRect: ElementRect | null;
  gated: boolean;
  passthrough: boolean;
  suppressHole: boolean;
}) {
  const hasCutout = !suppressHole && rect !== null && (rect.width > 0 || rect.height > 0);
  const hasSecondaryCutout = secondaryRect !== null && (secondaryRect.width > 0 || secondaryRect.height > 0);
  const pad = CUTOUT_PADDING;

  const cutoutX = hasCutout ? rect!.left - pad : 0;
  const cutoutY = hasCutout ? rect!.top - pad : 0;
  const cutoutW = hasCutout ? rect!.width + pad * 2 : 0;
  const cutoutH = hasCutout ? rect!.height + pad * 2 : 0;

  const secCutoutX = hasSecondaryCutout ? secondaryRect!.left - pad : 0;
  const secCutoutY = hasSecondaryCutout ? secondaryRect!.top - pad : 0;
  const secCutoutW = hasSecondaryCutout ? secondaryRect!.width + pad * 2 : 0;
  const secCutoutH = hasSecondaryCutout ? secondaryRect!.height + pad * 2 : 0;

  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 9990 }}
    >
      <defs>
        <mask id="spotlight-mask">
          {/* White = visible (the dim) */}
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {/* Black = transparent (the primary hole) */}
          {hasCutout && (
            <rect
              x={cutoutX}
              y={cutoutY}
              width={cutoutW}
              height={cutoutH}
              fill="black"
              rx={4}
            />
          )}
          {/* Black = transparent (the secondary hole) */}
          {hasSecondaryCutout && (
            <rect
              x={secCutoutX}
              y={secCutoutY}
              width={secCutoutW}
              height={secCutoutH}
              fill="black"
              rx={4}
            />
          )}
        </mask>
      </defs>

      {/* The dim layer, with the hole cut out */}
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.6)"
        mask="url(#spotlight-mask)"
      />

      {/* Transparent interaction-blocking layer over everything EXCEPT the cutout.
          Rendered ONLY for passive steps (advance via Next), to keep the user from
          clicking the dimmed UI while reading.
          Skipped for `passthrough` steps (drag needs free pointer access) AND for
          `gated` steps: a gated step asks the user to act on the real UI, so the
          dim is visual-only and ALL clicks pass through. Blocking everything except
          the cutout made gated completion depend on a pixel-perfect anchor rect —
          if the rect was off, the blocker covered the real control and ate the
          click. Visual-only dim makes the gate robust regardless of rect accuracy. */}
      {!passthrough && !gated && (hasCutout ? (
        <>
          {/* Block: above cutout */}
          <rect
            className="pointer-events-auto"
            x="0"
            y="0"
            width="100%"
            height={cutoutY}
            fill="transparent"
          />
          {/* Block: left of cutout */}
          <rect
            className="pointer-events-auto"
            x="0"
            y={cutoutY}
            width={cutoutX}
            height={cutoutH}
            fill="transparent"
          />
          {/* Block: right of cutout */}
          <rect
            className="pointer-events-auto"
            x={cutoutX + cutoutW}
            y={cutoutY}
            width="100%"
            height={cutoutH}
            fill="transparent"
          />
          {/* Block: below cutout */}
          <rect
            className="pointer-events-auto"
            x="0"
            y={cutoutY + cutoutH}
            width="100%"
            height="100%"
            fill="transparent"
          />
          {/* Cutout itself: only blocks interaction on passive steps */}
          {!gated && (
            <rect
              className="pointer-events-auto"
              x={cutoutX}
              y={cutoutY}
              width={cutoutW}
              height={cutoutH}
              fill="transparent"
            />
          )}
        </>
      ) : (
        /* No cutout: block entire viewport */
        <rect className="pointer-events-auto" x="0" y="0" width="100%" height="100%" fill="transparent" />
      ))}

      {/* Confined-drag step (passthrough WITH a secondary cutout, e.g. drag a
          block from the panel to the canvas): block interaction everywhere
          EXCEPT the two highlighted regions, so the surrounding chrome (toolbar,
          tabs, properties panel) is unclickable while the drag still works. The
          blockers tile the perimeter of the two cutouts' UNION — they never
          cover either hole, so the grab source and drop target stay live.
          ponytail: the gap between the two holes (inside the union) is left
          interactive too; it's empty editor gutter, and blocking it precisely
          would risk eating the drag for the sake of a non-clickable strip. */}
      {passthrough && hasCutout && hasSecondaryCutout && (() => {
        const ux = Math.min(cutoutX, secCutoutX);
        const uy = Math.min(cutoutY, secCutoutY);
        const uRight = Math.max(cutoutX + cutoutW, secCutoutX + secCutoutW);
        const uBottom = Math.max(cutoutY + cutoutH, secCutoutY + secCutoutH);
        return (
          <>
            {/* Above the union */}
            <rect className="pointer-events-auto" x="0" y="0" width="100%" height={Math.max(0, uy)} fill="transparent" />
            {/* Left of the union */}
            <rect className="pointer-events-auto" x="0" y={uy} width={Math.max(0, ux)} height={Math.max(0, uBottom - uy)} fill="transparent" />
            {/* Right of the union */}
            <rect className="pointer-events-auto" x={uRight} y={uy} width="100%" height={Math.max(0, uBottom - uy)} fill="transparent" />
            {/* Below the union */}
            <rect className="pointer-events-auto" x="0" y={uBottom} width="100%" height="100%" fill="transparent" />
          </>
        );
      })()}
    </svg>
  );
}

// ─── Skip Confirm Modal ───────────────────────────────────────────────────────

type SkipConfirmModalProps = {
  onBack: () => void;
  onDontShow: () => void;
  onSkip: () => void;
};

function SkipConfirmModal({ onBack, onDontShow, onSkip }: SkipConfirmModalProps) {
  const tg = useTranslations("app.pageBuilder.editor.tour");
  const backRef = useRef<HTMLButtonElement | null>(null);

  // Focus the Back button when the modal mounts
  useEffect(() => {
    const id = setTimeout(() => {
      backRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") onBack();
    },
    [onBack]
  );

  // Mirrors the shared AlertDialog/UnsavedChangesDialog pattern (icon + title +
  // description in a bordered header, actions in a right-aligned footer) so the
  // tour's skip warning is visually consistent with the editor's save/discard
  // dialogs. It is hand-rolled rather than reusing <AlertDialog> because the
  // tour runs in a high z-index portal (z-9990+) and the Dialog primitives are
  // pinned to z-50, which would render this behind the spotlight overlay.
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        className="fixed inset-0"
        style={{ zIndex: 9994, background: "rgba(0,0,0,0.4)" }}
      />
      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tg("skipConfirm.heading")}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "fixed left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-0",
          "overflow-hidden rounded-[var(--radius-surface)] bg-popover text-popover-foreground",
          "shadow-lg ring-1 ring-foreground/10 outline-none"
        )}
        style={{ zIndex: 9995, width: 448, maxWidth: "calc(100vw - 24px)" }}
      >
        {/* Header — icon + title + description */}
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
            <AlertCircleIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="font-heading text-base font-medium leading-none text-foreground">
              {tg("skipConfirm.heading")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tg("skipConfirm.body")}
            </p>
          </div>
        </div>
        {/* Footer — Back (cancel) · Don't show again · Skip Guide */}
        <div className="flex flex-col-reverse gap-2 px-4 py-3 sm:flex-row sm:justify-end">
          <Button
            ref={backRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
          >
            {tg("skipConfirm.back")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDontShow}
          >
            {tg("skipConfirm.dontShow")}
          </Button>
          <Button type="button" size="sm" onClick={onSkip}>
            {tg("skipConfirm.skip")}
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Tooltip Card ────────────────────────────────────────────────────────────

type TooltipCardProps = {
  step: SpotlightStep;
  stepIndex: number;
  total: number;
  position: Position;
  loading: boolean;
  gateSatisfied: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: (dontShowAgain: boolean) => void;
  onFinish: (dontShowAgain: boolean) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  cardRef: React.RefObject<HTMLDivElement | null>;
};

function TooltipCard({
  step,
  stepIndex,
  total,
  position,
  loading,
  gateSatisfied,
  onBack,
  onNext,
  onSkip,
  onFinish,
  onKeyDown,
  cardRef,
}: TooltipCardProps) {
  const tg = useTranslations("app.pageBuilder.editor.tour");
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const isGated = step.gated === true;
  // On an actionable (gated) step, Next is hidden until the user performs the
  // action. Once satisfied (incl. when stepping Back onto a completed step) the
  // Next button reappears so the user is never stuck.
  const hideNext = isGated && !gateSatisfied && !isLast;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-label={step.slug ? tg(`steps.${step.slug}.title`) : step.title}
      aria-busy={loading || undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn(
        "fixed flex flex-col gap-3 rounded-[var(--radius-surface)]",
        "border border-border bg-popover text-popover-foreground",
        "p-4 shadow-lg outline-none"
      )}
      style={{
        zIndex: 9991,
        top: position.top,
        left: position.left,
        width: TOOLTIP_W,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
      }}
    >
      {/* Header — always visible so the card stays recognisable while loading */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">
            {tg("progress", { n: stepIndex + 1, total })}
          </span>
          <p className="text-sm font-semibold leading-snug text-foreground">
            {step.slug ? tg(`steps.${step.slug}.title`) : step.title}
          </p>
        </div>
      </div>

      {loading ? (
        // While the next step's anchor is still settling, hold the card in
        // place and show a loading indicator instead of jumping the cutout to
        // a half-positioned state. Revealed once the anchor resolves.
        <div
          role="status"
          aria-label={tg("loading")}
          className="flex items-center justify-center py-8"
        >
          <span
            aria-hidden
            className="size-5 animate-spin rounded-full border-2 border-muted border-t-foreground"
          />
        </div>
      ) : (
        <>
          {/* Body */}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {step.slug ? tg(`steps.${step.slug}.body`) : step.body}
          </p>

          {/* Gated hint — visually prominent so users notice the call to action */}
          {isGated && (
            <div className="flex items-center gap-1.5 rounded-[var(--radius)] border border-dashed border-border px-2 py-1">
              {/* Pulsing dot: accent color + animation carry the "action needed" signal */}
              <span
                aria-hidden
                className="size-2 shrink-0 animate-pulse rounded-full bg-[color:var(--accent)]"
              />
              <p className="text-xs font-semibold text-foreground">{tg("tryIt")}</p>
            </div>
          )}

          {/* Progress bar */}
          <div className="flex items-center gap-0.5" aria-hidden>
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  i <= stepIndex ? "bg-foreground" : "bg-muted"
                )}
              />
            ))}
          </div>

          {/* Skip confirm modal (portaled) */}
          {showSkipConfirm && (
            <SkipConfirmModal
              onBack={() => setShowSkipConfirm(false)}
              onDontShow={() => onSkip(true)}
              onSkip={() => onSkip(false)}
            />
          )}

          {/* Footer — single row. Left: Back + Skip Guide (Skip takes Back's
              slot on the first step, where Back is absent). Right: Next/Finish. */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              {!isFirst && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={onBack}
                >
                  {tg("back")}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => setShowSkipConfirm(true)}
              >
                {tg("skip")}
              </Button>
            </div>

            {isLast ? (
              <Button
                type="button"
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => onFinish(true)}
              >
                {tg("finish")}
              </Button>
            ) : hideNext ? (
              // Actionable step, gate not yet satisfied: no Next — the "Try it…"
              // hint tells the user what to do; Back stays available.
              <span />
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={onNext}
              >
                {tg("next")}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * A controlled spotlight guide overlay that walks the user through steps,
 * highlighting real DOM elements via `[data-tour-id]` anchors.
 *
 * The component is Puck-agnostic: the parent is responsible for tracking gating
 * state and passing `gateSatisfied`. The engine auto-advances when a gated step
 * satisfies and handles Esc → skip.
 */
export function SpotlightGuide({
  open,
  steps,
  stepIndex,
  onStepChange,
  gateSatisfied,
  onSkip,
  onFinish,
  queryRoot,
}: SpotlightGuideProps) {
  const step = steps[stepIndex];
  const cardRef = useRef<HTMLDivElement | null>(null);
  const isRtl = useIsRtl();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Measure the active anchor element, scoped to queryRoot when provided to
  // avoid resolving to a sibling editor shell's element with the same tour id.
  const rect = useElementRect(open ? step?.anchorId : undefined, queryRoot);

  // Measure the secondary anchor (unconditional hook call; id is undefined when
  // the step has no secondaryAnchorId, which makes useElementRect return null).
  const secondaryRect = useElementRect(open ? step?.secondaryAnchorId : undefined, queryRoot);

  // Auto-advance when a gated step becomes satisfied *while the user stays on it*.
  // Must NOT fire when the step itself just changed (e.g. the user clicked Back
  // onto an already-satisfied gated step — the panel it opened is still open, so
  // gateSatisfied is true, but stepping back should not bounce them forward).
  const prevGateSatisfied = useRef(gateSatisfied);
  const prevStepIndex = useRef(stepIndex);
  useEffect(() => {
    const justChangedStep = prevStepIndex.current !== stepIndex;
    const wasUnsatisfied = !prevGateSatisfied.current;
    prevStepIndex.current = stepIndex;
    prevGateSatisfied.current = gateSatisfied;

    if (!open || !step?.gated) return;
    if (
      gateSatisfied &&
      wasUnsatisfied &&
      !justChangedStep &&
      stepIndex < steps.length - 1
    ) {
      onStepChange(stepIndex + 1);
    }
  }, [gateSatisfied, open, step, stepIndex, steps.length, onStepChange]);

  // Focus the tooltip card when the step changes
  useEffect(() => {
    if (!open) return;
    // Give the browser a tick to paint the portal before focusing
    const id = setTimeout(() => {
      cardRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(id);
  }, [open, stepIndex]);

  // ─── Step-change loading gate ────────────────────────────────────────────────
  // When the step changes to one that highlights an anchor that is NOT yet in
  // the DOM (e.g. its panel opens a moment later), hold the card in place
  // (frozen at its last position) showing a loading indicator until the anchor
  // mounts, then reveal the repositioned card + cutout. This replaces a
  // cross-fade: rather than animating through a half-positioned state (which
  // read as flickery), we wait for the anchor and snap straight to the final
  // position. `useElementRect` re-measures the new anchor synchronously on id
  // change, so an anchor that is already present positions correctly in the
  // same render — the gate keys off DOM PRESENCE (not pixel-perfect layout), so
  // a present-but-still-laying-out anchor reveals immediately with no spinner.
  const hasMeaningfulRect = rect !== null && (rect.width > 0 || rect.height > 0);

  const anchorPresent = (anchorId: string | undefined): boolean => {
    if (!anchorId || typeof document === "undefined") return false;
    const scope = queryRoot ?? document;
    return scope.querySelector(`[data-tour-id="${anchorId}"]`) !== null;
  };

  // The last position committed while NOT loading, so the card can hold there
  // (frozen) during a load instead of jumping. State (not a ref) because it is
  // read during render.
  const [committedPosition, setCommittedPosition] = useState<Position | null>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [trackedIndex, setTrackedIndex] = useState(stepIndex);
  if (trackedIndex !== stepIndex) {
    setTrackedIndex(stepIndex);
    // Only "load" when this step targets an anchor that hasn't mounted yet.
    const anchorId = steps[stepIndex]?.anchorId;
    setPendingIndex(anchorId && !anchorPresent(anchorId) ? stepIndex : null);
  }
  // Clear the gate as soon as the target anchor mounts.
  if (pendingIndex === stepIndex && anchorPresent(step?.anchorId)) {
    setPendingIndex(null);
  }
  const loading = pendingIndex === stepIndex;

  // Safety net: never spin forever if the anchor never resolves (e.g. it was
  // removed, or the step's panel failed to open).
  useEffect(() => {
    if (pendingIndex === null) return;
    const id = setTimeout(() => setPendingIndex(null), 600);
    return () => clearTimeout(id);
  }, [pendingIndex]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) onStepChange(stepIndex - 1);
  }, [stepIndex, onStepChange]);

  const handleNext = useCallback(() => {
    if (stepIndex < steps.length - 1) onStepChange(stepIndex + 1);
  }, [stepIndex, steps.length, onStepChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        onSkip(false);
      }
    },
    [onSkip]
  );

  if (!open || !step || !mounted) return null;

  const hasMeaningfulSecondaryRect = secondaryRect !== null && (secondaryRect.width > 0 || secondaryRect.height > 0);

  // Compute the live position from the current rect, but freeze to the last
  // committed position while loading so the card doesn't jump before the new
  // anchor resolves.
  const vpW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vpH = typeof window !== "undefined" ? window.innerHeight : 800;
  const livePosition: Position = hasMeaningfulRect
    ? calcTooltipPosition(rect!, step.placement, vpW, vpH, isRtl)
    : { top: vpH / 2 - TOOLTIP_H / 2, left: vpW / 2 - TOOLTIP_W / 2 };
  // Track the live position while not loading so a subsequent load can freeze
  // to it. Guarded so the render-phase update only fires when it actually moves.
  if (
    !loading &&
    (committedPosition?.top !== livePosition.top ||
      committedPosition?.left !== livePosition.left)
  ) {
    setCommittedPosition(livePosition);
  }
  const position = loading && committedPosition ? committedPosition : livePosition;

  return createPortal(
    <>
      <DimWithCutout
        rect={hasMeaningfulRect ? rect : null}
        secondaryRect={loading ? null : hasMeaningfulSecondaryRect ? secondaryRect : null}
        gated={step.gated === true}
        passthrough={step.passthrough === true}
        suppressHole={loading}
      />
      <TooltipCard
        step={step}
        stepIndex={stepIndex}
        total={steps.length}
        position={position}
        loading={loading}
        gateSatisfied={gateSatisfied}
        onBack={handleBack}
        onNext={handleNext}
        onSkip={onSkip}
        onFinish={onFinish}
        onKeyDown={handleKeyDown}
        cardRef={cardRef}
      />
    </>,
    document.body
  );
}
