"use client";

import "@measured/puck/puck.css";
import "./editor.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  PortfolioCollectionsPopupConfig,
  PortfolioContactConfig,
  PortfolioHeaderConfig,
  PortfolioSavedTheme,
  PuckData,
} from "@/lib/page-builder/types";
import { DEFAULT_BRAND_KIT, DEFAULT_HEADER_CONFIG } from "@/lib/page-builder/types";
import { DEFAULT_DRAFT_NAME } from "@/lib/page-builder/drafts";
import {
  dismissPortfolioGuideAction,
} from "../_actions";
import {
  createDraftAction,
  updateDraftAction,
  deleteDraftAction,
  getDraftAction,
  publishDraftAction,
  seedTemplateAction,
  type DraftSummary,
} from "../_draftActions";
import { PublishDialog } from "./PublishDialog";
import { ThemePanelDialog } from "./ThemePanelDialog";
import { ContactPanelDialog } from "./ContactPanelDialog";
import { ContactFormPreview } from "./ContactFormPreview";
import { HeaderPanelDialog } from "./HeaderPanelDialog";
import { HeaderFormPreview } from "./HeaderFormPreview";
import { CollectionsPopupPanelDialog } from "./CollectionsPopupPanelDialog";
import { CollectionsPopupPreview } from "./CollectionsPopupPreview";
import { MobileBanner } from "./MobileBanner";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { PortfolioGuideOverlay } from "./PortfolioGuideOverlay";
import { CollectionsManagerDialog } from "@/lib/page-builder/galleryPicker/CollectionsManagerDialog";
import { buildContactLabels } from "@/app/(public)/w/[orgSlug]/_components/buildContactLabels";
import {
  resolveAddSessionAppearance,
  resolveSubmitAppearance,
} from "@/app/(public)/w/[orgSlug]/_components/contactButtonAppearance";
import { RootCanvasStyle } from "@/lib/page-builder/RootCanvasStyle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DraftNameEditor } from "./DraftNameEditor";
import { DraftsDialog } from "./DraftsDialog";
import { PortfolioEntryDialog } from "./PortfolioEntryDialog";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

// Puck-editable zones (each round-trips its own Puck data). "contact" is a tab
// too, but it's the fixed prebuilt form — previewed, never Puck-edited.
type Zone = "home" | "gallery";
type EditorSection = Zone | "collectionsPopup" | "header" | "contact";

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
  initialCollectionsPopup: PortfolioCollectionsPopupConfig;
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
  // ---- Draft-system props (all optional; page.tsx wired in Task 13) ----
  initialDrafts?: DraftSummary[];
  initialActiveDraftId?: string | null;
  initialActiveDraftName?: string;
};

const EMPTY_ZONE: PuckData = { content: [], root: {} };
const EDITOR_SECTIONS: readonly EditorSection[] = ["home", "gallery", "collectionsPopup", "header", "contact"] as const;
const LOCAL_DRAFT_VERSION = 2;

