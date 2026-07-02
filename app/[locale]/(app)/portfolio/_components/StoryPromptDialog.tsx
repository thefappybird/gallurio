"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { completeStoryPromptAction } from "../_actions";

const MAX_DESCRIPTION = 300;

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

const SUGGESTED_TAGS: Record<string, string[]> = {
  photographer: ["Documentary", "Candid", "Studio", "Editorial", "Destination Weddings", "Same-Day Edit"],
  venue: ["Garden", "Ballroom", "Rustic", "Industrial", "Beachfront", "Rooftop"],
  planner: ["Full-Service", "Day-Of Coordination", "Destination", "Luxury", "Intimate Weddings", "Corporate Events"],
  stylist: ["Bridal", "Editorial", "Natural Glam", "Avant-Garde", "On-Location", "Airbrush"],
  catering: ["Plated", "Buffet", "Family-Style", "Farm-to-Table", "Fusion", "Dessert Bar"],
  entertainer: ["Live Band", "DJ", "Acoustic", "String Quartet", "MC Hosting", "Interactive"],
  other: ["Creative", "Modern", "Classic", "Bold", "Minimal", "Elegant"],
};

function SearchPreview({ slug, title, description }: { slug: string; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1.5 border border-border p-3">
      <p className="truncate text-[13px] text-muted-foreground">gallurio.com › w › {slug}</p>
      <p className="truncate text-base text-primary">{title}</p>
      <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn("h-1.5 w-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")}
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
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [description, setDescription] = useState(initialDescription);
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [tagInput, setTagInput] = useState("");
  const [savingAction, setSavingAction] = useState<"guide" | "explore" | null>(null);

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
    const trimmed = tagInput.trim();
    if (!trimmed || keywords.includes(trimmed) || keywords.length >= MAX_KEYWORDS) return;
    setKeywords([...keywords, trimmed]);
    setTagInput("");
  }

  async function handleExit(kind: "guide" | "explore") {
    setSavingAction(kind);
    try {
      const res = await completeStoryPromptAction({ description, keywords });
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

        <div className="overflow-hidden">
          <AnimatePresence initial={false}>
            {step === 0 && (
              <motion.div
                key="0"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex flex-col items-center gap-4 py-6 text-center"
              >
                <DialogTitle className="text-xl">{t("welcome.title")}</DialogTitle>
                <DialogDescription className="max-w-sm">{t("welcome.subtitle")}</DialogDescription>
                <Button type="button" onClick={() => setStep(1)} className="mt-2">
                  {t("welcome.cta")}
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
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm transition-colors",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted"
                        )}
                      >
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
                className="flex flex-col items-center gap-4 py-4 text-center"
              >
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
