"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, CopyIcon } from "lucide-react";
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
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  publicUrl: string;
};

export function PublishDialog({ open, onOpenChange, onConfirm, publicUrl }: Props) {
  const t = useTranslations("app.pageBuilder.editor.publishDialog");
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function confirm() {
    setPublishing(true);
    try {
      await onConfirm();
    } finally {
      setPublishing(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border border-border bg-muted/30 p-2 text-sm">
          <span className="flex-1 truncate text-muted-foreground">{publicUrl}</span>
          <Button type="button" size="sm" variant="ghost" onClick={copyLink} aria-label={t("copyLink")}>
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            <span className="ml-1">{copied ? t("copied") : t("copyLink")}</span>
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={confirm} loading={publishing}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
