"use client";

import { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import {
  Brush,
  Camera,
  CalendarCheck,
  Check,
  ClipboardList,
  Contact,
  Layers,
  Link2,
  Loader2,
  Lock,
  MessageSquare,
  Music,
  Scissors,
  Building2,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTerms,
  VOCABULARY_CONCEPTS,
  VOCABULARY_LOCALES,
  VOCABULARY_PRESET_IDS,
  type VocabularyConcept,
  type VocabularyLocale,
  type VocabularyPresetId,
} from "@/lib/vocabulary/presets";
import { THEMES } from "@/lib/theme/themes";
import { routing } from "@/lib/i18n/routing";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useTimeFormatContext } from "@/lib/time-format/context";
import {
  updateTimeFormatAction,
  updateVocabularyPresetAction,
} from "@/app/[locale]/(app)/settings/_actions";
import type { TimeMode } from "@/lib/utils/time-format";

const TIME_MODES: TimeMode[] = ["24h", "12h"];

const PRESET_ICONS: Record<VocabularyPresetId, LucideIcon> = {
  standard: Layers,
  photographer: Camera,
  venue: Building2,
  planner: ClipboardList,
  stylist: Scissors,
  catering: Utensils,
  entertainer: Music,
  artists: Brush,
};

const CONCEPT_ICONS: Record<VocabularyConcept, LucideIcon> = {
  inquiry: MessageSquare,
  booking: CalendarCheck,
  client: Contact,
  team: Users,
};

// Radio value for the "Match business type" card (stored as null).
const MATCH = "match";
type RadioValue = VocabularyPresetId | typeof MATCH;

function toLocale(l: string): VocabularyLocale {
  return (VOCABULARY_LOCALES as readonly string[]).includes(l)
    ? (l as VocabularyLocale)
    : "en";
}

interface CustomizePanelProps {
  initialTimeFormat?: TimeMode;
  /** Staff see the vocabulary section read-only. */
  role?: "owner" | "staff";
  /** Stored Workspace.vocabularyPreset (null = match business type). */
  vocabularyPreset?: VocabularyPresetId | null;
  /** Preset the business type resolves to (shown on the "Match" card). */
  businessPreset?: VocabularyPresetId;
}

