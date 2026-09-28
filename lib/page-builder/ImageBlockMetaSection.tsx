"use client";

import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { galleryKeys } from "./galleryPicker/queryKeys";
import { useGalleryWorkspaceId } from "./galleryPicker/GalleryQueryProvider";
import type { PickerItem } from "./galleryPicker/types";

type LoadResult = { kind: "ready"; item: PickerItem } | { kind: "not-found" };

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
  const workspaceId = useGalleryWorkspaceId();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: galleryKeys.itemByAsset(workspaceId, assetId ?? ""),
    queryFn: async (): Promise<LoadResult> => {
      const response = await fetch(`/api/portfolio/gallery/items/by-asset/${encodeURIComponent(assetId!)}`);
      if (response.status === 404) return { kind: "not-found" };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { kind: "ready", item: (await response.json()) as PickerItem };
    },
    enabled: open && !!assetId,
  });

  if (query.data?.kind === "ready") {
    return (
      <ImageMetaWizard
        items={[query.data.item]}
        open={open}
        onOpenChange={onOpenChange}
        onSaved={(item) => {
          queryClient.setQueryData(galleryKeys.itemByAsset(workspaceId, assetId ?? ""), {
            kind: "ready",
            item,
          } satisfies LoadResult);
          onSaved?.(item);
        }}
        labels={labels}
        saveUrl={() => `/api/portfolio/gallery/items/by-asset/${encodeURIComponent(assetId ?? "")}`}
      />
    );
  }

  const visibleLoad: { kind: "loading" | "not-found" | "error" } = query.isError
    ? { kind: "error" }
    : query.data?.kind === "not-found"
      ? { kind: "not-found" }
      : { kind: "loading" };

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
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
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
