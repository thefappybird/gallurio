"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSlugAvailability } from "@/hooks/useSlugAvailability";
import { SlugStatusIndicator } from "@/components/app/slug-status-indicator";
import { portfolioUrlParts } from "@/lib/portfolio/publicUrl";
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  publicUrl: string;
  currentSlug: string;
  onSlugSaved: (newSlug: string) => void;
  /** Injected so the component stays server-action-free for tests. */
  onUpdateSlug: (slug: string) => Promise<{ ok: true; savedAt?: string } | { error: string }>;
};

export function PublishDialog({
  open,
  onOpenChange,
  onConfirm,
  publicUrl,
  currentSlug,
  onSlugSaved,
  onUpdateSlug,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor.publishDialog");
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [slugInput, setSlugInput] = useState(currentSlug);
  const [slugSaveState, setSlugSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [slugSaveError, setSlugSaveError] = useState<string | null>(null);

  // Reset slug input and save state when the dialog opens or currentSlug changes.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: resets local slug state when the dialog opens, syncing the current slug prop into editable state
      setSlugInput(currentSlug);
      setSlugSaveState("idle");
      setSlugSaveError(null);
    }
  }, [open, currentSlug]);

  const { status: slugStatus } = useSlugAvailability(slugInput, currentSlug);
  const urlParts = portfolioUrlParts(currentSlug);

  const slugChanged = slugInput !== currentSlug;
  const slugSaveEnabled =
    slugChanged && slugStatus === "available" && slugSaveState !== "saving";

  async function saveSlug() {
    setSlugSaveState("saving");
    setSlugSaveError(null);
    const result = await onUpdateSlug(slugInput);
    if ("error" in result) {
      setSlugSaveState("error");
      setSlugSaveError(
        result.error === "url_taken" ? t("slugUrlTaken") : t("slugError"),
      );
    } else {
      setSlugSaveState("saved");
      onSlugSaved(slugInput);
      setTimeout(() => setSlugSaveState("idle"), 2000);
    }
  }

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

        {/* Slug editor */}
        <div className="space-y-1.5">
          <Label htmlFor="publish-dialog-slug">{t("slugLabel")}</Label>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center border border-border bg-background">
              {urlParts.prefix && (
                <span className="shrink-0 truncate ps-2 text-sm text-muted-foreground">
                  {urlParts.prefix}
                </span>
              )}
              <Input
                id="publish-dialog-slug"
                className="min-w-0 flex-1 border-0 shadow-none focus-visible:ring-0"
                value={slugInput}
                onChange={(e) => {
                  setSlugInput(e.target.value.toLowerCase().trim());
                  setSlugSaveState("idle");
                  setSlugSaveError(null);
                }}
                aria-describedby="publish-dialog-slug-status"
              />
              {urlParts.suffix && (
                <span className="shrink-0 pe-2 text-sm text-muted-foreground">
                  {urlParts.suffix}
                </span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!slugSaveEnabled}
              loading={slugSaveState === "saving"}
              onClick={() => void saveSlug()}
            >
              {slugSaveState === "saved"
                ? t("slugSaved")
                : slugSaveState === "saving"
                  ? t("slugSaving")
                  : t("slugSave")}
            </Button>
          </div>
          <div id="publish-dialog-slug-status">
            {slugSaveError ? (
              <p
                aria-live="polite"
                aria-atomic="true"
                className="flex min-h-4 items-center gap-1 text-xs text-destructive"
              >
                {slugSaveError}
              </p>
            ) : (
              <SlugStatusIndicator
                status={slugChanged ? slugStatus : "idle"}
                t={t}
              />
            )}
          </div>
        </div>

        {/* Public URL display + copy */}
        <div className="flex min-w-0 items-center gap-2 border border-border bg-muted/30 p-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {publicUrl}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={copyLink}
            aria-label={t("copyLink")}
          >
            {copied ? (
              <CheckIcon className="size-4" />
            ) : (
              <CopyIcon className="size-4" />
            )}
            <span className="ms-1">{copied ? t("copied") : t("copyLink")}</span>
          </Button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={publishing}
          >
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
