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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Failing test driving next change:
// FAIL UnsavedChangesDialog > renders a role=alert error above Save and disables Save when nameError is set
// TestingLibraryElementError: Unable to find an accessible element with the role "alert"

export function UnsavedChangesDialog({
  open,
  saving,
  onSave,
  onDiscard,
  onCancel,
  name,
  onNameChange,
  nameLabel = "Name",
  nameError,
  title = "Save your changes?",
  body = "You have unsaved changes on this draft. Switching now will lose them unless you save.",
}: {
  open: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  name?: string;
  onNameChange?: (next: string) => void;
  nameLabel?: string;
  nameError?: string | null;
  title?: string;
  body?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (!next && !saving ? onCancel() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>

        {name !== undefined && onNameChange !== undefined && (
          <div className="flex flex-col gap-1.5 py-1">
            <Label htmlFor="unsaved-dialog-name">{nameLabel}</Label>
            <Input
              id="unsaved-dialog-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              aria-invalid={!!nameError}
              disabled={saving}
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Keep editing
          </Button>
          <Button type="button" variant="outline" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <div className="flex flex-col items-stretch gap-1">
            {nameError && (
              <p role="alert" className="text-xs text-destructive">
                {nameError}
              </p>
            )}
            <Button
              type="button"
              onClick={onSave}
              loading={saving}
              disabled={saving || !!nameError}
            >
              Save changes
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
