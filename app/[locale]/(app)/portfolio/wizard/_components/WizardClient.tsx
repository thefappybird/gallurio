"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type {
  PortfolioBrandKit,
  PortfolioContactConfig,
} from "@/lib/page-builder/types";
import type { PortfolioTemplateId } from "@/lib/page-builder/templates/types";
import type { UploadedImage } from "@/lib/storage/uploadToCloudinary.client";
import { saveWizardOutputAction } from "../_actions";
import { StepTemplate } from "./StepTemplate";
import { StepBranding } from "./StepBranding";
import { StepTheme } from "./StepTheme";
import { StepImages } from "./StepImages";
import { StepReview } from "./StepReview";

export type WizardTemplateSummary = {
  id: PortfolioTemplateId;
  label: string;
  description: string;
  previewImage: string;
  defaultBrandKit: PortfolioBrandKit;
  defaultContact: PortfolioContactConfig;
};

type WizardBranding = { tagline: string; description: string };

type Props = {
  templates: WizardTemplateSummary[];
  defaultTemplateId: PortfolioTemplateId;
  workspaceBranding: {
    primaryColor: string;
    secondaryColor: string;
    tagline: string;
    description: string;
  };
  hasExistingData: boolean;
};

const STEPS = ["template", "branding", "theme", "images", "review"] as const;
const DRAFT_KEY = "gallurio:pageBuilderWizard";

type WizardDraft = {
  templateId: PortfolioTemplateId;
  brandKit: PortfolioBrandKit;
  contact: PortfolioContactConfig;
  branding: WizardBranding;
  images: UploadedImage[];
};

// Read an in-progress draft from sessionStorage (refresh-safe). Guarded for SSR.
function readDraft(): Partial<WizardDraft> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<WizardDraft>) : null;
  } catch {
    return null;
  }
}

export function WizardClient({
  templates,
  defaultTemplateId,
  workspaceBranding,
  hasExistingData,
}: Props) {
  const t = useTranslations("app.pageBuilder.wizard");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const minimalTpl = templates.find((tpl) => tpl.id === "minimal") ?? templates[templates.length - 1];
  const initialTpl = templates.find((tpl) => tpl.id === defaultTemplateId) ?? minimalTpl;

  // Seed state from an in-progress draft if one exists (refresh-safe), else from
  // the businessType-matched template. Lazy initializers run once — no effect.
  //
  // Deliberate tradeoff: reading sessionStorage in the initializer means that on
  // a same-tab mid-wizard refresh the client's first render reflects the saved
  // draft while the server rendered defaults, so React reconciles that subtree
  // once (a benign, invisible re-render that lands on the *correct* resumed
  // state). We prefer this to a post-mount restore effect, which would trip the
  // react-hooks "no setState in effect" rule and add a visible defaults→draft
  // flash. This page is authed + dynamically rendered (never prerendered/SEO).
  const [draft] = useState(() => readDraft());
  const [templateId, setTemplateId] = useState<PortfolioTemplateId>(() =>
    draft?.templateId && templates.some((tpl) => tpl.id === draft.templateId)
      ? draft.templateId
      : initialTpl.id
  );
  const [brandKit, setBrandKit] = useState<PortfolioBrandKit>(
    () => draft?.brandKit ?? initialTpl.defaultBrandKit
  );
  const [contact, setContact] = useState<PortfolioContactConfig>(
    () => draft?.contact ?? initialTpl.defaultContact
  );
  const [branding, setBranding] = useState<WizardBranding>(
    () => draft?.branding ?? { tagline: workspaceBranding.tagline, description: workspaceBranding.description }
  );
  const [images, setImages] = useState<UploadedImage[]>(() =>
    Array.isArray(draft?.images) ? draft.images : []
  );
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(!hasExistingData);

  // Persist the draft as the owner works (write-only effect — no setState).
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ templateId, brandKit, contact, branding, images })
      );
    } catch {
      // sessionStorage unavailable (private mode / quota) — non-fatal.
    }
  }, [templateId, brandKit, contact, branding, images]);

  const stepParam = Number(searchParams.get("step"));
  const step = Number.isInteger(stepParam) && stepParam >= 0 && stepParam < STEPS.length ? stepParam : 0;

  const goStep = useCallback(
    (n: number) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("step", String(n));
      router.push(`${pathname}?${p.toString()}`);
    },
    [pathname, router, searchParams]
  );

  function selectTemplate(id: PortfolioTemplateId) {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    setTemplateId(id);
    // Adopt the template's default look; the owner refines it in the theme step.
    setBrandKit(tpl.defaultBrandKit);
    setContact(tpl.defaultContact);
  }

  async function persist(input: Parameters<typeof saveWizardOutputAction>[0]) {
    setSaving(true);
    try {
      const res = await saveWizardOutputAction(input);
      if ("error" in res) {
        toast.error(t("toasts.error"));
        return;
      }
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      toast.success(t("toasts.saved"));
      router.push("/portfolio");
    } finally {
      setSaving(false);
    }
  }

  function launch() {
    void persist({ templateId, brandKit, contact, branding, starterImages: images });
  }

  function skip() {
    void persist({
      templateId: "minimal",
      brandKit: minimalTpl.defaultBrandKit,
      contact: minimalTpl.defaultContact,
      branding,
      starterImages: [],
    });
  }

  // Overwrite gate for returning owners.
  if (!confirmed) {
    return (
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("overwrite.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("overwrite.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => router.push("/portfolio")}>
              {t("overwrite.cancel")}
            </Button>
            <Button onClick={() => setConfirmed(true)}>{t("overwrite.continue")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-3xl flex-col gap-6 pb-28">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {/* Step indicator */}
      <ol className="flex flex-wrap items-center gap-1.5" aria-label={t("stepOf", { current: step + 1, total: STEPS.length })}>
        {STEPS.map((key, i) => (
          <li key={key} className="flex items-center gap-1.5">
            <span
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs",
                i === step
                  ? "border-foreground bg-foreground text-background"
                  : i < step
                    ? "border-border text-foreground"
                    : "border-border text-muted-foreground"
              )}
            >
              <span className="tabular-nums">{i + 1}</span>
              <span className="hidden sm:inline">{t(`steps.${key}`)}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex-1">
        {step === 0 && (
          <StepTemplate templates={templates} selectedId={templateId} onSelect={selectTemplate} />
        )}
        {step === 1 && <StepBranding value={branding} onChange={setBranding} />}
        {step === 2 && (
          <StepTheme
            brandKit={brandKit}
            onBrandKitChange={setBrandKit}
            workspaceBranding={{
              primaryColor: workspaceBranding.primaryColor,
              secondaryColor: workspaceBranding.secondaryColor,
            }}
          />
        )}
        {step === 3 && <StepImages images={images} onChange={setImages} />}
        {step === 4 && (
          <StepReview
            template={templates.find((x) => x.id === templateId) ?? initialTpl}
            brandKit={brandKit}
            imageCount={images.length}
          />
        )}
      </div>

      {/* Sticky footer nav (respects iOS safe area). */}
      <div
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={skip}
            disabled={saving}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline disabled:opacity-50"
          >
            {t("skip")}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => goStep(step - 1)} disabled={saving}>
                {t("back")}
              </Button>
            )}
            {isLast ? (
              <Button onClick={launch} loading={saving}>
                {saving ? t("launching") : t("launch")}
              </Button>
            ) : (
              <Button onClick={() => goStep(step + 1)} disabled={saving}>
                {t("next")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
