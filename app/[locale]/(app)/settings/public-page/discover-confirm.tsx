"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Confirmation shown when saving a Discover listing change on a live page.
 * Controlled by the caller, which stashes the form data until Confirm.
 */
export function DiscoverConfirmDialog({
  open,
  direction,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  direction: "list" | "unlist";
  onConfirm: () => void;
  onOpenChange: (next: boolean) => void;
}) {
  const t = useTranslations("app.settings.publicPage");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {direction === "list"
              ? t("discoverConfirm.listTitle")
              : t("discoverConfirm.unlistTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {direction === "list"
              ? t("discoverConfirm.listBody")
              : t("discoverConfirm.unlistBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 [&>button]:!flex-none">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("discoverConfirm.cancel")}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {t("discoverConfirm.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
