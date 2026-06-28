"use client";

import "@measured/puck/puck.css";
import "./editor.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Puck, type Config, type Data } from "@measured/puck";
import { usePuckStore } from "@/lib/page-builder/puckHooks";
import { isEditableTarget } from "@/lib/page-builder/editableTarget";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Smartphone, Tablet, Monitor, PanelLeft, PanelRight, ExternalLinkIcon, Undo2, Redo2 } from "lucide-react";
// Client-safe editor config (lightweight previews, identical fields). The real
// server blocks render only on the public page via <Render>; importing them here
// would pull Mongo + AsyncLocalStorage into the client bundle (build break).
import { createEditorConfig } from "@/lib/page-builder/editorConfig";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { resolveEffectiveFonts } from "@/lib/page-builder/fonts";
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
import { fillBlockDefaults, type PuckDataLike } from "@/lib/page-builder/fillBlockDefaults";
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
import { useIsRtl } from "@/lib/i18n/rtl";
import { useActionError } from "@/lib/i18n/actionError";
import { SpotlightGuide } from "./SpotlightGuide";
import { SPOTLIGHT_STEPS, guidePanelActions, applyGuidePanelActions, shouldResetGuideCanvasOnStep } from "./spotlightSteps";
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
import { DraftNameEditor, type DraftNameEditorHandle } from "./DraftNameEditor";
import { DraftsDialog } from "./DraftsDialog";
import { PortfolioEntryDialog } from "./PortfolioEntryDialog";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { resolveDiscardTarget } from "./draftDiscard";
import { SuppressedActionBar } from "./SuppressedActionBar";
import { BlockActionsToolbar } from "./BlockActionsToolbar";

// Puck-editable zones (each round-trips its own Puck data). "contact" is a tab
// too, but it's the fixed prebuilt form — previewed, never Puck-edited.
type Zone = "home" | "gallery";
type EditorSection = Zone | "collectionsPopup" | "header" | "contact";

/** Preview-route `zone` param for the active editor section. */
export type PreviewZoneParam = "home" | "gallery" | "contact" | "popup";

/**
 * Map the active editor section to the preview route's `zone` param so the
 * iframe and the open-in-new-tab link land on what the user is viewing.
 * Contact and the collections popup have dedicated preview zones; header
 * chrome renders on the underlying page, so it falls back to the active zone.
 */
export function previewZoneFor(
  activeSection: EditorSection,
  activeZone: Zone
): PreviewZoneParam {
  if (activeSection === "contact") return "contact";
  if (activeSection === "collectionsPopup") return "popup";
  return activeZone;
}

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
  /**
   * Scopes spotlight anchor queries to a specific DOM subtree. Only needed in
   * sandbox (guideMode) when a second EditorShell coexists with the real one —
   * both render the same data-tour-id attributes, so an unscoped querySelector
   * resolves to the outer shell's element. Pass the sandbox overlay container
   * element here to constrain the lookup to the guide's own subtree.
   */
  guideQueryRoot?: Element | null;
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

/**
 * Mounts inside Puck's `fields` override and climbs the DOM to find the
 * outermost sidebar column (identified by `grid-area: right` in its computed
 * style — stable regardless of Puck's minified class names). Adds
 * `data-tour-id="properties-panel-full"` to that column so the spotlight
 * guide can frame the *entire* right panel for step 3.
 *
 * The attribute is added and removed in a useEffect so it never leaks
 * into the DOM after unmount.
 */
function RightPanelTourMarker() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let marked: Element | null = null;
    let el: Element | null = ref.current?.parentElement ?? null;
    // Walk up at most 8 levels to find the Puck sidebar column.
    // Puck sets `grid-area: right` (CSS) on the right sidebar column. The
    // computed `gridRowStart` returns the named area identifier "right" reliably
    // across browsers (unlike the `gridArea` shorthand whose computed form varies).
    for (let i = 0; i < 8 && el; i++) {
      const style = window.getComputedStyle(el);
      if (style.gridRowStart === "right") {
        el.setAttribute("data-tour-id", "properties-panel-full");
        marked = el;
        break;
      }
      el = el.parentElement;
    }
    return () => {
      marked?.removeAttribute("data-tour-id");
    };
  }, []);
  return <div ref={ref} style={{ display: "none" }} aria-hidden />;
}