type PortfolioBrowserDraft = {
  version: typeof LOCAL_DRAFT_VERSION;
  data: Record<Zone, PuckData>;
  brandKit: PortfolioBrandKit;
  contact: PortfolioContactConfig;
  formLocale: string;
  headerConfig: PortfolioHeaderConfig;
  collectionsPopup: PortfolioCollectionsPopupConfig;
  draftId: string | null;
  draftName: string;
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
  initialCollectionsPopup,
  publicOrigin,
  previewBasePath,
  templates,
  currentTemplateId,
  guideDismissed,
  initialSavedThemes,
  initialDrafts = [],
  initialActiveDraftId = null,
  initialActiveDraftName,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor");
  const tPublicForm = useTranslations("publicPage.inquiryForm");
  const tLocationPicker = useTranslations("app.bookings.locationPicker");

  const [activeZone, setActiveZone] = useState<Zone>("home");
  const [previewMode, setPreviewMode] = useState(false);
  // Device width for the standalone iframe preview (the in-canvas Puck toggle
  // drives Puck's own viewport state instead).
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  // Bumped to force the preview iframe to reload with the freshest draft.
  const [previewNonce, setPreviewNonce] = useState(0);
  const [brandKit, setBrandKit] = useState(initialBrandKit);
  const [savedThemes, setSavedThemes] = useState<PortfolioSavedTheme[]>(initialSavedThemes);
  const [contact, setContact] = useState(initialContact);
  const [formLocale, setFormLocale] = useState(initialFormLocale);
  const [renderDraftData, setRenderDraftData] = useState<Record<Zone, PuckData>>({
    home: initialData.home ?? EMPTY_ZONE,
    gallery: initialData.gallery ?? EMPTY_ZONE,
  });
  const [publishOpen, setPublishOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [headerConfig, setHeaderConfig] = useState<PortfolioHeaderConfig>(initialHeaderConfig ?? DEFAULT_HEADER_CONFIG);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [collectionsPopup, setCollectionsPopup] = useState<PortfolioCollectionsPopupConfig>(initialCollectionsPopup ?? {});
  const [collectionsPopupOpen, setCollectionsPopupOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateId, setTemplateId] = useState(currentTemplateId);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  // The guide auto-opens on first run (until the owner persisted a dismissal),
  // and can be reopened on demand via the Guide button for the session.
  const [guideOpen, setGuideOpen] = useState(!guideDismissed);

  // ---- Draft state ----
  const [drafts, setDrafts] = useState<DraftSummary[]>(initialDrafts);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(initialActiveDraftId);
  const [draftName, setDraftName] = useState(initialActiveDraftName || DEFAULT_DRAFT_NAME);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingChanges, setSavingChanges] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  // Entry dialog shown on every load; options are gated by canContinue / hasDrafts.
  const [entryOpen, setEntryOpen] = useState(true);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // JSON string of last-saved snapshot; null = never saved (always dirty).
  // Stored as state so it can be read during render for the derived isDirty check.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(() => {
    if (initialActiveDraftId === null) return null;
    return JSON.stringify({
      name: initialActiveDraftName || DEFAULT_DRAFT_NAME,
      templateId: currentTemplateId,
      data: {
        home: initialData.home ?? EMPTY_ZONE,
        gallery: initialData.gallery ?? EMPTY_ZONE,
      },
      brandKit: initialBrandKit,
      contact: initialContact,
      header: initialHeaderConfig ?? DEFAULT_HEADER_CONFIG,
      collectionsPopup: initialCollectionsPopup ?? {},
      formLocale: initialFormLocale,
    });
  });

  const sidePanelOpen = headerOpen || contactOpen || collectionsPopupOpen;
  const activeSection: EditorSection = headerOpen ? "header" : contactOpen ? "contact" : collectionsPopupOpen ? "collectionsPopup" : activeZone;
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
  const collectionsPopupSnapshot = useRef<PortfolioCollectionsPopupConfig | null>(null);
  const collectionsPopupHasSaved = useRef(false);

  // The data object handed to <Puck> at mount. Set only on zone switch (in the
  // event handler, from the ref) and initialized from props — never read the ref
  // during render. Paired with key={activeZone} so brand-kit re-renders (which
  // re-run this component) never reset the editor mid-edit.
  const [puckSeed, setPuckSeed] = useState<Data>(() =>
    ensureIds(initialData.home ?? EMPTY_ZONE)
  );
  const draftKey = `gallurio:portfolio-draft:${slug}`;

  // ---- Snapshot helpers ----
  function buildDraftSnapshot() {
    return {
      templateId,
      data: {
        home: zoneDataRef.current.home,
        gallery: zoneDataRef.current.gallery,
      },
      brandKit,
      contact,
      header: headerConfig,
      collectionsPopup,
      formLocale,
    };
  }

  // Derived: isDirty is computed from savedSnapshot state + current render state so it
  // stays in sync without any effects. renderDraftData drives re-renders on Puck edits.
  const isDirty =
    savedSnapshot === null ||
    JSON.stringify({ name: draftName, templateId, data: renderDraftData, brandKit, contact, header: headerConfig, collectionsPopup, formLocale }) !==
      savedSnapshot;

  const persistLocalDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    const draft: PortfolioBrowserDraft = {
      version: LOCAL_DRAFT_VERSION,
      data: zoneDataRef.current,
      brandKit,
      contact,
      formLocale,
      headerConfig,
      collectionsPopup,
      draftId: activeDraftId,
      draftName,
    };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      return true;
    } catch {
      return false;
    }
  }, [brandKit, collectionsPopup, contact, draftKey, formLocale, headerConfig, activeDraftId, draftName]);

  // Compute on mount whether a recoverable localStorage buffer exists.
  const [hasRecoverableBuffer] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(`gallurio:portfolio-draft:${slug}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<PortfolioBrowserDraft>;
      return parsed.version === LOCAL_DRAFT_VERSION && Boolean(parsed.data);
    } catch {
      return false;
    }
  });

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
        setRenderDraftData(zoneDataRef.current);
        if (draft.brandKit) setBrandKit(draft.brandKit);
        if (draft.contact) setContact(draft.contact);
        if (typeof draft.formLocale === "string") setFormLocale(draft.formLocale);
        if (draft.headerConfig) setHeaderConfig(draft.headerConfig);
        if (draft.collectionsPopup) setCollectionsPopup(draft.collectionsPopup);
        if (draft.draftId !== undefined) setActiveDraftId(draft.draftId);
        if (draft.draftName) setDraftName(draft.draftName);
        ignoreNextChange.current = true;
        setPuckSeed(ensureIds(zoneDataRef.current.home));
      });
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    persistLocalDraft();
  }, [collectionsPopup, contact, formLocale, headerConfig, persistLocalDraft]);

  // beforeunload guard while dirty.
  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Puck/contact/navigation drafts are browser-local until Save changes.
  const flushPendingSave = useCallback(async (zone: Zone): Promise<boolean> => {
    void zone;
    persistLocalDraft();
    return true;
  }, [persistLocalDraft]);

  const handleChange = useCallback(
    (data: Data) => {
      const next = data as unknown as PuckData;
      zoneDataRef.current[activeZone] = next;
      setRenderDraftData((current) => ({ ...current, [activeZone]: next }));
      if (ignoreNextChange.current) {
        ignoreNextChange.current = false;
        return; // mount/remount echo - capture data, but don't autosave.
      }
      persistLocalDraft();
      // isDirty is derived at render time from savedSnapshot state — no manual update needed.
    },
    [activeZone, persistLocalDraft]
  );

  // ---- Draft name validation ----
  function validateDraftName(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return "This field is required";
    const clash = drafts.some(
      (d) => d.id !== activeDraftId && d.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (clash) return "A draft with this name already exists";
    return null;
  }

  // ---- Save changes ----
  async function handleSaveChanges(): Promise<boolean> {
    const validationError = validateDraftName(draftName);
    if (validationError) {
      setNameError(validationError);
      return false;
    }
    setSavingChanges(true);
    const payload = { name: draftName, ...buildDraftSnapshot() };
    try {
      let res;
      if (activeDraftId) {
        res = await updateDraftAction({ id: activeDraftId, ...payload });
      } else {
        res = await createDraftAction(payload);
      }
      if ("error" in res) {
        const err = res.error;
        if (err === "name_required") {
          setNameError("This field is required");
        } else if (err === "name_taken") {
          setNameError("A draft with this name already exists");
        } else if (err.startsWith("draft_limit_reached")) {
          toast.error("You've reached your draft limit.");
        } else {
          toast.error("Could not save draft. Please try again.");
        }
        return false;
      }
      const saved = res.draft;
      setActiveDraftId(saved.id);
      setDrafts((prev) => {
        const without = prev.filter((d) => d.id !== saved.id);
        return [saved, ...without];
      });
      const snapshotStr = JSON.stringify({ name: draftName, ...buildDraftSnapshot() });
      setSavedSnapshot(snapshotStr);
      persistLocalDraft();
      toast.success("Draft saved.");
      return true;
    } finally {
      setSavingChanges(false);
    }
  }

  // ---- Unsaved-changes guard ----
  function guardThenRun(run: () => void) {
    const validationError = validateDraftName(draftName);
    if (validationError) {
      setNameError(validationError);
      return;
    }
    if (activeDraftId === null || isDirty) {
      setPendingAction(() => run);
    } else {
      run();
    }
  }

  // ---- Apply draft ----
  async function applyDraft(id: string) {
    const res = await getDraftAction(id);
    if ("error" in res) {
      toast.error("Could not load draft. Please try again.");
      return;
    }
    const d = res.draft;
    const homeData = (d.data.home as PuckData) ?? EMPTY_ZONE;
    const galleryData = (d.data.gallery as PuckData) ?? EMPTY_ZONE;
    // Resolve each field to the value that will be committed to state, so the
    // saved snapshot always matches post-apply render state.
    const resolvedBrandKit = (d.brandKit as PortfolioBrandKit) ?? DEFAULT_BRAND_KIT;
    const resolvedContact = (d.contact as PortfolioContactConfig) ?? contact;
    const resolvedHeader = (d.header as PortfolioHeaderConfig) ?? headerConfig;
    const resolvedCollectionsPopup = (d.collectionsPopup as PortfolioCollectionsPopupConfig) ?? collectionsPopup;
    const resolvedFormLocale = typeof d.formLocale === "string" ? d.formLocale : formLocale;
    const resolvedTemplateId = d.templateId || templateId;
    zoneDataRef.current = { home: homeData, gallery: galleryData };
    setRenderDraftData(zoneDataRef.current);
    setBrandKit(resolvedBrandKit);
    setContact(resolvedContact);
    setHeaderConfig(resolvedHeader);
    setCollectionsPopup(resolvedCollectionsPopup);
    setFormLocale(resolvedFormLocale);
    setTemplateId(resolvedTemplateId);
    setActiveDraftId(d.id);
    setDraftName(d.name);
    setNameError(null);
    ignoreNextChange.current = true;
    setPuckSeed(ensureIds(homeData));
    setActiveZone("home");
    setSavedSnapshot(JSON.stringify({
      name: d.name,
      templateId: resolvedTemplateId,
      data: { home: homeData, gallery: galleryData },
      brandKit: resolvedBrandKit,
      contact: resolvedContact,
      header: resolvedHeader,
      collectionsPopup: resolvedCollectionsPopup,
      formLocale: resolvedFormLocale,
    }));
    persistLocalDraft();
    setDraftsOpen(false);
  }

  // ---- Delete draft ----
  async function handleDeleteDraft(id: string) {
    const res = await deleteDraftAction(id);
    if ("error" in res) {
      toast.error("Could not delete draft. Please try again.");
      return;
    }
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (id === activeDraftId) {
      setActiveDraftId(null);
      setSavedSnapshot(null);
    }
  }

  function hideEditorPanels() {
    setContactOpen(false);
    setHeaderOpen(false);
    setCollectionsPopupOpen(false);
  }

  async function selectZone(zone: Zone) {
    if (zone === activeZone && !sidePanelOpen) return;

    hideEditorPanels();
    if (sidePanelOpen) {
      hideEditorPanels();
      ignoreNextChange.current = true;
      setPuckSeed(ensureIds(zoneDataRef.current.home));
      setActiveZone("home");
    }
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
    if (sidePanelOpen) {
      hideEditorPanels();
      ignoreNextChange.current = true;
      setPuckSeed(ensureIds(zoneDataRef.current.home));
      setActiveZone("home");
    }
    setPreviewNonce((n) => n + 1);
    setPreviewMode(true);
  }

  // ---- Publish from draft ----
  async function doPublish() {
    if (!activeDraftId) return;
    setSavingChanges(true);
    try {
      const res = await publishDraftAction(activeDraftId);
      if ("error" in res) {
        toast.error(t("errorToast"));
        return;
      }
      setPublishOpen(false);
      if (typeof window !== "undefined") window.localStorage.removeItem(draftKey);
      toast.success(t("publishedToast"));
      if (!showPuck) setPreviewNonce((n) => n + 1);
    } finally {
      setSavingChanges(false);
    }
  }

  function handlePublish() {
    if (activeDraftId === null || isDirty) {
      // Must save first — route through the unsaved-changes guard so the user
      // saves before we publish.
      setPendingAction(() => () => setPublishOpen(true));
    } else {
      setPublishOpen(true);
    }
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
    if (collectionsPopupOpen) setCollectionsPopupOpen(false);
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
    if (collectionsPopupOpen) setCollectionsPopupOpen(false);
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

  async function openCollectionsPopup() {
    if (contactOpen) setContactOpen(false);
    if (headerOpen) setHeaderOpen(false);
    if (!previewMode) await flushPendingSave(activeZone);
    collectionsPopupSnapshot.current = collectionsPopup;
    collectionsPopupHasSaved.current = false;
    setCollectionsPopupOpen(true);
  }
  function closeCollectionsPopup(saved: boolean) {
    if (!saved && collectionsPopupSnapshot.current) setCollectionsPopup(collectionsPopupSnapshot.current);
    setCollectionsPopupOpen(false);
    if (collectionsPopupHasSaved.current) setPreviewNonce((n) => n + 1);
  }
  function saveCollectionsPopupSnapshot() {
    collectionsPopupSnapshot.current = collectionsPopup;
    collectionsPopupHasSaved.current = true;
  }

  // ---- Apply template as a new unsaved draft ----
  async function applyTemplate(nextTemplateId: string) {
    setSwitching(true);
    setSwitchError(null);
    const res = await seedTemplateAction(nextTemplateId);
    if ("error" in res) {
      setSwitching(false);
      setSwitchError(t("errorToast"));
      return;
    }
    const { seed } = res;
    zoneDataRef.current = {
      home: seed.data.home as PuckData,
      gallery: seed.data.gallery as PuckData,
    };
    setRenderDraftData(zoneDataRef.current);
    setBrandKit(seed.brandKit as PortfolioBrandKit);
    setContact(seed.contact as PortfolioContactConfig);
    setHeaderConfig(DEFAULT_HEADER_CONFIG);
    setCollectionsPopup({});
    setTemplateId(seed.templateId);
    setActiveDraftId(null);
    setDraftName(DEFAULT_DRAFT_NAME);
    setNameError(null);
    setSavedSnapshot(null);
    ignoreNextChange.current = true;
    setPuckSeed(ensureIds(zoneDataRef.current[activeZone]));
    setSwitching(false);
    setTemplatesOpen(false);
    if (!showPuck) setPreviewNonce((n) => n + 1);
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
        : activeSection === "collectionsPopup"
          ? "Collections Popup"
          : t(`zone.${activeSection}`);
  const headerTitle = `${workspaceName} · ${activeSectionTitle}`;
  const contactLabels = buildContactLabels(
    (key, values) => tPublicForm(key, values),
    (key, values) => tLocationPicker(key, values)
  ).form;
  const previewSrc =
    `${previewBasePath}?zone=${activeSection === "contact" ? "contact" : activeZone}` +
    `&v=${previewNonce}`;

  // Stable reference for the Puck canvas override: prevents Puck from re-rendering
  // the canvas container on every EditorShell re-render (e.g. keystroke → onChange
  // → setRenderDraftData), which would otherwise trigger a canvas scroll-to-top.
  const puckCanvasOverride = useMemo(
    () => ({
      puck: ({ children }: { children: ReactNode }) => (
        <>
          {children}
          <RootCanvasStyle />
        </>
      ),
    }),
    []
  );

  // Left cluster: page navigation (Home / Gallery / Contact) + Preview toggle.
  function navCluster() {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t("zone.sectionsLabel")}>
          {EDITOR_SECTIONS.filter((section) => !previewMode || (section !== "header" && section !== "contact" && section !== "collectionsPopup")).map((section) => {
            const label =
              section === "header"
                ? t("headerSettings")
                : section === "contact"
                  ? t("contactSettingsShort")
                  : section === "collectionsPopup"
                    ? "Collections Popup"
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
                  else if (section === "collectionsPopup") void openCollectionsPopup();
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

  // Right cluster: tools + draft name + the Publish slot.
  function toolsCluster(publishSlot: ReactNode) {
    const saveDisabled = !isDirty && activeDraftId !== null;
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DraftNameEditor
          name={draftName}
          error={nameError}
          onCommit={(n) => { setDraftName(n); setNameError(null); }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => setPhotosOpen(true)}>
          {t("photos")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={openTheme}>
          {t("theme")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setDraftsOpen(true)}>
          Drafts
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setGuideOpen(true)}>
          {t("guide")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saveDisabled}
          loading={savingChanges}
          onClick={() => void handleSaveChanges()}
        >
          Save changes
        </Button>
        {publishSlot}
      </div>
    );
  }

  // Three-section top bar: nav (left) · device toggle (center) · tools (right).
  function topBar(center: ReactNode, publishSlot: ReactNode) {
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
        className={cn("gallurio-editor min-h-svh", className)}
        data-testid="portfolio-editor-shell"
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
            onPublish={() => void handlePublish()}
            iframe={{ enabled: false }}
            headerTitle={headerTitle}
            metadata={{
              workspace: {
                _id: "",
                name: workspaceName,
                slug,
                editorPreview: true,
                publicPage: { collectionsPopup },
              },
            }}
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
              // Stable memoized override: prevents Puck from re-rendering the
              // canvas wrapper on every EditorShell re-render (keystroke → onChange).
              // Defined above with useMemo([]); RootCanvasStyle reads from Puck
              // context directly so needs no props passed here.
              ...puckCanvasOverride,
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
                <Button type="button" size="sm" onClick={() => void handlePublish()}>
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
                      labels={contactLabels}
                      submitAppearance={resolveSubmitAppearance(contact)}
                      addSessionAppearance={resolveAddSessionAppearance(contact)}
                      defaultTitle={t("contactPreview.title")}
                      defaultDescription={t("contactPreview.description")}
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
              ) : collectionsPopupOpen ? (
                <div className="flex h-full overflow-hidden">
                  <div className="flex-1 overflow-auto bg-muted/40">
                    <CollectionsPopupPreview config={collectionsPopup} brandKit={brandKit} />
                  </div>
                  <CollectionsPopupPanelDialog
                    config={collectionsPopup}
                    onChange={setCollectionsPopup}
                    brandKit={brandKit}
                    onSaved={saveCollectionsPopupSnapshot}
                    onCancel={() => closeCollectionsPopup(false)}
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
        onConfirm={doPublish}
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
        onConfirm={(id) => guardThenRun(() => void applyTemplate(id))}
      />
      <PortfolioGuideOverlay
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onDontShowAgain={dismissGuideForever}
      />

      {/* Draft system dialogs */}
      <DraftsDialog
        open={draftsOpen}
        onOpenChange={setDraftsOpen}
        drafts={drafts}
        activeDraftId={activeDraftId}
        onApply={(id) => guardThenRun(() => void applyDraft(id))}
        onDelete={(id) => void handleDeleteDraft(id)}
        onAddNew={() => { setDraftsOpen(false); setTemplatesOpen(true); }}
      />
      <PortfolioEntryDialog
        open={entryOpen}
        canContinue={hasRecoverableBuffer}
        hasDrafts={drafts.length > 0}
        onContinue={() => setEntryOpen(false)}
        onLoadExisting={() => { setEntryOpen(false); setDraftsOpen(true); }}
        onStartScratch={() => { setEntryOpen(false); setTemplatesOpen(true); }}
      />
      <UnsavedChangesDialog
        open={pendingAction !== null}
        saving={savingChanges}
        onSave={async () => {
          const ok = await handleSaveChanges();
          if (ok) {
            const run = pendingAction;
            setPendingAction(null);
            run?.();
          }
        }}
        onDiscard={() => {
          window.localStorage.removeItem(draftKey);
          const run = pendingAction;
          setPendingAction(null);
          run?.();
        }}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}

