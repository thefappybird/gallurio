"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { toastActionResult } from "@/lib/utils/handleActionResult";
import {
  updateWorkspaceBrandingSchema,
  type UpdateWorkspaceBrandingInput,
} from "@/lib/validators/workspace";
import { updateWorkspaceBrandingAction } from "../_actions";
import { uploadToCloudinary } from "@/lib/storage/uploadToCloudinary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WorkspaceBrandingForm({
  defaults,
}: {
  defaults: UpdateWorkspaceBrandingInput;
}) {
  const t = useTranslations("app.settings.workspace");
  const tBrand = useTranslations("onboarding.branding");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(defaults.logoUrl ?? null);
  const [logoPublicId, setLogoPublicId] = useState<string | null>(
    defaults.logoCloudinaryPublicId ?? null
  );

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateWorkspaceBrandingInput>({
    resolver: zodResolver(updateWorkspaceBrandingSchema),
    defaultValues: defaults,
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form watch() is non-memoizable; React Compiler skips this component intentionally
  const primary = watch("primaryColor");
  const secondary = watch("secondaryColor");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(tBrand("errors.notImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(tBrand("errors.tooLarge"));
      return;
    }
    setUploading(true);
    try {
      const res = await uploadToCloudinary(file, { subfolder: "branding" });
      setLogoUrl(res.secure_url);
      setLogoPublicId(res.public_id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tBrand("errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(data: UpdateWorkspaceBrandingInput) {
    const payload: UpdateWorkspaceBrandingInput = {
      ...data,
      logoUrl,
      logoCloudinaryPublicId: logoPublicId,
    };
    const result = await updateWorkspaceBrandingAction(payload);
    if (!toastActionResult(result, t("savedToast"))) return;
    reset(payload);
  }

  const logoDirty =
    logoUrl !== (defaults.logoUrl ?? null) ||
    logoPublicId !== (defaults.logoCloudinaryPublicId ?? null);
  const canSave = isDirty || logoDirty;

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <div>
        <h2 className="text-lg font-semibold">{t("brandingSection")}</h2>
        <p className="text-sm text-muted-foreground">{t("brandingSectionHint")}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center border border-dashed border-border bg-muted/40">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Logo"
                width={96}
                height={96}
                className="h-full w-full object-contain"
                unoptimized
              />
            ) : (
              <span className="text-xs text-muted-foreground">{tBrand("noLogo")}</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{tBrand("brandLogo")}</Label>
            <p className="text-xs text-muted-foreground">{tBrand("logoHint")}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tBrand("uploading")}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />{" "}
                    {logoUrl ? tBrand("replace") : tBrand("upload")}
                  </>
                )}
              </Button>
              {logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLogoUrl(null);
                    setLogoPublicId(null);
                  }}
                >
                  <X className="mr-1 h-4 w-4" /> {tBrand("remove")}
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorField
            id="primaryColor"
            label={tBrand("primaryColor")}
            value={primary}
            error={errors.primaryColor?.message}
            registration={register("primaryColor")}
          />
          <ColorField
            id="secondaryColor"
            label={tBrand("secondaryColor")}
            value={secondary}
            error={errors.secondaryColor?.message}
            registration={register("secondaryColor")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tagline">{tBrand("tagline")}</Label>
          <Input
            id="tagline"
            placeholder={tBrand("taglinePlaceholder")}
            {...register("tagline")}
          />
          {errors.tagline && (
            <p className="text-sm text-destructive">{errors.tagline.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">{tBrand("shortDescription")}</Label>
          <textarea
            id="description"
            rows={3}
            className="flex w-full border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={tBrand("descriptionPlaceholder")}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || uploading || !canSave}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ColorField({
  id,
  label,
  value,
  error,
  registration,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  registration: ReturnType<
    ReturnType<typeof useForm<UpdateWorkspaceBrandingInput>>["register"]
  >;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-stretch">
        <span
          className="h-9 w-9 shrink-0 border border-r-0 border-input"
          style={{ backgroundColor: value }}
          aria-hidden
        />
        <Input id={id} className="font-mono" {...registration} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
