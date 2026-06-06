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
import { BrandColorsContext } from "@/lib/page-builder/brandColors";
import type {
  PortfolioBrandKit,
  PortfolioContactConfig,
  PortfolioHeaderConfig,
  PortfolioSavedTheme,
  PuckData,
} from "@/lib/page-builder/types";
import { DEFAULT_HEADER_CONFIG } from "@/lib/page-builder/types";
import {
  savePortfolioDraftAction,
  publishPortfolioAction,
  switchTemplateAction,
  dismissPortfolioGuideAction,
  updateContactConfigAction,
  updateFormLocaleAction,
  updateHeaderConfigAction,
} from "../_actions";
import { PublishDialog } from "./PublishDialog";
import { ThemePanelDialog } from "./ThemePanelDialog";
import { ContactPanelDialog } from "./ContactPanelDialog";
import { ContactFormPreview } from "./ContactFormPreview";
import { HeaderPanelDialog } from "./HeaderPanelDialog";
import { HeaderFormPreview } from "./HeaderFormPreview";
import { MobileBanner } from "./MobileBanner";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { PortfolioGuideOverlay } from "./PortfolioGuideOverlay";
import { CollectionsManagerDialog } from "@/lib/page-builder/galleryPicker/CollectionsManagerDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Puck-editable zones (each round-trips its own Puck data). "contact" is a tab
// too, but it's the fixed prebuilt form — previewed, never Puck-edited.
type Zone = "home" | "gallery";
type EditorSection = Zone | "header" | "contact";
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
  initialHeaderConfig: PortfolioHeaderConfig;
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
const EDITOR_SECTIONS: readonly EditorSection[] = ["home", "gallery", "header", "contact"] as const;
const LOCAL_DRAFT_VERSION = 1;

