"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  body: string;
  discardLabel: string;
  saveLabel: string;
  saving?: boolean;
  error?: string | null;
  onDiscard: () => void;
  onSaveAndClose: () => void;
  onOpenChange: (open: boolean) => void;
};

/** Unsaved-changes guard with Discard (destructive) and Save & close (primary). */
export function UnsavedEditDialog({
  open, title, body, discardLabel, saveLabel, saving = false, error,
  onDiscard, onSaveAndClose, onOpenChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDiscard} disabled={saving}>
            {discardLabel}
          </Button>
          <Button type="button" onClick={onSaveAndClose} loading={saving} disabled={saving}>
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
