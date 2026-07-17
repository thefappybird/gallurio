"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, CopyIcon, DownloadIcon, PencilIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import QRCode from "qrcode";
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
import { CollapsibleDrawer } from "@/components/ui/collapsible-drawer";
import { useSlugAvailability } from "@/hooks/useSlugAvailability";
import { SlugStatusIndicator } from "@/components/app/slug-status-indicator";
import { portfolioPublicUrl } from "@/lib/portfolio/publicUrl";
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  publicUrl: string;
  currentSlug: string;
  /** A never-published workspace must verify its provisional URL before first publish. */
  hasBeenPublished: boolean;
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
  hasBeenPublished,
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
  const [editingSlug, setEditingSlug] = useState(!hasBeenPublished);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [debouncedSlugInput, setDebouncedSlugInput] = useState(currentSlug);
  const livePublicUrl =
    slugInput === currentSlug ? publicUrl : portfolioPublicUrl(slugInput || currentSlug);

  // Generate the QR code client-side whenever the public URL changes while open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toDataURL(livePublicUrl, { width: 160, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [livePublicUrl, open]);

  // Reset slug input and save state when the dialog opens or currentSlug changes.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: resets local slug state when the dialog opens, syncing the current slug prop into editable state
      setSlugInput(currentSlug);
      setDebouncedSlugInput(currentSlug);
      setSlugSaveState("idle");
      setSlugSaveError(null);
      setEditingSlug(!hasBeenPublished);
    }
  }, [open, currentSlug, hasBeenPublished]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlugInput(slugInput), 250);
    return () => clearTimeout(timer);
  }, [slugInput]);

  const { status: slugStatus } = useSlugAvailability(
    debouncedSlugInput,
    currentSlug,
    !hasBeenPublished,
  );

  const rawSlugChanged = slugInput !== currentSlug;
  const slugChanged = debouncedSlugInput !== currentSlug;
  const slugSaveEnabled =
    rawSlugChanged && slugChanged && slugStatus === "available" && slugSaveState !== "saving";

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
      setEditingSlug(false);
      setTimeout(() => setSlugSaveState("idle"), 2000);
    }
  }

  function resetSlug() {
    setSlugInput(currentSlug);
    setDebouncedSlugInput(currentSlug);
    setSlugSaveState("idle");
    setSlugSaveError(null);
  }

  function closeSlugEditor() {
    resetSlug();
    setEditingSlug(false);
  }

  async function confirm() {
    setPublishing(true);
    try {
      await onConfirm();
    } finally {
      setPublishing(false);
    }
  }

  const publishDisabled =
    publishing ||
    (editingSlug &&
      (hasBeenPublished ||
        slugStatus !== "available" ||
        (rawSlugChanged && slugSaveState !== "saved")));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(livePublicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${currentSlug || "portfolio"}-qr.png`;
    a.click();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>

        {/* URL editor */}
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="publish-dialog-slug">{t("slugLabel")}</Label>
          <div className="flex min-w-0 max-w-full items-center overflow-hidden border border-border bg-background">
            {editingSlug ? (
              <Input
                id="publish-dialog-slug"
                className="basis-0 min-w-0 flex-1 border-0 shadow-none focus-visible:ring-0"
                value={slugInput}
                onChange={(e) => {
                  setSlugInput(e.target.value.toLowerCase().trim());
                  setSlugSaveState("idle");
                  setSlugSaveError(null);
                }}
                aria-describedby="publish-dialog-slug-status publish-dialog-full-url"
              />
            ) : (
              <p id="publish-dialog-slug" className="min-w-0 flex-1 truncate px-3 text-sm">
                {currentSlug}
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="shrink-0"
              onClick={copyLink}
              aria-label={t("copyLink")}
            >
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            </Button>
            {editingSlug && rawSlugChanged ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  disabled={slugSaveState === "saving"}
                  onClick={closeSlugEditor}
                  aria-label={t("cancel")}
                  title={t("cancel")}
                >
                  <RotateCcwIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  disabled={!slugSaveEnabled}
                  loading={slugSaveState === "saving"}
                  onClick={() => void saveSlug()}
                  aria-label={t("slugSave")}
                  title={t("slugSave")}
                >
                  <SaveIcon className="size-4" />
                </Button>
              </>
            ) : editingSlug ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={closeSlugEditor}
                aria-label={t("cancel")}
                title={t("cancel")}
              >
                <RotateCcwIcon className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={() => setEditingSlug(true)}
                aria-label={t("slugEdit")}
                title={t("slugEdit")}
              >
                <PencilIcon className="size-4" />
              </Button>
            )}
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
                status={editingSlug && (!hasBeenPublished || rawSlugChanged) ? slugStatus : "idle"}
                t={t}
              />
            )}
          </div>
          <p
            id="publish-dialog-full-url"
            className="scrollbar-inline-subtle max-w-full overflow-x-auto whitespace-nowrap text-sm text-muted-foreground"
          >
            {livePublicUrl}
          </p>
        </div>

        <CollapsibleDrawer title="QR" defaultOpen={false}>
          <div className="flex flex-col items-center justify-center gap-3 p-2">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- client-generated data URL, not an optimizable asset
              <img
                src={qrDataUrl}
                alt={t("qrCodeAlt")}
                width={96}
                height={96}
                className="size-24 shrink-0"
              />
            ) : (
              <div className="size-24 shrink-0 animate-pulse bg-muted" />
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={!qrDataUrl}
              onClick={downloadQr}
            >
              <DownloadIcon className="size-4" />
              <span className="ms-1">{t("downloadQr")}</span>
            </Button>
          </div>
        </CollapsibleDrawer>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={publishing}
          >
            {t("cancel")}
          </Button>
          <Button type="button" onClick={confirm} loading={publishing} disabled={publishDisabled}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
