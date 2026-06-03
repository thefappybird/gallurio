"use client";

import "@measured/puck/puck.css";
import "./editor.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Puck, usePuck, type Config, type Data } from "@measured/puck";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Smartphone, Tablet, Monitor, PanelLeft, PanelRight } from "lucide-react";
// Client-safe editor config (lightweight previews, identical fields). The real
// server blocks render only on the public page via <Render>; importing them here
// would pull Mongo + AsyncLocalStorage into the client bundle (build break).
import { editorPuckConfig } from "@/lib/page-builder/editorConfig";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import type {
  PortfolioBrandKit,
  PortfolioContactConfig,
  PortfolioSavedTheme,
  PuckData,
} from "@/lib/page-builder/types";
import {
  savePortfolioDraftAction,
  publishPortfolioAction,
  switchTemplateAction,
  dismissPortfolioGuideAction,
} from "../_actions";
import { PublishDialog } from "./PublishDialog";
import { ThemePanelDialog } from "./ThemePanelDialog";
import { ContactPanelDialog } from "./ContactPanelDialog";
import { MobileBanner } from "./MobileBanner";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { PortfolioGuideOverlay } from "./PortfolioGuideOverlay";
import { CollectionsManagerDialog } from "@/lib/page-builder/galleryPicker/CollectionsManagerDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Puck-editable zones (each round-trips its own Puck data). "contact" is a tab
// too, but it's the fixed prebuilt form — previewed, never Puck-edited.
type Zone = "home" | "gallery";
type Tab = Zone | "contact";
type SaveStatus = "idle" | "saving" | "saved";

/** Serializable starter-template summary for the in-editor switcher. */
export type EditorTemplateSummary = {
  id: string;
  label: string;
  description: string;
  defaultBrandKit: PortfolioBrandKit;
};

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
  /** Starter templates for the switcher. */
  templates: EditorTemplateSummary[];
  /** Id of the template the page is currently seeded from. */
  currentTemplateId: string;
  /** Whether the owner already dismissed the first-run guide overlay. */
  guideDismissed: boolean;
  /** Owner's saved named themes (server-loaded). */
  initialSavedThemes: PortfolioSavedTheme[];
};

const EMPTY_ZONE: PuckData = { content: [], root: {} };
const AUTOSAVE_MS = 1500;
const TABS: readonly Tab[] = ["home", "gallery", "contact"] as const;

// Device preview widths — shared by the in-canvas (Puck viewport) toggle and the
// standalone iframe preview. Mirrors the <Puck viewports> prop.
type PreviewDevice = "mobile" | "tablet" | "desktop";
const DEVICES: readonly { key: PreviewDevice; label: string; width: number; Icon: typeof Monitor }[] = [
  { key: "mobile", label: "Mobile", width: 390, Icon: Smartphone },
  { key: "tablet", label: "Tablet", width: 768, Icon: Tablet },
  { key: "desktop", label: "Desktop", width: 1280, Icon: Monitor },
] as const;

/**
 * In-canvas edit controls: the Components/Properties sidebar toggles (which the
 * default Puck header would otherwise provide via `children` — lost when we use
 * the `overrides.header` slot) plus the device viewport toggle that clamps the
 * edit canvas. Lives inside Puck so `usePuck` has context.
 */
