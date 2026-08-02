"use client";

import { useRef, useState } from "react";
import { ImageCropperDialog } from "@/components/ui/image-cropper-dialog";
import type { CropSpec } from "./cropSpecs";

export type CropRequestResult =
  | { status: "ok"; file: File }
  | { status: "cancelled" }
  | { status: "error"; reason: "type_not_accepted" | "file_too_large" };

type Pending = {
  file: File;
  resolve: (result: CropRequestResult) => void;
};

export function useImageCropper(
  spec: CropSpec,
  opts?: { title?: string; description?: string }
): { cropDialog: React.ReactNode; requestCrop: (file: File) => Promise<CropRequestResult> } {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const setPendingBoth = (value: Pending | null) => {
    pendingRef.current = value;
    setPending(value);
  };

  const requestCrop = (file: File): Promise<CropRequestResult> => {
    if (pendingRef.current) {
      pendingRef.current.resolve({ status: "cancelled" });
    }

    if (!spec.acceptedTypes.includes(file.type)) {
      return Promise.resolve({ status: "error", reason: "type_not_accepted" });
    }
    if (file.size > spec.maxBytes) {
      return Promise.resolve({ status: "error", reason: "file_too_large" });
    }

    // Vector; canvas can't reliably rasterize it — pass through unchanged.
    if (file.type === "image/svg+xml") {
      return Promise.resolve({ status: "ok", file });
    }

    return new Promise<CropRequestResult>((resolve) => {
      setPendingBoth({ file, resolve });
    });
  };

  const handleCancel = () => {
    pendingRef.current?.resolve({ status: "cancelled" });
    setPendingBoth(null);
  };

  const handleConfirm = (cropped: File) => {
    pendingRef.current?.resolve({ status: "ok", file: cropped });
    setPendingBoth(null);
  };

  const cropDialog = (
    <ImageCropperDialog
      file={pending?.file ?? null}
      spec={spec}
      title={opts?.title}
      description={opts?.description}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );

  return { cropDialog, requestCrop };
}
