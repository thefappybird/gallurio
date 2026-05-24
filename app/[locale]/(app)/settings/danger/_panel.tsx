"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  requestDataExportAction,
  deleteWorkspaceAction,
} from "../_actions";

export function DangerPanel({
  workspaceName,
  workspaceSlug,
}: {
  workspaceName: string;
  workspaceSlug: string;
}) {
  const t = useTranslations("app.settings.danger");
  const router = useRouter();

  const [exportPending, startExport] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deletePending, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleExport() {
    startExport(async () => {
      const result = await requestDataExportAction();
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(t("exportRequestedToast"));
      }
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteWorkspaceAction(typed);
      if (result?.error) {
        setDeleteError(result.error);
        return;
      }
      router.replace("/onboarding");
    });
  }

  function handleOpenChange(open: boolean) {
    if (!deletePending) {
      setDeleteOpen(open);
      if (!open) {
        setTyped("");
        setDeleteError(null);
      }
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Export section */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("exportSection")}</h2>
          <p className="text-sm text-muted-foreground">{t("exportHint")}</p>
        </div>
        <div>
          <Button
            variant="outline"
            disabled={exportPending}
            onClick={handleExport}
            className="min-h-11"
          >
            {exportPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("exportButton")}
          </Button>
        </div>
      </section>

      {/* Delete section */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold text-destructive">{t("deleteSection")}</h2>
          <p className="text-sm text-muted-foreground">{t("deleteHint")}</p>
        </div>
        <div>
          <Dialog open={deleteOpen} onOpenChange={handleOpenChange}>
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              className="min-h-11"
            >
              {t("deleteOpen")}
            </Button>
            <DialogContent showCloseButton={!deletePending}>
              <DialogHeader>
                <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
              </DialogHeader>

              <p className="text-sm text-muted-foreground">
                {t("deleteConfirmBody", { workspaceName })}
              </p>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delete-confirm">{t("deleteConfirmInput")}</Label>
                <Input
                  id="delete-confirm"
                  placeholder={workspaceSlug}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={deletePending}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              {deleteError && (
                <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {deleteError}
                </p>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={deletePending}
                  onClick={() => handleOpenChange(false)}
                >
                  {t("deleteCancel")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={typed.trim() !== workspaceSlug || deletePending}
                  onClick={handleDelete}
                >
                  {deletePending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("deleting")}
                    </>
                  ) : (
                    t("deleteConfirm")
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </div>
  );
}