type PortfolioBrowserDraft = {
  version: typeof LOCAL_DRAFT_VERSION;
  data: Record<Zone, PuckData>;
  contact: PortfolioContactConfig;
  formLocale: string;
  headerConfig: PortfolioHeaderConfig;
};

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
  initialHeaderConfig,
  publicOrigin,
  previewBasePath,
  templates,
  currentTemplateId,
  guideDismissed,
  initialSavedThemes,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor");

  const [activeZone, setActiveZone] = useState<Zone>("home");
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
  const [headerConfig, setHeaderConfig] = useState<PortfolioHeaderConfig>(initialHeaderConfig ?? DEFAULT_HEADER_CONFIG);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateId, setTemplateId] = useState(currentTemplateId);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  // The guide auto-opens on first run (until the owner persisted a dismissal),
  // and can be reopened on demand via the Guide button for the session.
  const [guideOpen, setGuideOpen] = useState(!guideDismissed);

  const sidePanelOpen = headerOpen || contactOpen;
  const activeSection: EditorSection = headerOpen ? "header" : contactOpen ? "contact" : activeZone;
  const showPuck = !previewMode && !sidePanelOpen;

  // Source of truth for each zone's latest data, updated by Puck's onChange.
  // A ref (not state) so editing doesn't re-feed Puck mid-session.
  const zoneDataRef = useRef<Record<Zone, PuckData>>({
    home: initialData.home ?? EMPTY_ZONE,
    gallery: initialData.gallery ?? EMPTY_ZONE,
  });
  // Puck emits onChange once on mount (and again on the zone-switch remount).
  // Skip that first emission so merely loading a zone doesn't autosave/bump the
  // version — only genuine edits should.
  const ignoreNextChange = useRef(true);
  // Snapshots taken when a side panel opens, so closing it without saving reverts
  // the live preview to the last-saved value (no "looks saved but isn't" trap).
  const themeSnapshot = useRef<PortfolioBrandKit | null>(null);
  const contactSnapshot = useRef<PortfolioContactConfig | null>(null);
  const formLocaleSnapshot = useRef<string | null>(null);
  const headerSnapshot = useRef<PortfolioHeaderConfig | null>(null);
  const contactHasSaved = useRef(false);
  const headerHasSaved = useRef(false);

  // The data object handed to <Puck> at mount. Set only on zone switch (in the
  // event handler, from the ref) and initialized from props — never read the ref
  // during render. Paired with key={activeZone} so brand-kit re-renders (which
  // re-run this component) never reset the editor mid-edit.
  const [puckSeed, setPuckSeed] = useState<Data>(() =>
    ensureIds(initialData.home ?? EMPTY_ZONE)
  );
  const draftKey = `gallurio:portfolio-draft:${slug}`;

  const persistLocalDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    const draft: PortfolioBrowserDraft = {
      version: LOCAL_DRAFT_VERSION,
      data: zoneDataRef.current,
      contact,
      formLocale,
      headerConfig,
    };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      return true;
    } catch {
      return false;
    }
  }, [contact, draftKey, formLocale, headerConfig]);

  const writeLocalDraft = useCallback(() => {
    setSaveStatus(persistLocalDraft() ? "saved" : "idle");
  }, [persistLocalDraft]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Partial<PortfolioBrowserDraft>;
      if (draft.version !== LOCAL_DRAFT_VERSION || !draft.data) return;
      queueMicrotask(() => {
        zoneDataRef.current = {
          home: draft.data?.home ?? zoneDataRef.current.home,
          gallery: draft.data?.gallery ?? zoneDataRef.current.gallery,
        };
        if (draft.contact) setContact(draft.contact);
        if (typeof draft.formLocale === "string") setFormLocale(draft.formLocale);
        if (draft.headerConfig) setHeaderConfig(draft.headerConfig);
        ignoreNextChange.current = true;
        setPuckSeed(ensureIds(zoneDataRef.current.home));
        setSaveStatus("saved");
      });
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    persistLocalDraft();
  }, [contact, formLocale, headerConfig, persistLocalDraft]);

  // Puck/contact/navigation drafts are browser-local until Publish.
  const flushPendingSave = useCallback(async (zone: Zone): Promise<boolean> => {
    void zone;
    writeLocalDraft();
    return true;
  }, [writeLocalDraft]);

  const handleChange = useCallback(
    (data: Data) => {
      const next = data as unknown as PuckData;
      zoneDataRef.current[activeZone] = next;
      if (ignoreNextChange.current) {
        ignoreNextChange.current = false;
        return; // mount/remount echo — capture data, but don't autosave.
      }
      writeLocalDraft();
    },
    [activeZone, writeLocalDraft]
  );

  function hideEditorPanels() {
    setContactOpen(false);
    setHeaderOpen(false);
  }

  async function selectZone(zone: Zone) {
    if (zone === activeZone && !sidePanelOpen) return;

    hideEditorPanels();
    await flushPendingSave(activeZone);
    ignoreNextChange.current = true;
    setPuckSeed(ensureIds(zoneDataRef.current[zone]));
    setActiveZone(zone);
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
    setSaveStatus("saving");
    const saveResults = await Promise.all([
      savePortfolioDraftAction({ zone: "home", data: zoneDataRef.current.home }),
      savePortfolioDraftAction({ zone: "gallery", data: zoneDataRef.current.gallery }),
      updateContactConfigAction(contact),
      updateFormLocaleAction(formLocale),
      updateHeaderConfigAction(headerConfig),
    ]);
    if (saveResults.some((res) => "error" in res)) {
      setSaveStatus("idle");
      toast.error(t("errorToast"));
      return;
    }
    const res = await publishPortfolioAction();
    if ("error" in res) {
      setSaveStatus("idle");
      toast.error(t("errorToast"));
      return;
    }
    // Leave the indicator on "saved" — never a lingering "Saving…" after publish.
    setSaveStatus("saved");
    setPublishOpen(false);
    if (typeof window !== "undefined") window.localStorage.removeItem(draftKey);
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
    if (headerOpen) setHeaderOpen(false);
    contactSnapshot.current = contact;
    formLocaleSnapshot.current = formLocale;
    contactHasSaved.current = false;
    setContactOpen(true);
  }
  function closeContact(saved: boolean) {
    if (!saved) {
      if (contactSnapshot.current) setContact(contactSnapshot.current);
      if (formLocaleSnapshot.current !== null) setFormLocale(formLocaleSnapshot.current);
    }
    setContactOpen(false);
    if (contactHasSaved.current) setPreviewNonce((n) => n + 1);
  }
  // Called after a successful DB save so the snapshot reflects the saved state.
  // The sidebar stays open — the user can keep editing.
  function saveContactSnapshot() {
    contactSnapshot.current = contact;
    formLocaleSnapshot.current = formLocale;
    contactHasSaved.current = true;
  }

  async function openHeader() {
    if (contactOpen) setContactOpen(false);
    if (!previewMode) await flushPendingSave(activeZone);
    headerSnapshot.current = headerConfig;
    headerHasSaved.current = false;
    setHeaderOpen(true);
  }
  function closeHeader(saved: boolean) {
    if (!saved && headerSnapshot.current) setHeaderConfig(headerSnapshot.current);
    setHeaderOpen(false);
    if (headerHasSaved.current) setPreviewNonce((n) => n + 1);
  }
  function saveHeaderSnapshot() {
    headerSnapshot.current = headerConfig;
    headerHasSaved.current = true;
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
  // Resolved palette for the toolkit swatches (portaled popovers can't read the
  // `--pf-color-*` vars, so we thread the hex values through React context).
  const brandColors = {
    primary: brandKit.primaryColor,
    secondary: brandKit.secondaryColor,
    accent: brandKit.accentColor,
    background: brandKit.backgroundColor,
    foreground: brandKit.foregroundColor,
  };
  const activeSectionTitle =
    activeSection === "header"
      ? t("headerSettings")
      : activeSection === "contact"
        ? t("contactSettingsShort")
        : t(`zone.${activeSection}`);
  const headerTitle = `${workspaceName} · ${activeSectionTitle}`;
  const previewSrc =
    `${previewBasePath}?zone=${activeSection === "contact" ? "contact" : activeZone}` +
    `&v=${previewNonce}&header=${encodeURIComponent(JSON.stringify(headerConfig))}`;

  // Left cluster: page navigation (Home / Gallery / Contact) + Preview toggle.
  function navCluster() {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1" role="group" aria-label={t("zone.sectionsLabel")}>
          {EDITOR_SECTIONS.map((section) => {
            const label =
              section === "header"
                ? t("headerSettings")
                : section === "contact"
                  ? t("contactSettingsShort")
                  : t(`zone.${section}`);
            return (
              <Button
                key={section}
                type="button"
                size="sm"
                variant={activeSection === section ? "default" : "outline"}
                aria-pressed={activeSection === section}
                onClick={() => {
                  if (section === "header") void openHeader();
                  else if (section === "contact") openContact();
                  else void selectZone(section);
                }}
              >
                {label}
              </Button>
            );
          })}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-pressed={previewMode}
          onClick={() => void togglePreview()}
        >
          {previewMode ? t("preview.edit") : t("preview.show")}
        </Button>
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

      <BrandColorsContext.Provider value={brandColors}>
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
              // `gridArea: header` + the chrome styling replace what the default
              // `._PuckHeader_` wrapper provided — without it the bar collapses
              // into the narrow left grid column.
              header: ({ actions }) => (
                <header
                  className="border-b border-border bg-card px-3 py-2"
                  style={{ gridArea: "header" }}
                >
                  {topBar(<EditCanvasControls />, actions)}
                </header>
              ),
            }}
          />
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-border bg-card px-3 py-2">
              {topBar(
                // Hide device toggle when a sidebar panel is open (inline preview, not resizable iframe).
                sidePanelOpen ? null : (
                  <DeviceTogglePreview value={previewDevice} onChange={setPreviewDevice} />
                ),
                <Button type="button" size="sm" onClick={() => setPublishOpen(true)}>
                  {t("publish")}
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {contactOpen ? (
                // Issue 2 fix: ContactPanelDialog is now inline (flex sibling), not a fixed overlay.
                <div className="flex h-full overflow-hidden">
                  <div className="flex-1 overflow-auto bg-muted/40">
                    <ContactFormPreview
                      contact={contact}
                      brandKit={brandKit}
                      defaultTitle={t("contactPreview.title")}
                      defaultDescription={t("contactPreview.description")}
                      submitLabel={t("contactPreview.submit")}
                    />
                  </div>
                  <ContactPanelDialog
                    open={contactOpen}
                    contact={contact}
                    onContactChange={setContact}
                    formLocale={formLocale}
                    onFormLocaleChange={setFormLocale}
                    brandKit={brandKit}
                    onSaved={saveContactSnapshot}
                    onCancel={() => closeContact(false)}
                  />
                </div>
              ) : headerOpen ? (
                // Header editing view: preview on left, panel on right.
                <div className="flex h-full overflow-hidden">
                  <div className="flex-1 overflow-auto bg-muted/40">
                    <HeaderFormPreview
                      header={headerConfig}
                      brandKit={brandKit}
                      workspaceName={workspaceName}
                    />
                  </div>
                  <HeaderPanelDialog
                    header={headerConfig}
                    onHeaderChange={setHeaderConfig}
                    brandKit={brandKit}
                    workspaceName={workspaceName}
                    onSaved={saveHeaderSnapshot}
                    onCancel={() => closeHeader(false)}
                  />
                </div>
              ) : (
                <div className="h-full overflow-auto p-2 bg-muted/40">
                  <div
                    className="mx-auto h-full transition-[max-width]"
                    style={{
                      maxWidth:
                        previewDevice === "desktop"
                          ? "100%"
                          : `${DEVICES.find((d) => d.key === previewDevice)!.width}px`,
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
              )}
            </div>
          </div>
        )}
      </div>
      </BrandColorsContext.Provider>

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
