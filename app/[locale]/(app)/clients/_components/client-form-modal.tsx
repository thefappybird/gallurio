"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { clientFormSchema, type ClientFormInput } from "@/lib/validators/client";
import { createClientAction, updateClientAction } from "@/lib/actions/clients";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

// ClientRow shape needed for pre-fill (edit mode)
export type ClientFormData = {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  source?: string;
  tags?: string[];
  notes?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ClientFormData;
  onSuccess: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const SOURCES = ["form", "manual", "referral", "import"] as const;

export function ClientFormModal({ open, onOpenChange, initialData, onSuccess, onDirtyChange }: Props) {
  const t = useTranslations("app.clients");
  const isEdit = !!initialData?.id;

  const form = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      email: initialData?.email ?? null,
      phone: initialData?.phone ?? null,
      source: (initialData?.source as ClientFormInput["source"]) ?? "manual",
      tags: initialData?.tags ?? [],
      notes: initialData?.notes ?? "",
    },
  });

  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: initialData?.name ?? "",
        email: initialData?.email ?? null,
        phone: initialData?.phone ?? null,
        source: (initialData?.source as ClientFormInput["source"]) ?? "manual",
        tags: initialData?.tags ?? [],
        notes: initialData?.notes ?? "",
      });
    }
  }, [open, initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next && isDirty) {
      setUnsavedOpen(true);
      return;
    }
    onOpenChange(next);
  }

  function handleDiscard() {
    setUnsavedOpen(false);
    form.reset();
    onOpenChange(false);
  }

  function addTag(raw: string) {
    const tag = raw.trim().slice(0, 40);
    if (!tag) return;
    const current = form.getValues("tags");
    if (!current.includes(tag)) {
      form.setValue("tags", [...current, tag], { shouldDirty: true });
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    const current = form.getValues("tags");
    form.setValue("tags", current.filter((t) => t !== tag), { shouldDirty: true });
  }

  async function onSubmit(data: ClientFormInput) {
    const result = isEdit
      ? await updateClientAction(initialData!.id!, data)
      : await createClientAction(data);

    if ("error" in result) {
      form.setError("root", { message: result.error });
      return;
    }

    toast.success(isEdit ? t("form.updateSuccess") : t("form.createSuccess"));
    onSuccess();
    onOpenChange(false);
  }

  const tags = form.watch("tags");
  const { isSubmitting, isDirty } = form.formState;

  // Surface dirty state to the parent so it can guard navigation/target swaps.
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false} className="flex max-w-lg flex-col gap-0 p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <DialogTitle>{isEdit ? t("form.editTitle") : t("form.addTitle")}</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleOpenChange(false)}
              aria-label={t("detail.close")}
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4 py-4">
            {/* Row 1: Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cf-name">{t("form.name")} *</Label>
              <Input
                id="cf-name"
                placeholder={t("form.namePlaceholder")}
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Row 2: Email + Phone */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cf-email">{t("form.email")}</Label>
                <Input
                  id="cf-email"
                  type="email"
                  placeholder={t("form.emailPlaceholder")}
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cf-phone">{t("form.phone")}</Label>
                <Input
                  id="cf-phone"
                  placeholder={t("form.phonePlaceholder")}
                  {...form.register("phone")}
                />
              </div>
            </div>

            {/* Row 3: Source + Tags */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{t("form.source")}</Label>
                <Select
                  value={form.watch("source")}
                  onValueChange={(v) => form.setValue("source", v as ClientFormInput["source"], { shouldDirty: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`sourceValues.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("form.tags")}</Label>
                <Input
                  placeholder={t("form.tagsPlaceholder")}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                />
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-foreground"
                          aria-label={t("form.removeTag", { tag })}
                        >
                          <XIcon className="size-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 4: Notes */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cf-notes">{t("form.notes")}</Label>
              <textarea
                id="cf-notes"
                placeholder={t("form.notesPlaceholder")}
                rows={3}
                className="w-full resize-none border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                {...form.register("notes")}
              />
            </div>

            {/* Root error */}
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            {/* Footer */}
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("form.cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? t("form.saving") : t("form.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={unsavedOpen}
        onKeepEditing={() => setUnsavedOpen(false)}
        onDiscard={handleDiscard}
      />
    </>
  );
}
