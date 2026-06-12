"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const L = {
  title: "Save your changes?",
  body: "You have unsaved changes on this draft. Switching now will lose them unless you save.",
  save: "Save changes",
  discard: "Discard",
  cancel: "Keep editing",
};

export function UnsavedChangesDialog({
  open,
  saving,
  onSave,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (!next && !saving ? onCancel() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{L.title}</AlertDialogTitle>
          <AlertDialogDescription>{L.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            {L.cancel}
          </Button>
          <Button type="button" variant="outline" onClick={onDiscard} disabled={saving}>
            {L.discard}
          </Button>
          <Button type="button" onClick={onSave} loading={saving} disabled={saving}>
            {L.save}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
