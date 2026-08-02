"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import Cropper, { type Area, type MediaSize, type Point } from "react-easy-crop";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cropToFile, outputName } from "@/lib/media/cropImage";
import { aspectLabel, type CropSpec } from "@/lib/media/cropSpecs";

type ImageCropperDialogProps = {
  file: File | null;
  spec: CropSpec;
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
};

export function ImageCropperDialog({
  file,
  spec,
  title,
  description,
  onCancel,
  onConfirm,
}: ImageCropperDialogProps) {
  const t = useTranslations("common.imageCropper");
  const zoomId = useId();

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // ponytail: react-easy-crop has no free-rectangle mode; for aspect:null specs
  // we default the frame to the whole image (imageAspect) so nothing is cropped
  // away by default, and the user can still zoom/pan for a same-shape sub-crop.
  const [imageAspect, setImageAspect] = useState(spec.maxWidth / spec.maxHeight);
  const [busy, setBusy] = useState(false);
  // Kept as state (not a ref) so the Upload button's disabled state re-renders
  // reactively the moment the crop area first arrives.
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [mediaStatus, setMediaStatus] = useState<"loading" | "ready" | "error">("loading");
  const [encodeError, setEncodeError] = useState(false);

  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs the `file` prop (external state) into local objectUrl/crop state when it becomes null
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setImageAspect(spec.maxWidth / spec.maxHeight);
    setMediaStatus("loading");
    setEncodeError(false);
    return () => URL.revokeObjectURL(url);
  }, [file, spec.maxWidth, spec.maxHeight]);

  const handleConfirm = async () => {
    if (!file || !croppedAreaPixels) return;
    setBusy(true);
    setEncodeError(false);
    try {
      const cropped = await cropToFile(file, croppedAreaPixels, spec, outputName(file.name));
      onConfirm(cropped);
    } catch {
      setEncodeError(true);
    } finally {
      setBusy(false);
    }
  };

  const showError = mediaStatus === "error" || encodeError;

  const hint =
    description ??
    (spec.aspect === null
      ? t("hintFree", { width: spec.maxWidth, height: spec.maxHeight })
      : t("hintFixed", {
          aspect: aspectLabel(spec.aspect),
          width: spec.maxWidth,
          height: spec.maxHeight,
        }));

  return (
    <Dialog
      open={file !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? t("title")}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <div
            dir="ltr"
            className="relative h-[min(60vh,420px)] w-full overflow-hidden rounded-[var(--radius)] bg-muted"
          >
            {objectUrl && (
              <Cropper
                image={objectUrl}
                crop={crop}
                zoom={zoom}
                aspect={spec.aspect ?? imageAspect}
                cropShape={spec.round ? "round" : "rect"}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, areaPixels) => {
                  setCroppedAreaPixels(areaPixels);
                }}
                onMediaLoaded={(mediaSize: MediaSize) => {
                  setImageAspect(mediaSize.naturalWidth / mediaSize.naturalHeight);
                  setMediaStatus("ready");
                }}
                mediaProps={{ onError: () => setMediaStatus("error") }}
                cropperProps={{ "aria-label": t("cropArea") }}
                classes={{
                  cropAreaClassName: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                }}
              />
            )}
            {mediaStatus === "loading" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                <span className="sr-only">{t("loading")}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={zoomId} className="text-xs text-muted-foreground">
              {t("zoom")}
            </label>
            <input
              id={zoomId}
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {showError && (
            <p role="alert" className="text-xs text-destructive">
              {t("cropFailed")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={busy || !croppedAreaPixels}>
            {busy && <Loader2 className="me-2 size-4 animate-spin" aria-hidden />}
            {busy ? t("uploading") : t("upload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
