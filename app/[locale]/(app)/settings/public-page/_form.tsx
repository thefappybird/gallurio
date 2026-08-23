"use client";

import { useEffect, useId, useRef, useState, useTransition, useOptimistic } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useActionError } from "@/lib/i18n/actionError";
import { AlertCircle, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  publicPageSettingsSchema,
  type PublicPageSettingsInput,
} from "@/lib/validators/workspace";
import {
  updatePublicPageSettingsAction,
  togglePublicPagePublishedAction,
} from "../_actions";
import { publishDraftAction } from "../../portfolio/_draftActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadAsset } from "@/lib/storage/uploadAsset.client";
import { uploadImage } from "@/lib/storage/uploadImage.client";
import { portfolioPublicUrl } from "@/lib/portfolio/publicUrl";
import { useImageRetry } from "@/hooks/useImageRetry";
import { FormField, useFieldError } from "@/components/ui/form-field";
import { fieldMessage } from "@/lib/utils/fieldMessage";

const SITE_ICON_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;
const SITE_ICON_MAX_BYTES = 1 * 1024 * 1024;
const SITE_ICON_MAX_DIM = 512;

// Phrases are separated by commas (or newlines, if pasted from a list) only —
// spaces inside a phrase are significant, so "wedding photographer" stays one tag.
export function parseSeoKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const part of raw.split(/[,\n\r]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(trimmed);
  }

  return keywords;
}

/** True if any of the published-page-affecting fields differ from the published snapshot. */
function computeHasPendingChanges(
  data: PublicPageSettingsInput,
  publishedDefaults?: PublicPageSettingsInput,
): boolean {
  if (!publishedDefaults) return true;
  return (
    data.seoTitle !== publishedDefaults.seoTitle ||
    data.seoDescription !== publishedDefaults.seoDescription ||
    data.logoUrl !== publishedDefaults.logoUrl ||
    data.logoAssetId !== publishedDefaults.logoAssetId ||
    data.siteIconUrl !== publishedDefaults.siteIconUrl ||
    data.siteIconAssetId !== publishedDefaults.siteIconAssetId ||
    JSON.stringify(data.seo?.keywords ?? []) !==
      JSON.stringify(publishedDefaults.seo?.keywords ?? []) ||
    data.seo?.ogImageUrl !== publishedDefaults.seo?.ogImageUrl ||
    data.seo?.ogImageAssetId !== publishedDefaults.seo?.ogImageAssetId ||
    data.seo?.galleryDescription !== publishedDefaults.seo?.galleryDescription ||
    data.seo?.noindex !== publishedDefaults.seo?.noindex
  );
}

