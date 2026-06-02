"use client";

import { useEffect, useState } from "react";
import {
  LayoutPanelLeftIcon,
  PaintbrushIcon,
  ImagesIcon,
  SlidersHorizontalIcon,
  EyeIcon,
  RocketIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Plain strings — Puck editor chrome is English (see RELEASE-CHECKLIST §4f).
// This overlay is editor chrome, so it follows the same English-only convention
// as the Puck canvas and the photos manager rather than the 5-locale rule.
const L = {
  skip: "Skip",
  back: "Back",
  next: "Next",
  finish: "Get started",
  dontShow: "Don't show again",
  stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
  reopenHint: "You can reopen this anytime from the Guide button.",
};

type Step = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: LayoutPanelLeftIcon,
    title: "Build across three pages",
    body: "Switch between Home and Gallery to lay out blocks, and Contact to preview the inquiry form visitors use to reach you. Drag blocks in from the left, click any block to edit it.",
  },
  {
    icon: SlidersHorizontalIcon,
    title: "Style any block",
    body: "Select a block and use the Style toolbar at the top of its settings — borders, shadows, spacing, background, fonts, and bold/italic/underline. It's the first section of every block's editor.",
  },
  {
    icon: ImagesIcon,
    title: "Add your photos",
    body: "Open Photos to create collections and upload images once. Gallery blocks pull from a collection; Hero and CTA backgrounds can use any single photo.",
  },
  {
    icon: PaintbrushIcon,
    title: "Set your palette & template",
    body: "Theme controls your five brand colors and fonts — every block's Style options pull from that palette. Templates swaps your whole starter layout if you want a different look.",
  },
  {
    icon: EyeIcon,
    title: "Preview on every device",
    body: "Use the Desktop / Tablet / Mobile toggle to check your layout at each size, then Preview to see the live page exactly as visitors will.",
  },
  {
    icon: RocketIcon,
    title: "Publish when you're ready",
    body: "Your edits autosave as a draft. Hit Publish to push them live to your public page. You can keep editing and republish anytime.",
  },
];

/**
 * First-run guide that overlays the editor (a README-style walkthrough). Shown
 * automatically until the owner dismisses it with "Don't show again" (persisted
 * to the workspace), or finishes/closes for the session. Reopened on demand via
 * the editor's Guide button.
 */
export function PortfolioGuideOverlay({
  open,
  onClose,
  onDontShowAgain,
}: {
  open: boolean;
  onClose: () => void;
  onDontShowAgain: () => void;
}) {
  const [step, setStep] = useState(0);

  // Always start at the beginning when the guide (re)opens.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="flex-row items-start gap-3 border-b border-border px-4 py-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center border border-border bg-muted text-foreground">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{L.stepOf(step + 1, STEPS.length)}</span>
            <DialogTitle className="leading-tight">{current.title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{current.body}</p>

          {/* Progress dots */}
          <div className="mt-4 flex items-center gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 transition-colors",
                  i <= step ? "bg-foreground" : "bg-muted"
                )}
              />
            ))}
          </div>

          {isLast && <p className="mt-3 text-xs text-muted-foreground">{L.reopenHint}</p>}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDontShowAgain}>
            {L.dontShow}
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                {L.back}
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {L.skip}
              </Button>
            )}
            {isLast ? (
              <Button type="button" size="sm" onClick={onClose}>
                {L.finish}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)}>
                {L.next}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
