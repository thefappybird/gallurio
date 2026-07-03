"use client";

import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Upload, X } from "lucide-react";
import { toastActionResult } from "@/lib/utils/handleActionResult";
import { SlugStatusIndicator } from "@/components/app/slug-status-indicator";
import {
  updateWorkspaceBusinessSchema,
  BILLING_COUNTRY_VALUES,
  SUPPORTED_CURRENCIES,
  COUNTRY_TO_CURRENCY,
  type UpdateWorkspaceBusinessInput,
  type SupportedCountry,
  type SupportedCurrency,
} from "@/lib/validators/workspace";
import { updateWorkspaceBusinessAction } from "../_actions";
import { TIMEZONE_GROUPS } from "@/lib/utils/timezones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSlugAvailability } from "@/hooks/useSlugAvailability";
import { uploadAsset } from "@/lib/storage/uploadAsset.client";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_DIM = 2000;

const COUNTRY_LABELS: Record<SupportedCountry, string> = {
  PH: "Philippines",
  SG: "Singapore",
  MY: "Malaysia",
  ID: "Indonesia",
  TH: "Thailand",
  AU: "Australia",
  CA: "Canada",
  NZ: "New Zealand",
  GB: "United Kingdom",
  US: "United States",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  OM: "Oman",
  BH: "Bahrain",
};

const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  PHP: "Philippine Peso (₱)",
  SGD: "Singapore Dollar (S$)",
  MYR: "Malaysian Ringgit (RM)",
  IDR: "Indonesian Rupiah (Rp)",
  THB: "Thai Baht (฿)",
  AUD: "Australian Dollar (A$)",
  CAD: "Canadian Dollar (C$)",
  NZD: "New Zealand Dollar (NZ$)",
  GBP: "British Pound (£)",
  USD: "US Dollar ($)",
  AED: "UAE Dirham (د.إ)",
  SAR: "Saudi Riyal (﷼)",
  QAR: "Qatari Riyal (﷼)",
  KWD: "Kuwaiti Dinar (د.ك)",
  OMR: "Omani Rial (﷼)",
  BHD: "Bahraini Dinar (.د.ب)",
};

