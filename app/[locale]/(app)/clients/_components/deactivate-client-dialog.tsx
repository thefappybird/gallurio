"use client";

import { useState } from "react";
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
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const result = await deactivateClientAction(clientId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(t("form.updateSuccess"));
        onSuccess();
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex max-w-md flex-col gap-0 p-0">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
            <AlertCircleIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>{t("deactivate.title")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{clientName}</span>{" "}
              {t("deactivate.body")}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 px-4 py-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("deactivate.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "…" : t("deactivate.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
