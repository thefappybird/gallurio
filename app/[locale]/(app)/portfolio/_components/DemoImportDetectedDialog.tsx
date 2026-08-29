"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Shown once when the real editor detects a saved Portfolio Maker demo
 * session in localStorage (see lib/page-builder/demoSession.ts). Both
 * choices wipe the demo's localStorage — the caller is responsible for that
 * (see EditorShell's handlers) so this modal can never appear a second time
 * for the same demo session, regardless of which button was pressed.
 */
export function DemoImportDetectedDialog({
  open,
  busy,
  onConfirm,
  onDiscard,
}: {
  open: boolean;
  /** True while the import server call is in flight. */
  busy: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("app.pageBuilder.editor.demoImportDialog");
  return (
    <AlertDialog open={open} onOpenChange={() => {}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onDiscard} disabled={busy}>
            {t("discard")}
          </Button>
          <Button type="button" onClick={onConfirm} loading={busy} disabled={busy}>
            {t("yes")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
