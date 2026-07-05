"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Plus, Check, Upload, Sparkles } from "lucide-react";
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
  },
  dark: {
    bg: "#202124",
    faviconBg: "#303134",
    faviconRing: "#5f6368",
    domain: "#e8eaed",
    breadcrumb: "#81c995",
    title: "#8ab4f8",
    description: "#bdc1c6",
  },
};

function SearchPreview({ slug, title, description }: { slug: string; title: string; description: string }) {
  const t = useTranslations("app.pageBuilder.editor.storyPrompt");
  const scheme = useForcedInverseScheme();
  const c = SERP_COLORS[scheme];
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{t("story.previewLabel")}</p>
      <div style={{ backgroundColor: c.bg }} className="flex flex-col gap-1.5 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span
            style={{ backgroundColor: c.faviconBg, borderColor: c.faviconRing }}
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

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn("h-1.5 w-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")}
        />
      ))}
    </div>
  );
}

function StepSparkleScatter({ density }: { density: "sparse" | "dense" }) {
  const dots =
    density === "dense"
      ? [
          { top: "8%", left: "12%", size: 10 },
          { top: "18%", left: "82%", size: 14 },
          { top: "70%", left: "8%", size: 8 },
          { top: "76%", left: "88%", size: 12 },
        ]
      : [{ top: "10%", left: "85%", size: 10 }];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {dots.map((d, i) => (
        <Sparkles
          key={i}
          className="absolute text-brand/40"
          style={{ top: d.top, left: d.left, width: d.size, height: d.size }}
        />
      ))}
    </div>
  );
}

const stepVariants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
};

export function StoryPromptDialog({
  open,
  workspaceName,
  initialDescription,
  initialKeywords,
  businessType,
  onContinueWithGuide,
  onExploreSelf,
}: {
  open: boolean;
  workspaceName: string;
  initialDescription: string;
  initialKeywords: string[];
  businessType: string;
  onContinueWithGuide: () => void;
  onExploreSelf: () => void;
}) {
  const t = useTranslations("app.pageBuilder.editor.storyPrompt");
  const tEditor = useTranslations("app.pageBuilder.editor");
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [description, setDescription] = useState(initialDescription);
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [tagInput, setTagInput] = useState("");
  const [savingAction, setSavingAction] = useState<"guide" | "explore" | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoAssetId, setLogoAssetId] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState("");
  const [iconAssetId, setIconAssetId] = useState("");
  const [iconUploading, setIconUploading] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const suggestedTags = SUGGESTED_TAGS[businessType] ?? SUGGESTED_TAGS.other;
  const displayTags = Array.from(new Set([...suggestedTags, ...keywords]));

  function toggleTag(tag: string) {
    if (keywords.includes(tag)) {
      setKeywords(keywords.filter((k) => k !== tag));
    } else if (keywords.length < MAX_KEYWORDS) {
      setKeywords([...keywords, tag]);
    }
  }

  function addCustomTag() {
    const trimmed = tagInput.trim().slice(0, MAX_KEYWORD_LENGTH);
    if (!trimmed || keywords.includes(trimmed) || keywords.length >= MAX_KEYWORDS) return;
    setKeywords([...keywords, trimmed]);
    setTagInput("");
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    setLogoError(null);
    try {
      const result = await uploadAsset(
        file,
        { acceptedTypes: LOGO_TYPES, maxBytes: LOGO_MAX_BYTES, maxWidth: LOGO_MAX_WIDTH, maxHeight: LOGO_MAX_HEIGHT },
        { subfolder: "portfolio_header" },
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
        { subfolder: "site_icon" },
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
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <StepDots step={step} />

        <motion.div layout transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            {step === 0 && (
              <motion.div
                key="0"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="relative flex flex-col items-center gap-4 py-6 text-center"
              >
                <StepSparkleScatter density="dense" />
                <Image src="/brand/gallurio-sq.svg" alt="" width={28} height={28} className="h-7 w-7" priority />
                <DialogTitle className="text-xl">{t("welcome.title")}</DialogTitle>
                <DialogDescription className="max-w-sm">{t("welcome.subtitle")}</DialogDescription>
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
                  className="text-muted-foreground"
                >
                  {t("welcome.skip")}
                </Button>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="1"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1">
                  <DialogTitle className="text-lg">{t("story.title")}</DialogTitle>
                  <DialogDescription>{t("story.subtitle")}</DialogDescription>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Textarea
                    value={description}
                    maxLength={MAX_DESCRIPTION}
                    placeholder={t("story.placeholder")}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-24"
                  />
                  <p className="text-end text-xs text-muted-foreground">
                    {t("story.charCount", { count: description.length, max: MAX_DESCRIPTION })}
                  </p>
                </div>
                <SearchPreview slug={slugify(workspaceName)} title={workspaceName} description={description} />
                <div className="flex justify-between gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(0)}>
                    {t("back")}
                  </Button>
                  <Button type="button" onClick={() => setStep(2)}>
                    {t("continue")}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="2"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1">
                  <DialogTitle className="text-lg">{t("vibe.title")}</DialogTitle>
                  <DialogDescription>{t("vibe.subtitle")}</DialogDescription>
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
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted"
                        )}
                      >
                        {selected && <Check className="h-3 w-3" aria-hidden="true" />}
                        {tag}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomTag();
                      }
                    }}
                    placeholder={t("vibe.addPlaceholder")}
                    disabled={keywords.length >= MAX_KEYWORDS}
                    className="flex h-8 w-full border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!tagInput.trim() || keywords.length >= MAX_KEYWORDS}
                    onClick={addCustomTag}
                    aria-label={t("vibe.addPlaceholder")}
                  >
                    <Plus />
                  </Button>
                </div>
                <div className="flex justify-between gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    {t("back")}
                  </Button>
                  <Button type="button" onClick={() => setStep(3)}>
                    {t("continue")}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="3"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1">
                  <DialogTitle className="text-lg">{t("branding.title")}</DialogTitle>
                  <DialogDescription>{t("branding.subtitle")}</DialogDescription>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted-foreground">{t("branding.logoLabel")}</p>
                  {logoUrl ? (
                    <div className="flex flex-col gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoUrl} alt="" className="h-12 w-auto max-w-full border border-border object-contain" />
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        {t("branding.logoRemove")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={logoUploading}
                      onClick={() => logoFileInputRef.current?.click()}
                      className="inline-flex min-h-24 flex-col items-center justify-center gap-2 border border-dashed border-border bg-background px-3 text-center text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
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
                  <p className="text-xs text-muted-foreground">{t("branding.iconLabel")}</p>
                  {iconUrl ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={iconUrl} alt="" className="h-12 w-12 border border-border object-contain" />
                      <button
                        type="button"
                        onClick={removeIcon}
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        {t("branding.iconRemove")}
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="story-prompt-icon-file"
                      className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border bg-background px-3 text-center text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                <div className="flex justify-between gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>
                    {t("back")}
                  </Button>
                  <Button type="button" onClick={() => setStep(4)}>
                    {t("continue")}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="4"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="relative flex flex-col items-center gap-4 py-4 text-center"
              >
                <StepSparkleScatter density="dense" />
                <DialogTitle className="text-xl">{t("done.title")}</DialogTitle>
                <DialogDescription className="max-w-sm">{t("done.subtitle")}</DialogDescription>
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
                <p className="text-xs text-muted-foreground">{t("done.footerNote")}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
