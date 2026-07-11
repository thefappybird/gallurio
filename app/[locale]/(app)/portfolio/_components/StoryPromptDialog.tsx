"use client";

import type { ReactNode } from "react";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Plus, Check, Upload, X } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { resolveScheme } from "@/lib/theme/themes";
import { uploadAsset } from "@/lib/storage/uploadAsset.client";
import { useImageRetry } from "@/hooks/useImageRetry";
import { AmbientBackground } from "@/components/app/ambient-background";
import { completeStoryPromptAction } from "../_actions";

const MAX_DESCRIPTION = 300;

const LOGO_MAX_BYTES = 250 * 1024;
const LOGO_MAX_WIDTH = 512;
const LOGO_MAX_HEIGHT = 256;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

const SITE_ICON_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;
const SITE_ICON_MAX_BYTES = 1 * 1024 * 1024;
const SITE_ICON_MAX_DIM = 512;

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "your-page"
  );
}

const MAX_KEYWORDS = 10;
const MAX_KEYWORD_LENGTH = 40;

const SUGGESTED_TAGS: Record<string, string[]> = {
  photographer: ["Documentary", "Candid", "Studio", "Editorial", "Destination Weddings", "Same-Day Edit"],
  venue: ["Garden", "Ballroom", "Rustic", "Industrial", "Beachfront", "Rooftop"],
  planner: ["Full-Service", "Day-Of Coordination", "Destination", "Luxury", "Intimate Weddings", "Corporate Events"],
  stylist: ["Bridal", "Editorial", "Natural Glam", "Avant-Garde", "On-Location", "Airbrush"],
  catering: ["Plated", "Buffet", "Family-Style", "Farm-to-Table", "Fusion", "Dessert Bar"],
  entertainer: ["Live Band", "DJ", "Acoustic", "String Quartet", "MC Hosting", "Interactive"],
  other: ["Creative", "Modern", "Classic", "Bold", "Minimal", "Elegant"],
};

type SerpScheme = "light" | "dark";

function useForcedInverseScheme(): SerpScheme {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);
  if (!mounted) return "dark";
  return resolveScheme(resolvedTheme) === "dark" ? "light" : "dark";
}

const SERP_COLORS: Record<
  SerpScheme,
  {
    bg: string;
    faviconBg: string;
    faviconRing: string;
    domain: string;
    breadcrumb: string;
    title: string;
    description: string;
    faviconText: string;
  }
> = {
  light: {
    bg: "#ffffff",
    faviconBg: "#f1f3f4",
    faviconRing: "#dfe1e5",
    domain: "#202124",
    breadcrumb: "#006621",
    title: "#1a0dab",
    description: "#4d5156",
    faviconText: "#202124",
  },
  dark: {
    bg: "#202124",
    faviconBg: "#303134",
    faviconRing: "#5f6368",
    domain: "#e8eaed",
    breadcrumb: "#81c995",
    title: "#8ab4f8",
    description: "#bdc1c6",
    faviconText: "#e8eaed",
  },
};

function SearchPreview({ slug, title, description }: { slug: string; title: string; description: string }) {
  const t = useTranslations("app.pageBuilder.editor.storyPrompt");
  const scheme = useForcedInverseScheme();
  const c = SERP_COLORS[scheme];
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-foreground/80">{t("story.previewLabel")}</p>
      <div style={{ backgroundColor: c.bg }} className="flex flex-col gap-1.5 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span
            style={{ backgroundColor: c.faviconBg, borderColor: c.faviconRing, color: c.faviconText }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
          >
            {title.charAt(0).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span style={{ color: c.domain }} className="truncate text-xs font-medium">
              {title}
            </span>
            <span style={{ color: c.breadcrumb }} className="truncate text-xs">
              gallurio.com › w › {slug}
            </span>
          </div>
        </div>
        <p style={{ color: c.title, fontFamily: "Georgia, serif" }} className="truncate text-lg">
          {title}
        </p>
        <p style={{ color: c.description }} className="line-clamp-2 text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

type StoryStep = 0 | 1 | 2 | 3 | 4;

function storyChipClass(active: boolean) {
  return cn(
    "inline-flex min-h-8 items-center gap-1.5 border px-2 py-1 text-xs font-medium transition-colors",
    "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "border-foreground bg-accent text-accent-foreground"
      : "border-border bg-popover text-popover-foreground",
  );
}

function StepDots({ step, onStepChange }: { step: StoryStep; onStepChange: (step: StoryStep) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`Step ${i + 1}`}
          aria-current={i === step ? "step" : undefined}
          disabled={i > step}
          onClick={() => onStepChange(i as StoryStep)}
          className={cn(
            "h-2 w-2 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed",
            i <= step ? "border-foreground bg-foreground" : "border-foreground/45 bg-foreground/25"
          )}
        />
      ))}
    </div>
  );
}

function StepFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-testid="story-prompt-action-footer"
      className={cn("mt-auto flex gap-2 pt-3", className)}
    >
      {children}
    </div>
  );
}

export function StoryPromptDialog({
  open,
  workspaceName,
  initialDescription,
  initialKeywords,
  businessType,
  persistOnExit = true,
  onContinueWithGuide,
  onExploreSelf,
  onBrandingSaved,
}: {
  open: boolean;
  workspaceName: string;
  initialDescription: string;
  initialKeywords: string[];
  businessType: string;
  persistOnExit?: boolean;
  onContinueWithGuide: () => void;
  onExploreSelf: () => void;
  onBrandingSaved?: (branding: {
    logoUrl: string;
    logoAssetId: string;
    siteIconUrl: string;
    siteIconAssetId: string;
  }) => void;
}) {
  const t = useTranslations("app.pageBuilder.editor.storyPrompt");
  const tEditor = useTranslations("app.pageBuilder.editor");
  const [step, setStep] = useState<StoryStep>(0);
  const [description, setDescription] = useState(initialDescription);
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [tagInput, setTagInput] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [savingAction, setSavingAction] = useState<"guide" | "explore" | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoAssetId, setLogoAssetId] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState("");
  const [iconAssetId, setIconAssetId] = useState("");
  const [iconUploading, setIconUploading] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);
  const logo = useImageRetry(logoUrl);
  const icon = useImageRetry(iconUrl);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const suggestedTags = SUGGESTED_TAGS[businessType] ?? SUGGESTED_TAGS.other;
  const displayTags = Array.from(new Set([...suggestedTags, ...keywords]));

  function toggleTag(tag: string) {
    if (keywords.includes(tag)) {
      setKeywords(keywords.filter((k) => k !== tag));
    } else if (keywords.length < MAX_KEYWORDS) {
      setKeywords([...keywords, tag]);
    }
  }

  function normalizeTags(value: string) {
    return value
      .split(/\s+/)
      .map((tag) => tag.trim().slice(0, MAX_KEYWORD_LENGTH))
      .filter(Boolean);
  }

  function addDraftTagsFromText(value: string) {
    const nextTags = normalizeTags(value);
    if (nextTags.length === 0) return;
    setDraftTags((current) => {
      const merged = [...current];
      for (const tag of nextTags) {
        if (keywords.length + merged.length >= MAX_KEYWORDS) break;
        if (!keywords.includes(tag) && !merged.includes(tag)) merged.push(tag);
      }
      return merged;
    });
    setTagInput("");
  }

  function commitDraftTags(value = tagInputRef.current?.value ?? tagInput) {
    const nextTags = normalizeTags(value);
    setKeywords((current) => {
      const merged = [...current];
      for (const tag of [...draftTags, ...nextTags]) {
        if (merged.length >= MAX_KEYWORDS) break;
        if (!merged.includes(tag)) merged.push(tag);
      }
      return merged;
    });
    setDraftTags([]);
    setTagInput("");
  }

  function handleTagInputChange(value: string) {
    if (/\s/.test(value)) {
      const hasTrailingWhitespace = /\s$/.test(value);
      const parts = value.split(/\s+/);
      const completed = hasTrailingWhitespace ? parts : parts.slice(0, -1);
      const draft = hasTrailingWhitespace ? "" : parts.at(-1) ?? "";
      addDraftTagsFromText(completed.join(" "));
      setTagInput(draft.slice(0, MAX_KEYWORD_LENGTH));
      return;
    }
    setTagInput(value.slice(0, MAX_KEYWORD_LENGTH));
  }

  function restoreLastTagToInput() {
    if (tagInput.length > 0 || draftTags.length === 0) return;
    const lastTag = draftTags[draftTags.length - 1];
    setDraftTags(draftTags.slice(0, -1));
    setTagInput(lastTag);
  }

  function removeDraftTag(tag: string) {
    setDraftTags(draftTags.filter((k) => k !== tag));
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    setLogoError(null);
    try {
      const result = await uploadAsset(
        file,
        { acceptedTypes: LOGO_TYPES, maxBytes: LOGO_MAX_BYTES, maxWidth: LOGO_MAX_WIDTH, maxHeight: LOGO_MAX_HEIGHT },
        { subfolder: "portfolio_header", delivery: { width: 512, height: 256, fit: "scale-down" } },
      );
      if ("error" in result) {
        const key = {
          type_not_accepted: "type",
          file_too_large: "size",
          dimensions_too_large: "dimensions",
          invalid_image: "image",
        }[result.error];
        setLogoError(t(`branding.logoErrors.${key}` as Parameters<typeof t>[0]));
        return;
      }
      setLogoUrl(result.asset.url);
      setLogoAssetId(result.asset.assetId);
    } catch {
      setLogoError(t("branding.logoErrors.upload"));
    } finally {
      setLogoUploading(false);
    }
  }
  function removeLogo() {
    setLogoUrl("");
    setLogoAssetId("");
    setLogoError(null);
  }

  async function uploadIcon(file: File) {
    setIconUploading(true);
    setIconError(null);
    try {
      const result = await uploadAsset(
        file,
        { acceptedTypes: SITE_ICON_TYPES, maxBytes: SITE_ICON_MAX_BYTES, maxWidth: SITE_ICON_MAX_DIM, maxHeight: SITE_ICON_MAX_DIM },
        { subfolder: "site_icon", delivery: { width: 512, height: 512, fit: "scale-down" } },
      );
      if ("error" in result) {
        const key = {
          type_not_accepted: "type",
          file_too_large: "size",
          dimensions_too_large: "dimensions",
          invalid_image: "image",
        }[result.error];
        setIconError(t(`branding.iconErrors.${key}` as Parameters<typeof t>[0]));
        return;
      }
      setIconUrl(result.asset.url);
      setIconAssetId(result.asset.assetId);
    } catch {
      setIconError(t("branding.iconErrors.upload"));
    } finally {
      setIconUploading(false);
    }
  }
  function removeIcon() {
    setIconUrl("");
    setIconAssetId("");
    setIconError(null);
  }

  async function handleExit(kind: "guide" | "explore") {
    setSavingAction(kind);
    try {
      if (persistOnExit) {
        const res = await completeStoryPromptAction({
          description,
          keywords,
          logoUrl,
          logoAssetId,
          siteIconUrl: iconUrl,
          siteIconAssetId: iconAssetId,
        });
        if ("error" in res) {
          toast.error(tEditor("errorToast"));
          return;
        }
        onBrandingSaved?.({ logoUrl, logoAssetId, siteIconUrl: iconUrl, siteIconAssetId: iconAssetId });
      }
      if (kind === "guide") onContinueWithGuide();
      else onExploreSelf();
    } finally {
      setSavingAction(null);
    }
  }

  const busy = savingAction !== null;

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={() => {
        // no-op: this dialog is non-dismissible until the owner completes or skips it.
      }}
    >
      <DialogContent
        className="min-h-[560px] overflow-hidden bg-onboarding-bg p-0 text-foreground sm:min-h-[480px] sm:max-w-3xl"
        showCloseButton={false}
      >
        <AmbientBackground />
        <div className="relative mx-auto flex h-full min-h-[560px] w-full max-w-lg flex-col gap-4 p-4 sm:min-h-[480px] sm:p-6">
          <StepDots step={step} onStepChange={setStep} />

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {step === 0 && (
              <div className="relative flex w-full flex-col items-center justify-center gap-4 py-6 text-center">
                <Image src="/brand/gallurio-sq.svg" alt="" width={28} height={28} className="h-7 w-7 scale-200" priority />
                <DialogTitle className="text-xl">{t("welcome.title")}</DialogTitle>
                <DialogDescription className="max-w-sm text-foreground/85">{t("welcome.subtitle")}</DialogDescription>
                <Button type="button" onClick={() => setStep(1)} className="mt-2">
                  {t("welcome.cta")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={savingAction === "explore"}
                  disabled={busy && savingAction !== "explore"}
                  onClick={() => void handleExit("explore")}
                  className="text-foreground/80 hover:text-foreground"
                >
                  {t("welcome.skip")}
                </Button>
              </div>
            )}

            {step === 1 && (
              <div className="flex min-h-0 w-full flex-col">
                <div className="flex flex-1 flex-col justify-center gap-4 pb-4">
                <div className="flex flex-col gap-1">
                  <DialogTitle className="text-lg">{t("story.title")}</DialogTitle>
                  <DialogDescription className="text-foreground/85">{t("story.subtitle")}</DialogDescription>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Textarea
                    value={description}
                    maxLength={MAX_DESCRIPTION}
                    placeholder={t("story.placeholder")}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-24 bg-popover text-popover-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-end text-xs font-medium text-foreground/75">
                    {t("story.charCount", { count: description.length, max: MAX_DESCRIPTION })}
                  </p>
                </div>
                <SearchPreview slug={slugify(workspaceName)} title={workspaceName} description={description} />
                </div>
                <StepFooter className="justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(0)}>
                    {t("back")}
                  </Button>
                  <Button type="button" onClick={() => setStep(2)}>
                    {t("continue")}
                  </Button>
                </StepFooter>
              </div>
            )}

            {step === 2 && (
              <div className="flex min-h-0 w-full flex-col">
                <div className="flex flex-1 flex-col justify-center gap-4 pb-4">
                <div className="flex flex-col gap-1">
                  <DialogTitle className="text-lg">{t("vibe.title")}</DialogTitle>
                  <DialogDescription className="text-foreground/85">{t("vibe.subtitle")}</DialogDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {displayTags.map((tag) => {
                    const selected = keywords.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleTag(tag)}
                        className={storyChipClass(selected)}
                      >
                        {selected && <Check className="h-3 w-3" aria-hidden="true" />}
                        {tag}
                      </button>
                    );
                  })}
                </div>
                <form
                  className="flex gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitDraftTags();
                  }}
                >
                  <div className="flex min-h-10 flex-1 flex-wrap items-center gap-1.5 border border-input bg-popover px-2 py-1.5 text-popover-foreground focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                    {draftTags.map((tag) => (
                      <span
                        key={tag}
                        className={cn(storyChipClass(true), "max-w-full")}
                      >
                        <span className="max-w-36 truncate">{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeDraftTag(tag)}
                          aria-label={`Remove draft ${tag}`}
                          className="-me-1 inline-flex size-4 items-center justify-center text-foreground/75 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                    <input
                      ref={tagInputRef}
                      type="text"
                      value={tagInput}
                      onChange={(e) => handleTagInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Spacebar" || e.code === "Space") {
                          e.preventDefault();
                          addDraftTagsFromText(e.currentTarget.value);
                        }
                        if (e.key === "Backspace") {
                          restoreLastTagToInput();
                        }
                      }}
                      placeholder={draftTags.length > 0 ? "" : t("vibe.addPlaceholder")}
                      disabled={keywords.length + draftTags.length >= MAX_KEYWORDS}
                      className="h-6 min-w-24 flex-1 bg-transparent text-sm text-popover-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    size="icon"
                    disabled={keywords.length >= MAX_KEYWORDS || (draftTags.length === 0 && !tagInput.trim())}
                    aria-label={t("vibe.addPlaceholder")}
                    title={t("vibe.addPlaceholder")}
                    className="h-auto min-h-10 self-stretch"
                  >
                    <Plus />
                  </Button>
                </form>
                </div>
                <StepFooter className="justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    {t("back")}
                  </Button>
                  <Button type="button" onClick={() => setStep(3)}>
                    {t("continue")}
                  </Button>
                </StepFooter>
              </div>
            )}

            {step === 3 && (
              <div className="flex min-h-0 w-full flex-col">
                <div className="flex flex-1 flex-col justify-center gap-4 pb-4">
                <div className="flex flex-col gap-1">
                  <DialogTitle className="text-lg">{t("branding.title")}</DialogTitle>
                  <DialogDescription className="text-foreground/85">{t("branding.subtitle")}</DialogDescription>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-foreground/80">{t("branding.logoLabel")}</p>
                  {logoUrl && !logo.failed ? (
                    <div className="flex flex-col gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logo.src}
                        alt=""
                        onError={logo.onError}
                        className="h-12 w-auto max-w-full border border-border object-contain"
                      />
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="text-xs font-medium text-foreground/80 underline hover:text-foreground"
                      >
                        {t("branding.logoRemove")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={logoUploading}
                      onClick={() => logoFileInputRef.current?.click()}
                      className="inline-flex min-h-24 flex-col items-center justify-center gap-2 border border-dashed border-border bg-popover px-3 text-center text-xs font-medium text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
                    >
                      <Upload className="size-3.5" aria-hidden />
                      <span>{logoUploading ? t("branding.logoUploading") : t("branding.logoUpload")}</span>
                      <span>{t("branding.logoRequirements")}</span>
                    </button>
                  )}
                  {logoError ? (
                    <p role="alert" className="text-xs text-destructive">
                      {logoError}
                    </p>
                  ) : null}
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadLogo(file);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-foreground/80">{t("branding.iconLabel")}</p>
                  {iconUrl && !icon.failed ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={icon.src}
                        alt=""
                        onError={icon.onError}
                        className="h-12 w-12 border border-border object-contain"
                      />
                      <button
                        type="button"
                        onClick={removeIcon}
                        className="text-xs font-medium text-foreground/80 underline hover:text-foreground"
                      >
                        {t("branding.iconRemove")}
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="story-prompt-icon-file"
                      className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border bg-popover px-3 text-center text-xs font-medium text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Upload className="size-3.5" aria-hidden />
                      <span>{iconUploading ? t("branding.iconUploading") : t("branding.iconUpload")}</span>
                      <span>{t("branding.iconRequirements")}</span>
                    </label>
                  )}
                  {iconError ? (
                    <p role="alert" className="text-xs text-destructive">
                      {iconError}
                    </p>
                  ) : null}
                  <input
                    id="story-prompt-icon-file"
                    type="file"
                    accept={SITE_ICON_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadIcon(file);
                      e.target.value = "";
                    }}
                  />
                </div>
                </div>
                <StepFooter className="justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>
                    {t("back")}
                  </Button>
                  <Button type="button" onClick={() => setStep(4)}>
                    {t("continue")}
                  </Button>
                </StepFooter>
              </div>
            )}

            {step === 4 && (
              <div className="relative flex w-full flex-col items-center justify-center gap-4 py-4 text-center">
                <DialogTitle className="text-xl">{t("done.title")}</DialogTitle>
                <DialogDescription className="max-w-sm text-foreground/85">{t("done.subtitle")}</DialogDescription>
                <div className="flex w-full max-w-xs flex-col gap-2">
                  <Button
                    type="button"
                    loading={savingAction === "guide"}
                    disabled={busy && savingAction !== "guide"}
                    onClick={() => void handleExit("guide")}
                  >
                    {t("done.continueWithGuide")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    loading={savingAction === "explore"}
                    disabled={busy && savingAction !== "explore"}
                    onClick={() => void handleExit("explore")}
                  >
                    {t("done.exploreSelf")}
                  </Button>
                </div>
                <p className="text-xs font-medium text-foreground/75">{t("done.footerNote")}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
