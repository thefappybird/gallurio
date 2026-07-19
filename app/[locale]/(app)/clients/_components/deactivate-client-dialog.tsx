"use client";

import { useTranslations } from "next-intl";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deactivateClientAction } from "@/lib/actions/clients";
import { useGuardedAction } from "@/hooks/use-guarded-action";
import { useActionError } from "@/lib/i18n/actionError";

type Props = {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function DeactivateClientDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const t = useTranslations("app.clients");
  const errMsg = useActionError();

  const { loading, trigger: triggerDeactivate } = useGuardedAction(
    async () => {
      const id_toast = toast.loading(t("toasts.deactivating"));
      const result = await deactivateClientAction(clientId);
      if ("error" in result) {
        // Error surfaced via toast; keep the dialog open so the user can retry.
        toast.error(errMsg(result.error), { id: id_toast });
        return;
      }
      toast.success(t("form.updateSuccess"), { id: id_toast });
      onSuccess();
      onOpenChange(false);
    }
  );

  function handleConfirm() {
    void triggerDeactivate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex max-h-[calc(100dvh-2rem)] sm:max-w-md flex-col gap-0 p-0">
        <div className="flex min-h-0 flex-1 items-start gap-3 overflow-y-auto border-b border-border px-4 py-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
            <AlertCircleIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>{t("deactivate.title")}</DialogTitle>
            <span className="truncate text-lg font-semibold text-foreground">{clientName}</span>
            <p className="text-sm text-muted-foreground">{t("deactivate.body")}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 px-4 py-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="min-h-11 sm:min-h-0"
          >
            {t("deactivate.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            loading={loading}
            className="min-h-11 sm:min-h-0"
          >
            {t("deactivate.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
