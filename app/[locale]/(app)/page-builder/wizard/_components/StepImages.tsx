"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImageToCloudinary, type UploadedImage } from "@/lib/storage/uploadToCloudinary.client";

type Props = {
  images: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
};

export function StepImages({ images, onChange }: Props) {
  const t = useTranslations("app.pageBuilder.wizard.images");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [hadError, setHadError] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setHadError(false);
    const picked = Array.from(files);
    const results = await Promise.allSettled(
      picked.map((file) => uploadImageToCloudinary(file, { subfolder: "portfolio" }))
    );
    const ok: UploadedImage[] = [];
    let failed = false;
    for (const r of results) {
      if (r.status === "fulfilled") ok.push(r.value);
      else failed = true;
    }
    if (ok.length > 0) onChange([...images, ...ok]);
    if (failed) setHadError(true);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
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
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {!uploading && <ImagePlusIcon className="size-4" />}
          {uploading ? t("uploading") : t("upload")}
        </Button>
        {images.length > 0 && (
          <span className="text-sm text-muted-foreground">{t("count", { count: images.length })}</span>
        )}
      </div>

      {hadError && (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      )}

      {images.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {uploading ? <Loader2Icon className="size-5 animate-spin" /> : <ImagePlusIcon className="size-5" />}
          <span>{t("empty")}</span>
        </div>
      ) : (
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
                <XIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
