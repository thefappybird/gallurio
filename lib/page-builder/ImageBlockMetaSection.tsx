"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ImageMetaWizard,
  useImageWizardLabels,
} from "./galleryPicker/ImageMetaWizard";
import type { PickerItem } from "./galleryPicker/types";

type LoadState =
  | { kind: "idle" }
  | { kind: "ready"; key: string; item: PickerItem }
  | { kind: "not-found"; key: string }
  | { kind: "error"; key: string };

/**
 * Resolves an Image block's asset id, then hands editing to the same
 * ImageMetaWizard used by Photos & collections. This adapter owns only the
 * by-asset lookup and route; the fields, validation, steps and save behavior
 * deliberately live in one shared component.
 */
export function ImageBlockMetaSection({
  assetId,
  open,
  onOpenChange,
  onSaved,
}: {
  assetId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (item: PickerItem) => void;
}) {
  const t = useTranslations("app.pageBuilder.editor.imageBlockDetails");
  const labels = useImageWizardLabels();
  const [load, setLoad] = useState<LoadState>({ kind: "idle" });
  const [reloadToken, setReloadToken] = useState(0);
  const loadKey = `${assetId ?? ""}:${reloadToken}`;

  useEffect(() => {
    if (!open || !assetId) return;
    const controller = new AbortController();
    const key = `${assetId}:${reloadToken}`;
    fetch(`/api/portfolio/gallery/items/by-asset/${encodeURIComponent(assetId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          setLoad({ kind: "not-found", key });
          return;
        }
        if (!response.ok) {
          setLoad({ kind: "error", key });
          return;
        }
        setLoad({ kind: "ready", key, item: (await response.json()) as PickerItem });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ kind: "error", key });
      });
    return () => controller.abort();
  }, [assetId, open, reloadToken]);

  const visibleLoad = load.kind !== "idle" && load.key === loadKey ? load : ({ kind: "loading" } as const);

  if (visibleLoad.kind === "ready") {
    return (
      <ImageMetaWizard
        items={[visibleLoad.item]}
        open={open}
        onOpenChange={onOpenChange}
        onSaved={(item) => {
          setLoad({ kind: "ready", key: loadKey, item });
          onSaved?.(item);
        }}
        labels={labels}
        saveUrl={() => `/api/portfolio/gallery/items/by-asset/${encodeURIComponent(assetId ?? "")}`}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.heading}</DialogTitle>
        </DialogHeader>
        {!assetId ? (
          <p className="text-sm text-muted-foreground">{t("chooseImagePrompt")}</p>
        ) : visibleLoad.kind === "not-found" ? (
          <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        ) : visibleLoad.kind === "error" ? (
          <div role="alert" className="flex items-center justify-between gap-3">
            <p className="text-sm text-destructive">{t("loadError")}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
              {t("retry")}
            </Button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("loading")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
