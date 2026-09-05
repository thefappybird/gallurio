"use client";

/**
 * Image block's Content-tab metadata section — edits the underlying
 * GalleryItem record (title/description/alt text/date/location/client/tags/
 * custom meta rows) for the photo currently picked into this Image block.
 *
 * Everything here lives on the GalleryItem itself and is shared by every
 * placement of this photo. There is intentionally no separate per-instance
 * alt-text field on the Image block.
 *
 * Resolving the block's `_style.bgImagePublicId` (a Cloudflare asset id) to
 * the GalleryItem that owns it, and persisting edits back, both go through
 * server endpoints — see the inline fetch calls below for the exact contract.
 */

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TagsInput } from "@/components/ui/tags-input";

const TITLE_MAX = 300;
const LOCATION_MAX = 300;
const CLIENT_MAX = 300;
const CAPTION_MAX = 2000;
const ALT_MAX = 300;
const META_MAX_ROWS = 20;
const META_LABEL_MAX = 120;
const META_VALUE_MAX = 120;

type MetaRow = { label: string; value: string };

export type GalleryItemMeta = {
  id: string;
  caption: string | null;
  altText: string | null;
  title: string;
  date: string;
  location: string;
  client: string;
  tags: string[];
  meta: MetaRow[];
};

type FormState = {
  caption: string;
  altText: string;
  title: string;
  date: string;
  location: string;
  client: string;
  tags: string[];
  meta: MetaRow[];
};

function toFormState(item: GalleryItemMeta): FormState {
  return {
    caption: item.caption ?? "",
    altText: item.altText ?? "",
    title: item.title ?? "",
    date: item.date ?? "",
    location: item.location ?? "",
    client: item.client ?? "",
    tags: item.tags ?? [],
    meta: item.meta ?? [],
  };
}

function buildPayload(f: FormState) {
  return {
    caption: f.caption,
    altText: f.altText,
    title: f.title,
    date: f.date,
    location: f.location,
    client: f.client,
    tags: f.tags,
    meta: f.meta
      .filter((row) => row.label.trim() || row.value.trim())
      .map((row) => ({
        label: row.label.trim().slice(0, META_LABEL_MAX),
        value: row.value.trim().slice(0, META_VALUE_MAX),
      })),
  };
}

type Phase = "no-asset" | "loading" | "not-found" | "load-error" | "ready";
type SaveStatus = "idle" | "saving" | "saved" | "error";

const inputClass =
  "h-9 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const textareaClass =
  "border border-border bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

// Fetch outcome, tagged with the assetId it resolves — lets render derive the
// current phase by comparing `load.forAssetId` against the current `assetId`
// prop instead of resetting state imperatively inside the effect (a stale
// in-flight fetch for a since-replaced assetId is simply ignored at render
// time, no cancellation flag required).
type LoadState =
  | { kind: "idle"; forAssetId: null }
  | { kind: "loading"; forAssetId: string }
  | { kind: "ready"; forAssetId: string; item: GalleryItemMeta }
  | { kind: "not-found"; forAssetId: string }
  | { kind: "load-error"; forAssetId: string };