export function PublicPageSettingsForm({
  slug,
  publishedAt,
  defaults,
  locale,
  targetDraftId,
  initialHasPendingChanges,
  publishedDefaults,
}: {
  slug: string;
  publishedAt: Date | null;
  defaults: PublicPageSettingsInput;
  locale: string;
  targetDraftId?: string;
  initialHasPendingChanges?: boolean;
  publishedDefaults?: PublicPageSettingsInput;
}) {
  const t = useTranslations("app.settings.publicPage");
  const errMsg = useActionError();
  const formId = useId();
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasPendingChanges, setHasPendingChanges] = useState(
    initialHasPendingChanges ?? false,
  );
  const [isPublishing, startPublishTransition] = useTransition();

  const [optimisticPublishedAt, setOptimisticPublishedAt] = useOptimistic<Date | null>(
    publishedAt
  );

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const [iconUploading, setIconUploading] = useState(false);
  const [iconDragActive, setIconDragActive] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);

  const [ogUploading, setOgUploading] = useState(false);
  const [ogError, setOgError] = useState<string | null>(null);
  const ogFileInputRef = useRef<HTMLInputElement>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PublicPageSettingsInput>({
    resolver: zodResolver(publicPageSettingsSchema),
    defaultValues: defaults,
  });

  const siteIconUrl = watch("siteIconUrl");
  const ogImageUrl = watch("seo.ogImageUrl");
  const siteIcon = useImageRetry(siteIconUrl);

  // Raw text typed into the keywords input, kept separate from the parsed
  // form value so a trailing comma/space the owner just typed isn't eaten
  // by re-deriving the input from the parsed array on every keystroke.
  const [seoKeywordsRaw, setSeoKeywordsRaw] = useState(
    () => (defaults.seo?.keywords ?? []).join(", "),
  );
  const seoKeywordsDefaultsKey = JSON.stringify(defaults.seo?.keywords ?? []);
  useEffect(() => {
    setSeoKeywordsRaw(JSON.parse(seoKeywordsDefaultsKey).join(", "));
  }, [seoKeywordsDefaultsKey]);

  const seoTitleError = fieldMessage(errors.seoTitle);
  const seoKeywordsError = fieldMessage(errors.seo?.keywords);
  const seoDescriptionError = fieldMessage(errors.seoDescription);
  const galleryDescriptionError = fieldMessage(errors.seo?.galleryDescription);
  const inquiryRecipientEmailError = fieldMessage(errors.inquiryRecipientEmail);

  const logoA11y = useFieldError(logoError ?? undefined, { id: "public-page-logoFile" });
  const ogA11y = useFieldError(ogError ?? undefined, { id: "ogImageFile" });
  const iconA11y = useFieldError(iconError ?? undefined, { id: "siteIconFile" });

  const publicUrl = portfolioPublicUrl(slug);

  function handleCopy() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePublishedStateChange(next: boolean) {
    startTransition(async () => {
      setOptimisticPublishedAt(next ? new Date() : null);
      const previous = optimisticPublishedAt;
      const result = await togglePublicPagePublishedAction(next);
      if (result?.error) {
        setOptimisticPublishedAt(previous);
        toast.error(errMsg(result.error, result.params));
      } else {
        toast.success(t("visibilityUpdatedToast"));
      }
    });
  }

  async function onSubmit(data: PublicPageSettingsInput) {
    const result = await updatePublicPageSettingsAction(data);
    if (!result?.ok) {
      toast.error(errMsg(result?.error, result?.params));
      return;
    }
    toast.success(t("savedToast"));
    reset(data);
    setSeoKeywordsRaw((data.seo?.keywords ?? []).join(", "));
    setHasPendingChanges(computeHasPendingChanges(data, publishedDefaults));
  }

  function handlePublish() {
    startPublishTransition(async () => {
      if (!targetDraftId) return;
      const result = await publishDraftAction(targetDraftId);
      if (result && "error" in result) {
        toast.error(errMsg(result.error));
        return;
      }
      setOptimisticPublishedAt(new Date());
      toast.success(t("publishChangesSuccessToast"));
      setHasPendingChanges(false);
    });
  }

  const isPublished = !!optimisticPublishedAt;
  const publishAction = isPublished && !hasPendingChanges ? "unpublish" : "publish";
  const publishActionPending = isPending || isPublishing;
  const publishActionDisabled =
    isDirty ||
    isSubmitting ||
    publishActionPending ||
    (publishAction === "publish" && !targetDraftId);

  function handlePrimaryPublishAction() {
    if (publishAction === "unpublish") {
      handlePublishedStateChange(false);
      return;
    }
    handlePublish();
  }

  async function handleLogoInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    setLogoUploading(true);
    try {
      const result = await uploadAsset(
        file,
        {
          acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
          maxBytes: 250 * 1024,
          maxWidth: 512,
          maxHeight: 256,
        },
        {
          subfolder: "portfolio_header",
          delivery: { width: 512, height: 256, fit: "scale-down" },
        },
      );
      if ("error" in result) {
        const msgKey = (
          {
            type_not_accepted: "logoErrors.type",
            file_too_large: "logoErrors.size",
            dimensions_too_large: "logoErrors.dimensions",
            invalid_image: "logoErrors.image",
          } as Record<string, string>
        )[result.error];
        setLogoError(t(msgKey as Parameters<typeof t>[0]));
        return;
      }
      setValue("logoUrl", result.asset.url, { shouldDirty: true });
      setValue("logoAssetId", result.asset.assetId, { shouldDirty: true });
    } catch {
      setLogoError(t("logoErrors.upload"));
    } finally {
      setLogoUploading(false);
      if (logoFileInputRef.current) logoFileInputRef.current.value = "";
    }
  }

  function handleRemoveLogo() {
    setValue("logoUrl", "", { shouldDirty: true });
    setValue("logoAssetId", "", { shouldDirty: true });
    setLogoError(null);
    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
  }

  async function handleIconFile(file: File) {
    setIconError(null);
    setIconUploading(true);
    try {
      const result = await uploadAsset(
        file,
        {
          acceptedTypes: SITE_ICON_TYPES,
          maxBytes: SITE_ICON_MAX_BYTES,
          maxWidth: SITE_ICON_MAX_DIM,
          maxHeight: SITE_ICON_MAX_DIM,
        },
        { subfolder: "site_icon", delivery: { width: 512, height: 512, fit: "scale-down" } },
      );
      if ("error" in result) {
        const msgKey = (
          {
            type_not_accepted: "siteIconErrors.type",
            file_too_large: "siteIconErrors.size",
            dimensions_too_large: "siteIconErrors.dimensions",
            invalid_image: "siteIconErrors.image",
          } as Record<string, string>
        )[result.error];
        setIconError(t(msgKey as Parameters<typeof t>[0]));
        return;
      }
      setValue("siteIconUrl", result.asset.url, { shouldDirty: true });
      setValue("siteIconAssetId", result.asset.assetId, { shouldDirty: true });
    } catch {
      setIconError(t("siteIconErrors.upload"));
    } finally {
      setIconUploading(false);
      if (iconFileInputRef.current) iconFileInputRef.current.value = "";
    }
  }

  function handleIconInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleIconFile(file);
  }

  function handleIconDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIconDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleIconFile(file);
  }

  function handleRemoveIcon() {
    setValue("siteIconUrl", "", { shouldDirty: true });
    setValue("siteIconAssetId", "", { shouldDirty: true });
    setIconError(null);
    if (iconFileInputRef.current) iconFileInputRef.current.value = "";
  }

  async function handleOgFile(file: File): Promise<void> {
    setOgError(null);
    setOgUploading(true);
    try {
      const result = await uploadImage(file);
      setValue("seo.ogImageUrl", result.url, { shouldDirty: true });
      setValue("seo.ogImageAssetId", result.assetId, { shouldDirty: true });
    } catch (err) {
      const reason = (err as Error).message;
      const msgKey = (
        {
          type_not_accepted: "ogImageErrors.type",
          file_too_large: "ogImageErrors.size",
          dimension_too_small: "ogImageErrors.dimensions",
        } as Record<string, string>
      )[reason] ?? "ogImageErrors.upload";
      setOgError(t(msgKey as Parameters<typeof t>[0]));
    } finally {
      setOgUploading(false);
      if (ogFileInputRef.current) ogFileInputRef.current.value = "";
    }
  }

  function handleRemoveOg() {
    setValue("seo.ogImageUrl", "", { shouldDirty: true });
    setValue("seo.ogImageAssetId", "", { shouldDirty: true });
    setOgError(null);
    if (ogFileInputRef.current) ogFileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Visibility */}
      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex flex-col gap-3 border-t border-border bg-background px-6 py-4">
        {hasPendingChanges && (
          <div className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              <span className="block font-medium">
                {!isPublished
                  ? t("unpublishedBannerTitle")
                  : t("pendingChangesBannerTitle")}
              </span>
              {!isPublished
                ? t("unpublishedBannerBody")
                : t("pendingChangesBannerBody")}
            </p>
          </div>
        )}
      </div>
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t("visibilitySection")}</h2>
            <p className="text-sm text-muted-foreground">{t("visibilityHint")}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={publishActionDisabled}
              onClick={handlePrimaryPublishAction}
            >
              {publishActionPending ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {publishAction === "unpublish" ? t("saving") : t("publishingChanges")}
                </>
              ) : (
                t(publishAction)
              )}
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={isSubmitting || !isDirty}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
          </div>
        </div>

        <div
          data-testid="public-page-visibility-layout"
          className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "inline-flex items-center border px-2 py-0.5 text-xs font-medium",
                  isPublished
                    ? "border-brand/40 bg-brand/10 text-brand"
                    : "border-border bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {isPublished
                  ? t("publishedAt", {
                      date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                        optimisticPublishedAt!
                      ),
                    })
                  : t("unpublished")}
              </span>
            </div>

            <div className="flex gap-1.5">
              <div className="flex flex-col gap-1.5">
                <Label>{t("publicUrl")}</Label>
                <div className="flex items-stretch">
                  <span className="flex min-h-[2.25rem] items-center border border-e-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
                    <span className="truncate">{publicUrl}</span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[2.25rem] shrink-0 border-s-0"
                    onClick={handleCopy}
                  >
                    {copied ? t("copied") : t("copy")}
                  </Button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SEO + Logo + Site icon + Inquiry (shared form) */}
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
        {/* Header logo section */}
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold">{t("logoSection")}</h2>
            <p className="text-sm text-muted-foreground">{t("logoHint")}</p>
            <p className="text-xs text-muted-foreground">{t("logoRequirements")}</p>
          </div>

          {watch("logoUrl") ? (
            <div className="flex flex-col gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={watch("logoUrl")}
                alt={t("logoLabel")}
                className="w-full border border-border bg-muted object-contain"
                style={{ maxWidth: 384, aspectRatio: "512 / 256" }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logoUploading}
                  onClick={() => logoFileInputRef.current?.click()}
                >
                  {t("logoReplace")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logoUploading}
                  onClick={handleRemoveLogo}
                  className="flex items-center gap-1.5"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("logoRemove")}
                </Button>
              </div>
            </div>
          ) : (
            <label
              htmlFor="public-page-logoFile"
              className={[
                "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-6 py-8 text-center transition-colors",
                logoUploading
                  ? "pointer-events-none opacity-60"
                  : "border-input hover:border-brand hover:bg-brand/5",
              ].join(" ")}
            >
              {logoUploading ? (
                <>
                  <Loader2
                    className="h-6 w-6 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("logoUploading")}
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium">{t("logoLabel")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("logoRequirements")}
                  </span>
                </>
              )}
            </label>
          )}

          <input
            ref={logoFileInputRef}
            id={logoA11y.id}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label={t("logoLabel")}
            aria-describedby={logoA11y["aria-describedby"]}
            disabled={logoUploading}
            onChange={handleLogoInputChange}
          />

          {logoError && (
            <p id={logoA11y.errorId} className="text-sm text-destructive" role="alert">
              {logoError}
            </p>
          )}

          <input type="hidden" {...register("logoUrl")} />
          <input type="hidden" {...register("logoAssetId")} />
        </section>

        {/* SEO section */}
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold">{t("seoSection")}</h2>
            <p className="text-sm text-muted-foreground">{t("seoSectionHint")}</p>
          </div>

          <div
            data-testid="public-page-seo-layout"
            className="grid grid-cols-1 gap-5 xl:grid-cols-2"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoTitle">{t("seoTitle")}</Label>
              <Input
                id="seoTitle"
                placeholder={t("seoTitlePlaceholder")}
                aria-invalid={seoTitleError ? true : undefined}
                aria-describedby={
                  [seoTitleError ? "seoTitle-error" : null, "seoTitleHint"]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                {...register("seoTitle")}
              />
              {seoTitleError && (
                <p id="seoTitle-error" role="alert" className="text-sm text-destructive">
                  {seoTitleError}
                </p>
              )}
              <p id="seoTitleHint" className="text-xs text-muted-foreground">
                {t("seoTitleHint")}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoKeywords">{t("seoKeywords")}</Label>
              <Controller
                control={control}
                name="seo.keywords"
                render={({ field }) => (
                  <Input
                    id="seoKeywords"
                    placeholder={t("seoKeywordsPlaceholder")}
                    value={seoKeywordsRaw}
                    aria-invalid={seoKeywordsError ? true : undefined}
                    aria-describedby={
                      [seoKeywordsError ? "seoKeywords-error" : null, "seoKeywordsHint"]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                    onChange={(e) => {
                      setSeoKeywordsRaw(e.target.value);
                      field.onChange(parseSeoKeywords(e.target.value));
                    }}
                  />
                )}
              />
              {seoKeywordsError && (
                <p id="seoKeywords-error" role="alert" className="text-sm text-destructive">
                  {seoKeywordsError}
                </p>
              )}
              <p id="seoKeywordsHint" className="text-xs text-muted-foreground">
                {t("seoKeywordsHint")}
              </p>
            </div>

            <div className="flex flex-col gap-1.5 xl:col-span-2">
              <Label htmlFor="seoDescription">{t("seoDescription")}</Label>
              <textarea
                id="seoDescription"
                rows={3}
                className="flex w-full border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={t("seoDescriptionPlaceholder")}
                aria-invalid={seoDescriptionError ? true : undefined}
                aria-describedby={
                  [seoDescriptionError ? "seoDescription-error" : null, "seoDescriptionHint"]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                {...register("seoDescription")}
              />
              {seoDescriptionError && (
                <p id="seoDescription-error" role="alert" className="text-sm text-destructive">
                  {seoDescriptionError}
                </p>
              )}
              <p id="seoDescriptionHint" className="text-xs text-muted-foreground">
                {t("seoDescriptionHint")}
              </p>
            </div>

            <div className="flex flex-col gap-1.5 xl:col-span-2">
              <Label htmlFor="galleryDescription">{t("galleryDescriptionLabel")}</Label>
              <textarea
                id="galleryDescription"
                rows={3}
                className="flex w-full border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={t("galleryDescriptionPlaceholder")}
                aria-invalid={galleryDescriptionError ? true : undefined}
                aria-describedby={
                  [galleryDescriptionError ? "galleryDescription-error" : null, "galleryDescriptionHint"]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                {...register("seo.galleryDescription")}
              />
              {galleryDescriptionError && (
                <p id="galleryDescription-error" role="alert" className="text-sm text-destructive">
                  {galleryDescriptionError}
                </p>
              )}
              <p id="galleryDescriptionHint" className="text-xs text-muted-foreground">
                {t("galleryDescriptionHint")}
              </p>
            </div>
          </div>
        </section>

        {/* Share image (OG) section */}
        <div
          data-testid="public-page-media-layout"
          className="grid grid-cols-1 gap-8 xl:grid-cols-2"
        >
          {/* Share image (OG) section */}
          <section className="flex flex-col gap-4 border-t border-border pt-8 xl:pt-8">
            <div>
              <h2 className="text-lg font-semibold">{t("ogImageSection")}</h2>
              <p className="text-sm text-muted-foreground">{t("ogImageHint")}</p>
              <p className="text-xs text-muted-foreground">{t("ogImageRequirements")}</p>
            </div>

            <div className="flex flex-col gap-3">
              {ogImageUrl ? (
                <div className="flex flex-col gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ogImageUrl}
                    alt={t("ogImageLabel")}
                    className="w-full border border-border bg-muted object-cover"
                    style={{ maxWidth: 480, aspectRatio: "1200 / 630" }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ogUploading}
                      onClick={() => ogFileInputRef.current?.click()}
                    >
                      {t("ogImageReplace")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ogUploading}
                      onClick={handleRemoveOg}
                      className="flex items-center gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("ogImageRemove")}
                    </Button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="ogImageFile"
                  className={[
                    "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-6 py-8 text-center transition-colors",
                    ogUploading
                      ? "pointer-events-none opacity-60"
                      : "border-input hover:border-brand hover:bg-brand/5",
                  ].join(" ")}
                >
                  {ogUploading ? (
                    <>
                      <Loader2
                        className="h-6 w-6 animate-spin text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-muted-foreground">
                        {t("ogImageUploading")}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                      <span className="text-sm font-medium">{t("ogImageLabel")}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("ogImageRequirements")}
                      </span>
                    </>
                  )}
                </label>
              )}

              <input
                ref={ogFileInputRef}
                id={ogA11y.id}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                aria-label={t("ogImageLabel")}
                aria-describedby={ogA11y["aria-describedby"]}
                disabled={ogUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleOgFile(file);
                }}
              />

              {ogError && (
                <p id={ogA11y.errorId} className="text-sm text-destructive" role="alert">
                  {ogError}
                </p>
              )}
            </div>

            <input type="hidden" {...register("seo.ogImageUrl")} />
            <input type="hidden" {...register("seo.ogImageAssetId")} />
          </section>

          {/* Site icon section */}
          <section className="flex flex-col gap-4 border-t border-border pt-8 xl:pt-8">
            <div>
              <h2 className="text-lg font-semibold">{t("siteIconSection")}</h2>
              <p className="text-sm text-muted-foreground">{t("siteIconHint")}</p>
              <p className="text-xs text-muted-foreground">
                {t("siteIconRequirements")}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {siteIconUrl && !siteIcon.failed ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={siteIcon.src}
                      alt={t("siteIconLabel")}
                      onError={siteIcon.onError}
                      className="h-16 w-16 border border-border bg-background object-contain"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={iconUploading}
                        onClick={() => iconFileInputRef.current?.click()}
                      >
                        {t("siteIconUpload")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={iconUploading}
                        onClick={handleRemoveIcon}
                        className="flex items-center gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("siteIconRemove")}
                      </Button>
                    </div>
                  </div>

                </div>
              ) : (
                <label
                  htmlFor="siteIconFile"
                  className={[
                    "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-6 py-8 text-center transition-colors",
                    iconDragActive
                      ? "border-brand bg-brand/5"
                      : "border-input hover:border-brand hover:bg-brand/5",
                    iconUploading ? "pointer-events-none opacity-60" : "",
                  ].join(" ")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIconDragActive(true);
                  }}
                  onDragLeave={() => setIconDragActive(false)}
                  onDrop={handleIconDrop}
                >
                  {iconUploading ? (
                    <>
                      <Loader2
                        className="h-6 w-6 animate-spin text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-muted-foreground">
                        {t("siteIconUploading")}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload
                        className="h-6 w-6 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium">{t("siteIconLabel")}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("siteIconRequirements")}
                      </span>
                    </>
                  )}
                </label>
              )}

              <input
                ref={iconFileInputRef}
                id={iconA11y.id}
                type="file"
                accept={SITE_ICON_TYPES.join(",")}
                className="sr-only"
                aria-label={t("siteIconLabel")}
                aria-describedby={iconA11y["aria-describedby"]}
                disabled={iconUploading}
                onChange={handleIconInputChange}
              />

              {iconError && (
                <p id={iconA11y.errorId} className="text-sm text-destructive" role="alert">
                  {iconError}
                </p>
              )}
            </div>

            <input type="hidden" {...register("siteIconUrl")} />
            <input type="hidden" {...register("siteIconAssetId")} />
          </section>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          {/* Search visibility (noindex) section */}
          <section className="flex flex-col gap-4 border-t border-border pt-8">
            <div>
              <h2 className="text-lg font-semibold">{t("noindexSection")}</h2>
            </div>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="noindex"
                className="mt-0.5 h-4 w-4 shrink-0"
                {...register("seo.noindex")}
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="noindex">{t("noindexLabel")}</Label>
                <p className="text-sm text-muted-foreground">{t("noindexHint")}</p>
              </div>
            </div>
          </section>
          {/* Inquiry routing section */}
          <section className="flex flex-col gap-4 border-t border-border pt-8">
            <div>
              <h2 className="text-lg font-semibold">{t("inquirySection")}</h2>
              <p className="text-sm text-muted-foreground">{t("inquirySectionHint")}</p>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <FormField
                id="inquiryRecipientEmail"
                className="xl:max-w-xl"
                label={t("inquiryRecipientEmail")}
                error={inquiryRecipientEmailError}
              >
                {({ id, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedby }) => (
                  <Input
                    id={id}
                    type="email"
                    aria-invalid={ariaInvalid}
                    aria-describedby={ariaDescribedby}
                    placeholder={t("inquiryRecipientEmailPlaceholder")}
                    {...register("inquiryRecipientEmail")}
                  />
                )}
              </FormField>
            </div>
          </section>
        </div>

      </form>
    </div>
  );
}
