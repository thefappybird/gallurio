"use client";

import { useEffect, useState } from "react";
import { AlertTriangleIcon, CheckIcon, PlusIcon, XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";
import type { GalleryMetaRow, PickerItem } from "./types";

export const WIZARD_TITLE_MAX = 300;
export const WIZARD_CAPTION_MAX = 2000;
export const WIZARD_ALT_MAX = 300;
export const WIZARD_LOCATION_MAX = 300;
export const WIZARD_CLIENT_MAX = 300;
export const WIZARD_TAG_MAX = 40;
export const WIZARD_TAGS_CAP = 20;
export const WIZARD_META_LABEL_MAX = 120;
export const WIZARD_META_VALUE_MAX = 120;
export const WIZARD_META_CAP = 20;

/** Fully resolved copy — no i18n call inside the component (see ImageMetaDialog). */
export type ImageWizardLabels = {
  heading: string;
  position: (current: number, total: number) => string;
  fieldTitle: string;
  fieldTitlePlaceholder: string;
  fieldCaption: string;
  fieldCaptionPlaceholder: string;
  fieldAlt: string;
  fieldAltHelp: string;
  fieldAltPlaceholder: string;
  altCounter: (count: number, max: number) => string;
  fieldDate: string;
  fieldLocation: string;
  fieldLocationPlaceholder: string;
  fieldClient: string;
  fieldClientPlaceholder: string;
  fieldTags: string;
  fieldTagsPlaceholder: string;
  fieldTagsHint: string;
  removeTag: (tag: string) => string;
  fieldMeta: string;
  fieldMetaHint: string;
  metaLabelPlaceholder: string;
  metaValuePlaceholder: string;
  addMetaRow: string;
  removeMetaRow: (n: number) => string;
  savedBadge: string;
  unsavedBadge: string;
  jumpToPhoto: (n: number) => string;
  previous: string;
  next: string;
  finish: string;
  close: string;
  /** Maps a server error code (or null for a network/unknown failure) to a display string. */
  errorMessage: (code: string | null) => string;
};

type WizardForm = {
  title: string;
  caption: string;
  altText: string;
  date: string;
  location: string;
  client: string;
  tags: string[];
  meta: GalleryMetaRow[];
};

function baselineForm(item: PickerItem): WizardForm {
  return {
    title: item.title ?? "",
    caption: item.caption ?? "",
    altText: item.altText ?? "",
    date: item.date ?? "",
    location: item.location ?? "",
    client: item.client ?? "",
    tags: item.tags ?? [],
    meta: item.meta ?? [],
  };
}

function sameForm(a: WizardForm, b: WizardForm): boolean {
  return (
    a.title === b.title &&
    a.caption === b.caption &&
    a.altText === b.altText &&
    a.date === b.date &&
    a.location === b.location &&
    a.client === b.client &&
    a.tags.length === b.tags.length &&
    a.tags.every((t, i) => t === b.tags[i]) &&
    a.meta.length === b.meta.length &&
    a.meta.every((m, i) => m.label === b.meta[i]?.label && m.value === b.meta[i]?.value)
  );
}

/**
 * Post-upload metadata wizard: one photo at a time, one PATCH per photo.
 * A failed save never loses another photo's already-saved data — every
 * image's local form + saved snapshot is tracked independently by id.
 */
export function ImageMetaWizard({
  items,
  open,
  onOpenChange,
  onSaved,
  labels,
}: {
  items: PickerItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: PickerItem) => void;
  labels: ImageWizardLabels;
}) {
  const [index, setIndex] = useState(0);
  const [forms, setForms] = useState<Record<string, WizardForm>>({});
  const [savedSnapshots, setSavedSnapshots] = useState<Record<string, WizardForm>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const initial: Record<string, WizardForm> = {};
      for (const it of items) initial[it.id] = baselineForm(it);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: resets the wizard for a fresh batch each time it opens
      setForms(initial);
      setSavedSnapshots({});
      setSavedIds(new Set());
      setErrorById({});
      setIndex(0);
    }
    // `items` is a fixed snapshot handed to the wizard on open; re-running on
    // every identity change would wipe in-progress edits mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Same workaround as ImageMetaDialog: the editor's global Puck-hotkey guard
  // is a document-level, capture-phase keydown listener that swallows Escape
  // whenever the event target is a text input/textarea (which most of this
  // wizard's fields are) — before it ever reaches this dialog. `window`
  // captures ahead of `document`, so we intercept there instead.
  useEffect(() => {
    if (!open) return;
    function onWindowKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || saving) return;
      e.stopPropagation();
      handleFinish();
    }
    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saving, index, forms, savedSnapshots]);

  if (items.length === 0) return null;
  const current = items[Math.min(index, items.length - 1)];
  const form = forms[current.id] ?? baselineForm(current);
  const isLast = index === items.length - 1;
  const currentError = errorById[current.id] ?? null;

  function isDirty(id: string): boolean {
    const item = items.find((it) => it.id === id);
    if (!item) return false;
    const f = forms[id] ?? baselineForm(item);
    const snapshot = savedSnapshots[id] ?? baselineForm(item);
    return !sameForm(f, snapshot);
  }

  function updateForm(patch: Partial<WizardForm>) {
    setForms((f) => ({ ...f, [current.id]: { ...(f[current.id] ?? baselineForm(current)), ...patch } }));
  }

  async function saveItem(id: string): Promise<boolean> {
    const toSave = forms[id];
    if (!toSave) return true;
    setSaving(true);
    setErrorById((e) => ({ ...e, [id]: null }));
    try {
      const res = await fetch(`/api/portfolio/gallery/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: toSave.title,
          caption: toSave.caption,
          altText: toSave.altText,
          date: toSave.date,
          location: toSave.location,
          client: toSave.client,
          tags: toSave.tags,
          meta: toSave.meta,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data && typeof data.error === "string" ? data.error : null;
        setErrorById((e) => ({ ...e, [id]: labels.errorMessage(code) }));
        return false;
      }
      setSavedSnapshots((s) => ({ ...s, [id]: toSave }));
      setSavedIds((s) => new Set(s).add(id));
      onSaved(data as PickerItem);
      return true;
    } catch {
      setErrorById((e) => ({ ...e, [id]: labels.errorMessage(null) }));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function goTo(target: number) {
    if (target < 0 || target >= items.length || target === index) return;
    if (isDirty(current.id)) {
      const ok = await saveItem(current.id);
      if (!ok) return;
    }
    setIndex(target);
  }

  // The only exit path, shared by the finish button, Escape and the dialog's
  // own close: leaving SAVES, exactly like moving between photos. The wizard is
  // skippable, so a half-filled photo is a valid outcome and there is nothing
  // to "discard"; a failed save keeps the wizard open with its error rather
  // than dropping the edits on the floor.
  async function handleFinish() {
    if (isDirty(current.id)) {
      const ok = await saveItem(current.id);
      if (!ok) return;
    }
    onOpenChange(false);
  }


  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? undefined : handleFinish())}>
        <DialogContent
          showCloseButton={false}
          className="flex h-dvh w-full max-w-[calc(100%-1rem)] flex-col overflow-hidden sm:h-[80vh] sm:max-w-xl"
        >
          <DialogHeader>
            <DialogTitle>{labels.heading}</DialogTitle>
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {labels.position(index + 1, items.length)}
            </p>
          </DialogHeader>

          {items.length > 1 && (
            <ul className="flex gap-1.5 overflow-x-auto pb-1" aria-label={labels.heading}>
              {items.map((it, i) => {
                const status = savedIds.has(it.id) ? "saved" : errorById[it.id] ? "error" : "idle";
                return (
                  <li key={it.id} className="shrink-0">
                    <button
                      type="button"
                      aria-label={labels.jumpToPhoto(i + 1)}
                      aria-current={i === index ? "step" : undefined}
                      disabled={saving}
                      onClick={() => void goTo(i)}
                      className={cn(
                        "relative block size-9 overflow-hidden border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
                        i === index ? "border-foreground" : "border-border"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.thumbUrl} alt="" className="size-full object-cover" />
                      {status === "saved" && (
                        <span className="absolute bottom-0 end-0 inline-flex size-3.5 items-center justify-center bg-foreground text-background">
                          <CheckIcon className="size-2.5" aria-hidden />
                        </span>
                      )}
                      {status === "error" && (
                        <span className="absolute bottom-0 end-0 inline-flex size-3.5 items-center justify-center bg-destructive text-primary-foreground">
                          <AlertTriangleIcon className="size-2.5" aria-hidden />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div key={current.id} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.thumbUrl}
                alt=""
                className="size-16 shrink-0 overflow-hidden border border-border object-cover"
              />
              <span
                className={cn(
                  "inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-medium",
                  savedIds.has(current.id) && !isDirty(current.id)
                    ? "border-border bg-muted text-muted-foreground"
                    : "border-border text-muted-foreground"
                )}
              >
                {savedIds.has(current.id) && !isDirty(current.id) ? (
                  <>
                    <CheckIcon className="size-3" aria-hidden /> {labels.savedBadge}
                  </>
                ) : (
                  labels.unsavedBadge
                )}
              </span>
            </div>

            <FormField label={labels.fieldTitle}>
              {({ id }) => (
                <Input
                  id={id}
                  autoFocus
                  value={form.title}
                  placeholder={labels.fieldTitlePlaceholder}
                  maxLength={WIZARD_TITLE_MAX}
                  disabled={saving}
                  onChange={(e) => updateForm({ title: e.target.value })}
                />
              )}
            </FormField>

            <FormField label={labels.fieldCaption}>
              {({ id }) => (
                <Textarea
                  id={id}
                  value={form.caption}
                  placeholder={labels.fieldCaptionPlaceholder}
                  maxLength={WIZARD_CAPTION_MAX}
                  disabled={saving}
                  onChange={(e) => updateForm({ caption: e.target.value })}
                />
              )}
            </FormField>

            <FormField
              label={labels.fieldAlt}
              hint={
                <span className="flex flex-col gap-0.5">
                  <span>{labels.fieldAltHelp}</span>
                  <span aria-live={WIZARD_ALT_MAX - form.altText.length <= 20 ? "polite" : undefined}>
                    {labels.altCounter(form.altText.length, WIZARD_ALT_MAX)}
                  </span>
                </span>
              }
            >
              {({ id }) => (
                <Textarea
                  id={id}
                  value={form.altText}
                  placeholder={labels.fieldAltPlaceholder}
                  maxLength={WIZARD_ALT_MAX}
                  disabled={saving}
                  onChange={(e) => updateForm({ altText: e.target.value })}
                />
              )}
            </FormField>

            <FormField label={labels.fieldDate}>
              {({ id }) => (
                <Input
                  id={id}
                  type="date"
                  value={form.date}
                  disabled={saving}
                  onChange={(e) => updateForm({ date: e.target.value })}
                  className="w-full sm:w-48"
                />
              )}
            </FormField>

            <FormField label={labels.fieldLocation}>
              {({ id }) => (
                <Input
                  id={id}
                  value={form.location}
                  placeholder={labels.fieldLocationPlaceholder}
                  maxLength={WIZARD_LOCATION_MAX}
                  disabled={saving}
                  onChange={(e) => updateForm({ location: e.target.value })}
                />
              )}
            </FormField>

            <FormField label={labels.fieldClient}>
              {({ id }) => (
                <Input
                  id={id}
                  value={form.client}
                  placeholder={labels.fieldClientPlaceholder}
                  maxLength={WIZARD_CLIENT_MAX}
                  disabled={saving}
                  onChange={(e) => updateForm({ client: e.target.value })}
                />
              )}
            </FormField>

            <TagsField
              tags={form.tags}
              onChange={(tags) => updateForm({ tags })}
              label={labels.fieldTags}
              placeholder={labels.fieldTagsPlaceholder}
              hint={labels.fieldTagsHint}
              removeLabel={labels.removeTag}
              disabled={saving}
            />

            <MetaRowsField
              rows={form.meta}
              onChange={(meta) => updateForm({ meta })}
              label={labels.fieldMeta}
              hint={labels.fieldMetaHint}
              labelPlaceholder={labels.metaLabelPlaceholder}
              valuePlaceholder={labels.metaValuePlaceholder}
              addLabel={labels.addMetaRow}
              removeLabel={labels.removeMetaRow}
              disabled={saving}
            />

            {currentError && (
              <p role="alert" className="text-xs text-destructive">
                {currentError}
              </p>
            )}
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <div className="flex gap-2">
              {items.length > 1 && (
                <Button type="button" variant="outline" onClick={() => void goTo(index - 1)} disabled={index === 0 || saving}>
                  {labels.previous}
                </Button>
              )}
              {isLast ? (
                <Button type="button" onClick={handleFinish} loading={saving} disabled={saving}>
                  {labels.finish}
                </Button>
              ) : (
                <Button type="button" onClick={() => void goTo(index + 1)} loading={saving} disabled={saving}>
                  {labels.next}
                </Button>
              )}
            </div>
            <Button type="button" variant="ghost" onClick={handleFinish} disabled={saving}>
              {labels.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}

function TagsField({
  tags,
  onChange,
  label,
  placeholder,
  hint,
  removeLabel,
  disabled,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  label: string;
  placeholder: string;
  hint: string;
  removeLabel: (tag: string) => string;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const val = draft.trim();
    setDraft("");
    if (!val) return;
    const parts = val.split(",").map((p) => p.trim()).filter(Boolean);
    const next = [...tags];
    for (const p of parts) {
      if (next.length >= WIZARD_TAGS_CAP) break;
      const clipped = p.slice(0, WIZARD_TAG_MAX);
      if (!next.includes(clipped)) next.push(clipped);
    }
    onChange(next);
  }

  return (
    <FormField label={label} hint={hint}>
      {({ id }) => (
        <div className="flex flex-col gap-1.5">
          <Input
            id={id}
            value={draft}
            placeholder={placeholder}
            maxLength={WIZARD_TAG_MAX}
            disabled={disabled || tags.length >= WIZARD_TAGS_CAP}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commit();
              }
            }}
            onBlur={commit}
          />
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((tag, i) => (
                <li key={`${tag}-${i}`} className="inline-flex items-center gap-1 border border-border bg-muted/40 px-2 py-1 text-xs">
                  <span>{tag}</span>
                  <button
                    type="button"
                    aria-label={removeLabel(tag)}
                    disabled={disabled}
                    onClick={() => onChange(tags.filter((_, j) => j !== i))}
                    className="inline-flex size-4 items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <XIcon className="size-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </FormField>
  );
}

function MetaRowsField({
  rows,
  onChange,
  label,
  hint,
  labelPlaceholder,
  valuePlaceholder,
  addLabel,
  removeLabel,
  disabled,
}: {
  rows: GalleryMetaRow[];
  onChange: (rows: GalleryMetaRow[]) => void;
  label: string;
  hint: string;
  labelPlaceholder: string;
  valuePlaceholder: string;
  addLabel: string;
  removeLabel: (n: number) => string;
  disabled: boolean;
}) {
  function updateRow(i: number, patch: Partial<GalleryMetaRow>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    if (rows.length >= WIZARD_META_CAP) return;
    onChange([...rows, { label: "", value: "" }]);
  }
  function removeRow(i: number) {
    onChange(rows.filter((_, j) => j !== i));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {rows.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <Input
                aria-label={`${label} ${i + 1} ${labelPlaceholder}`}
                value={row.label}
                placeholder={labelPlaceholder}
                maxLength={WIZARD_META_LABEL_MAX}
                disabled={disabled}
                onChange={(e) => updateRow(i, { label: e.target.value })}
                className="w-28 min-w-0 flex-none sm:w-32"
              />
              <Input
                aria-label={`${label} ${i + 1} ${valuePlaceholder}`}
                value={row.value}
                placeholder={valuePlaceholder}
                maxLength={WIZARD_META_VALUE_MAX}
                disabled={disabled}
                onChange={(e) => updateRow(i, { value: e.target.value })}
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                aria-label={removeLabel(i + 1)}
                disabled={disabled}
                onClick={() => removeRow(i)}
                className="inline-flex size-8 shrink-0 items-center justify-center border border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                <XIcon className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 self-start"
        disabled={disabled || rows.length >= WIZARD_META_CAP}
        onClick={addRow}
      >
        <PlusIcon className="size-4" aria-hidden /> {addLabel}
      </Button>
    </div>
  );
}
