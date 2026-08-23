"use client";

import { useEffect, useState, type RefObject } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import type { PickerItem } from "./types";

export const IMAGE_META_ALT_MAX = 300;

/**
 * Fully resolved copy the dialog renders — no i18n call inside the component
 * itself, so the same dialog works both inside the app tree (has
 * NextIntlClientProvider) and inside the Puck field panel (does not, see
 * MediaPicker.tsx's `L` object). Callers resolve their own strings.
 */
export type ImageMetaLabels = {
  title: string;
  altLabel: string;
  altHelp: string;
  altPlaceholder: string;
  counter: (count: number, max: number) => string;
  save: string;
  saving: string;
  cancel: string;
  savedToast: string;
  /** Maps a server error code (or null for a network/unknown failure) to a display string. */
  errorMessage: (code: string | null) => string;
};

export function ImageMetaDialog({
  item,
  open,
  onOpenChange,
  onSaved,
  labels,
  triggerRef,
}: {
  item: PickerItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: PickerItem) => void;
  labels: ImageMetaLabels;
  /** The pencil button that opened this dialog — restores focus there on close (see `finalFocus` below). */
  triggerRef?: RefObject<HTMLElement | null>;
}) {
  const [altText, setAltText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: resets local state for the item being edited each time the dialog opens
      setAltText(item?.altText ?? "");
      setError(null);
      setSaving(false);
    }
  }, [open, item]);

  // This dialog is always mounted nested inside another dialog (the Photos
  // manager or the MediaPicker), inside the portfolio editor. The editor's
  // global Puck-hotkey guard (EditorShell.tsx's `interceptPuckHotkeys`) is a
  // document-level, capture-phase keydown listener that swallows Escape (and
  // other Puck shortcuts) via stopImmediatePropagation whenever the event
  // target is a text input/textarea — which our alt-text field always is. It
  // mounts once with the editor shell, ahead of this dialog, so any listener
  // we register on `document` fires too late to ever see the event. `window`
  // captures before `document` does, so a capture-phase listener there lets
  // us dismiss on Escape without touching that shared, editor-wide guard.
  useEffect(() => {
    if (!open) return;
    function onWindowKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || saving) return;
      e.stopPropagation();
      onOpenChange(false);
    }
    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
  }, [open, saving, onOpenChange]);

  async function handleSave() {
    if (!item || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/gallery/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data && typeof data.error === "string" ? data.error : null;
        setError(labels.errorMessage(code));
        setSaving(false);
        return;
      }
      toast.success(labels.savedToast);
      onSaved(data as PickerItem);
      setSaving(false);
      onOpenChange(false);
    } catch {
      setError(labels.errorMessage(null));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm" finalFocus={triggerRef}>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
        </DialogHeader>

        {item && (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.thumbUrl}
              alt=""
              className="size-16 shrink-0 overflow-hidden border border-border object-cover"
            />
            <FormField
              className="min-w-0 flex-1"
              label={labels.altLabel}
              error={error ?? undefined}
              hint={
                <span className="flex flex-col gap-0.5">
                  <span>{labels.altHelp}</span>
                  {/* Live only near/over the limit — announcing on every keystroke drowns the rest of the dialog. */}
                  <span aria-live={IMAGE_META_ALT_MAX - altText.length <= 20 ? "polite" : undefined}>
                    {labels.counter(altText.length, IMAGE_META_ALT_MAX)}
                  </span>
                </span>
              }
            >
              {/* Destructure rather than spread: FieldA11y also carries `errorId`,
                  which is caller metadata, not a DOM attribute. */}
              {({ id, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedby }) => (
                <Textarea
                  id={id}
                  aria-invalid={ariaInvalid}
                  aria-describedby={ariaDescribedby}
                  autoFocus
                  value={altText}
                  placeholder={labels.altPlaceholder}
                  maxLength={IMAGE_META_ALT_MAX}
                  disabled={saving}
                  onChange={(e) => setAltText(e.target.value)}
                />
              )}
            </FormField>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {labels.cancel}
          </Button>
          <Button type="button" onClick={handleSave} loading={saving} disabled={saving}>
            {saving ? labels.saving : labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