export function WorkspaceBusinessForm({
  defaults,
}: {
  defaults: UpdateWorkspaceBusinessInput;
}) {
  const t = useTranslations("app.settings.workspace");
  const tOnb = useTranslations("onboarding.business");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateWorkspaceBusinessInput>({
    resolver: zodResolver(updateWorkspaceBusinessSchema),
    defaultValues: defaults,
  });

  const slugValue = useWatch({ control, name: "slug" });
  const { status: slugStatus } = useSlugAvailability(slugValue, defaults.slug);
  const logoUrl = watch("logoUrl");

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(data: UpdateWorkspaceBusinessInput) {
    const result = await updateWorkspaceBusinessAction(data);
    if (!toastActionResult(result, t("savedToast"))) return;
    reset(data);
  }

  async function handleLogoFile(file: File) {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const result = await uploadAsset(
        file,
        {
          acceptedTypes: LOGO_TYPES,
          maxBytes: LOGO_MAX_BYTES,
          maxWidth: LOGO_MAX_DIM,
          maxHeight: LOGO_MAX_DIM,
        },
        { subfolder: "logo" },
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
        setLogoError(t((msgKey ?? "logoErrors.upload") as Parameters<typeof t>[0]));
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

  function handleLogoInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleLogoFile(file);
  }

  function handleLogoDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setLogoDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleLogoFile(file);
  }

  function handleRemoveLogo() {
    setValue("logoUrl", "", { shouldDirty: true });
    setValue("logoAssetId", "", { shouldDirty: true });
    setLogoError(null);
    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{t("businessSection")}</h2>
        <p className="text-sm text-muted-foreground">{t("businessSectionHint")}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-1.5 w-full">
          <div className="flex flex-col gap-1.5 w-full">
            <Label htmlFor="name">{tOnb("businessName")}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            <Label htmlFor="slug">
              {tOnb("workspaceUrl")}{" "}
              <span className="font-normal text-muted-foreground">{tOnb("workspaceUrlNote")}</span>
            </Label>
            <div className="flex items-stretch">
              <span className="flex items-center border border-e-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
                gallurio.com/w/
              </span>
              <Input
                id="slug"
                aria-invalid={slugStatus === "taken" || slugStatus === "invalid" || !!errors.slug}
                {...register("slug")}
              />
            </div>
            <SlugStatusIndicator status={slugStatus} t={tOnb} />
            {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
          </div>
        </div>



        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessType">{tOnb("businessType")}</Label>
            <select
              id="businessType"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("businessType")}
            >
              <option value="photographer">{tOnb("businessTypes.photographer")}</option>
              <option value="venue">{tOnb("businessTypes.venue")}</option>
              <option value="planner">{tOnb("businessTypes.planner")}</option>
              <option value="stylist">{tOnb("businessTypes.stylist")}</option>
              <option value="catering">{tOnb("businessTypes.catering")}</option>
              <option value="entertainer">{tOnb("businessTypes.entertainer")}</option>
              <option value="other">{tOnb("businessTypes.other")}</option>
            </select>
            {errors.businessType && (
              <p className="text-sm text-destructive">{errors.businessType.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="country">{tOnb("country")}</Label>
            <select
              id="country"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("country", {
                onChange: (e) => {
                  const next = e.target.value as SupportedCountry;
                  setValue("currency", COUNTRY_TO_CURRENCY[next], {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                },
              })}
            >
              {BILLING_COUNTRY_VALUES.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_LABELS[c]}
                </option>
              ))}
            </select>
            {errors.country && (
              <p className="text-sm text-destructive">{errors.country.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currency">{tOnb("currency")}</Label>
            <select
              id="currency"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("currency")}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABELS[c]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("currencyWarning")}</p>
            {errors.currency && (
              <p className="text-sm text-destructive">{errors.currency.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timezone">{tOnb("timezone")}</Label>
            <select
              id="timezone"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("timezone")}
            >
              {Object.entries(TIMEZONE_GROUPS).map(([region, zones]) => (
                <optgroup key={region} label={region}>
                  {zones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errors.timezone && (
              <p className="text-sm text-destructive">{errors.timezone.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactEmail">{t("contactEmail")}</Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder={t("contactEmailPlaceholder")}
              {...register("contactEmail")}
            />
            {errors.contactEmail && (
              <p className="text-sm text-destructive">{errors.contactEmail.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactAddress">{t("contactAddress")}</Label>
            <Input
              id="contactAddress"
              placeholder={t("contactAddressPlaceholder")}
              {...register("contactAddress")}
            />
            {errors.contactAddress && (
              <p className="text-sm text-destructive">{errors.contactAddress.message}</p>
            )}
          </div>
        </div>

        <section className="flex flex-col gap-4 border-t border-border pt-6">
          <div>
            <h2 className="text-lg font-semibold">{t("logoSection")}</h2>
            <p className="text-sm text-muted-foreground">{t("logoHint")}</p>
          </div>

          <div className="flex flex-col gap-3">
            {logoUrl ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={t("logoLabel")}
                  className="h-16 w-16 border border-border bg-muted object-contain"
                />
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
            ) : (
              <label
                htmlFor="logoFile"
                className={[
                  "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-6 py-8 text-center transition-colors",
                  logoDragActive
                    ? "border-brand bg-brand/5"
                    : "border-input hover:border-brand hover:bg-brand/5",
                  logoUploading ? "pointer-events-none opacity-60" : "",
                ].join(" ")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setLogoDragActive(true);
                }}
                onDragLeave={() => setLogoDragActive(false)}
                onDrop={handleLogoDrop}
              >
                {logoUploading ? (
                  <>
                    <Loader2
                      className="h-6 w-6 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-muted-foreground">{t("logoUploading")}</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm font-medium">{t("logoLabel")}</span>
                    <span className="text-xs text-muted-foreground">{t("logoRequirements")}</span>
                  </>
                )}
              </label>
            )}

            <input
              ref={logoFileInputRef}
              id="logoFile"
              type="file"
              accept={LOGO_TYPES.join(",")}
              className="sr-only"
              aria-label={t("logoLabel")}
              disabled={logoUploading}
              onChange={handleLogoInputChange}
            />

            {logoError && (
              <p className="text-sm text-destructive" role="alert">
                {logoError}
              </p>
            )}
          </div>

          <input type="hidden" {...register("logoUrl")} />
          <input type="hidden" {...register("logoAssetId")} />
        </section>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              !isDirty ||
              slugStatus === "checking" ||
              slugStatus === "taken" ||
              slugStatus === "invalid"
            }
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
      </form>
    </section>
  );
}