// Device preview widths — shared by the in-canvas (Puck viewport) toggle and the
// standalone iframe preview. Mirrors the <Puck viewports> prop.
type PreviewDevice = "mobile" | "tablet" | "desktop";
const DEVICES: readonly { key: PreviewDevice; width: number; Icon: typeof Monitor }[] = [
  { key: "mobile", width: 390, Icon: Smartphone },
  { key: "tablet", width: 768, Icon: Tablet },
  { key: "desktop", width: 1280, Icon: Monitor },
] as const;

/**
 * In-canvas edit controls: the Components/Properties sidebar toggles (which the
 * default Puck header would otherwise provide via `children` — lost when we use
 * the `overrides.header` slot) plus the device viewport toggle that clamps the
 * edit canvas. Lives inside Puck so `usePuck` has context.
 */
function EditCanvasControls() {
  const t = useTranslations("app.pageBuilder.editor");
  const leftSideBarVisible = usePuckStore((s) => s.appState.ui.leftSideBarVisible);
  const rightSideBarVisible = usePuckStore((s) => s.appState.ui.rightSideBarVisible);
  const dispatch = usePuckStore((s) => s.dispatch);
  const hasPast = usePuckStore((s) => s.history.hasPast);
  const hasFuture = usePuckStore((s) => s.history.hasFuture);
  const back = usePuckStore((s) => s.history.back);
  const forward = usePuckStore((s) => s.history.forward);
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("controls.editorControls")}>
      <Button
        type="button"
        size="icon-sm"
        variant={leftSideBarVisible ? "default" : "outline"}
        aria-pressed={leftSideBarVisible}
        aria-label={t("controls.toggleBlocks")}
        title={t("controls.toggleBlocks")}
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
        title={t("controls.undoTitle")}
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
        title={t("controls.redoTitle")}
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
        aria-label={t("controls.toggleProperties")}
        title={t("controls.toggleProperties")}
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
  const t = useTranslations("app.pageBuilder.editor");
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("controls.previewDevice")} data-tour-id="device-toggle">
      {DEVICES.map(({ key, Icon }) => {
        const label = t(`devices.${key}`);
        return (
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
        );
      })}
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