export function ImageBlockMetaSection({
  assetId,
  onSaved,
}: {
  assetId: string | undefined;
  onSaved?: (item: GalleryItemMeta) => void;
}) {
  const t = useTranslations("app.pageBuilder.editor.imageBlockDetails");
  const tagsInputId = useId();

  const [load, setLoad] = useState<LoadState>(
    assetId ? { kind: "loading", forAssetId: assetId } : { kind: "idle", forAssetId: null }
  );
  const [form, setForm] = useState<FormState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const pendingRef = useRef(false);
  const queuedRef = useRef<FormState | null>(null);
  const lastFailedRef = useRef<FormState | null>(null);

  const item = load.kind === "ready" && load.forAssetId === assetId ? load.item : null;

  // `idle` carries forAssetId: null, so once assetId is a string and
  // load.forAssetId matches it, the idle variant is already excluded — no
  // separate check for it is reachable here.
  const phase: Phase = !assetId
    ? "no-asset"
    : load.forAssetId !== assetId
      ? "loading"
      : load.kind;

  useEffect(() => {
    if (!assetId) return;
    fetch(`/api/portfolio/gallery/items/by-asset/${encodeURIComponent(assetId)}`)
      .then(async (res) => {
        if (res.status === 404) {
          setLoad({ kind: "not-found", forAssetId: assetId });
          return;
        }
        if (!res.ok) {
          setLoad({ kind: "load-error", forAssetId: assetId });
          return;
        }
        const data = (await res.json()) as GalleryItemMeta;
        setLoad({ kind: "ready", forAssetId: assetId, item: data });
        setForm(toFormState(data));
        setSaveStatus("idle");
      })
      .catch(() => {
        setLoad({ kind: "load-error", forAssetId: assetId });
      });
  }, [assetId, reloadToken]);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const id = setTimeout(() => setSaveStatus("idle"), 2000);
    return () => clearTimeout(id);
  }, [saveStatus]);

  // Plain (hoisted) function, not useCallback: it recurses to drain the save
  // queue, and a function declaration can safely reference itself by name.
  //
  // PATCHes by-asset (not by item id): an assetId can back several GalleryItem
  // docs (adding the same photo to a second collection copies the row), and
  // the section tells the owner these details live on the photo and update
  // everywhere it appears — writing only the representative row would make
  // that false. The route fans the write out to every copy in the workspace
  // and reports how many it touched via `matched`.
  function save(next: FormState) {
    if (!item || !assetId) return;
    if (pendingRef.current) {
      queuedRef.current = next;
      return;
    }
    pendingRef.current = true;
    setSaveStatus("saving");
    fetch(`/api/portfolio/gallery/items/by-asset/${encodeURIComponent(assetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(next)),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("save_failed");
        const data = (await res.json()) as GalleryItemMeta & { matched: number };
        lastFailedRef.current = null;
        setMatchedCount(data.matched);
        setSaveStatus("saved");
        setLoad({ kind: "ready", forAssetId: assetId, item: data });
        onSaved?.(data);
      })
      .catch(() => {
        lastFailedRef.current = next;
        setSaveStatus("error");
      })
      .finally(() => {
        pendingRef.current = false;
        const queued = queuedRef.current;
        if (queued) {
          queuedRef.current = null;
          save(queued);
        }
      });
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleBlurSave() {
    if (form) save(form);
  }

  function addMetaRow() {
    setForm((prev) => {
      if (!prev || prev.meta.length >= META_MAX_ROWS) return prev;
      return { ...prev, meta: [...prev.meta, { label: "", value: "" }] };
    });
  }

  function removeMetaRow(index: number) {
    setForm((prev) => {
      if (!prev) return prev;
      const nextMeta = prev.meta.filter((_, i) => i !== index);
      const next = { ...prev, meta: nextMeta };
      save(next);
      return next;
    });
  }

  function updateMetaRow(index: number, patch: Partial<MetaRow>) {
    setForm((prev) => {
      if (!prev) return prev;
      const nextMeta = prev.meta.map((row, i) => (i === index ? { ...row, ...patch } : row));
      return { ...prev, meta: nextMeta };
    });
  }

  if (phase === "no-asset") {
    return (
      <div className="border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">{t("chooseImagePrompt")}</p>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 border border-border bg-muted/30 p-3">
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (phase === "not-found") {
    return (
      <div className="border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  if (phase === "load-error") {
    return (
      <div className="flex flex-col gap-2 border border-border bg-muted/30 p-3">
        <p role="alert" className="text-xs text-destructive">
          {t("loadError")}
        </p>
        <Button type="button" variant="outline" size="xs" onClick={() => setReloadToken((n) => n + 1)}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!item || !form) return null;

  return (
    <div className="flex flex-col gap-3 border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("heading")}
        </span>
        <SaveIndicator
          status={saveStatus}
          savingLabel={t("saving")}
          savedLabel={
            matchedCount !== null && matchedCount > 1 ? t("savedInPlaces", { count: matchedCount }) : t("saved")
          }
          errorLabel={t("saveError")}
          retryLabel={t("retry")}
          onRetry={() => lastFailedRef.current && save(lastFailedRef.current)}
        />
      </div>

      <p className="text-xs text-muted-foreground">{t("sharedNotice")}</p>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("titleLabel")}</span>
        <input
          type="text"
          value={form.title}
          maxLength={TITLE_MAX}
          onChange={(e) => updateField("title", e.target.value)}
          onBlur={handleBlurSave}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("descriptionLabel")}</span>
        <textarea
          rows={3}
          value={form.caption}
          maxLength={CAPTION_MAX}
          onChange={(e) => updateField("caption", e.target.value)}
          onBlur={handleBlurSave}
          className={textareaClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("altLabel")}</span>
        <input
          type="text"
          value={form.altText}
          maxLength={ALT_MAX}
          onChange={(e) => updateField("altText", e.target.value)}
          onBlur={handleBlurSave}
          className={inputClass}
        />
        <span className="text-xs text-muted-foreground">{t("altHint")}</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("dateLabel")}</span>
        <input
          type="date"
          value={form.date}
          onChange={(e) => updateField("date", e.target.value)}
          onBlur={handleBlurSave}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("locationLabel")}</span>
        <input
          type="text"
          value={form.location}
          maxLength={LOCATION_MAX}
          onChange={(e) => updateField("location", e.target.value)}
          onBlur={handleBlurSave}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("clientLabel")}</span>
        <input
          type="text"
          value={form.client}
          maxLength={CLIENT_MAX}
          onChange={(e) => updateField("client", e.target.value)}
          onBlur={handleBlurSave}
          className={inputClass}
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={tagsInputId}>{t("tagsLabel")}</label>
        <TagsInput
          id={tagsInputId}
          tags={form.tags}
          onChange={(tags) => {
            const next = { ...form, tags };
            setForm(next);
            save(next);
          }}
          placeholder={t("tagsPlaceholder")}
          maxTags={20}
          maxTagLength={40}
          removeLabel={(tag) => t("removeTag", { tag })}
        />
        <span className="text-xs text-muted-foreground">{t("tagsHint")}</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("metaLabel")}
        </span>
        {form.meta.map((row, index) => (
          <div key={index} className="flex items-start gap-1.5">
            <input
              type="text"
              aria-label={t("metaLabelPlaceholder")}
              placeholder={t("metaLabelPlaceholder")}
              value={row.label}
              maxLength={META_LABEL_MAX}
              onChange={(e) => updateMetaRow(index, { label: e.target.value })}
              onBlur={handleBlurSave}
              className={`${inputClass} min-w-0 flex-1`}
            />
            <input
              type="text"
              aria-label={t("metaValuePlaceholder")}
              placeholder={t("metaValuePlaceholder")}
              value={row.value}
              maxLength={META_VALUE_MAX}
              onChange={(e) => updateMetaRow(index, { value: e.target.value })}
              onBlur={handleBlurSave}
              className={`${inputClass} min-w-0 flex-1`}
            />
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              aria-label={t("metaRemove", { index: index + 1 })}
              onClick={() => removeMetaRow(index)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={addMetaRow}
          disabled={form.meta.length >= META_MAX_ROWS}
          className="self-start"
        >
          <Plus aria-hidden="true" />
          {t("metaAdd")}
        </Button>
        {form.meta.length >= META_MAX_ROWS && (
          <span className="text-xs text-muted-foreground">{t("metaLimitReached")}</span>
        )}
      </div>
    </div>
  );
}

function SaveIndicator({
  status,
  savingLabel,
  savedLabel,
  errorLabel,
  retryLabel,
  onRetry,
}: {
  status: SaveStatus;
  savingLabel: string;
  savedLabel: string;
  errorLabel: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  if (status === "idle") return null;
  return (
    <div aria-live="polite" className="flex items-center gap-1.5 text-xs">
      {status === "saving" && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          {savingLabel}
        </span>
      )}
      {status === "saved" && <span className="text-muted-foreground">{savedLabel}</span>}
      {status === "error" && (
        <span role="alert" className="flex items-center gap-1.5 text-destructive">
          {errorLabel}
          <Button type="button" variant="outline" size="xs" onClick={onRetry}>
            {retryLabel}
          </Button>
        </span>
      )}
    </div>
  );
}
