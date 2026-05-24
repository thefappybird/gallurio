"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type { OnboardingStep } from "@/lib/db/models";
import { brandingStepSchema, type BrandingStepInput } from "@/lib/validators/workspace";
import { brandingStepAction } from "@/lib/actions/onboarding";
import { uploadToCloudinary } from "@/lib/storage/uploadToCloudinary";
import { StepShell, StepBackButton } from "../_components/step-shell";
import { BrandingIllustration } from "../_components/illustrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BrandingStepForm({
  defaults,
  furthestStep,
}: {
  defaults: BrandingStepInput;
  furthestStep: OnboardingStep;
}) {
  const t = useTranslations("onboarding.branding");
  const tShell = useTranslations("onboarding.shell");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(defaults.logoUrl ?? null);
  const [logoPublicId, setLogoPublicId] = useState<string | null>(
    defaults.logoCloudinaryPublicId ?? null
  );
  const [, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BrandingStepInput>({
    resolver: zodResolver(brandingStepSchema),
    defaultValues: defaults,
  });

  const primary = watch("primaryColor");
  const secondary = watch("secondaryColor");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("errors.notImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("errors.tooLarge"));
      return;
    }
    setUploading(true);
    try {
      const res = await uploadToCloudinary(file, { subfolder: "branding" });
      setLogoUrl(res.secure_url);
      setLogoPublicId(res.public_id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(data: BrandingStepInput) {
    const payload: BrandingStepInput = {
      ...data,
      logoUrl,
      logoCloudinaryPublicId: logoPublicId,
    };
    const result = await brandingStepAction(payload);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    startTransition(() => router.push("/onboarding/plan"));
  }

  function skip() {
    startTransition(async () => {
      const result = await brandingStepAction({
        logoUrl: null,
        logoCloudinaryPublicId: null,
        primaryColor: defaults.primaryColor,
        secondaryColor: defaults.secondaryColor,
        tagline: "",
        description: "",
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      router.push("/onboarding/plan");
    });
  }

  return (
    <StepShell
      step="branding"
      furthestStep={furthestStep}
      title={t("title")}
      description={t("description")}
      illustration={<BrandingIllustration />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
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
              <span className="text-xs text-muted-foreground">{t("noLogo")}</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("brandLogo")}</Label>
            <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("uploading")}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" /> {logoUrl ? t("replace") : t("upload")}
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
                  <X className="mr-1 h-4 w-4" /> {t("remove")}
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

        <div className="grid grid-cols-2 gap-4">
          <ColorField
            id="primaryColor"
            label={t("primaryColor")}
            value={primary}
            error={errors.primaryColor?.message}
            register={register("primaryColor")}
          />
          <ColorField
            id="secondaryColor"
            label={t("secondaryColor")}
            value={secondary}
            error={errors.secondaryColor?.message}
            register={register("secondaryColor")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tagline">{t("tagline")}</Label>
          <Input
            id="tagline"
            placeholder={t("taglinePlaceholder")}
            {...register("tagline")}
          />
          {errors.tagline && (
            <p className="text-sm text-destructive">{errors.tagline.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">{t("shortDescription")}</Label>
          <textarea
            id="description"
            rows={3}
            className="flex w-full border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={t("descriptionPlaceholder")}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <StepBackButton from="branding" />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={skip} disabled={isSubmitting}>
              {t("skipForNow")}
            </Button>
            <Button type="submit" disabled={isSubmitting || uploading} className="min-w-32">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tShell("saving")}
                </>
              ) : (
                tShell("continue")
              )}
            </Button>
          </div>
        </div>
      </form>
    </StepShell>
  );
}

function ColorField({
  id,
  label,
  value,
  error,
  register,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  register: ReturnType<ReturnType<typeof useForm<BrandingStepInput>>["register"]>;
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
        <Input id={id} className="font-mono" {...register} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
