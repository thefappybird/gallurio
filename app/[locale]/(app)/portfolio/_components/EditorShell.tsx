"use client";

import "@measured/puck/puck.css";
import "./editor.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Puck, type Config, type Data } from "@measured/puck";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
// Client-safe editor config (lightweight previews, identical fields). The real
// server blocks render only on the public page via <Render>; importing them here
// would pull Mongo + AsyncLocalStorage into the client bundle (build break).
import { editorPuckConfig } from "@/lib/page-builder/editorConfig";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import type {
  PortfolioBrandKit,
  PortfolioContactConfig,
  PuckData,
} from "@/lib/page-builder/types";
import {
  savePortfolioDraftAction,
  publishPortfolioAction,
} from "../_actions";
import { PublishDialog } from "./PublishDialog";
import { ThemePanelDialog } from "./ThemePanelDialog";
import { ContactPanelDialog } from "./ContactPanelDialog";
import { MobileBanner } from "./MobileBanner";
import { CollectionsManagerDialog } from "@/lib/page-builder/galleryPicker/CollectionsManagerDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Puck-editable zones (each round-trips its own Puck data). "contact" is a tab
// too, but it's the fixed prebuilt form — previewed, never Puck-edited.
type Zone = "home" | "gallery";
type Tab = Zone | "contact";
type SaveStatus = "idle" | "saving" | "saved";

type Props = {
  slug: string;
  workspaceName: string;
  initialData: { home: PuckData; gallery: PuckData };
  initialBrandKit: PortfolioBrandKit;
  initialContact: PortfolioContactConfig;
  /** Per-page public chrome language ("" = auto from workspace country). */
  initialFormLocale: string;
  publicOrigin: string;
  /** Locale-aware path to the chrome-less preview route (iframe src base). */
  previewBasePath: string;
};

const EMPTY_ZONE: PuckData = { content: [], root: {} };
const AUTOSAVE_MS = 1500;
const TABS: readonly Tab[] = ["home", "gallery", "contact"] as const;

// The editor is uncontrolled per zone — Puck owns the live edit state and emits
// it via onChange. Each content item needs a stable props.id; seeded template
// data has none, so add deterministic ids before handing data to <Puck>.
function ensureIds(data: PuckData): Data {
  const withIds = (items: PuckData["content"], prefix: string) =>
    (items ?? []).map((b, i) => ({
      ...b,
      props: { id: (b.props?.id as string) ?? `${prefix}-${b.type}-${i}`, ...b.props },
    }));
  return {
    root: data.root ?? {},
    content: withIds(data.content, "c"),
    zones: data.zones
      ? Object.fromEntries(Object.entries(data.zones).map(([k, v]) => [k, withIds(v, k)]))
      : undefined,
  } as Data;
}