function VocabularySection({
  role,
  initialPreset,
  businessPreset,
}: {
  role: "owner" | "staff";
  initialPreset: VocabularyPresetId | null;
  businessPreset: VocabularyPresetId;
}) {
  const t = useTranslations("app.settings.customize.vocabulary");
  const locale = toLocale(useLocale());
  const router = useRouter();
  const isOwner = role === "owner";

  const [stored, setStored] = useState<VocabularyPresetId | null>(initialPreset);
  const [pendingValue, setPendingValue] = useState<RadioValue | null>(null);
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<VocabularyPresetId | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  const values: RadioValue[] = [MATCH, ...VOCABULARY_PRESET_IDS];
  const checkedValue: RadioValue = stored ?? MATCH;
  const effective = stored ?? businessPreset;
  const shown = preview ?? effective;
  const tabStop = focusIdx ?? values.indexOf(checkedValue);

  function words(preset: VocabularyPresetId): string[] {
    return VOCABULARY_CONCEPTS.map((c) => getTerms(preset, locale, c).plural);
  }

  function choose(value: RadioValue) {
    if (!isOwner || isPending || value === checkedValue) return;
    const original = stored;
    const next = value === MATCH ? null : value;
    setPendingValue(value);
    setStored(next);
    setPreview(null);
    startTransition(async () => {
      const result = await updateVocabularyPresetAction(next);
      setPendingValue(null);
      if ("error" in result) {
        setStored(original);
        toast.error(t("error"));
        return;
      }
      router.refresh();
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>, i: number) {
    const rtl = document.dir === "rtl" || e.currentTarget.closest("[dir=rtl]") !== null;
    let n: number | null = null;
    if (e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight"))
      n = (i + 1) % values.length;
    if (e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft"))
      n = (i - 1 + values.length) % values.length;
    if (n === null) return;
    e.preventDefault();
    setFocusIdx(n);
    e.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [n]?.focus();
  }

  const cardBase =
    "relative flex gap-2 border bg-card p-3 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed";

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="vocab-heading"
      data-testid="vocabulary-section"
    >
      <div>
        <h2 id="vocab-heading" className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          {t("section")}
          <span className="inline-flex h-5 items-center rounded-sm bg-muted px-2 text-xs font-medium text-muted-foreground">
            {t("scope")}
          </span>
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      {!isOwner && (
        <div role="note" className="flex items-start gap-2.5 bg-muted p-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <b className="font-semibold">{t("memberTitle")}</b> {t("memberBody")}
          </div>
        </div>
      )}

      <div
        role="radiogroup"
        aria-labelledby="vocab-heading"
        aria-busy={isPending ? "true" : undefined}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {values.map((value, i) => {
          const checked = value === checkedValue;
          const showSpinner = isPending && pendingValue === value;
          const isMatch = value === MATCH;
          const Icon = isMatch ? Link2 : PRESET_ICONS[value];
          const wordsOf = isMatch ? null : words(value);
          const previewId = isMatch ? businessPreset : value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={!isOwner || (isPending && !showSpinner)}
              tabIndex={i === tabStop ? 0 : -1}
              onClick={() => choose(value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onFocus={() => {
                setFocusIdx(i);
                if (isOwner) setPreview(previewId === effective ? null : previewId);
              }}
              onBlur={() => setPreview(null)}
              onMouseEnter={() => isOwner && setPreview(previewId === effective ? null : previewId)}
              onMouseLeave={() => setPreview(null)}
              className={cn(
                cardBase,
                isMatch ? "items-center sm:col-span-2 lg:col-span-3" : "flex-col",
                checked ? "border-foreground" : "border-border",
                isOwner && !checked && "hover:border-muted-foreground",
                !isOwner && !checked && "opacity-60"
              )}
            >
              <span className={cn("flex items-center gap-2 font-semibold", isMatch && "shrink-0")}>
                <span className="grid size-7 place-items-center rounded-sm bg-muted">
                  <Icon className="size-4" aria-hidden />
                </span>
                {isMatch ? null : t(`presets.${value}`)}
              </span>
              {isMatch ? (
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold">{t("matchTitle")}</span>
                  <span className="text-muted-foreground">
                    {t("matchHint", { preset: t(`presets.${businessPreset}`) })}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {wordsOf!.map((w, k) => (
                    <span key={k}>
                      {k > 0 && " · "}
                      <span className="capitalize">{w}</span>
                    </span>
                  ))}
                </span>
              )}
              <span
                aria-hidden
                className={cn(
                  "grid size-[18px] shrink-0 place-items-center rounded-full border",
                  isMatch ? "ms-auto" : "absolute end-3 top-3",
                  checked ? "border-brand bg-brand text-brand-foreground" : "border-border"
                )}
              >
                {showSpinner ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  checked && <Check className="size-3" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div
        aria-live="polite"
        className="flex flex-col gap-2 bg-card p-4 ring-1 ring-foreground/10"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {t("previewTitle")}
          <span className="ms-auto text-xs font-medium text-muted-foreground">
            {preview ? t("previewing", { preset: t(`presets.${preview}`) }) : t(`presets.${effective}`)}
          </span>
        </h3>
        <ul className="flex flex-col gap-0.5" data-testid="vocabulary-preview">
          {VOCABULARY_CONCEPTS.map((c) => {
            const Icon = CONCEPT_ICONS[c];
            return (
              <li key={c} className="flex h-8 items-center gap-2 text-sm">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="capitalize">{getTerms(shown, locale, c).plural}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function CustomizePanel({
  initialTimeFormat: _initialTimeFormat,
  role = "staff",
  vocabularyPreset = null,
  businessPreset = "standard",
}: CustomizePanelProps) {
  const { theme, setTheme } = useTheme();
  const tTheme = useTranslations("app.theme");
  const tCustomize = useTranslations("app.settings.customize");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const { timeMode, setTimeMode } = useTimeFormatContext();
  const [isTimeFormatPending, startTimeFormatTransition] = useTransition();
  const [pendingTimeFormat, setPendingTimeFormat] = useState<TimeMode | null>(null);
  const [, startLocaleTransition] = useTransition();
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);

  // Locale switch remounts this component with a new `currentLocale`; clear
  // the pending flag once that lands so it can't linger past the transition.
  const [prevLocale, setPrevLocale] = useState(currentLocale);
  if (currentLocale !== prevLocale) {
    setPrevLocale(currentLocale);
    setPendingLocale(null);
  }

  function handleLocaleChange(nextLocale: string) {
    if (nextLocale === currentLocale) return;
    setPendingLocale(nextLocale);
    startLocaleTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  function handleTimeFormatChange(newFormat: TimeMode) {
    if (newFormat === timeMode) return;
    const original = timeMode;
    setPendingTimeFormat(newFormat);
    setTimeMode(newFormat);
    startTimeFormatTransition(async () => {
      const result = await updateTimeFormatAction(newFormat);
      if (!result.ok) {
        setTimeMode(original);
        toast.error(tCustomize("timeFormatError"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <VocabularySection
        role={role}
        initialPreset={vocabularyPreset}
        businessPreset={businessPreset}
      />

      {/* Theme section */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">{tCustomize("themeSection")}</h2>
          <p className="text-sm text-muted-foreground">{tCustomize("themeHint")}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEMES.map((opt) => {
            const Icon = opt.icon;
            const isActive = mounted && theme === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={cn(
                  "flex items-center justify-center gap-2 border px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground"
                    : "border-border hover:border-muted-foreground focus-visible:border-muted-foreground"
                )}
              >
                <Icon
                  className="size-4 shrink-0"
                  suppressHydrationWarning
                />
                <span suppressHydrationWarning>
                  {mounted ? tTheme(opt.labelKey) : ""}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Language section */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">{tCustomize("languageSection")}</h2>
          <p className="text-sm text-muted-foreground">{tCustomize("languageHint")}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {routing.locales.map((locale) => {
            const isActive = locale === currentLocale;
            const isPendingThis = pendingLocale === locale;

            return (
              <button
                key={locale}
                type="button"
                disabled={isActive || pendingLocale !== null}
                aria-busy={isPendingThis ? "true" : undefined}
                onClick={() => handleLocaleChange(locale)}
                className={cn(
                  "flex items-center justify-center gap-2 border px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground"
                    : "border-border hover:border-muted-foreground focus-visible:border-muted-foreground"
                )}
              >
                {isPendingThis && (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                )}
                {tCustomize(`languages.${locale}`)}
              </button>
            );
          })}
        </div>
      </section>

      {/* Time Format section */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">{tCustomize("timeFormatSection")}</h2>
          <p className="text-sm text-muted-foreground">{tCustomize("timeFormatHint")}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {TIME_MODES.map((mode) => {
            const isActive = timeMode === mode;
            const showSpinner = isTimeFormatPending && pendingTimeFormat === mode;

            return (
              <button
                key={mode}
                type="button"
                disabled={isActive || isTimeFormatPending}
                aria-busy={showSpinner ? "true" : undefined}
                onClick={() => handleTimeFormatChange(mode)}
                className={cn(
                  "flex items-center justify-center gap-2 border px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground"
                    : "border-border hover:border-muted-foreground focus-visible:border-muted-foreground"
                )}
              >
                {showSpinner && (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                )}
                {mode === "24h" ? tCustomize("time24h") : tCustomize("time12h")}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
