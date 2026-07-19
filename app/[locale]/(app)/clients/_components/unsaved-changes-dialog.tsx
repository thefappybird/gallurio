"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};

export function UnsavedChangesDialog({ open, onKeepEditing, onDiscard }: Props) {
  const t = useTranslations("app.clients.unsaved");

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onKeepEditing()}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)]">
        <AlertDialogHeader className="min-h-0 flex-1 overflow-y-auto">
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepEditing}>{t("keep")}</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>{t("discard")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
