"use client";

import "@measured/puck/puck.css";
import "./editor.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Puck, type Config, type Data } from "@measured/puck";
import { usePuckStore } from "@/lib/page-builder/puckHooks";
import { isEditableTarget } from "@/lib/page-builder/editableTarget";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Smartphone, Tablet, Monitor, PanelLeft, PanelRight, ExternalLinkIcon, Undo2, Redo2 } from "lucide-react";
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
  listDraftsAction,
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
import { SpotlightGuide } from "./SpotlightGuide";
import { SPOTLIGHT_STEPS } from "./spotlightSteps";
import { SandboxEditorGuide } from "./SandboxEditorGuide";
import { CollectionsManagerDialog } from "@/lib/page-builder/galleryPicker/CollectionsManagerDialog";
import { GalleryPickerCacheProvider } from "@/lib/page-builder/galleryPicker/GalleryPickerCacheContext";
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
  /**
   * When true the shell runs in sandbox/guide mode: all persistence (localStorage,
   * server drafts, publish, dismiss-guide) is disabled so the real editor's data
   * is never touched during the interactive tour.
   */
  guideMode?: boolean;
  /** Called when the sandbox guide finishes (user completed all steps). */
  onGuideFinish?: (dontShowAgain: boolean) => void;
  /** Called when the sandbox guide is skipped mid-tour. */
  onGuideSkipClose?: (dontShowAgain: boolean) => void;
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
  const leftSideBarVisible = usePuckStore((s) => s.appState.ui.leftSideBarVisible);
  const rightSideBarVisible = usePuckStore((s) => s.appState.ui.rightSideBarVisible);
  const dispatch = usePuckStore((s) => s.dispatch);
  const hasPast = usePuckStore((s) => s.history.hasPast);
  const hasFuture = usePuckStore((s) => s.history.hasFuture);
  const back = usePuckStore((s) => s.history.back);
  const forward = usePuckStore((s) => s.history.forward);
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Editor controls">
      <Button
        type="button"
        size="icon-sm"
        variant={leftSideBarVisible ? "default" : "outline"}
        aria-pressed={leftSideBarVisible}
        aria-label="Toggle blocks panel"
        title="Toggle blocks panel"
        data-tour-id="blocks-panel"
        onClick={() => dispatch({ type: "setUi", ui: (p) => ({ leftSideBarVisible: !p.leftSideBarVisible }) })}
      >
        <PanelLeft className="size-4" aria-hidden />
      </Button>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        disabled={!hasPast}
        onClick={back}
      >
        <Undo2 className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!hasFuture}
        onClick={forward}
      >
        <Redo2 className="size-4" aria-hidden />
      </Button>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Button
        type="button"
        size="icon-sm"
        variant={rightSideBarVisible ? "default" : "outline"}
        aria-pressed={rightSideBarVisible}
        aria-label="Toggle properties panel"
        title="Toggle properties panel"
        data-tour-id="properties-panel"
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
    <div className="flex items-center gap-1" role="group" aria-label="Preview device" data-tour-id="device-toggle">
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

/**
 * Reads Puck state that the spotlight guide needs for gate detection.
 * Must be rendered inside a <Puck> tree (has Puck context).
 * Reports values up via the `onState` callback after each render.
 */
