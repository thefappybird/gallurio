"use client";

// Lightweight, demo-only image picker for the public Portfolio Maker demo
// (app/[locale]/portfolio-maker-demo). No collections, no server-backed listing,
// no drag-to-reorder — just this session's uploaded images (localStorage-backed)
// plus an upload button. Drop-in swap for SingleImageControl/MultiImageControl
// (lib/page-builder/galleryPicker/MediaField.tsx) in demo mode; never used by
// the real (authenticated) editor.

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, ImagePlusIcon, XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadDemoImage } from "@/lib/storage/uploadDemoImage.client";
import {
  readDemoImageLibrary,
  writeDemoImageLibrary,
  type DemoLibraryImage,
} from "@/lib/page-builder/demoSession";
import { useDemoPicker } from "@/lib/page-builder/demoPickerContext";
import type { MediaPickerSelection } from "@/lib/page-builder/galleryPicker/MediaPicker";

const IMAGE_CAP = 10;

type DialogProps =
  | {
      mode: "single";
      value: string;
      onChange: (v: string) => void;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }
  | {
      mode: "multi";
      value: MediaPickerSelection[];
      onChange: (v: MediaPickerSelection[]) => void;
      max?: number;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    };

function DemoImagePickerDialog(props: DialogProps) {
  const { mode, value, onChange, open, onOpenChange } = props;
  const max = mode === "multi" ? props.max : undefined;
  const t = useTranslations("app.portfolioMakerDemo");
  const ctx = useDemoPicker();
  const demoSessionId = ctx?.demoSessionId ?? "";
  const onImageCapHit = ctx?.onImageCapHit ?? (() => {});

  const [library, setLibrary] = useState<DemoLibraryImage[]>(() => readDemoImageLibrary(demoSessionId));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-read on open — another control instance may have uploaded since last close.
  // Render-time state adjustment (React's sanctioned "derive state from a prop
  // change" pattern — see DemoGateModal.tsx) instead of an effect, so opening
  // the dialog never renders one frame of stale data.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setLibrary(readDemoImageLibrary(demoSessionId));
  }

  const selection = mode === "multi" ? (Array.isArray(value) ? value : []) : [];
  const atMax = mode === "multi" && typeof max === "number" && selection.length >= max;

  function selectItem(item: DemoLibraryImage) {
    if (mode === "single") {
      onChange(item.publicId);
      onOpenChange(false);
      return;
    }
    const exists = selection.some((s) => s.id === item.id);
    if (exists) {
      onChange(selection.filter((s) => s.id !== item.id));
      return;
    }
    if (atMax) return;
    onChange([...selection, { id: item.id, publicId: item.publicId, width: item.width, height: item.height }]);
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const result = await uploadDemoImage(file, demoSessionId);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!result.ok) {
      if (result.error === "image_cap_reached") {
        onOpenChange(false);
        onImageCapHit();
        return;
      }
      setError(
        t(
          result.error === "rate_limited"
            ? "imagePicker.errorRateLimited"
            : result.error === "invalid_file"
              ? "imagePicker.errorInvalidFile"
              : "imagePicker.errorGeneric"
        )
      );
      return;
    }

    const item: DemoLibraryImage = {
      id: result.image.assetId,
      publicId: result.image.assetId,
      url: result.image.url,
      width: result.image.width,
      height: result.image.height,
    };
    const nextLibrary = [item, ...library];
    setLibrary(nextLibrary);
    writeDemoImageLibrary(demoSessionId, nextLibrary);
    selectItem(item);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "single" ? t("imagePicker.titleSingle") : t("imagePicker.titleMulti")}</DialogTitle>
          <DialogDescription>{t("counters.images", { count: library.length })}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/avif"
              className="sr-only"
              id="demo-image-picker-upload"
              onChange={(e) => void handleFiles(e.target.files)}
              disabled={uploading || library.length >= IMAGE_CAP}
            />
            <Button
              type="button"
              variant="outline"
              loading={uploading}
              disabled={uploading || library.length >= IMAGE_CAP}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlusIcon className="size-4" aria-hidden />
              {uploading ? t("imagePicker.uploading") : t("imagePicker.uploadButton")}
            </Button>
            {error && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          {library.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("imagePicker.empty")}</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2" aria-label={t("imagePicker.titleMulti")}>
              {library.map((item) => {
                const selected = mode === "single" ? value === item.publicId : selection.some((s) => s.id === item.id);
                const disabled = mode === "multi" && !selected && atMax;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      disabled={disabled}
                      onClick={() => selectItem(item)}
                      className={cn(
                        "relative aspect-square w-full overflow-hidden border-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40",
                        selected ? "border-brand" : "border-border"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt="" className="size-full object-cover" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("imagePicker.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DemoSingleImageControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("app.portfolioMakerDemo");
  const ctx = useDemoPicker();
  const demoSessionId = ctx?.demoSessionId ?? "";
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<DemoLibraryImage[]>(() => readDemoImageLibrary(demoSessionId));

  // Re-read on close — a selection just made inside the dialog may have
  // uploaded a new image. Render-time state adjustment, not an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setLibrary(readDemoImageLibrary(demoSessionId));
  }

  const thumb = value ? (library.find((i) => i.publicId === value)?.url ?? null) : null;

  return (
    <div className="flex items-center gap-3">
      <div className="relative size-14 shrink-0 overflow-hidden border border-border bg-muted">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
          </span>
        )}
      </div>
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-muted-foreground">{value ? t("imagePicker.selected") : t("imagePicker.none")}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ImagePlusIcon className="size-3.5" aria-hidden />
            {value ? t("imagePicker.triggerChange") : t("imagePicker.triggerChoose")}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              <XIcon className="size-3" aria-hidden />
              {t("imagePicker.clear")}
            </button>
          )}
        </div>
      </div>

      <DemoImagePickerDialog mode="single" value={value} onChange={onChange} open={open} onOpenChange={setOpen} />
    </div>
  );
}

export function DemoMultiImageControl({
  value,
  onChange,
  max,
}: {
  value: MediaPickerSelection[];
  onChange: (v: MediaPickerSelection[]) => void;
  max?: number;
}) {
  const t = useTranslations("app.portfolioMakerDemo");
  const ctx = useDemoPicker();
  const demoSessionId = ctx?.demoSessionId ?? "";
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<DemoLibraryImage[]>(() => readDemoImageLibrary(demoSessionId));
  const selection = Array.isArray(value) ? value : [];

  // Re-read on close — a selection just made inside the dialog may have
  // uploaded a new image. Render-time state adjustment, not an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setLibrary(readDemoImageLibrary(demoSessionId));
  }

  return (
    <div className="flex flex-col gap-2">
      {selection.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("imagePicker.titleMulti")}>
          {selection.slice(0, 6).map((s) => {
            const thumb = library.find((i) => i.id === s.id)?.url ?? null;
            return (
              <li key={s.id} className="size-10 overflow-hidden border border-border bg-muted">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center">
                    <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{t("imagePicker.countSelected", { count: selection.length })}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ImagePlusIcon className="size-3.5" aria-hidden />
          {t("imagePicker.triggerChooseMulti")}
        </button>
      </div>

      <DemoImagePickerDialog mode="multi" value={selection} onChange={onChange} max={max} open={open} onOpenChange={setOpen} />
    </div>
  );
}
