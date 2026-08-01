"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { tagBorderClass } from "@/components/app/tag-pill";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { clientFormSchema, type ClientFormInput } from "@/lib/validators/client";
import { createClientAction, updateClientAction, findClientMatchesAction } from "@/lib/actions/clients";
import { useActionError } from "@/lib/i18n/actionError";
import { ClientMatchDialog, type ClientMatchCard, type ClientMatchResolution } from "@/components/app/client-match-dialog";
import { reconcileClient } from "@/lib/clients/reconcile";
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
  /** Edit mode only: discard any draft and return to the read-only client view. */
  onView?: () => void;
};

const SOURCES = ["form", "manual", "referral", "import"] as const;

export function ClientFormModal({ open, onOpenChange, initialData, onSuccess, onDirtyChange, onView }: Props) {
  const t = useTranslations("app.clients");
  const errMsg = useActionError();
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

  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [viewAfterDiscard, setViewAfterDiscard] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [matchState, setMatchState] = useState<{ matches: ClientMatchCard[]; data: ClientFormInput } | null>(null);

  // Reset form (and the in-progress tag draft) when modal opens/closes or
  // initialData changes so a partial tag typed in one session can't survive
  // into the next.
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
      setTagInput("");
    }
  }, [open, initialData]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setTagInput("");
    onOpenChange(false);
    if (viewAfterDiscard) {
      setViewAfterDiscard(false);
      onView?.();
    }
  }

  function handleView() {
    if (!onView) return;
    if (isDirty) {
      setViewAfterDiscard(true);
      setUnsavedOpen(true);
      return;
    }
    onOpenChange(false);
    onView();
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

  async function finishCreate(data: ClientFormInput) {
    const result = await createClientAction(data);
    if ("error" in result) {
      form.setError("root", { message: errMsg(result.error) });
      return;
    }
    toast.success(t("form.createSuccess"));
    onSuccess();
    onOpenChange(false);
  }

  async function finishLink(clientId: string, data: ClientFormInput) {
    const result = await updateClientAction(clientId, data);
    if ("error" in result) {
      form.setError("root", { message: errMsg(result.error) });
      return;
    }
    // Not "created" — this path attaches to an existing client.
    toast.success(t("form.linkSuccess"));
    onSuccess();
    onOpenChange(false);
  }

  async function onSubmit(data: ClientFormInput) {
    if (isEdit) {
      const result = await updateClientAction(initialData!.id!, data);
      if ("error" in result) {
        form.setError("root", { message: errMsg(result.error) });
        return;
      }
      toast.success(t("form.updateSuccess"));
      onSuccess();
      onOpenChange(false);
      return;
    }

    const matchResult = await findClientMatchesAction({ name: data.name, email: data.email, phone: data.phone });
    if ("error" in matchResult) {
      form.setError("root", { message: errMsg(matchResult.error) });
      return;
    }
    if (matchResult.matches.length === 0) {
      await finishCreate(data);
      return;
    }
    setMatchState({ matches: matchResult.matches, data });
  }

  function handleMatchResolve(result: ClientMatchResolution) {
    const data = matchState!.data;
    setMatchState(null);
    if ("createNew" in result) {
      void finishCreate(data);
      return;
    }
    const card = matchState!.matches.find((m) => m.id === result.clientId)!;
    // updateClientAction $sets the whole document, so the merge must START from
    // the stored client. A field the form left blank is not a conflict and so
    // never appears in `picks` — building from `data` would silently erase it.
    const reconciled = reconcileClient(
      { email: card.email, phone: card.phone, notes: card.notes, tags: card.tags },
      data
    );
    const merged: ClientFormInput = {
      name: card.name,
      email: card.email,
      phone: card.phone,
      notes: card.notes ?? "",
      source: card.source,
      tags: reconciled.tags ?? [],
    };
    // Fill blanks from what was typed, then apply the explicit picks.
    for (const change of reconciled.additive) merged[change.field] = change.value;
    for (const conflict of reconciled.conflicts) {
      if (result.picks[conflict.field] === "typed") merged[conflict.field] = conflict.typedValue;
    }
    void finishLink(result.clientId, merged);
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
        <DialogContent showCloseButton={false} className="flex max-h-[calc(100dvh-2rem)] sm:max-w-lg flex-col gap-0 p-0">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <DialogTitle>{isEdit ? t("form.editTitle") : t("form.addTitle")}</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleOpenChange(false)}
              aria-label={t("detail.close")}
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
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

              {/* Row 2: Email */}
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

              {/* Row 3: Phone + Source */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cf-phone">{t("form.phone")}</Label>
                  <Controller
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <PhoneInput
                        id="cf-phone"
                        value={field.value ?? undefined}
                        onChange={(value: string | undefined) => field.onChange(value ?? null)}
                        placeholder={t("form.phonePlaceholder")}
                      />
                    )}
                  />
                  {form.formState.errors.phone && (
                    <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("form.source")}</Label>
                  <Select
                    value={form.watch("source")}
                    onValueChange={(v) => form.setValue("source", v as ClientFormInput["source"], { shouldDirty: true })}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value: string | null) =>
                          value ? (
                            <span className="capitalize">
                              {t(`sourceValues.${value}` as Parameters<typeof t>[0])}
                            </span>
                          ) : null
                        }
                      </SelectValue>
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
              </div>

              {/* Row 4: Tags */}
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
                  <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-flex items-center gap-1 border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground ${tagBorderClass(tag)}`}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-h-0 sm:min-w-0"
                          aria-label={t("form.removeTag", { tag })}
                        >
                          <XIcon className="size-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Row 5: Notes */}
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
            </div>

            {/* Footer */}
            <div className="flex shrink-0 flex-row flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
              {isEdit && onView ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleView}
                  disabled={isSubmitting}
                  className="min-h-11 sm:mr-auto sm:min-h-0"
                >
                  {t("form.view")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="min-h-11 sm:min-h-0"
              >
                {t("form.cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={isSubmitting}
                className="min-h-11 sm:min-h-0"
              >
                {t("form.save")}
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

      {matchState && (
        <ClientMatchDialog
          open
          matches={matchState.matches}
          typed={{
            name: matchState.data.name,
            email: matchState.data.email ?? null,
            phone: matchState.data.phone ?? null,
            notes: matchState.data.notes,
            tags: matchState.data.tags,
          }}
          mode="create"
          onResolve={handleMatchResolve}
          onCancel={() => setMatchState(null)}
        />
      )}
    </>
  );
}
