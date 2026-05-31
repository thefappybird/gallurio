"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImageToCloudinary, type UploadedImage } from "@/lib/storage/uploadToCloudinary.client";
import { validatePhotoFile } from "@/lib/page-builder/photoSpec";
import { cn } from "@/lib/utils";

type Props = {
  images: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
};

export function StepImages({ images, onChange }: Props) {
  const t = useTranslations("app.pageBuilder.wizard.images");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const valid: File[] = [];
    let typeRejected = false;
    let sizeRejected = false;

    Array.from(files).forEach((f) => {
      const check = validatePhotoFile(f);
      if (!check.ok) {
        if (check.reason === "type_not_accepted") typeRejected = true;
        else sizeRejected = true;
      } else {
        valid.push(f);
      }
    });

    // Surface type / size errors even when some files are valid.
    const validationError = typeRejected ? "errorType" : sizeRejected ? "errorSize" : null;
    if (valid.length === 0 && validationError) {
      setErrorKey(validationError);
      return;
    }

    setUploading(true);
    setErrorKey(validationError); // keep inline if some files were rejected

    const results = await Promise.allSettled(
      valid.map((file) => uploadImageToCloudinary(file, { subfolder: "portfolio" }))
    );

    const ok: UploadedImage[] = [];
    let dimRejected = false;
    let uploadFailed = false;

    for (const r of results) {
      if (r.status === "fulfilled") {
        ok.push(r.value);
      } else {
        const reason = r.reason instanceof Error ? r.reason.message : "";
        if (reason === "dimension_too_small") dimRejected = true;
        else uploadFailed = true;
      }
    }

    if (ok.length > 0) onChange([...images, ...ok]);

    // Show the most specific error (dimension > upload failure).
    if (dimRejected) setErrorKey("errorDim");
    else if (uploadFailed) setErrorKey("error");

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  // Drag + drop handlers
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave() {
    setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void handleFiles(e.dataTransfer.files);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="sr-only"
        onChange={(e) => void handleFiles(e.target.files)}
        tabIndex={-1}
      />

      {/* Drag + drop zone (always visible) */}
      <div
        role="button"
        tabIndex={0}
        aria-label={dragOver ? t("dropZoneActive") : t("dropZone")}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          dragOver
            ? "border-foreground bg-accent/30 text-foreground"
            : "border-border text-muted-foreground hover:bg-accent/20 focus-visible:bg-accent/20"
        )}
      >
        {uploading ? (
          <>
            <Loader2Icon className="size-5 animate-spin" aria-hidden />
            <span>{t("uploading")}</span>
          </>
        ) : (
          <>
            <ImagePlusIcon className="size-5" aria-hidden />
            <span>{dragOver ? t("dropZoneActive") : t("dropZone")}</span>
            <span className="text-xs opacity-70">{t("spec")}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {!uploading && <ImagePlusIcon className="size-4" aria-hidden />}
          {uploading ? t("uploading") : t("upload")}
        </Button>
        {images.length > 0 && (
          <span className="text-sm text-muted-foreground">{t("count", { count: images.length })}</span>
        )}
      </div>

      {errorKey && (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey as Parameters<typeof t>[0])}
        </p>
      )}

      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.cloudinaryPublicId} className="group relative aspect-square overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="size-full object-cover" />
              <button
                type="button"
                aria-label={t("remove")}
                onClick={() => removeAt(i)}
                className="absolute right-1 top-1 inline-flex size-7 items-center justify-center border border-border bg-background/90 text-foreground transition-colors hover:bg-destructive hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <XIcon className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Optional notice */}
      <p className="text-xs text-muted-foreground">{t("optional")}</p>
    </section>
  );
}