/** Fill missing defaultProps into every block, then assign stable ids. */
function prepareForEditor(data: PuckData): Data {
  const withDefaults = fillBlockDefaults(data as unknown as PuckDataLike) as unknown as PuckData;
  return ensureIds(withDefaults);
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
  guideQueryRoot,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor");
  const tPublicForm = useTranslations("publicPage.inquiryForm");
  const tLocationPicker = useTranslations("app.bookings.locationPicker");
  const errMsg = useActionError();
  const editorConfig = useMemo(() => createEditorConfig(t), [t]);

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
  const [renderDraftData, setRenderDraftData] = useState<Record<Zone, PuckData>>(() => ({
    home: prepareForEditor(initialData.home ?? EMPTY_ZONE) as unknown as PuckData,
    gallery: prepareForEditor(initialData.gallery ?? EMPTY_ZONE) as unknown as PuckData,
  }));
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
  // JSON snapshot of the zone data at the time the last template was applied.
  // Compared against renderDraftData to detect canvas divergence for the "Current" badge.
  const [templateSeedSnapshot, setTemplateSeedSnapshot] = useState<string | null>(null);
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

  // Restart the spotlight tour when the writing direction flips (LTR<->RTL)
  // mid-tour — e.g. the owner switches to/from Arabic while the guide is open.
  // The mirrored layout invalidates the active step's anchor geometry, so we
  // re-run from step 0 for a clean re-flow rather than leaving a stale cutout.
  // Only direction flips restart; same-direction language swaps (en<->fil) keep
  // the user's place and just re-translate.
  // Restart from step 0 only on a direction flip (the mirrored layout
  // invalidates the active step's anchor geometry). Tracked via prev-state
  // compared during render — React's sanctioned "store info from previous
  // renders" pattern — so there's no effect or ref access during render.
  const guideIsRtl = useIsRtl();
  const [prevGuideRtl, setPrevGuideRtl] = useState(guideIsRtl);
  if (prevGuideRtl !== guideIsRtl) {
    setPrevGuideRtl(guideIsRtl);
    if (guideOpen) setSpotlightStepIndex(0);
  }

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
  const [pendingAction, setPendingAction] = useState<{ run: () => void; reseeds: boolean } | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
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
        home: prepareForEditor(initialData.home ?? EMPTY_ZONE),
        gallery: prepareForEditor(initialData.gallery ?? EMPTY_ZONE),
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
    home: prepareForEditor(initialData.home ?? EMPTY_ZONE) as unknown as PuckData,
    gallery: prepareForEditor(initialData.gallery ?? EMPTY_ZONE) as unknown as PuckData,
  });
  // Puck emits onChange once on mount (and again on the zone-switch remount).
  // Skip that first emission so merely loading a zone doesn't autosave/bump the
  // version — only genuine edits should.
  const ignoreNextChange = useRef(true);
  // Ref to the DraftNameEditor so handleSaveChanges can flush an in-progress rename.
  const nameEditorRef = useRef<DraftNameEditorHandle>(null);
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
    prepareForEditor(initialData.home ?? EMPTY_ZONE)
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

  // True when the canvas exactly matches the seed that was applied via applyTemplate.
  // Drives the "Current" badge in TemplatePickerDialog (B2).
  const isCanvasMatchingSeed =
    templateSeedSnapshot !== null &&
    JSON.stringify(renderDraftData) === templateSeedSnapshot;

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
        // prepareForEditor both zones so zoneDataRef, renderDraftData, and the
        // Puck seed are all in the same shape — mismatched shapes cause isDirty=true.
        const home = prepareForEditor(draft.data?.home ?? zoneDataRef.current.home) as unknown as PuckData;
        const gallery = prepareForEditor(draft.data?.gallery ?? zoneDataRef.current.gallery) as unknown as PuckData;
        zoneDataRef.current = { home, gallery };
        setRenderDraftData({ home, gallery });
        if (draft.brandKit) setBrandKit(draft.brandKit);
        if (draft.contact) setContact(draft.contact);
        if (typeof draft.formLocale === "string") setFormLocale(draft.formLocale);
        if (draft.headerConfig) setHeaderConfig(draft.headerConfig);
        if (draft.collectionsPopup) setCollectionsPopup(draft.collectionsPopup);
        if (draft.draftId !== undefined) setActiveDraftId(draft.draftId);
        if (draft.draftName) setDraftName(draft.draftName);
        ignoreNextChange.current = true;
        setPuckSeed(home as unknown as Data);
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
    if (!trimmed) return errMsg("field_required");
    const clash = drafts.some(
      (d) => d.id !== activeDraftId && d.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (clash) return errMsg("name_taken");
    return null;
  }

  // ---- Save changes ----
  async function handleSaveChanges(): Promise<boolean> {
    if (guideMode) return false;
    // Flush any in-progress rename so the name used for validation/save is current.
    const flushed = nameEditorRef.current?.commit();
    const nameToSave = flushed ?? draftName;
    const shouldToastValidationError = templatesOpen;
    const validationError = validateDraftName(nameToSave);
    if (validationError) {
      setNameError(validationError);
      if (shouldToastValidationError) toast.error(validationError);
      return false;
    }
    setSavingChanges(true);
    const payload = { name: nameToSave, ...buildDraftSnapshot() };
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
          const msg = errMsg("field_required");
          setNameError(msg);
          if (shouldToastValidationError) toast.error(msg);
        } else if (err === "name_taken") {
          const msg = errMsg(err);
          setNameError(msg);
          if (shouldToastValidationError) toast.error(msg);
        } else {
          toast.error(errMsg(err));
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
      const snapshotStr = JSON.stringify(payload);
      setSavedSnapshot(snapshotStr);
      persistLocalDraft();
      toast.success(t("savedToast"));
      return true;
    } finally {
      setSavingChanges(false);
    }
  }

  // ---- Unsaved-changes guard ----
  // `reseeds` should be true for actions that fully re-seed the canvas
  // (applyTemplate, applyDraft) so handleDiscardChanges can skip the redundant
  // intermediate restore and avoid a double seedNonce bump.
  function guardThenRun(run: () => void, reseeds = false) {
    if (activeDraftId === null || isDirty) {
      setPendingAction({ run, reseeds });
    } else {
      run();
    }
  }

  // ---- Apply draft ----
  async function applyDraft(id: string) {
    const res = await getDraftAction(id);
    if ("error" in res) {
      toast.error(errMsg("draft_load_failed"));
      return;
    }
    const d = res.draft;
    // prepareForEditor must be applied here so zoneDataRef, renderDraftData, and
    // savedSnapshot all carry the same shape — without it the gallery zone stays
    // raw while the snapshot holds the prepared version → isDirty=true on load.
    const homeData = prepareForEditor((d.data.home as PuckData) ?? EMPTY_ZONE) as unknown as PuckData;
    const galleryData = prepareForEditor((d.data.gallery as PuckData) ?? EMPTY_ZONE) as unknown as PuckData;
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
    // homeData is already prepareForEditor'd — pass directly to Puck.
    setPuckSeed(homeData as unknown as Data);
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

  // ---- Reset canvas to an empty scratch state (no backing draft) ----
  function resetToScratchCanvas() {
    zoneDataRef.current = { home: EMPTY_ZONE, gallery: EMPTY_ZONE };
    setRenderDraftData(zoneDataRef.current);
    setActiveDraftId(null);
    setIsNewUnsavedDraft(true);
    setDraftName(DEFAULT_DRAFT_NAME);
    setNameError(null);
    setSavedSnapshot(null);
    ignoreNextChange.current = true;
    setPuckSeed(prepareForEditor(EMPTY_ZONE));
    setSeedNonce((n) => n + 1);
    setActiveZone("home");
  }

  // ---- Discard unsaved changes ----
  // Scrap the in-memory edits, restore a clean canvas (see resolveDiscardTarget),
  // then perform the action the user was attempting.
  //
  // When the pending action re-seeds the canvas itself (applyTemplate, applyDraft),
  // the intermediate restore is skipped entirely — it would silently remount the
  // canvas once, only for the pending action to immediately remount it again with
  // the real target data. Skipping collapses to a single seedNonce bump and a
  // single indicated load cycle (the pending action's own switching/discarding state).
  async function handleDiscardChanges() {
    const pending = pendingAction;
    setPendingAction(null);
    setPublishOpen(false);
    setDiscarding(true);
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(draftKey);

      if (pending?.reseeds) {
        // The pending action (applyTemplate / applyDraft) fully re-seeds all canvas
        // state on its own — skip the intermediate canvas restore so there is only
        // ONE seedNonce bump (one remount, one visible load cycle).
        if (activeDraftId === null) {
          // Was a new unsaved draft: clear the flag so it doesn't linger when the
          // pending action (e.g. applyDraft) doesn't reset it itself.
          setIsNewUnsavedDraft(false);
        }
        pending.run();
      } else {
        // Non-reseeding pending action (e.g. open publish dialog): restore the
        // canvas to a clean state first, then run the action.
        if (activeDraftId !== null) {
          // 5.2 — saved draft: re-fetch its stored data into the canvas.
          await applyDraft(activeDraftId);
        } else {
          // 5.1 — new, never-saved draft: drop it and open the next available
          // draft (resolved from a fresh list), or an empty canvas when none.
          const list = await listDraftsAction();
          setDrafts(list);
          setIsNewUnsavedDraft(false);
          const target = resolveDiscardTarget(null, list);
          if (target.type === "open") await applyDraft(target.id);
          else resetToScratchCanvas();
        }
        pending?.run();
      }
    } finally {
      setDiscarding(false);
    }
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
        toast.error(errMsg("draft_delete_failed"));
        return;
      }
      if (
        nameError === errMsg("name_taken") &&
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
      setPuckSeed(prepareForEditor(zoneDataRef.current.home));
      setActiveZone("home");
    }
    await flushPendingSave(activeZone);
    ignoreNextChange.current = true;
    setPuckSeed(prepareForEditor(zoneDataRef.current[zone]));
    setActiveZone(zone);
    if (previewMode) setPreviewNonce((n) => n + 1);
  }

  async function togglePreview() {
    setPreviewLoading(true);
    try {
      if (previewMode) {
        // Back to editing — remount Puck from the freshest data; ignore its echo.
        ignoreNextChange.current = true;
        setPuckSeed(prepareForEditor(zoneDataRef.current[activeZone]));
        setPreviewMode(false);
        return;
      }
      // Entering preview — guarantee the iframe shows the latest edits.
      await flushPendingSave(activeZone);
      if (sidePanelOpen) {
        hideEditorPanels();
        ignoreNextChange.current = true;
        setPuckSeed(prepareForEditor(zoneDataRef.current.home));
        setActiveZone("home");
      }
      setPreviewNonce((n) => n + 1);
      setPreviewMode(true);
    } finally {
      setPreviewLoading(false);
    }
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
      setPendingAction({ run: () => setPublishOpen(true), reseeds: false });
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
    // Prepare both zones so zoneDataRef, renderDraftData, and templateSeedSnapshot
    // are all in the same shape — consistent with the applyDraft path (B3).
    const homeData = prepareForEditor((seed.data.home as PuckData) ?? EMPTY_ZONE) as unknown as PuckData;
    const galleryData = prepareForEditor((seed.data.gallery as PuckData) ?? EMPTY_ZONE) as unknown as PuckData;
    zoneDataRef.current = { home: homeData, gallery: galleryData };
    setRenderDraftData(zoneDataRef.current);
    setBrandKit(seed.brandKit as PortfolioBrandKit);
    setContact(seed.contact as PortfolioContactConfig);
    setHeaderConfig((seed.header as PortfolioHeaderConfig) ?? DEFAULT_HEADER_CONFIG);
    setCollectionsPopup((seed.collectionsPopup as PortfolioCollectionsPopupConfig) ?? {});
    setTemplateId(seed.templateId);
    // Snapshot the seed data so the template picker can show the "Current" badge
    // only while the canvas matches this exact seed (B2).
    setTemplateSeedSnapshot(JSON.stringify(zoneDataRef.current));
    setActiveDraftId(null);
    setIsNewUnsavedDraft(true);
    setDraftName(DEFAULT_DRAFT_NAME);
    setNameError(null);
    // Re-baseline savedSnapshot to the just-applied state so isDirty is false
    // immediately after applyTemplate. Mirrors applyDraft's pattern exactly —
    // field order must match the isDirty serialisation (~line 574).
    setSavedSnapshot(JSON.stringify({
      name: DEFAULT_DRAFT_NAME,
      templateId: seed.templateId,
      data: zoneDataRef.current,
      brandKit: seed.brandKit as PortfolioBrandKit,
      contact: seed.contact as PortfolioContactConfig,
      header: (seed.header as PortfolioHeaderConfig) ?? DEFAULT_HEADER_CONFIG,
      collectionsPopup: (seed.collectionsPopup as PortfolioCollectionsPopupConfig) ?? {},
      formLocale,
    }));
    ignoreNextChange.current = true;
    // Already prepared — pass directly to Puck without double-prepareForEditor.
    setPuckSeed(homeData as unknown as Data);
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

  function resetGuideCanvas() {
    zoneDataRef.current = { home: EMPTY_ZONE, gallery: EMPTY_ZONE };
    setRenderDraftData({ home: EMPTY_ZONE, gallery: EMPTY_ZONE });
    setPuckSeed(prepareForEditor(EMPTY_ZONE));
    setSeedNonce((n) => n + 1);
    setDragBaseline(0);
  }

  function handleGuideStepChange(next: number) {
    const currentId = SPOTLIGHT_STEPS[next]?.id;

    if (guideMode && shouldResetGuideCanvasOnStep(currentId ?? "", puckContentCount > 0)) {
      // Back to drag-block: wipe the scratch canvas so step 2 starts blank and
      // its drop-gate re-arms correctly.
      resetGuideCanvas();
    } else if (currentId === "drag-block") {
      // Forward to drag-block: capture the current count as the new baseline.
      setDragBaseline(puckContentCount);
    }

    // Rewind: restore the side-panel context the target step expects so its
    // anchor exists (and Back works across panels).
    applyGuidePanelActions(
      guidePanelActions(currentId, { headerOpen, contactOpen }),
      {
        openHeader: () => { void openHeader(); },
        openContact: () => { void openContact(); },
        closeHeader: () => closeHeader(false),
        closeContact: () => closeContact(false),
      },
    );

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

  // Stop Puck's global keydown hotkeys (Backspace/Delete/Escape/Ctrl+Z/Ctrl+S,
  // and single-key shortcuts like I=interactive-preview and Y=redo) from firing
  // while the user is typing in any text input, textarea, select, or contenteditable.
  //
  // Two-layer defence:
  //  1. React onKeyDown (bubble): stops propagation so Puck's document-level
  //     bubble-phase listener never sees the event for most cases.
  //  2. Native capture-phase listener on document: fires before ANY bubble-phase
  //     listener (including ones registered before React mounts), so it catches
  //     the edge case where Puck's registration order beats React's delegation.
  //     stopImmediatePropagation() is used so no subsequent same-phase handler
  //     on document can see the event either.
  //     We do NOT preventDefault — normal typing must reach the input.
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditableTarget(e.target)) e.stopPropagation();
  }, []);

  useEffect(() => {
    function interceptPuckHotkeys(e: KeyboardEvent) {
      const target = e.target ?? document.activeElement;
      if (isEditableTarget(target)) {
        // stopImmediatePropagation prevents all other listeners — same phase
        // (capture) and all subsequent phases — from seeing this event.
        // Do NOT preventDefault: typing characters must still reach the input.
        e.stopImmediatePropagation();
      }
    }
    document.addEventListener("keydown", interceptPuckHotkeys, true);
    return () => {
      document.removeEventListener("keydown", interceptPuckHotkeys, true);
    };
  }, []);

  const { cssVars, className } = resolveBrandKit(brandKit);
  // Resolved palette for the toolkit swatches (portaled popovers can't read the
  // `--pf-color-*` vars, so we thread the hex values through React context).
  // Use resolveEffectiveFonts so legacy-kit portfolios (only `fontPair` set, no
  // independent headingFont/bodyFont) get the same font the live page renders —
  // preventing the font dropdown from showing no selection for those portfolios.
  const { headingFont: effectiveHeadingFont, bodyFont: effectiveBodyFont } = resolveEffectiveFonts(brandKit);
  const brandColors = {
    primary: brandKit.primaryColor,
    secondary: brandKit.secondaryColor,
    accent: brandKit.accentColor,
    background: brandKit.backgroundColor,
    foreground: brandKit.foregroundColor,
    brandRadius: brandKit.radius,
    headingFont: effectiveHeadingFont,
    bodyFont: effectiveBodyFont,
  };
  const activeSectionTitle =
    activeSection === "header"
      ? t("headerSettings")
      : activeSection === "contact"
        ? t("contactSettingsShort")
        : activeSection === "collectionsPopup"
          ? t("featuredPopup")
          : t(`zone.${activeSection}`);
  const headerTitle = `${workspaceName} · ${activeSectionTitle}`;
  const contactLabels = buildContactLabels(
    (key, values) => tPublicForm(key, values),
    (key, values) => tLocationPicker(key, values)
  ).form;
  const previewZone = previewZoneFor(activeSection, activeZone);
  const previewSrc = `${previewBasePath}?zone=${previewZone}&v=${previewNonce}`;

  // Stable references for Puck overrides that must not change identity on every
  // re-render. Puck treats a new function reference as a reason to unmount and
  // remount the subtree — causing canvas scroll-to-top for `puck`, and focus loss
  // on every keystroke for `drawer`/`fields` (Puck onChange → re-render → new
  // inline arrow → remounted right panel → focused input destroyed).
  // All three are stable because none of their JSX closes over changing values:
  // RootCanvasStyle and RightPanelTourMarker are module-level components.
  const puckStableOverrides = useMemo(
    () => ({
      // Canvas wrapper — also carries RootCanvasStyle for the iframe background,
      // and BlockActionsToolbar (always-visible, portals to body from within
      // Puck context so createUsePuck selectors are available).
      puck: ({ children }: { children: ReactNode }) => (
        <div data-tour-id="canvas" className="flex min-h-0 flex-1 flex-col">
          {children}
          <RootCanvasStyle />
          <BlockActionsToolbar />
        </div>
      ),
      // Left sidebar drawer — tour anchor for the "drag a block" spotlight step.
      drawer: ({ children }: { children: ReactNode }) => (
        <div data-tour-id="blocks-panel" className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      ),
      // Right properties panel — tour anchor for the "block settings" spotlight step.
      // RightPanelTourMarker climbs to the sidebar column (grid-area: right) and
      // marks it as "properties-panel-full" so the step-3 cutout frames the full
      // column, not just the inner fields wrapper.
      fields: ({ children }: { children: ReactNode }) => (
        <div data-tour-id="properties-panel-body" className="flex min-h-0 flex-1 flex-col">
          <RightPanelTourMarker />
          {children}
        </div>
      ),
      // Block action bar: suppress Puck's built-in floating bar so it doesn't
      // compete with BlockActionsToolbar (our always-visible toolbar).
      // SuppressedActionBar is module-level — stable reference, no remount risk.
      actionBar: SuppressedActionBar,
    }),
    []
  );

  // Left cluster: page navigation (Home / Gallery / Contact) + Preview toggle.
  function navCluster() {
    return (
      <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto" role="group" aria-label={t("zone.sectionsLabel")}>
        {/* section-tabs wrapper: spans all five page tabs (Home → Contact Form)
            for the spotlight tour step 7 cutout. Excludes Preview. */}
        <div className="flex flex-nowrap items-center gap-1" data-tour-id="section-tabs">
          {EDITOR_SECTIONS.filter((section) => !previewMode || (section !== "header" && section !== "contact" && section !== "collectionsPopup")).map((section) => {
            const label =
              section === "header"
                ? t("headerSettings")
                : section === "contact"
                  ? t("contactSettingsShort")
                  : section === "collectionsPopup"
                    ? t("featuredPopup")
                    : t(`zone.${section}`);
            // Tour anchor: header and contact get dedicated ids for their own
            // gated steps (step 8 and step 12); page tabs have no individual id.
            const tourId =
              section === "header"
                ? "header-tab"
                : section === "contact"
                  ? "contact-tab"
                  : undefined;
            return (
              <Button
                key={section}
                type="button"
                size="sm"
                variant={activeSection === section ? "default" : "outline"}
                aria-pressed={activeSection === section}
                data-tour-id={tourId}
                className="shrink-0"
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
          variant="secondary"
          aria-pressed={previewMode}
          data-tour-id="preview-toggle"
          loading={previewLoading}
          disabled={previewLoading}
          className="shrink-0"
          onClick={() => void togglePreview()}
        >
          {previewMode ? t("preview.edit") : t("preview.show")}
        </Button>
        <button
          type="button"
          title={t("preview.openInTab")}
          aria-label={t("preview.openInTab")}
          onClick={() => window.open(`${previewBasePath}?zone=${previewZone}`, "_blank", "noopener,noreferrer")}
          className="inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
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
          {t("drafts")}
        </Button>
        <div
          data-testid="draft-title-slot"
          className="order-first basis-full lg:order-7 lg:basis-auto"
        >
          <DraftNameEditor
            ref={nameEditorRef}
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
          {t("saveChanges")}
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
        className={cn("gallurio-editor relative min-h-svh", className)}
        data-testid="portfolio-editor-shell"
        style={cssVars as React.CSSProperties}
        onKeyDown={handleEditorKeyDown}
      >
        {/* Page-wide loading overlay shown during draft discard/load transitions.
            Positioned to cover the editor canvas area; when Puck is visible the
            inline-start sidebar (~260px) is excluded by the inline-start offset
            so only the canvas + properties panel area is covered. */}
        {discarding && (
          <div
            role="status"
            aria-live="polite"
            aria-label={t("loadingDraft")}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            // Puck's left sidebar (~260px) sits at the inline-start edge in both
            // LTR and RTL (the grid mirrors under dir=rtl); exclude it logically.
            style={{ insetInlineStart: showPuck ? "260px" : 0 }}
          >
            <div className="flex flex-col items-center gap-3 rounded-lg bg-card px-8 py-6 shadow-lg border border-border">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium text-foreground">{t("loadingDraftEllipsis")}</p>
            </div>
          </div>
        )}
        {showPuck ? (
          <Puck
            key={`${activeZone}-${seedNonce}`}
            // Cast to the base Config so Puck's deep generic inference doesn't blow
            // tsc's stack; editorPuckConfig is typed at the component level already.
            config={editorConfig as unknown as Config}
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
              { width: 1280, label: t("devices.desktop"), icon: "Monitor" },
              { width: 768, label: t("devices.tablet"), icon: "Tablet" },
              { width: 390, label: t("devices.mobile"), icon: "Smartphone" },
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
              // Stable memoized overrides: canvas (`puck`), left drawer, and right
              // fields panel. All three are defined in `puckStableOverrides` above
              // with useMemo([]) so their identities never change between renders,
              // preventing Puck from remounting the subtrees (scroll-to-top on canvas;
              // focus loss on every keystroke in the right-panel inputs).
              ...puckStableOverrides,
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
        isCanvasMatchingSeed={isCanvasMatchingSeed}
        switching={switching}
        error={switchError}
        onConfirm={(id) => guardThenRun(() => void applyTemplate(id), true)}
      />
      {/* Welcome template modal — shown to brand-new users (no drafts, no buffer) instead of PortfolioEntryDialog. */}
      <TemplatePickerDialog
        open={welcomeTemplatesOpen}
        onOpenChange={() => {/* non-dismissible in welcome mode */}}
        templates={templates}
        currentTemplateId={templateId}
        isCanvasMatchingSeed={isCanvasMatchingSeed}
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
          queryRoot={guideQueryRoot}
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
        onApply={(id) => guardThenRun(() => void applyDraft(id), true)}
        onDelete={(id) => void handleDeleteDraft(id)}
        onAddNew={handleAddNewDraft}
        deletingId={deletingDraftId}
        unsavedDraftName={isNewUnsavedDraft && activeDraftId === null ? draftName : null}
      />
      <PortfolioEntryDialog
        open={entryOpen}
        // "Continue where you left off" resumes the most recent state: the
        // unsaved-edit buffer if present, otherwise the active draft. It is only
        // disabled on a true first visit — no active draft now (initialActiveDraftId)
        // nor a recoverable buffer from last time. Note the buffer is cleared on
        // save/publish, so it must NOT be the sole gate.
        canContinue={hasRecoverableBuffer || initialActiveDraftId !== null}
        hasDrafts={drafts.length > 0}
        onContinue={() => setEntryOpen(false)}
        onLoadExisting={() => { setEntryOpen(false); setDraftsOpen(true); }}
        onStartScratch={() => { setEntryOpen(false); setTemplatesOpen(true); }}
      />
      <UnsavedChangesDialog
        open={pendingAction !== null}
        saving={savingChanges}
        discarding={discarding}
        name={draftName}
        onNameChange={(next) => { setDraftName(next); setNameError(validateDraftName(next)); }}
        nameLabel={t("draftNameLabel")}
        nameError={nameError}
        onSave={async () => {
          const ok = await handleSaveChanges();
          if (ok) {
            const run = pendingAction?.run;
            setPendingAction(null);
            run?.();
          }
        }}
        onDiscard={() => void handleDiscardChanges()}
        onCancel={() => setPendingAction(null)}
      />

    </GalleryPickerCacheProvider>
  );
}

