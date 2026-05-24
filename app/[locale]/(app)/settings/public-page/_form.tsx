"use client";

import { useState, useTransition, useOptimistic } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  publicPageSettingsSchema,
  type PublicPageSettingsInput,
} from "@/lib/validators/workspace";
import {
  updatePublicPageSettingsAction,
  togglePublicPagePublishedAction,
} from "../_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PublicPageSettingsForm({
  slug,
  publishedAt,
  defaults,
  locale,
}: {
  slug: string;
  publishedAt: Date | null;
  defaults: PublicPageSettingsInput;
  locale: string;
}) {
  const t = useTranslations("app.settings.publicPage");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [optimisticPublishedAt, setOptimisticPublishedAt] = useOptimistic<Date | null>(
    publishedAt
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PublicPageSettingsInput>({
    resolver: zodResolver(publicPageSettingsSchema),
    defaultValues: defaults,
  });

  const publicUrl = `gallurio.com/w/${slug}`;

  function handleCopy() {
    navigator.clipboard.writeText(`https://${publicUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleTogglePublish() {
    const next = !optimisticPublishedAt;
    startTransition(async () => {
      setOptimisticPublishedAt(next ? new Date() : null);
      const result = await togglePublicPagePublishedAction(next);
      if (result?.error) {
        setOptimisticPublishedAt(optimisticPublishedAt);
        toast.error(result.error);
      } else {
        toast.success(t("visibilityUpdatedToast"));
      }
    });
  }

  async function onSubmit(data: PublicPageSettingsInput) {
    const result = await updatePublicPageSettingsAction(data);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(t("savedToast"));
    reset(data);
  }

  const isPublished = !!optimisticPublishedAt;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Visibility ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("visibilitySection")}</h2>
          <p className="text-sm text-muted-foreground">{t("visibilityHint")}</p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Status pill */}
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

          {/* Public URL row */}
          <div className="flex flex-col gap-1.5">
            <Label>{t("publicUrl")}</Label>
            <div className="flex items-stretch">
              <span className="flex min-h-[2.25rem] items-center border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
                {publicUrl}
              </span>
              <Button
                type="button"
                variant="outline"
                className="min-h-[2.25rem] shrink-0 border-l-0"
                onClick={handleCopy}
              >
                {copied ? t("copied") : t("copy")}
              </Button>
            </div>
          </div>

          {/* Visibility toggle */}
          <div>
            <Button
              type="button"
              variant={isPublished ? "outline" : "default"}
              disabled={isPending}
              onClick={handleTogglePublish}
              className="min-h-[2.75rem]"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : isPublished ? (
                t("unpublish")
              ) : (
                t("publish")
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* ── SEO + Inquiry (shared form) ─────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
        {/* SEO section */}
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold">{t("seoSection")}</h2>
            <p className="text-sm text-muted-foreground">{t("seoSectionHint")}</p>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoTitle">{t("seoTitle")}</Label>
              <Input
                id="seoTitle"
                placeholder={t("seoTitlePlaceholder")}
                {...register("seoTitle")}
              />
              {errors.seoTitle && (
                <p className="text-sm text-destructive">{errors.seoTitle.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoDescription">{t("seoDescription")}</Label>
              <textarea
                id="seoDescription"
                rows={3}
                className="flex w-full border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={t("seoDescriptionPlaceholder")}
                {...register("seoDescription")}
              />
              {errors.seoDescription && (
                <p className="text-sm text-destructive">{errors.seoDescription.message}</p>
              )}
            </div>
          </div>
        </section>

        {/* Inquiry routing section */}
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold">{t("inquirySection")}</h2>
            <p className="text-sm text-muted-foreground">{t("inquirySectionHint")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inquiryRecipientEmail">{t("inquiryRecipientEmail")}</Label>
            <Input
              id="inquiryRecipientEmail"
              type="email"
              placeholder={t("inquiryRecipientEmailPlaceholder")}
              {...register("inquiryRecipientEmail")}
            />
            {errors.inquiryRecipientEmail && (
              <p className="text-sm text-destructive">
                {errors.inquiryRecipientEmail.message}
              </p>
            )}
          </div>
        </section>

        {/* Custom domain section (disabled, coming soon) */}
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold">{t("customDomainSection")}</h2>
          </div>

          <div className="opacity-60">
            <Input
              disabled
              placeholder={t("customDomainComingSoon")}
              className="cursor-not-allowed"
            />
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
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
    </div>
  );
}