export function EditorShell({
  slug,
  workspaceName,
  initialData,
  initialBrandKit,
  initialContact,
  initialFormLocale,
  publicOrigin,
  previewBasePath,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor");

  const [activeZone, setActiveZone] = useState<Zone>("home");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [previewMode, setPreviewMode] = useState(false);
  // Bumped to force the preview iframe to reload with the freshest draft.
  const [previewNonce, setPreviewNonce] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [brandKit, setBrandKit] = useState(initialBrandKit);
  const [contact, setContact] = useState(initialContact);
  const [formLocale, setFormLocale] = useState(initialFormLocale);
  const [publishOpen, setPublishOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);

  const isContact = activeTab === "contact";
  const showPuck = !isContact && !previewMode;

  // Source of truth for each zone's latest data, updated by Puck's onChange.
  // A ref (not state) so editing doesn't re-feed Puck mid-session.
  const zoneDataRef = useRef<Record<Zone, PuckData>>({
    home: initialData.home ?? EMPTY_ZONE,
    gallery: initialData.gallery ?? EMPTY_ZONE,
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Puck emits onChange once on mount (and again on the zone-switch remount).
  // Skip that first emission so merely loading a zone doesn't autosave/bump the
  // version — only genuine edits should.
  const ignoreNextChange = useRef(true);
  // Snapshots taken when a side panel opens, so closing it without saving reverts
  // the live preview to the last-saved value (no "looks saved but isn't" trap).
  const themeSnapshot = useRef<PortfolioBrandKit | null>(null);
  const contactSnapshot = useRef<PortfolioContactConfig | null>(null);
  const formLocaleSnapshot = useRef<string | null>(null);

  // The data object handed to <Puck> at mount. Set only on zone switch (in the
  // event handler, from the ref) and initialized from props — never read the ref
  // during render. Paired with key={activeZone} so brand-kit re-renders (which
  // re-run this component) never reset the editor mid-edit.
  const [puckSeed, setPuckSeed] = useState<Data>(() =>
    ensureIds(initialData.home ?? EMPTY_ZONE)
  );

  const saveZone = useCallback(async (zone: Zone, data: PuckData): Promise<boolean> => {
    setSaveStatus("saving");
    const res = await savePortfolioDraftAction({ zone, data });
    if ("error" in res) {
      setSaveStatus("idle");
      toast.error(t("errorToast"));
      return false;
    }
    setSaveStatus("saved");
    return true;
  }, [t]);

  // Persist a debounced edit immediately if one is pending; no-op otherwise.
  const flushPendingSave = useCallback(async (zone: Zone): Promise<boolean> => {
    if (!saveTimer.current) return true;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    return saveZone(zone, zoneDataRef.current[zone]);
  }, [saveZone]);

  // Flush a pending autosave when leaving the active zone (effect cleanup runs on
  // zone change) and on unmount — so a final edit made within the debounce window
  // isn't lost, and the debounced timer never fires after the component is gone.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        // Intentionally read the LATEST ref value at flush time — that's the
        // freshest edit for the zone this effect was set up for (captured in
        // `activeZone`). Not a DOM-node ref, so the exhaustive-deps caution
        // about stale refs doesn't apply.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        void saveZone(activeZone, zoneDataRef.current[activeZone]);
      }
    };
  }, [activeZone, saveZone]);

  const handleChange = useCallback(
    (data: Data) => {
      const next = data as unknown as PuckData;
      zoneDataRef.current[activeZone] = next;
      if (ignoreNextChange.current) {
        ignoreNextChange.current = false;
        return; // mount/remount echo — capture data, but don't autosave.
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const zone = activeZone;
      saveTimer.current = setTimeout(() => void saveZone(zone, next), AUTOSAVE_MS);
    },
    [activeZone, saveZone]
  );

  async function selectTab(tab: Tab) {
    if (tab === activeTab) return;

    if (tab === "contact") {
      // Persist any in-flight edit of the editable zone we're leaving so the
      // preview (and a later publish) reflect it, then show the contact preview.
      if (!isContact) await flushPendingSave(activeZone);
      setActiveTab("contact");
      setPreviewNonce((n) => n + 1);
      return;
    }

    // Entering an editable zone (home/gallery).
    if (!isContact) await flushPendingSave(activeZone);
    // The new zone remounts <Puck> (key change) and echoes onChange — ignore it.
    ignoreNextChange.current = true;
    setPuckSeed(ensureIds(zoneDataRef.current[tab]));
    setActiveZone(tab);
    setActiveTab(tab);
    // Carry the preview/edit preference across zones; reload the iframe if shown.
    if (previewMode) setPreviewNonce((n) => n + 1);
  }

  async function togglePreview() {
    if (previewMode) {
      // Back to editing — remount Puck from the freshest data; ignore its echo.
      ignoreNextChange.current = true;
      setPuckSeed(ensureIds(zoneDataRef.current[activeZone]));
      setPreviewMode(false);
      return;
    }
    // Entering preview — guarantee the iframe shows the latest edits.
    await flushPendingSave(activeZone);
    setPreviewNonce((n) => n + 1);
    setPreviewMode(true);
  }

  async function handlePublish() {
    // Persist the active zone's latest edits FIRST and only publish if that
    // succeeds — otherwise we'd flip publishedAt against a stale draft while
    // telling the owner their newest edits went live.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const saved = await saveZone(activeZone, zoneDataRef.current[activeZone]);
    if (!saved) return;
    const res = await publishPortfolioAction();
    if ("error" in res) {
      toast.error(t("errorToast"));
      return;
    }
    // Leave the indicator on "saved" — never a lingering "Saving…" after publish.
    setSaveStatus("saved");
    setPublishOpen(false);
    toast.success(t("publishedToast"));
    if (!showPuck) setPreviewNonce((n) => n + 1);
  }

  function openTheme() {
    themeSnapshot.current = brandKit;
    setThemeOpen(true);
  }
  function closeTheme(saved: boolean) {
    if (!saved && themeSnapshot.current) setBrandKit(themeSnapshot.current);
    setThemeOpen(false);
    if (saved && !showPuck) setPreviewNonce((n) => n + 1);
  }
  function openContact() {
    contactSnapshot.current = contact;
    formLocaleSnapshot.current = formLocale;
    setContactOpen(true);
  }
  function closeContact(saved: boolean) {
    if (!saved) {
      if (contactSnapshot.current) setContact(contactSnapshot.current);
      if (formLocaleSnapshot.current !== null) setFormLocale(formLocaleSnapshot.current);
    }
    setContactOpen(false);
    if (saved && isContact) setPreviewNonce((n) => n + 1);
  }

  const { cssVars, className } = resolveBrandKit(brandKit);
  const headerTitle = `${workspaceName} · ${t(`zone.${activeTab}`)}`;
  const previewSrc = `${previewBasePath}?zone=${isContact ? "contact" : activeZone}&v=${previewNonce}`;

  // Shared toolbar contents. `publishSlot` is Puck's own Publish button in edit
  // mode, or our equivalent in preview mode. The save-status sits BELOW the
  // button row, right-aligned under the controls.
  function renderControls(publishSlot: React.ReactNode) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1" role="group" aria-label={t("zone.groupLabel")}>
            {TABS.map((tab) => (
              <Button
                key={tab}
                type="button"
                size="sm"
                variant={activeTab === tab ? "default" : "outline"}
                aria-pressed={activeTab === tab}
                onClick={() => void selectTab(tab)}
              >
                {t(`zone.${tab}`)}
              </Button>
            ))}
          </div>
          {!isContact && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={previewMode}
              onClick={() => void togglePreview()}
            >
              {previewMode ? t("preview.edit") : t("preview.show")}
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setPhotosOpen(true)}>
            {t("photos")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={openTheme}>
            {t("theme")}
          </Button>
          {isContact && (
            <Button type="button" size="sm" variant="outline" onClick={openContact}>
              {t("contactSettings")}
            </Button>
          )}
          {publishSlot}
        </div>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saveStatus === "saving"
            ? t("save.saving")
            : saveStatus === "saved"
              ? t("save.saved")
              : t("save.idle")}
        </span>
      </div>
    );
  }

  return (
    <>
      <MobileBanner publicUrl={`${publicOrigin}/w/${slug}`} />

      <div
        className={cn("gallurio-editor", className)}
        style={cssVars as React.CSSProperties}
      >
        {showPuck ? (
          <Puck
            key={activeZone}
            // Cast to the base Config so Puck's deep generic inference doesn't blow
            // tsc's stack; editorPuckConfig is typed at the component level already.
            config={editorPuckConfig as unknown as Config}
            data={puckSeed}
            onChange={handleChange}
            onPublish={() => setPublishOpen(true)}
            iframe={{ enabled: false }}
            headerTitle={headerTitle}
            viewports={[
              { width: 1280, label: "Desktop", icon: "Monitor" },
              { width: 768, label: "Tablet", icon: "Tablet" },
              { width: 390, label: "Mobile", icon: "Smartphone" },
            ]}
            overrides={{
              headerActions: ({ children }) => renderControls(children),
            }}
          />
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
              <span className="min-w-0 truncate text-sm font-medium">{headerTitle}</span>
              {renderControls(
                <Button type="button" size="sm" onClick={() => setPublishOpen(true)}>
                  {t("publish")}
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-muted/40">
              <iframe
                key={previewNonce}
                src={previewSrc}
                title={t("preview.title")}
                className="h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        )}
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onConfirm={handlePublish}
        publicUrl={`${publicOrigin}/w/${slug}`}
      />
      <ThemePanelDialog
        open={themeOpen}
        brandKit={brandKit}
        onBrandKitChange={setBrandKit}
        onSaved={() => closeTheme(true)}
        onCancel={() => closeTheme(false)}
      />
      <ContactPanelDialog
        open={contactOpen}
        contact={contact}
        onContactChange={setContact}
        formLocale={formLocale}
        onFormLocaleChange={setFormLocale}
        onSaved={() => closeContact(true)}
        onCancel={() => closeContact(false)}
      />
      <CollectionsManagerDialog open={photosOpen} onOpenChange={setPhotosOpen} />
    </>
  );
}