function PuckGateReader({
  onState,
}: {
  onState: (state: { contentCount: number }) => void;
}) {
  const contentCount = usePuckStore((s) => s.appState.data.content?.length ?? 0);

  useEffect(() => {
    onState({ contentCount });
  });

  return null;
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
  guideMode = false,
  onGuideFinish,
  onGuideSkipClose,
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
  const [spotlightStepIndex, setSpotlightStepIndex] = useState(0);
  // Puck gate state (populated by PuckGateReader when Puck is mounted)
  const [puckContentCount, setPuckContentCount] = useState(0);
  // Baseline content count captured when the drag-block step becomes active
  const [dragBaseline, setDragBaseline] = useState<number | null>(null);

  // ---- Draft state ----
  const [drafts, setDrafts] = useState<DraftSummary[]>(initialDrafts);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(initialActiveDraftId);
  const [draftName, setDraftName] = useState(initialActiveDraftName || DEFAULT_DRAFT_NAME);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingChanges, setSavingChanges] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);

  // Entry dialog shown on load; deferred until after the guide when guide is not dismissed.
  // When guideDismissed=true, open the entry immediately — but brand-new users (no saved
  // drafts AND no recoverable buffer) go to the welcome template modal instead.
  // When guideDismissed=false, both stay closed until guide finishes/skips.
  const [entryOpen, setEntryOpen] = useState(() => {
    if (!guideDismissed) return false;
    // Brand-new check: no saved drafts AND no localStorage buffer.
    const hasDrafts = initialDrafts.length > 0;
    const hasBuffer = (() => {
      if (typeof window === "undefined") return false;
      try {
        const raw = window.localStorage.getItem(`gallurio:portfolio-draft:${slug}`);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as Partial<PortfolioBrowserDraft>;
        return parsed.version === LOCAL_DRAFT_VERSION && Boolean(parsed.data);
      } catch { return false; }
    })();
    return hasDrafts || hasBuffer;
  });
  // Welcome template modal for brand-new users (no buffer AND no saved drafts).
  const [welcomeTemplatesOpen, setWelcomeTemplatesOpen] = useState(() => {
    if (!guideDismissed) return false;
    const hasDrafts = initialDrafts.length > 0;
    const hasBuffer = (() => {
      if (typeof window === "undefined") return false;
      try {
        const raw = window.localStorage.getItem(`gallurio:portfolio-draft:${slug}`);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as Partial<PortfolioBrowserDraft>;
        return parsed.version === LOCAL_DRAFT_VERSION && Boolean(parsed.data);
      } catch { return false; }
    })();
    return !hasDrafts && !hasBuffer;
  });
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  // True only when the canvas holds a newly-created draft (applyTemplate path) that
  // has no DB record yet; false when the active draft was deleted (deleted-working-copy
  // path). Controls whether the dashed "Unsaved" row appears in DraftsDialog.
  const [isNewUnsavedDraft, setIsNewUnsavedDraft] = useState(() => initialActiveDraftId === null);

  // JSON string of last-saved snapshot; null = never saved (always dirty).
  // Stored as state so it can be read during render for the derived isDirty check.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(() => {
    if (initialActiveDraftId === null) return null;
    return JSON.stringify({
      name: initialActiveDraftName || DEFAULT_DRAFT_NAME,
      templateId: currentTemplateId,
      data: {
        home: ensureIds(initialData.home ?? EMPTY_ZONE),
        gallery: ensureIds(initialData.gallery ?? EMPTY_ZONE),
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
  // during render. Paired with key={`${activeZone}-${seedNonce}`} so brand-kit
  // re-renders never reset the editor mid-edit, and full re-seeds (applyTemplate,
  // applyDraft) force a remount by bumping seedNonce.
  const [puckSeed, setPuckSeed] = useState<Data>(() =>
    ensureIds(initialData.home ?? EMPTY_ZONE)
  );
  const [seedNonce, setSeedNonce] = useState(0);
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
    if (guideMode) return;
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
  }, [brandKit, collectionsPopup, contact, draftKey, formLocale, guideMode, headerConfig, activeDraftId, draftName]);

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
    if (guideMode) return;
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Partial<PortfolioBrowserDraft>;
      if (draft.version !== LOCAL_DRAFT_VERSION || !draft.data) return;
      queueMicrotask(() => {
        const home = draft.data?.home ?? zoneDataRef.current.home;
        const gallery = draft.data?.gallery ?? zoneDataRef.current.gallery;
        zoneDataRef.current = { home, gallery };
        setRenderDraftData({
          home: ensureIds(home) as unknown as PuckData,
          gallery: ensureIds(gallery) as unknown as PuckData,
        });
        if (draft.brandKit) setBrandKit(draft.brandKit);
        if (draft.contact) setContact(draft.contact);
        if (typeof draft.formLocale === "string") setFormLocale(draft.formLocale);
        if (draft.headerConfig) setHeaderConfig(draft.headerConfig);
        if (draft.collectionsPopup) setCollectionsPopup(draft.collectionsPopup);
        if (draft.draftId !== undefined) setActiveDraftId(draft.draftId);
        if (draft.draftName) setDraftName(draft.draftName);
        ignoreNextChange.current = true;
        setPuckSeed(ensureIds(zoneDataRef.current.home));
        setSeedNonce((n) => n + 1);
      });
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey, guideMode]);

  useEffect(() => {
    if (guideMode) return;
    persistLocalDraft();
  }, [activeDraftId, collectionsPopup, contact, draftName, formLocale, guideMode, headerConfig, persistLocalDraft]);

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
    if (guideMode) return false;
    const shouldToastValidationError = templatesOpen;
    const validationError = validateDraftName(draftName);
    if (validationError) {
      setNameError(validationError);
      if (shouldToastValidationError) toast.error(validationError);
      return false;
    }
    setSavingChanges(true);
    const payload = { name: draftName, ...buildDraftSnapshot() };
    try {
      let res: Awaited<ReturnType<typeof createDraftAction | typeof updateDraftAction>>;
      if (activeDraftId) {
        res = await updateDraftAction({ id: activeDraftId, ...payload });
      } else {
        res = await createDraftAction(payload);
        // Recover from a stale server-side default draft when the client is in
        // "brand-new unsaved draft" mode and the local list is empty.
        if (
          "error" in res &&
          res.error === "name_taken" &&
          draftName === DEFAULT_DRAFT_NAME &&
          drafts.length === 0
        ) {
          const serverDrafts = await listDraftsAction();
          const existingDefaultDraft = serverDrafts.find(
            (d) => d.name.trim().toLowerCase() === DEFAULT_DRAFT_NAME.toLowerCase()
          );
          if (existingDefaultDraft) {
            setDrafts(serverDrafts);
            res = await updateDraftAction({ id: existingDefaultDraft.id, ...payload });
          }
        }
      }
      if ("error" in res) {
        const err = res.error;
        if (err === "name_required") {
          setNameError("This field is required");
          if (shouldToastValidationError) toast.error("This field is required");
        } else if (err === "name_taken") {
          setNameError("A draft with this name already exists");
          if (shouldToastValidationError) toast.error("A draft with this name already exists");
        } else if (err.startsWith("draft_limit_reached")) {
          toast.error("You've reached your draft limit.");
        } else {
          toast.error("Could not save draft. Please try again.");
        }
        return false;
      }
      const saved = res.draft;
      setActiveDraftId(saved.id);
      setIsNewUnsavedDraft(false);
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
    setSeedNonce((n) => n + 1);
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
    setDeletingDraftId(id);
    try {
      const res = await deleteDraftAction(id);
      // Refresh the drafts list to stay in sync.
      const refreshed = await listDraftsAction();
      setDrafts(refreshed);
      if ("error" in res) {
        toast.error("Could not delete draft. Please try again.");
        return;
      }
      if (
        nameError === "A draft with this name already exists" &&
        refreshed.every((d) => d.name.trim().toLowerCase() !== draftName.trim().toLowerCase())
      ) {
        setNameError(null);
      }
      if (id === activeDraftId) {
        // Keep the loaded canvas as an unsaved working copy after its backing
        // draft record is deleted. Not shown as a dashed-border row in DraftsDialog
        // (that row is only for newly-created drafts from the template picker).
        setActiveDraftId(null);
        setIsNewUnsavedDraft(false);
        setSavedSnapshot(null);
        setNameError(null);
      }
    } finally {
      setDeletingDraftId(null);
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
    if (guideMode) return;
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
    if (guideMode) return;
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
    setIsNewUnsavedDraft(true);
    setDraftName(DEFAULT_DRAFT_NAME);
    setNameError(null);
    setSavedSnapshot(null);
    ignoreNextChange.current = true;
    setPuckSeed(ensureIds(zoneDataRef.current[activeZone]));
    setSeedNonce((n) => n + 1);
    setSwitching(false);
    setTemplatesOpen(false);
    if (!showPuck) setPreviewNonce((n) => n + 1);
  }

  // ---- Add New Draft ----
  function handleAddNewDraft() {
    setDraftsOpen(false);
    setTemplatesOpen(true);
  }

  // ---- Spotlight guide helpers ----

  /** Open the correct entry flow after the guide finishes or is skipped. */
  function openEntryAfterGuide() {
    // Brand-new = no recoverable local buffer AND no saved drafts.
    const isNewUser = !hasRecoverableBuffer && drafts.length === 0;
    if (isNewUser) {
      setWelcomeTemplatesOpen(true);
    } else {
      setEntryOpen(true);
    }
  }

  function handleGuideSkip(dontShowAgain: boolean) {
    setGuideOpen(false);
    if (guideMode) {
      onGuideSkipClose?.(dontShowAgain);
      return;
    }
    if (dontShowAgain) void dismissPortfolioGuideAction();
    // Open entry only when the guide was gating it (i.e. it was not already open).
    if (!guideDismissed) openEntryAfterGuide();
  }

  function handleGuideFinish(dontShowAgain: boolean) {
    setGuideOpen(false);
    if (guideMode) {
      onGuideFinish?.(dontShowAgain);
      return;
    }
    if (dontShowAgain) void dismissPortfolioGuideAction();
    if (!guideDismissed) openEntryAfterGuide();
  }

  function handleGuideStepChange(next: number) {
    // Capture baseline content count when entering the drag-block step
    const currentId = SPOTLIGHT_STEPS[next]?.id;
    if (currentId === "drag-block") {
      setDragBaseline(puckContentCount);
    }
    setSpotlightStepIndex(next);
  }

  // Compute whether the current gated step's condition is satisfied.
  const currentStepId = SPOTLIGHT_STEPS[spotlightStepIndex]?.id ?? "";
  const gateSatisfied: boolean = (() => {
    switch (currentStepId) {
      case "drag-block":
        return dragBaseline !== null
          ? puckContentCount > dragBaseline
          : false;
      case "header-tab":
        return headerOpen;
      case "contact-tab":
        return contactOpen;
      default:
        return false;
    }
  })();

  // Stop Puck's global keydown hotkeys (Backspace/Delete/Escape/Ctrl+Z/Ctrl+S)
  // from firing while the user is typing in an input or contenteditable inside
  // the right-side properties panel. Puck registers document-level listeners;
  // stopping propagation here prevents those handlers from seeing the event.
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditableTarget(e.target)) e.stopPropagation();
  }, []);

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
        <div data-tour-id="canvas" className="flex min-h-0 flex-1 flex-col">
          {children}
          <RootCanvasStyle />
        </div>
      ),
    }),
    []
  );

  // Left cluster: page navigation (Home / Gallery / Contact) + Preview toggle.
  function navCluster() {
    return (
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
          // Tour anchor: home+gallery share the section-tabs group id on the first
          // rendered tab; header and contact get dedicated ids.
          const tourId =
            section === "header"
              ? "header-tab"
              : section === "contact"
                ? "contact-tab"
                : section === "home"
                  ? "section-tabs"
                  : undefined;
          return (
            <Button
              key={section}
              type="button"
              size="sm"
              variant={activeSection === section ? "default" : "outline"}
              aria-pressed={activeSection === section}
              data-tour-id={tourId}
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
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-pressed={previewMode}
          data-tour-id="preview-toggle"
          onClick={() => void togglePreview()}
        >
          {previewMode ? t("preview.edit") : t("preview.show")}
        </Button>
        <button
          type="button"
          title={t("preview.openInTab")}
          aria-label={t("preview.openInTab")}
          onClick={() => window.open(previewBasePath, "_blank", "noopener,noreferrer")}
          className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          <ExternalLinkIcon className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  function actionsCluster(publishSlot: ReactNode) {
    const saveDisabled = (!isDirty && activeDraftId !== null) || nameError !== null;
    return (
      <>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="order-4 lg:order-3"
          data-tour-id="photos"
          onClick={() => setPhotosOpen(true)}
        >
          {t("photos")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="order-5 lg:order-4"
          data-tour-id="theme"
          onClick={openTheme}
        >
          {t("theme")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="order-6 lg:order-5"
          onClick={() => { setSpotlightStepIndex(0); setGuideOpen(true); }}
        >
          {t("guide")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="order-7 lg:order-6"
          data-tour-id="drafts"
          onClick={() => setDraftsOpen(true)}
        >
          Drafts
        </Button>
        <div
          data-testid="draft-title-slot"
          className="order-first basis-full lg:order-7 lg:basis-auto"
        >
          <DraftNameEditor
            name={draftName}
            error={pendingAction !== null ? null : nameError}
            onCommit={(n) => { setDraftName(n); setNameError(null); }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="brand"
          className="order-8"
          data-tour-id="save-changes"
          disabled={saveDisabled}
          loading={savingChanges}
          onClick={() => void handleSaveChanges()}
        >
          Save changes
        </Button>
        <div className="order-9">{publishSlot}</div>
      </>
    );
  }

  // Three-section top bar: nav (left) · device toggle (center) · tools (right).
  function topBar(center: ReactNode, publishSlot: ReactNode) {
    return (
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="order-2 flex min-w-0 flex-1 justify-start lg:order-1">{navCluster()}</div>
        {center && <div className="order-3 flex shrink-0 items-center justify-center lg:order-2">{center}</div>}
        {actionsCluster(publishSlot)}
      </div>
    );
  }

  return (
    <GalleryPickerCacheProvider>
      <MobileBanner publicUrl={`${publicOrigin}/w/${slug}`} />

      <BrandColorsContext.Provider value={brandColors}>
      <div
        className={cn("gallurio-editor min-h-svh", className)}
        data-testid="portfolio-editor-shell"
        style={cssVars as React.CSSProperties}
        onKeyDown={handleEditorKeyDown}
      >
        {showPuck ? (
          <Puck
            key={`${activeZone}-${seedNonce}`}
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
              header: () => (
                <header
                  className="border-b border-border bg-card px-3 py-2"
                  style={{ gridArea: "header" }}
                >
                  <PuckGateReader
                    onState={({ contentCount }) => {
                      setPuckContentCount(contentCount);
                    }}
                  />
                  {topBar(
                    <EditCanvasControls />,
                    <Button
                      type="button"
                      size="sm"
                      data-tour-id="publish"
                      onClick={() => void handlePublish()}
                    >
                      {t("publish")}
                    </Button>,
                  )}
                </header>
              ),
              // Stable memoized override: prevents Puck from re-rendering the
              // canvas wrapper on every EditorShell re-render (keystroke → onChange).
              // Defined above with useMemo([]); RootCanvasStyle reads from Puck
              // context directly so needs no props passed here.
              ...puckCanvasOverride,
              // Tour anchor on the actual properties panel (not the toggle button)
              // so the guide highlights where a selected block's settings appear.
              fields: ({ children }: { children: ReactNode }) => (
                <div data-tour-id="properties-panel-body" className="flex min-h-0 flex-1 flex-col">
                  {children}
                </div>
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
                <Button type="button" size="sm" data-tour-id="publish" onClick={() => void handlePublish()}>
                  {t("publish")}
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {contactOpen ? (
                // Issue 2 fix: ContactPanelDialog is now inline (flex sibling), not a fixed overlay.
                <div className="flex h-full overflow-hidden">
                  <div className="flex-1 overflow-auto bg-muted/40" data-tour-id="contact-form-preview">
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
      {/* Welcome template modal — shown to brand-new users (no drafts, no buffer) instead of PortfolioEntryDialog. */}
      <TemplatePickerDialog
        open={welcomeTemplatesOpen}
        onOpenChange={() => {/* non-dismissible in welcome mode */}}
        templates={templates}
        currentTemplateId={templateId}
        switching={switching}
        error={switchError}
        onConfirm={(id) => { void applyTemplate(id); setWelcomeTemplatesOpen(false); }}
        welcome
        onStartScratch={() => setWelcomeTemplatesOpen(false)}
      />
      {/* In sandbox (guideMode) the guide runs directly in this shell. In the
          real editor it opens a full-screen sandbox so the live data is never
          touched during the tour. */}
      {guideMode ? (
        <SpotlightGuide
          open={guideOpen}
          steps={SPOTLIGHT_STEPS}
          stepIndex={spotlightStepIndex}
          onStepChange={handleGuideStepChange}
          gateSatisfied={gateSatisfied}
          onSkip={handleGuideSkip}
          onFinish={handleGuideFinish}
        />
      ) : (
        guideOpen && (
          <SandboxEditorGuide
            templates={templates}
            onFinished={handleGuideFinish}
            onSkipped={handleGuideSkip}
          />
        )
      )}

      {/* Draft system dialogs */}
      <DraftsDialog
        open={draftsOpen}
        onOpenChange={setDraftsOpen}
        drafts={drafts}
        activeDraftId={activeDraftId}
        onApply={(id) => guardThenRun(() => void applyDraft(id))}
        onDelete={(id) => void handleDeleteDraft(id)}
        onAddNew={handleAddNewDraft}
        deletingId={deletingDraftId}
        unsavedDraftName={isNewUnsavedDraft && activeDraftId === null ? draftName : null}
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
        name={draftName}
        onNameChange={(next) => { setDraftName(next); setNameError(validateDraftName(next)); }}
        nameLabel="Draft name"
        nameError={nameError}
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
          setPendingAction(null);
          setPublishOpen(false);
        }}
        onCancel={() => setPendingAction(null)}
      />

    </GalleryPickerCacheProvider>
  );
}