function EditCanvasControls() {
  const { appState, dispatch } = usePuck();
  const current = appState.ui.viewports.current.width;
  const { leftSideBarVisible, rightSideBarVisible } = appState.ui;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Editor controls">
      <Button
        type="button"
        size="icon-sm"
        variant={leftSideBarVisible ? "default" : "outline"}
        aria-pressed={leftSideBarVisible}
        aria-label="Toggle blocks panel"
        title="Toggle blocks panel"
        onClick={() => dispatch({ type: "setUi", ui: (p) => ({ leftSideBarVisible: !p.leftSideBarVisible }) })}
      >
        <PanelLeft className="size-4" aria-hidden />
      </Button>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      {DEVICES.map(({ key, label, width, Icon }) => (
        <Button
          key={key}
          type="button"
          size="icon-sm"
          variant={current === width ? "default" : "outline"}
          aria-pressed={current === width}
          aria-label={label}
          title={label}
          onClick={() =>
            dispatch({
              type: "setUi",
              ui: (prev) => ({ viewports: { ...prev.viewports, current: { width, height: "auto" } } }),
            })
          }
        >
          <Icon className="size-4" aria-hidden />
        </Button>
      ))}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Button
        type="button"
        size="icon-sm"
        variant={rightSideBarVisible ? "default" : "outline"}
        aria-pressed={rightSideBarVisible}
        aria-label="Toggle properties panel"
        title="Toggle properties panel"
        onClick={() => dispatch({ type: "setUi", ui: (p) => ({ rightSideBarVisible: !p.rightSideBarVisible }) })}
      >
        <PanelRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

/** Iframe-preview device toggle — clamps the standalone preview iframe width. */
function DeviceTogglePreview({
  value,
  onChange,
}: {
  value: PreviewDevice;
  onChange: (next: PreviewDevice) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Preview device">
      {DEVICES.map(({ key, label, Icon }) => (
        <Button
          key={key}
          type="button"
          size="icon-sm"
          variant={value === key ? "default" : "outline"}
          aria-pressed={value === key}
          aria-label={label}
          title={label}
          onClick={() => onChange(key)}
        >
          <Icon className="size-4" aria-hidden />
        </Button>
      ))}
    </div>
  );
}

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
  templates,
  currentTemplateId,
  guideDismissed,
  initialSavedThemes,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor");

  const [activeZone, setActiveZone] = useState<Zone>("home");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [previewMode, setPreviewMode] = useState(false);
  // Device width for the standalone iframe preview (the in-canvas Puck toggle
  // drives Puck's own viewport state instead).
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  // Bumped to force the preview iframe to reload with the freshest draft.
  const [previewNonce, setPreviewNonce] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [brandKit, setBrandKit] = useState(initialBrandKit);
  const [savedThemes, setSavedThemes] = useState<PortfolioSavedTheme[]>(initialSavedThemes);
  const [contact, setContact] = useState(initialContact);
  const [formLocale, setFormLocale] = useState(initialFormLocale);
  const [publishOpen, setPublishOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateId, setTemplateId] = useState(currentTemplateId);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  // The guide auto-opens on first run (until the owner persisted a dismissal),
  // and can be reopened on demand via the Guide button for the session.
  const [guideOpen, setGuideOpen] = useState(!guideDismissed);

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

  async function handleSwitchTemplate(nextTemplateId: string) {
    setSwitching(true);
    setSwitchError(null);
    const res = await switchTemplateAction({ templateId: nextTemplateId });
    if ("error" in res) {
      setSwitching(false);
      setSwitchError(t("errorToast"));
      return;
    }
    const { seed } = res;
    // Replace both zones with the freshly seeded data; the active zone remounts.
    zoneDataRef.current = {
      home: (seed.data.home as PuckData) ?? EMPTY_ZONE,
      gallery: (seed.data.gallery as PuckData) ?? EMPTY_ZONE,
    };
    setBrandKit(seed.brandKit);
    setContact(seed.contact);
    setTemplateId(seed.templateId);
    ignoreNextChange.current = true;
    setPuckSeed(ensureIds(zoneDataRef.current[activeZone]));
    setSwitching(false);
    setTemplatesOpen(false);
    setSaveStatus("saved");
    if (!showPuck) setPreviewNonce((n) => n + 1);
    toast.success(t("templateSwitchedToast"));
  }

  // The guide's "Don't show again" persists the dismissal; closing/skipping is
  // session-only so it can be reopened from the Guide button without re-showing
  // on the next load.
  function dismissGuideForever() {
    setGuideOpen(false);
    void dismissPortfolioGuideAction();
  }

  const { cssVars, className } = resolveBrandKit(brandKit);
  const headerTitle = `${workspaceName} · ${t(`zone.${activeTab}`)}`;
  const previewSrc = `${previewBasePath}?zone=${isContact ? "contact" : activeZone}&v=${previewNonce}`;

  // Left cluster: page navigation (Home / Gallery / Contact) + Preview toggle.
  function navCluster() {
    return (
      <div className="flex items-center gap-2">
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
      </div>
    );
  }

  // Right cluster: tools + the save indicator + the Publish slot.
  function toolsCluster(publishSlot: React.ReactNode) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saveStatus === "saving"
            ? t("save.saving")
            : saveStatus === "saved"
              ? t("save.saved")
              : t("save.idle")}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={() => setPhotosOpen(true)}>
          {t("photos")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={openTheme}>
          {t("theme")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setTemplatesOpen(true)}>
          {t("templates")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setGuideOpen(true)}>
          {t("guide")}
        </Button>
        {isContact && (
          <Button type="button" size="sm" variant="outline" onClick={openContact}>
            {t("contactSettings")}
          </Button>
        )}
        {publishSlot}
      </div>
    );
  }

  // Three-section top bar: nav (left) · device toggle (center) · tools (right).
  function topBar(center: React.ReactNode, publishSlot: React.ReactNode) {
    return (
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 justify-start">{navCluster()}</div>
        {center && <div className="flex shrink-0 items-center justify-center">{center}</div>}
        <div className="flex min-w-0 flex-1 justify-end">{toolsCluster(publishSlot)}</div>
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
              // Full custom header: nav left · canvas controls center · tools +
              // Puck's Publish action (`actions`) right. The center cluster also
              // carries the sidebar-panel toggles the default header would own.
              header: ({ actions }) => topBar(<EditCanvasControls />, actions),
            }}
          />
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-border bg-card px-3 py-2">
              {topBar(
                <DeviceTogglePreview value={previewDevice} onChange={setPreviewDevice} />,
                <Button type="button" size="sm" onClick={() => setPublishOpen(true)}>
                  {t("publish")}
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-muted/40 p-2">
              <div
                className="mx-auto h-full transition-[max-width]"
                style={{
                  maxWidth:
                    previewDevice === "desktop" ? "100%" : `${DEVICES.find((d) => d.key === previewDevice)!.width}px`,
                }}
              >
                <iframe
                  key={previewNonce}
                  src={previewSrc}
                  title={t("preview.title")}
                  className="h-full w-full border-0 bg-background"
                />
              </div>
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
        savedThemes={savedThemes}
        onSavedThemesChange={setSavedThemes}
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
      <TemplatePickerDialog
        open={templatesOpen}
        onOpenChange={(next) => {
          setTemplatesOpen(next);
          if (!next) setSwitchError(null);
        }}
        templates={templates}
        currentTemplateId={templateId}
        switching={switching}
        error={switchError}
        onConfirm={(id) => void handleSwitchTemplate(id)}
      />
      <PortfolioGuideOverlay
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onDontShowAgain={dismissGuideForever}
      />
    </>
  );
}
