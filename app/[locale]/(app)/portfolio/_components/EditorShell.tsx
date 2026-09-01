"use client";

import "@measured/puck/puck.css";
import "./editor.css";
import { Children, createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Puck, Render, type Config, type Data } from "@measured/puck";
import { usePuckStore } from "@/lib/page-builder/puckHooks";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { isEditableTarget, isSelfManagedComboboxTarget } from "@/lib/page-builder/editableTarget";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CircleHelp,
  ChevronDown,
  ExternalLinkIcon,
  Files,
  Images,
  Loader2,
  Monitor,
  Palette,
  PanelLeft,
  PanelRight,
  Redo2,
  Rocket,
  Save,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";
import { CanvasViewportControls } from "./CanvasViewportControls";
import { PresetDrawerItem, PresetPreviewPanel } from "./PresetPreviewCard";
import { PortfolioLanguageControl } from "./PortfolioLanguageControl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { computeCollectionsPopupAction, applyCollectionsPopupBranch } from "@/lib/page-builder/hasFeaturedWork";
// Client-safe editor config (lightweight previews, identical fields). The real
// server blocks render only on the public page via <Render>; importing them here
// would pull Mongo + AsyncLocalStorage into the client bundle (build break).
import { createEditorConfig } from "@/lib/page-builder/editorConfig";
import { reconcileContainerAnchors } from "@/lib/page-builder/containerAnchorReconciler";
import { reconcileMasonryClones } from "@/lib/page-builder/masonryCloneReconciler";
import { PRESET_BLOCK_KEYS } from "@/lib/page-builder/blockCategories";
import {
  SECTION_PRESETS,
  COLLECTION_PRESET_KEYS,
  PRESET_GROUPS,
  type SectionPresetKey,
  type SectionPresetEntry,
} from "@/lib/page-builder/blocks/sectionPresets";
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
  updatePortfolioSlugAction,
} from "../_actions";
import {
  createDraftAction,
  updateDraftAction,
  deleteDraftAction,
  getDraftAction,
  listDraftsAction,
  publishDraftAction,
  seedTemplateAction,
  importDemoPortfolioAction,
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
import { useIsRtl, resolveEffectiveDir } from "@/lib/i18n/rtl";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DraftNameEditor, type DraftNameEditorHandle } from "./DraftNameEditor";
import { DraftsDialog } from "./DraftsDialog";
import { PortfolioEntryDialog } from "./PortfolioEntryDialog";
import { StoryPromptDialog } from "./StoryPromptDialog";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { resolveDiscardTarget } from "./draftDiscard";
import { SuppressedActionBar } from "./SuppressedActionBar";
import { BlockActionsToolbar } from "./BlockActionsToolbar";
import { portfolioPublicUrl } from "@/lib/portfolio/publicUrl";
import { DemoGateModal, type DemoGateType } from "./DemoGateModal";
import {
  getOrCreateDemoSessionId,
  demoDraftKey,
  detectImportableDemoSession,
  readDemoImageLibrary,
  wipeDemoLocalStorage,
} from "@/lib/page-builder/demoSession";
import { DemoImportDetectedDialog } from "./DemoImportDetectedDialog";
import { DemoPickerContext } from "@/lib/page-builder/demoPickerContext";
import { getTemplate } from "@/lib/page-builder/templates";
import { useDemoGuideChrome } from "@/lib/page-builder/demoGuideChrome";
import type { PortfolioRenderMetadata } from "@/lib/page-builder/blockContext";
import {
  createNavigationData,
  normalizeSharedChromeData,
  readNavigationConfig,
  setNavigationConfig,
  stripPageLocalFooters,
} from "@/lib/page-builder/sharedChrome";

// Puck-editable zones (each round-trips its own Puck data). "contact" is a tab
// too, but it's the fixed prebuilt form — previewed, never Puck-edited.
type Zone = "home" | "gallery" | "footer";
type DraftData = Record<Zone, PuckData> & { navigation: PuckData };
type InitialDraftData = Pick<DraftData, "home" | "gallery"> & Partial<Pick<DraftData, "navigation" | "footer">>;
type EditorSection = Zone | "collectionsPopup" | "header" | "contact";

/** Preview-route `zone` param for the active editor section. */
export type PreviewZoneParam = "home" | "gallery" | "contact" | "popup" | "footer";

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
  if (activeSection === "footer") return "footer";
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
  initialData: InitialDraftData;
  initialBrandKit: PortfolioBrandKit;
  initialContact: PortfolioContactConfig;
  initialHeaderConfig: PortfolioHeaderConfig;
  initialCollectionsPopup: PortfolioCollectionsPopupConfig;
  /** Per-page public chrome language ("" = auto from workspace country). */
  initialFormLocale: string;
  /** Explicit text direction for the public page ("" = derived from locale). */
  initialFormDir?: string;
  publicOrigin: string;
  /** Tenant subdomain used in public URL previews; null uses path-based fallback. */
  portfolioDomain?: string | null;
  /** Locale-aware path to the chrome-less preview route (iframe src base). */
  previewBasePath: string;
  /** Starter templates for the switcher. */
  templates: EditorTemplateSummary[];
  /** Id of the template the page is currently seeded from. */
  currentTemplateId: string;
  /** Whether the owner already dismissed the first-run guide overlay. */
  guideDismissed: boolean;
  /** True once the owner has been through/skipped the story prompt flow. */
  storyPromptCompleted: boolean;
  /** Owner's current public-page SEO description (seeds the story prompt). */
  initialSeoDescription: string;
  /** Owner's current SEO/style keywords (seeds the story prompt). */
  initialSeoKeywords: string[];
  /** Live recipient for inquiry-form submissions (seeds the story prompt). */
  initialInquiryRecipientEmail: string;
  /** Whether this workspace's public portfolio has been published at least once. */
  hasBeenPublished: boolean;
  /** Workspace business type, used to pick suggested vibe tags. */
  workspaceBusinessType: string;
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
  /**
   * Runs the shell as the public, unauthenticated Portfolio Maker demo: no
   * server calls anywhere (drafts/publish/template-seed are all
   * requireOrg()-gated and would break for an anonymous visitor). Persists to
   * localStorage keyed by a per-browser demo session id instead of the
   * workspace slug, shows a simplified 2-option entry screen, replaces the
   * Drafts button with "Create new design", and enforces image/block caps via
   * a shared gate modal. Mutually exclusive with guideMode — unlike sandbox
   * mode, the demo DOES persist to localStorage and DOES run the real
   * SpotlightGuide (with 3 step overrides).
   */
  demoMode?: boolean;
};

const EMPTY_ZONE: PuckData = { content: [], root: {} };
const SCRATCH_TEMPLATE_ID = "scratch";
// Demo caps — locked copy references "10" and "20" directly; keep in sync.
const DEMO_BLOCK_CAP = 20;
const EDITOR_SECTIONS: readonly EditorSection[] = ["home", "gallery", "header", "footer", "collectionsPopup", "contact"] as const;
// formDir was added as an optional field; absence defaults to LTR at hydration,
// so v2 buffers stay forward-compatible and must not be invalidated by a bump.
const LOCAL_DRAFT_VERSION = 3;

type PortfolioBrowserDraft = {
  version: typeof LOCAL_DRAFT_VERSION;
  data: DraftData;
  brandKit: PortfolioBrandKit;
  contact: PortfolioContactConfig;
  formLocale: string;
  formDir: string;
  headerConfig: PortfolioHeaderConfig;
  collectionsPopup: PortfolioCollectionsPopupConfig;
  draftId: string | null;
  draftName: string;
  templateId: string;
};

function readBrowserRecovery(key: string): PortfolioBrowserDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Omit<Partial<PortfolioBrowserDraft>, "version"> & { version?: number };
    if ((parsed.version !== 2 && parsed.version !== LOCAL_DRAFT_VERSION) || !parsed.data) return null;
    if (!parsed.data.home || !parsed.data.gallery) return null;
    const normalized = normalizeSharedChromeData(parsed.data, parsed.headerConfig);
    return {
      version: LOCAL_DRAFT_VERSION,
      data: {
        home: normalized.home,
        gallery: normalized.gallery,
        navigation: normalized.navigation,
        footer: normalized.footer,
      },
      brandKit: parsed.brandKit ?? DEFAULT_BRAND_KIT,
      contact: parsed.contact ?? {},
      formLocale: typeof parsed.formLocale === "string" ? parsed.formLocale : "",
      formDir: typeof parsed.formDir === "string" ? parsed.formDir : "",
      headerConfig: readNavigationConfig(normalized.navigation, parsed.headerConfig ?? DEFAULT_HEADER_CONFIG),
      collectionsPopup: parsed.collectionsPopup ?? {},
      draftId: parsed.draftId ?? null,
      draftName: parsed.draftName || DEFAULT_DRAFT_NAME,
      templateId: parsed.templateId || SCRATCH_TEMPLATE_ID,
    };
  } catch {
    return null;
  }
}

type SharedChromeCanvasValue = {
  navigation: PuckData;
  footer: PuckData;
  activeZone: Zone;
  config: Config;
  metadata: PortfolioRenderMetadata;
};

const SharedChromeCanvasContext = createContext<SharedChromeCanvasValue | null>(null);

function SharedChromeCanvas({ children }: { children: ReactNode }) {
  const value = useContext(SharedChromeCanvasContext);
  if (!value) return <>{children}</>;
  return (
    <>
      <Render data={value.navigation as Data} config={value.config} metadata={value.metadata} />
      {children}
      {value.activeZone !== "footer" && (
        <Render data={value.footer as Data} config={value.config} metadata={value.metadata} />
      )}
    </>
  );
}

export function NestedPresetDrawer({ children, presetTitle }: { children: ReactNode; presetTitle: string }) {
  const [open, setOpen] = useState(false);
  const items = Children.toArray(children);
  const presetGroupIds = new Set<string>(PRESET_GROUPS.map((group) => group.id));
  const presetGroups: ReactNode[] = [];
  const siblings: ReactNode[] = [];

  for (const child of items) {
    const key = isValidElement(child) ? String(child.key ?? "").replace(/^\.\$/, "") : "";
    if (presetGroupIds.has(key)) presetGroups.push(child);
    else siblings.push(child);
  }

  // During Puck's first render the component list is not populated yet. Keep
  // the wrapper stable and wait for its category effect rather than rendering
  // an empty accordion shell.
  if (presetGroups.length === 0) return <div>{children}</div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-tour-id="blocks-panel">
      <div className="border-b border-border">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center justify-between px-3 text-start text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span>{presetTitle}</span>
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
        {open && <div>{presetGroups}</div>}
      </div>
      {siblings}
    </div>
  );
}

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

/**
 * Portfolio Maker demo's simplified entry screen — exactly 2 options (no
 * "load existing draft", the demo has no named-drafts concept), replacing
 * PortfolioEntryDialog/the welcome-template modal/StoryPromptDialog entirely.
 * Non-dismissible, mirroring PortfolioEntryDialog's own pattern.
 */
function DemoEntryScreen({
  open,
  canContinue,
  onContinue,
  onStartScratch,
  t,
}: {
  open: boolean;
  canContinue: boolean;
  onContinue: () => void;
  onStartScratch: () => void;
  t: (key: string) => string;
}) {
  return (
    <Dialog open={open} disablePointerDismissal onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("entry.title")}</DialogTitle>
          <DialogDescription>{t("entry.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canContinue}
            onClick={onContinue}
            className="flex h-auto w-full flex-col items-start gap-1 p-4 text-start"
          >
            <span className="font-semibold">{t("entry.continueTitle")}</span>
            <span className="text-xs font-normal text-muted-foreground">{t("entry.continueHint")}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onStartScratch}
            className="flex h-auto w-full flex-col items-start gap-1 p-4 text-start"
          >
            <span className="font-semibold">{t("entry.startScratchTitle")}</span>
            <span className="text-xs font-normal text-muted-foreground">{t("entry.startScratchHint")}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * First thing a demo visitor sees: a plain welcome modal (mirrors the real
 * editor's onboarding-style dialogs) explaining what the page is, over the
 * already-mounted (empty) canvas. Opt-in tour: unlike the real editor's
 * first-run guide, the spotlight tour never auto-launches here — the visitor
 * picks it or dismisses straight into free exploration.
 */
function DemoIntroDialog({
  open,
  onShowGuide,
  onExploreSelf,
  t,
}: {
  open: boolean;
  onShowGuide: () => void;
  onExploreSelf: () => void;
  t: (key: string) => string;
}) {
  return (
    <Dialog open={open} disablePointerDismissal onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("intro.title")}</DialogTitle>
          <DialogDescription>{t("intro.body")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="button" onClick={onShowGuide} className="flex-1">
            {t("intro.showGuideCta")}
          </Button>
          <Button type="button" variant="outline" onClick={onExploreSelf} className="flex-1">
            {t("intro.exploreSelfCta")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
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
function EditCanvasControls({
  formLocale,
  formDir,
  onFormLocaleChange,
  onFormDirChange,
}: {
  formLocale: string;
  formDir: "ltr" | "rtl" | "";
  onFormLocaleChange: (v: string) => void;
  onFormDirChange: (v: "ltr" | "rtl") => void;
}) {
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
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <CanvasViewportControls />
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <PortfolioLanguageControl
        value={formLocale as Parameters<typeof PortfolioLanguageControl>[0]["value"]}
        onChange={onFormLocaleChange}
        dir={resolveEffectiveDir(formDir, formLocale)}
        onDirChange={onFormDirChange}
      />
    </div>
  );
}

function ResponsiveEditCanvasControls(
  props: Parameters<typeof EditCanvasControls>[0]
) {
  const t = useTranslations("app.pageBuilder.editor");
  return (
    <div data-tour-id="canvas-controls" className="shrink-0">
      <div className="portfolio-canvas-controls-inline">
        <EditCanvasControls {...props} />
      </div>
      <div className="portfolio-canvas-controls-compact">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label={t("controls.editorControls")}
                title={t("controls.editorControls")}
                data-testid="canvas-controls-trigger"
              />
            }
          >
            <SlidersHorizontal className="size-4" aria-hidden />
          </PopoverTrigger>
          <PopoverContent side="bottom" align="center" className="w-auto max-w-[calc(100vw-1rem)] p-2">
            <EditCanvasControls {...props} />
          </PopoverContent>
        </Popover>
      </div>
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
  onState: (state: { contentCount: number; hasPresetBlock: boolean }) => void;
}) {
  const content = usePuckStore((s) => s.appState.data.content ?? []);
  const contentCount = content.length;
  const hasPresetBlock = content.some((block) =>
    (PRESET_BLOCK_KEYS as readonly string[]).includes(block.type)
  );

  useEffect(() => {
    onState({ contentCount, hasPresetBlock });
  }, [contentCount, hasPresetBlock, onState]);

  return null;
}

/** Keeps editor-only ContainerAnchor data correct after every Puck mutation. */
function ContainerAnchorReconciler() {
  const data = usePuckStore((s) => s.appState.data);
  const dispatch = usePuckStore((s) => s.dispatch);

  useEffect(() => {
    const normalized = reconcileMasonryClones(reconcileContainerAnchors(data));
    if (normalized === data) return;
    dispatch({ type: "setData", data: normalized });
  }, [data, dispatch]);

  return null;
}

// The editor is uncontrolled per zone — Puck owns the live edit state and emits
// it via onChange. Each content item needs a stable props.id; seeded template
// data has none, so add deterministic ids before handing data to <Puck>.
function ensureIds(data: PuckData): Data {
  const withIds = (items: PuckData["content"], prefix: string): PuckData["content"] =>
    (items ?? []).map((b, i) => {
      const id = (b.props?.id as string) ?? `${prefix}-${b.type}-${i}`;
      const childContent = b.props?.content;
      return {
        ...b,
        props: {
          id,
          ...b.props,
          ...(Array.isArray(childContent)
            ? { content: withIds(childContent as PuckData["content"], id) }
            : {}),
        },
      };
    });
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
  // Normalize legacy/restored ContainerAnchor data before the first canvas
  // render, then keep it normalized live with ContainerAnchorReconciler.
  return reconcileMasonryClones(reconcileContainerAnchors(ensureIds(withDefaults)));
}

type DrawerCategories = NonNullable<ReturnType<typeof createEditorConfig>["categories"]>;

// Demo mode has no equivalent of the real (auth-gated) collections picker that
// FeaturedWork's Content tab needs (MultiCollectionControl), and the
// CollectionCard manual block shares that same dependency. Registry-derived
// (COLLECTION_PRESET_KEYS), not a hand-picked literal list, so a newly added
// collection-dependent preset can't slip through.
const DEMO_HIDDEN_COMPONENT_KEYS: ReadonlySet<string> = new Set([
  ...COLLECTION_PRESET_KEYS,
  "FeaturedWork",
  "CollectionCard",
]);

/**
 * Strips every collection-dependent preset variant plus the FeaturedWork /
 * CollectionCard manual blocks from EVERY drawer category (iterated, no
 * category named by hand) when demoMode is on. Pre-existing FeaturedWork /
 * CollectionCard blocks from a seeded template still render — StyleToolkitField
 * shows a disabled explanatory message instead of the real collections picker
 * for those. No-op (same reference) outside demo mode.
 */
export function filterCategoriesForDemo(categories: DrawerCategories, demoMode: boolean): DrawerCategories {
  if (!demoMode) return categories;
  const result: DrawerCategories = { ...categories };
  for (const id of Object.keys(result)) {
    const key = id as keyof DrawerCategories;
    const category = result[key];
    if (!category?.components) continue;
    result[key] = {
      ...category,
      components: category.components.filter((componentKey) => !DEMO_HIDDEN_COMPONENT_KEYS.has(componentKey)),
    };
  }
  return result;
}

/** Section-preset entry for a drawer item's component name; undefined for manual blocks. */
export function resolveDrawerItemPreset(name: string): SectionPresetEntry | undefined {
  return SECTION_PRESETS[name as SectionPresetKey];
}

export function EditorShell({
  slug,
  workspaceName,
  initialData,
  initialBrandKit,
  initialContact,
  initialFormLocale,
  initialFormDir,
  initialHeaderConfig,
  initialCollectionsPopup,
  portfolioDomain = null,
  previewBasePath,
  templates,
  currentTemplateId,
  guideDismissed,
  storyPromptCompleted,
  initialSeoDescription,
  initialSeoKeywords,
  initialInquiryRecipientEmail,
  hasBeenPublished,
  workspaceBusinessType,
  initialSavedThemes,
  initialDrafts = [],
  initialActiveDraftId = null,
  initialActiveDraftName,
  guideMode = false,
  onGuideFinish,
  onGuideSkipClose,
  guideQueryRoot,
  demoMode = false,
}: Props) {
  const setDemoGuideChromeOpen = useDemoGuideChrome();
  const t = useTranslations("app.pageBuilder.editor");
  const tDemo = useTranslations("app.portfolioMakerDemo");
  const tNav = useTranslations("publicPage.nav");
  const tPublicForm = useTranslations("publicPage.inquiryForm");
  const tLocationPicker = useTranslations("app.bookings.locationPicker");
  const errMsg = useActionError();
  const editorConfig = useMemo(() => {
    const config = createEditorConfig(t);
    if (!guideMode && !demoMode) return config;
    let categories = config.categories ?? {};

    // See filterCategoriesForDemo above: registry-derived removal of every
    // collection-dependent preset variant plus the FeaturedWork /
    // CollectionCard manual blocks, across every category (not two named ones).
    categories = filterCategoriesForDemo(categories, demoMode);

    // The guide's first task must create a block with the Style Toolkit tabs
    // used by steps 4â€“6. Keep manual blocks (including bare Video) out of the
    // sandbox drawer so only composed preset sections can be dropped.
    if (guideMode) {
      categories = { ...categories, manual: { ...categories.manual, visible: false } };
    }

    return { ...config, categories };
  }, [demoMode, guideMode, t]);

  // Demo-mode guide steps: SPOTLIGHT_STEPS with exactly 3 steps' copy
  // overridden (by id) to explain demo limits. slug is cleared on the
  // overridden steps so SpotlightGuide's TooltipCard falls back to the
  // literal title/body instead of the shared (non-demo) i18n slug key.
  const demoSpotlightSteps = useMemo(() => {
    if (!demoMode) return SPOTLIGHT_STEPS;
    return SPOTLIGHT_STEPS.map((step) => {
      if (step.id === "theme") {
        return { ...step, slug: undefined, body: `${step.body} ${tDemo("guideOverrides.theme.body")}` };
      }
      if (step.id === "drafts") {
        return {
          ...step,
          slug: undefined,
          title: tDemo("guideOverrides.drafts.title"),
          body: tDemo("guideOverrides.drafts.body"),
        };
      }
      if (step.id === "publish") {
        return { ...step, slug: undefined, body: `${step.body} ${tDemo("guideOverrides.publish.body")}` };
      }
      return step;
    });
  }, [demoMode, tDemo]);

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
  const [formDir, setFormDir] = useState<"ltr" | "rtl" | "">(
    (initialFormDir as "ltr" | "rtl" | "" | undefined) ?? ""
  );
  const [renderDraftData, setRenderDraftData] = useState<DraftData>(() => ({
    home: prepareForEditor(initialData.home ?? EMPTY_ZONE) as unknown as PuckData,
    gallery: prepareForEditor(initialData.gallery ?? EMPTY_ZONE) as unknown as PuckData,
    footer: prepareForEditor(initialData.footer ?? EMPTY_ZONE) as unknown as PuckData,
    navigation: initialData.navigation ?? createNavigationData(initialHeaderConfig),
  }));
  // currentSlug tracks the live slug after in-dialog edits (optimistic update).
  const [currentSlug, setCurrentSlug] = useState(slug);
  const [publishOpen, setPublishOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [headerConfig, setHeaderConfig] = useState<PortfolioHeaderConfig>(initialHeaderConfig ?? DEFAULT_HEADER_CONFIG);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [collectionsPopup, setCollectionsPopup] = useState<PortfolioCollectionsPopupConfig>(initialCollectionsPopup ?? {});
  const [collectionsPopupOpen, setCollectionsPopupOpen] = useState(false);
  const [featuredWorkWarningOpen, setFeaturedWorkWarningOpen] = useState(false);
  const pendingOpenCollectionsPopup = useRef<(() => void) | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateId, setTemplateId] = useState(currentTemplateId);
  // JSON snapshot of the zone data at the time the last template was applied.
  // Compared against renderDraftData to detect canvas divergence for the "Current" badge.
  const [templateSeedSnapshot, setTemplateSeedSnapshot] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  // Detect a public Portfolio Maker draft before initializing any first-run
  // dialogs. The owner must choose whether to import or discard it before the
  // story prompt, guide, or normal draft entry flow can take focus.
  const [detectedDemo, setDetectedDemo] = useState(() =>
    demoMode ? null : detectImportableDemoSession(),
  );
  // The story prompt auto-opens once, before the guide, on a fresh workspace.
  // Also gated on !guideDismissed so an owner who already dismissed the guide
  // via the old (pre-story-prompt) path never sees it retroactively, and on
  // !guideMode since the sandbox tour-preview shell has no real story to capture.
  const [storyPromptOpen, setStoryPromptOpen] = useState(
    !detectedDemo &&
      !storyPromptCompleted &&
      !guideDismissed &&
      !guideMode &&
      !demoMode,
  );
  // The guide auto-opens on first run (until the owner persisted a dismissal),
  // and can be reopened on demand via the Guide button for the session. In
  // demoMode it never auto-opens — DemoIntroDialog below gates it behind an
  // explicit "Show me around" choice instead of forcing the tour on load.
  const [guideOpen, setGuideOpen] = useState(
    !detectedDemo && !guideDismissed && !demoMode,
  );
  // Demo-only: the opt-in welcome modal shown before anything else. Gated on
  // !guideDismissed for the same reason guideOpen is elsewhere — tests (and,
  // in principle, a returning visitor) that start past that point skip
  // straight to the entry screen instead of re-showing the intro.
  const [demoIntroOpen, setDemoIntroOpen] = useState(demoMode && !guideDismissed);
  const [spotlightStepIndex, setSpotlightStepIndex] = useState(0);
  function openGuide() {
    setSpotlightStepIndex(0);
    setGuideOpen(true);
    if (demoMode) setDemoGuideChromeOpen?.(true);
  }
  function handleFormLocaleChange(next: string) {
    setFormLocale(next);
    if (next === "ar") setFormDir("rtl");
    markRecoveryEdit();
  }

  function handleFormDirChange(next: "ltr" | "rtl" | "") {
    setFormDir(next);
    markRecoveryEdit();
  }

  // Puck gate state (populated by PuckGateReader when Puck is mounted)
  const [puckContentCount, setPuckContentCount] = useState(0);
  const [puckHasPresetBlock, setPuckHasPresetBlock] = useState(false);
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

  // Recovery is offered only for a valid browser buffer. Durable drafts are
  // already loaded by the server and never trigger an entry decision.
  // When guideDismissed=false, both stay closed until guide finishes/skips.
  // detectedDemo was captured before the first-run dialog state above so this
  // decision always takes priority over onboarding prompts.
  const [entryOpen, setEntryOpen] = useState(() => {
    if (detectedDemo) return false;
    if (!guideDismissed) return false;
    // Brand-new check: no saved drafts AND no localStorage buffer.
    const hasBuffer = Boolean(readBrowserRecovery(`gallurio:portfolio-draft:${slug}`));
    return hasBuffer;
  });
  // Welcome template modal for brand-new users (no buffer AND no saved drafts).
  const [welcomeTemplatesOpen, setWelcomeTemplatesOpen] = useState(() => {
    if (detectedDemo) return false;
    if (!guideDismissed) return false;
    const hasDrafts = initialDrafts.length > 0;
    const hasBuffer = Boolean(readBrowserRecovery(`gallurio:portfolio-draft:${slug}`));
    return !hasDrafts && !hasBuffer;
  });
  const [pendingAction, setPendingAction] = useState<{ run: () => void; reseeds: boolean } | null>(null);
  // Opens immediately whenever a saved public-builder setup is present. The
  // explicit decision must not be hidden behind the first-run guide.
  const [demoImportOpen, setDemoImportOpen] = useState(() => Boolean(detectedDemo));
  const [demoImportBusy, setDemoImportBusy] = useState(false);
  // ---- Demo-mode-only state (app/[locale]/portfolio-maker-demo) ----
  const [demoSessionId] = useState<string>(() => (demoMode ? getOrCreateDemoSessionId() : ""));
  // Simplified 2-option entry screen, shown instead of PortfolioEntryDialog /
  // the welcome-template modal / StoryPromptDialog. Opens immediately when the
  // guide is already dismissed (returning demo visitor); otherwise the guide
  // runs first and opens it on finish/skip (openEntryAfterGuide).
  const [demoEntryOpen, setDemoEntryOpen] = useState(() => demoMode && guideDismissed);
  // "Create new design" — same TemplatePickerDialog(welcome) the real editor's
  // brand-new-user welcome flow uses, but opened on demand and never
  // auto-applies scratch on close (this is an explicit user action, not a
  // mandatory first-run flow).
  const [demoTemplatesOpen, setDemoTemplatesOpen] = useState(false);
  // Which upsell gate the visitor just hit (image cap / block cap / publish /
  // theme customization); null = no gate modal open.
  const [activeDemoGate, setActiveDemoGate] = useState<DemoGateType>(null);
  const [discarding, setDiscarding] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [applyingDraftId, setApplyingDraftId] = useState<string | null>(null);
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
        footer: prepareForEditor(initialData.footer ?? EMPTY_ZONE),
        navigation: initialData.navigation ?? createNavigationData(initialHeaderConfig),
      },
      brandKit: initialBrandKit,
      contact: initialContact,
      header: initialHeaderConfig ?? DEFAULT_HEADER_CONFIG,
      collectionsPopup: initialCollectionsPopup ?? {},
      formLocale: initialFormLocale,
      formDir: initialFormDir ?? "",
    });
  });

  const sidePanelOpen = headerOpen || contactOpen || collectionsPopupOpen;
  const activeSection: EditorSection = headerOpen ? "header" : contactOpen ? "contact" : collectionsPopupOpen ? "collectionsPopup" : activeZone;
  const showPuck = !previewMode && !sidePanelOpen;

  // Source of truth for each zone's latest data, updated by Puck's onChange.
  // A ref (not state) so editing doesn't re-feed Puck mid-session.
  const zoneDataRef = useRef<DraftData>({
    home: prepareForEditor(initialData.home ?? EMPTY_ZONE) as unknown as PuckData,
    gallery: prepareForEditor(initialData.gallery ?? EMPTY_ZONE) as unknown as PuckData,
    footer: prepareForEditor(initialData.footer ?? EMPTY_ZONE) as unknown as PuckData,
    navigation: initialData.navigation ?? createNavigationData(initialHeaderConfig),
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
  // Logo captured by the onboarding story prompt, held here instead of applied to
  // headerConfig immediately — setting headerConfig this early would get written into
  // the localStorage draft buffer by the persistLocalDraft effect below, making a
  // brand-new visitor look like they already have a recoverable draft. Applied once,
  // into the new draft, when a template is actually picked (applyTemplate).
  const pendingOnboardingLogoRef = useRef<{ logoUrl: string; logoAssetId: string } | null>(null);

  // The data object handed to <Puck> at mount. Set only on zone switch (in the
  // event handler, from the ref) and initialized from props — never read the ref
  // during render. Paired with key={`${activeZone}-${seedNonce}`} so brand-kit
  // re-renders never reset the editor mid-edit, and full re-seeds (applyTemplate,
  // applyDraft) force a remount by bumping seedNonce.
  const [puckSeed, setPuckSeed] = useState<Data>(() =>
    prepareForEditor(initialData.home ?? EMPTY_ZONE)
  );
  const [seedNonce, setSeedNonce] = useState(0);
  // Demo sessions use a distinct namespace (keyed by demoSessionId, not slug)
  // so a demo session can never collide with or leak into a real workspace's draft.
  const draftKey = demoMode ? demoDraftKey(demoSessionId) : `gallurio:portfolio-draft:${slug}`;
  const [browserRecovery, setBrowserRecovery] = useState<PortfolioBrowserDraft | null>(() =>
    readBrowserRecovery(draftKey),
  );
  const [hasRecoverableBuffer, setHasRecoverableBuffer] = useState(() => browserRecovery !== null);
  const recoveryWritesEnabledRef = useRef(demoMode);
  const [previewRecoveryAllowed, setPreviewRecoveryAllowed] = useState(demoMode);

  const markRecoveryEdit = useCallback(() => {
    if (guideMode) return;
    recoveryWritesEnabledRef.current = true;
    setPreviewRecoveryAllowed(true);
    setHasRecoverableBuffer(true);
  }, [guideMode]);

  // ---- Snapshot helpers ----
  function buildDraftSnapshot() {
    return {
      templateId,
      data: {
        home: zoneDataRef.current.home,
        gallery: zoneDataRef.current.gallery,
        navigation: zoneDataRef.current.navigation,
        footer: zoneDataRef.current.footer,
      },
      brandKit,
      contact,
      header: headerConfig,
      collectionsPopup,
      formLocale,
      formDir,
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
    JSON.stringify({ name: draftName, templateId, data: renderDraftData, brandKit, contact, header: headerConfig, collectionsPopup, formLocale, formDir }) !==
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
      formDir,
      headerConfig,
      collectionsPopup,
      draftId: activeDraftId,
      draftName,
      templateId,
    };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      return true;
    } catch {
      return false;
    }
  }, [brandKit, collectionsPopup, contact, draftKey, formDir, formLocale, guideMode, headerConfig, activeDraftId, draftName, templateId]);

  // Typing emits a Puck onChange per keystroke; persisting to localStorage on
  // every one makes text blocks laggy. Debounce the local write (trailing) and
  // flush it at every commit point (zone switch, save, blur, unload, unmount).
  const { debounced: debouncedPersistLocalDraft, flush: flushLocalDraft } = useDebounce<void>(
    () => persistLocalDraft(),
    350,
  );

  useEffect(() => {
    if (guideMode) return;
    if (!recoveryWritesEnabledRef.current) return;
    persistLocalDraft();
  }, [activeDraftId, collectionsPopup, contact, draftName, formDir, formLocale, guideMode, headerConfig, persistLocalDraft]);

  function applyBrowserRecovery() {
    const draft = browserRecovery;
    if (!draft) return;
    const home = prepareForEditor(draft.data.home) as unknown as PuckData;
    const gallery = prepareForEditor(draft.data.gallery) as unknown as PuckData;
    const footer = prepareForEditor(draft.data.footer) as unknown as PuckData;
    const navigation = draft.data.navigation;
    zoneDataRef.current = { home, gallery, footer, navigation };
    setRenderDraftData(zoneDataRef.current);
    setBrandKit(draft.brandKit);
    setContact(draft.contact);
    setFormLocale(draft.formLocale);
    setFormDir(draft.formDir as "ltr" | "rtl" | "");
    setHeaderConfig(readNavigationConfig(navigation, draft.headerConfig));
    setCollectionsPopup(draft.collectionsPopup);
    setActiveDraftId(draft.draftId);
    setDraftName(draft.draftName);
    setTemplateId(draft.templateId);
    setSavedSnapshot(null);
    recoveryWritesEnabledRef.current = true;
    setPreviewRecoveryAllowed(true);
    ignoreNextChange.current = true;
    setPuckSeed(home as unknown as Data);
    setSeedNonce((n) => n + 1);
  }

  // beforeunload guard while dirty. Flush any pending debounced write so a
  // reload/close never loses the last keystrokes.
  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      flushLocalDraft();
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, flushLocalDraft]);

  // Flush a pending debounced write on unmount.
  useEffect(() => () => flushLocalDraft(), [flushLocalDraft]);

  // Puck/contact/navigation drafts are browser-local until Save changes.
  // Flushing commits any pending debounced keystroke write before the caller
  // (zone switch, preview, save) reads the buffer.
  const flushPendingSave = useCallback(async (zone: Zone): Promise<boolean> => {
    void zone;
    flushLocalDraft();
    return true;
  }, [flushLocalDraft]);

  const handleChange = useCallback(
    (data: Data) => {
      const rawNext = data as unknown as PuckData;
      const next = activeZone === "footer" ? rawNext : stripPageLocalFooters(rawNext);
      const removedPageFooter =
        rawNext.content.length !== next.content.length ||
        rawNext.content.some((entry, index) => entry !== next.content[index]) ||
        Object.entries(rawNext.zones ?? {}).some(([key, entries]) => {
          const sanitized = next.zones?.[key] ?? [];
          return entries.length !== sanitized.length || entries.some((entry, index) => entry !== sanitized[index]);
        });
      if (demoMode) {
        const prevLen = zoneDataRef.current[activeZone].content.length;
        const nextLen = next.content.length;
        // Only a genuine block ADD past the cap is blocked (reorders/edits
        // never grow content.length). Puck is uncontrolled after mount, so the
        // only way to revert the visual canvas is the same remount technique
        // used elsewhere in this file (bump seedNonce with the pre-add data).
        if (nextLen > DEMO_BLOCK_CAP && nextLen > prevLen) {
          setActiveDemoGate("blockCap");
          ignoreNextChange.current = true;
          setPuckSeed(prepareForEditor(zoneDataRef.current[activeZone]));
          setSeedNonce((n) => n + 1);
          return;
        }
      }
      zoneDataRef.current[activeZone] = next;
      setRenderDraftData((current) => ({ ...current, [activeZone]: next }));
      if (removedPageFooter) {
        // Footer presets belong to the shared Footer document. If legacy data
        // or a drawer drag introduces one into Home/Gallery, discard it from
        // that page and remount Puck so it never renders as duplicate chrome.
        ignoreNextChange.current = true;
        setPuckSeed(prepareForEditor(next));
        setSeedNonce((n) => n + 1);
        return;
      }
      if (ignoreNextChange.current) {
        ignoreNextChange.current = false;
        return; // mount/remount echo - capture data, but don't autosave.
      }
      markRecoveryEdit();
      debouncedPersistLocalDraft();
      // isDirty is derived at render time from savedSnapshot state — no manual update needed.
    },
    [activeZone, debouncedPersistLocalDraft, demoMode, markRecoveryEdit, setActiveDemoGate]
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
    if (demoMode) {
      // Local-only: no createDraftAction/updateDraftAction — those are
      // requireOrg()-gated and would break for an anonymous demo visitor.
      if (nameToSave !== draftName) setDraftName(nameToSave);
      const payload = { name: nameToSave, ...buildDraftSnapshot() };
      persistLocalDraft();
      setSavedSnapshot(JSON.stringify(payload));
      toast.success(t("savedToast"));
      return true;
    }
    const shouldToastValidationError = templatesOpen;
    const validationError = validateDraftName(nameToSave);
    if (validationError) {
      setNameError(validationError);
      if (shouldToastValidationError) toast.error(validationError);
      return false;
    }
    // Consume any pending trailing write before the durable request. Once the
    // request succeeds, removing the key cannot be undone by that old timer.
    flushLocalDraft();
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
      if (typeof window !== "undefined") window.localStorage.removeItem(draftKey);
      recoveryWritesEnabledRef.current = false;
      setBrowserRecovery(null);
      setHasRecoverableBuffer(false);
      setPreviewRecoveryAllowed(false);
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

  // ---- Demo import (detected on mount — see detectedDemo above) ----
  // Both paths wipe the demo session's localStorage so the detection can
  // never fire again for it, regardless of which button was pressed.
  function handleDemoImportDiscard() {
    if (detectedDemo) wipeDemoLocalStorage(detectedDemo.sessionId);
    setDetectedDemo(null);
    setDemoImportOpen(false);

    if (!storyPromptCompleted && !guideDismissed && !guideMode) {
      setGuideOpen(true);
      setStoryPromptOpen(true);
    } else if (!guideDismissed) {
      openGuide();
    } else {
      openNormalEntryFlow();
    }
  }

  async function runDemoImport() {
    if (!detectedDemo) {
      setDemoImportOpen(false);
      return;
    }
    setDemoImportBusy(true);
    try {
      const res = await importDemoPortfolioAction({
        demoSessionId: detectedDemo.sessionId,
        draft: {
          data: detectedDemo.buffer.data,
          brandKit: detectedDemo.buffer.brandKit,
          contact: detectedDemo.buffer.contact,
          header: detectedDemo.buffer.headerConfig,
          collectionsPopup: detectedDemo.buffer.collectionsPopup,
          formLocale: detectedDemo.buffer.formLocale,
          formDir: detectedDemo.buffer.formDir,
        },
        images: readDemoImageLibrary(detectedDemo.sessionId).map((img) => ({
          publicId: img.publicId,
          width: img.width,
          height: img.height,
        })),
      });
      if ("error" in res) {
        toast.error(t("demoImportDialog.errorToast"));
        return;
      }
      if (res.failedAssetIds.length > 0) {
        toast.error(t("demoImportDialog.partialFailureToast", { count: res.failedAssetIds.length }));
      } else {
        toast.success(t("demoImportDialog.importedToast"));
      }
      wipeDemoLocalStorage(detectedDemo.sessionId);
      setDetectedDemo(null);
      setDemoImportOpen(false);
      await applyDraft(res.draft.id);
    } catch (err) {
      console.error("[portfolio] demo import failed", err);
      toast.error(t("demoImportDialog.errorToast"));
    } finally {
      setDemoImportBusy(false);
    }
  }

  function handleDemoImportConfirm() {
    // Reuses the existing unsaved-changes guard: if a draft is already loaded
    // and dirty, UnsavedChangesDialog appears first so the owner can save
    // before it's replaced (reseeds=true — runDemoImport re-seeds the canvas
    // itself via applyDraft, so the intermediate restore is skipped).
    guardThenRun(() => { void runDemoImport(); }, true);
  }

  // ---- Apply draft ----
  async function applyDraft(id: string) {
    setApplyingDraftId(id);
    try {
      await applyDraftInner(id);
    } finally {
      setApplyingDraftId(null);
    }
  }

  async function applyDraftInner(id: string) {
    // A real draft already has its own header — never let a still-pending onboarding
    // logo (not yet applied to any draft) leak into it or a later template switch.
    pendingOnboardingLogoRef.current = null;
    const res = await getDraftAction(id);
    if ("error" in res) {
      toast.error(errMsg("draft_load_failed"));
      return;
    }
    if (!demoMode && typeof window !== "undefined") {
      window.localStorage.removeItem(draftKey);
      recoveryWritesEnabledRef.current = false;
      setBrowserRecovery(null);
      setHasRecoverableBuffer(false);
      setPreviewRecoveryAllowed(false);
    }
    const d = res.draft;
    // prepareForEditor must be applied here so zoneDataRef, renderDraftData, and
    // savedSnapshot all carry the same shape — without it the gallery zone stays
    // raw while the snapshot holds the prepared version → isDirty=true on load.
    const homeData = prepareForEditor((d.data.home as PuckData) ?? EMPTY_ZONE) as unknown as PuckData;
    const galleryData = prepareForEditor((d.data.gallery as PuckData) ?? EMPTY_ZONE) as unknown as PuckData;
    const footerData = prepareForEditor((d.data.footer as PuckData) ?? EMPTY_ZONE) as unknown as PuckData;
    // Resolve each field to the value that will be committed to state, so the
    // saved snapshot always matches post-apply render state.
    const resolvedBrandKit = (d.brandKit as PortfolioBrandKit) ?? DEFAULT_BRAND_KIT;
    const resolvedContact = (d.contact as PortfolioContactConfig) ?? contact;
    const navigationData = (d.data.navigation as PuckData) ?? createNavigationData(d.header as PortfolioHeaderConfig);
    const resolvedHeader = readNavigationConfig(navigationData, (d.header as PortfolioHeaderConfig) ?? headerConfig);
    const resolvedCollectionsPopup = (d.collectionsPopup as PortfolioCollectionsPopupConfig) ?? collectionsPopup;
    const resolvedFormLocale = typeof d.formLocale === "string" ? d.formLocale : formLocale;
    const resolvedFormDir = typeof d.formDir === "string" ? (d.formDir as "ltr" | "rtl" | "") : formDir;
    const resolvedTemplateId = d.templateId || templateId;
    zoneDataRef.current = { home: homeData, gallery: galleryData, footer: footerData, navigation: navigationData };
    setRenderDraftData(zoneDataRef.current);
    setBrandKit(resolvedBrandKit);
    setContact(resolvedContact);
    setHeaderConfig(resolvedHeader);
    setCollectionsPopup(resolvedCollectionsPopup);
    setFormLocale(resolvedFormLocale);
    setFormDir(resolvedFormDir);
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
      data: { home: homeData, gallery: galleryData, footer: footerData, navigation: navigationData },
      brandKit: resolvedBrandKit,
      contact: resolvedContact,
      header: resolvedHeader,
      collectionsPopup: resolvedCollectionsPopup,
      formLocale: resolvedFormLocale,
      formDir: resolvedFormDir,
    }));
    if (demoMode) persistLocalDraft();
    setDraftsOpen(false);
  }

  // ---- Reset canvas to an empty scratch state (no backing draft) ----
  function resetToScratchCanvas() {
    zoneDataRef.current = {
      home: EMPTY_ZONE,
      gallery: EMPTY_ZONE,
      footer: EMPTY_ZONE,
      navigation: createNavigationData(headerConfig),
    };
    setRenderDraftData(zoneDataRef.current);
    setTemplateId(SCRATCH_TEMPLATE_ID);
    setTemplateSeedSnapshot(JSON.stringify(zoneDataRef.current));
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
    if (id === activeDraftId && drafts.length <= 1) return;
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
    if (demoMode) {
      // No real publish for an anonymous demo visitor — handlePublish already
      // routes Publish clicks straight to the gate modal, this is defense in
      // depth in case doPublish is ever reached directly (e.g. PublishDialog).
      setPublishOpen(false);
      setActiveDemoGate("publish");
      return;
    }
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
      recoveryWritesEnabledRef.current = false;
      setBrowserRecovery(null);
      setHasRecoverableBuffer(false);
      setPreviewRecoveryAllowed(false);
      toast.success(t("publishedToast"));
      if (!showPuck) setPreviewNonce((n) => n + 1);
    } finally {
      setSavingChanges(false);
    }
  }

  function handlePublish() {
    if (demoMode) {
      setActiveDemoGate("publish");
      return;
    }
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
    if (!saved && headerSnapshot.current) {
      const restored = headerSnapshot.current;
      setHeaderConfig(restored);
      const navigation = setNavigationConfig(zoneDataRef.current.navigation, restored);
      zoneDataRef.current = { ...zoneDataRef.current, navigation };
      setRenderDraftData(zoneDataRef.current);
    }
    setHeaderOpen(false);
    if (headerHasSaved.current) setPreviewNonce((n) => n + 1);
  }
  function saveHeaderSnapshot() {
    headerSnapshot.current = headerConfig;
    headerHasSaved.current = true;
  }
  function changeHeaderConfig(next: PortfolioHeaderConfig) {
    setHeaderConfig(next);
    const navigation = setNavigationConfig(zoneDataRef.current.navigation, next);
    zoneDataRef.current = { ...zoneDataRef.current, navigation };
    setRenderDraftData(zoneDataRef.current);
    markRecoveryEdit();
  }

  async function activateCollectionsPopup() {
    if (contactOpen) setContactOpen(false);
    if (headerOpen) setHeaderOpen(false);
    if (!previewMode) await flushPendingSave(activeZone);
    collectionsPopupSnapshot.current = collectionsPopup;
    collectionsPopupHasSaved.current = false;
    setCollectionsPopupOpen(true);
  }

  function openCollectionsPopup() {
    applyCollectionsPopupBranch(computeCollectionsPopupAction(zoneDataRef.current), {
      open: () => { void activateCollectionsPopup(); },
      warn: () => {
        pendingOpenCollectionsPopup.current = () => { void activateCollectionsPopup(); };
        setFeaturedWorkWarningOpen(true);
      },
    });
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
    if (guideMode) return false;
    if (demoMode) return false; // demo uses applyDemoTemplate (client-side seedData, no seedTemplateAction)
    setSwitching(true);
    setSwitchError(null);
    const res = await seedTemplateAction(nextTemplateId);
    if ("error" in res) {
      setSwitching(false);
      setSwitchError(t("errorToast"));
      return false;
    }
    const { seed } = res;
    // Prepare both zones so zoneDataRef, renderDraftData, and templateSeedSnapshot
    // are all in the same shape — consistent with the applyDraft path (B3).
    const homeData = prepareForEditor((seed.data.home as PuckData) ?? EMPTY_ZONE) as unknown as PuckData;
    const galleryData = prepareForEditor((seed.data.gallery as PuckData) ?? EMPTY_ZONE) as unknown as PuckData;
    const footerData = prepareForEditor((seed.data.footer as PuckData) ?? EMPTY_ZONE) as unknown as PuckData;
    const seedHeader = (seed.header as PortfolioHeaderConfig) ?? DEFAULT_HEADER_CONFIG;
    const pendingLogo = pendingOnboardingLogoRef.current;
    const resolvedHeader = pendingLogo
      ? { ...seedHeader, logoUrl: pendingLogo.logoUrl, logoAssetId: pendingLogo.logoAssetId }
      : seedHeader;
    pendingOnboardingLogoRef.current = null;
    const navigationData = setNavigationConfig(
      (seed.data.navigation as PuckData) ?? createNavigationData(resolvedHeader),
      resolvedHeader,
    );
    zoneDataRef.current = { home: homeData, gallery: galleryData, footer: footerData, navigation: navigationData };
    setRenderDraftData(zoneDataRef.current);
    setBrandKit(seed.brandKit as PortfolioBrandKit);
    setContact(seed.contact as PortfolioContactConfig);
    setHeaderConfig(resolvedHeader);
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
      header: resolvedHeader,
      collectionsPopup: (seed.collectionsPopup as PortfolioCollectionsPopupConfig) ?? {},
      formLocale,
      formDir,
    }));
    markRecoveryEdit();
    ignoreNextChange.current = true;
    // Already prepared — pass directly to Puck without double-prepareForEditor.
    setPuckSeed(homeData as unknown as Data);
    setSeedNonce((n) => n + 1);
    setSwitching(false);
    setTemplatesOpen(false);
    if (!showPuck) setPreviewNonce((n) => n + 1);
    return true;
  }

  async function applyWelcomeTemplate(nextTemplateId = SCRATCH_TEMPLATE_ID) {
    const applied = await applyTemplate(nextTemplateId);
    if (applied) setWelcomeTemplatesOpen(false);
  }

  // ---- Demo mode: apply a template client-side (no seedTemplateAction) ----
  // Mirrors applyTemplate's post-seed state exactly, using the template's own
  // pure-data seedData()/defaultBrandKit/defaultContact/defaultHeader/
  // defaultCollectionsPopup instead of a server response.
  async function applyDemoTemplate(nextTemplateId: string): Promise<boolean> {
    setSwitching(true);
    setSwitchError(null);
    const template = getTemplate(nextTemplateId);
    if (!template) {
      setSwitching(false);
      setSwitchError(t("errorToast"));
      return false;
    }
    const seedData = template.seedData({ workspace: { name: workspaceName || "Your Studio" } });
    const seedHeader = template.defaultHeader ?? DEFAULT_HEADER_CONFIG;
    const normalizedSeed = normalizeSharedChromeData(seedData, seedHeader);
    const homeData = prepareForEditor(normalizedSeed.home) as unknown as PuckData;
    const galleryData = prepareForEditor(normalizedSeed.gallery) as unknown as PuckData;
    const footerData = prepareForEditor(normalizedSeed.footer) as unknown as PuckData;
    const seedCollectionsPopup = template.defaultCollectionsPopup ?? {};
    zoneDataRef.current = {
      home: homeData,
      gallery: galleryData,
      footer: footerData,
      navigation: normalizedSeed.navigation,
    };
    setRenderDraftData(zoneDataRef.current);
    setBrandKit(template.defaultBrandKit);
    setContact(template.defaultContact);
    setHeaderConfig(seedHeader);
    setCollectionsPopup(seedCollectionsPopup);
    setTemplateId(template.id);
    setTemplateSeedSnapshot(JSON.stringify(zoneDataRef.current));
    setActiveDraftId(null);
    setIsNewUnsavedDraft(true);
    setDraftName(DEFAULT_DRAFT_NAME);
    setNameError(null);
    setSavedSnapshot(JSON.stringify({
      name: DEFAULT_DRAFT_NAME,
      templateId: template.id,
      data: zoneDataRef.current,
      brandKit: template.defaultBrandKit,
      contact: template.defaultContact,
      header: seedHeader,
      collectionsPopup: seedCollectionsPopup,
      formLocale,
      formDir,
    }));
    markRecoveryEdit();
    ignoreNextChange.current = true;
    setPuckSeed(homeData as unknown as Data);
    setSeedNonce((n) => n + 1);
    setSwitching(false);
    setDemoTemplatesOpen(false);
    if (!showPuck) setPreviewNonce((n) => n + 1);
    return true;
  }

  // ---- Add New Draft ----
  function handleAddNewDraft() {
    setDraftsOpen(false);
    setTemplatesOpen(true);
  }

  // ---- Spotlight guide helpers ----

  function openNormalEntryFlow() {
    if (hasRecoverableBuffer) {
      setEntryOpen(true);
    } else if (drafts.length === 0) {
      setWelcomeTemplatesOpen(true);
    }
  }

  /** Open the correct entry flow after the guide finishes or is skipped. */
  function openEntryAfterGuide() {
    if (demoMode) {
      setDemoEntryOpen(true);
      return;
    }
    if (detectedDemo) {
      setDemoImportOpen(true);
      return;
    }
    openNormalEntryFlow();
  }

  function handleGuideSkip(dontShowAgain: boolean) {
    setGuideOpen(false);
    if (demoMode) setDemoGuideChromeOpen?.(false);
    if (guideMode) {
      onGuideSkipClose?.(dontShowAgain);
      return;
    }
    // dismissPortfolioGuideAction is requireOrg()-gated — never call it for an
    // anonymous demo visitor. Persisting a demo "don't show again" flag is a
    // page-level (localStorage) concern outside this component.
    if (dontShowAgain && !demoMode) {
      dismissPortfolioGuideAction().catch((err) => {
        console.warn("[portfolio] failed to dismiss guide on skip", err);
      });
    }
    // Open entry only when the guide was gating it (i.e. it was not already open).
    if (!guideDismissed) openEntryAfterGuide();
  }

  function handleGuideFinish(dontShowAgain: boolean) {
    setGuideOpen(false);
    if (demoMode) setDemoGuideChromeOpen?.(false);
    if (guideMode) {
      onGuideFinish?.(dontShowAgain);
      return;
    }
    if (dontShowAgain && !demoMode) {
      dismissPortfolioGuideAction().catch((err) => {
        console.warn("[portfolio] failed to dismiss guide on finish", err);
      });
    }
    if (!guideDismissed) openEntryAfterGuide();
  }

  function resetGuideCanvas() {
    zoneDataRef.current = {
      home: EMPTY_ZONE,
      gallery: EMPTY_ZONE,
      footer: EMPTY_ZONE,
      navigation: createNavigationData(headerConfig),
    };
    setRenderDraftData(zoneDataRef.current);
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
          ? puckContentCount > dragBaseline && puckHasPresetBlock
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
  // role="combobox" targets (e.g. components/ui/combobox.tsx) own their
  // Arrow/Enter/Escape keys and need the event to actually reach them; they're
  // exempt from the blanket Puck-hotkey suppression below.
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditableTarget(e.target) && !isSelfManagedComboboxTarget(e.target)) e.stopPropagation();
  }, []);

  useEffect(() => {
    function interceptPuckHotkeys(e: KeyboardEvent) {
      const target = e.target ?? document.activeElement;
      if (isEditableTarget(target) && !isSelfManagedComboboxTarget(target)) {
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

  // Memoized on the kit: resolveBrandKit does real work (font resolution,
  // luminance-based color-scheme calc) and allocates a fresh cssVars/className
  // pair each call; this recomputes only when brandKit changes rather than on
  // every render. Feeds the wrapper div's inline style below, the cssVars prop
  // threaded into PresetPreviewPanel, and Puck's metadata.workspace.brandVars.
  const { cssVars, className } = useMemo(() => resolveBrandKit(brandKit), [brandKit]);
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
  const previewQuery = `zone=${previewZone}&v=${previewNonce}&formLocale=${formLocale}&formDir=${formDir}&draftId=${encodeURIComponent(activeDraftId ?? "")}&recovery=${previewRecoveryAllowed ? "1" : "0"}`;
  const previewSrc = `${previewBasePath}?${previewQuery}`;
  const editorRenderMetadata = useMemo<PortfolioRenderMetadata>(() => ({
    workspace: {
      _id: "",
      name: workspaceName,
      slug: currentSlug,
      editorPreview: true,
      publicPage: { collectionsPopup },
      brandVars: cssVars,
      chrome: {
        navigation: {
          labels: {
            brand: workspaceName,
            navLandmark: tNav("navLandmark"),
            home: tNav("home"),
            gallery: tNav("gallery"),
            contact: tNav("contact"),
            openMenu: tNav("openMenu"),
            closeMenu: tNav("closeMenu"),
          },
          activePath: activeZone === "gallery" ? "/gallery" : "/",
          homeHref: "/",
          galleryHref: "/gallery",
        },
      },
    },
  }), [activeZone, collectionsPopup, cssVars, currentSlug, tNav, workspaceName]);
  const sharedChromeCanvasValue = useMemo<SharedChromeCanvasValue>(() => ({
    navigation: renderDraftData.navigation,
    footer: renderDraftData.footer,
    activeZone,
    config: editorConfig as unknown as Config,
    metadata: editorRenderMetadata,
  }), [activeZone, editorConfig, editorRenderMetadata, renderDraftData.footer, renderDraftData.navigation]);

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
      // Tour anchor for the precise canvas VIEWPORT only (Puck's `preview` slot,
      // scoped to the grid's "editor" column) — unlike `data-tour-id="canvas"`
      // above (Puck's `puck` slot, which wraps the entire UI: header/drawer/
      // editor/fields), this wrapper is tightly bounded to just the drop-target
      // surface. Used by the "drag-block" spotlight step's secondary cutout so
      // it doesn't highlight the whole editor.
      // `h-full w-full` (not `display: contents`) is required: the wrapper must
      // have a real, measurable box for the tour's getBoundingClientRect to read,
      // and Puck's preview surface expects a definite-height ancestor for its own
      // `height: 100%` to resolve against.
      preview: ({ children }: { children: ReactNode }) => (
        <div data-tour-id="canvas-viewport" className="h-full w-full">
          <SharedChromeCanvas>{children}</SharedChromeCanvas>
        </div>
      ),
      // Left sidebar drawer — tour anchor for the "drag a block" spotlight step.
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

  const drawerOverride = useMemo(
    () => ({
      drawer: ({ children }: { children: ReactNode }) => (
        <NestedPresetDrawer presetTitle={t("puckConfig.categories.presets")}>{children}</NestedPresetDrawer>
      ),
    }),
    [t],
  );

  // Wraps section-preset drawer items with PresetDrawerItem, which triggers
  // the shared PresetPreviewPanel (rendered once, above) on hover/focus — the
  // per-row description moved into that popover, so this override no longer
  // needs `t` or anything else that changes at runtime. Kept in its own
  // empty-dep memo (not merged into puckStableOverrides above) so it stays a
  // fully stable reference regardless of what that memo's contents end up
  // depending on.
  const drawerItemOverrides = useMemo(
    () => ({
      drawerItem: ({ name, children }: { name: string; children: ReactNode }) => {
        const preset = resolveDrawerItemPreset(name);
        if (!preset) return <>{children}</>; // manual blocks keep the plain item
        // The row is name-only: 33 rows each carrying a description made the
        // drawer too verbose to scan. The description moved into the preview
        // popover, beside a live miniature of the preset itself.
        // Handlers only. The panel itself is rendered ONCE below — Puck mounts
        // every row twice, so a panel per row produced two stacked copies.
        return <PresetDrawerItem presetKey={name as SectionPresetKey}>{children}</PresetDrawerItem>;
      },
    }),
    []
  );

  const describePreset = useCallback(
    (key: SectionPresetKey) => ({
      name: t(SECTION_PRESETS[key].labelKey),
      description: t(SECTION_PRESETS[key].descriptionKey),
    }),
    [t]
  );

  // Left cluster: page navigation (Home / Gallery / Contact) + Preview toggle.
  function navCluster() {
    return (
      <div className="flex flex-nowrap items-center gap-1" role="group" aria-label={t("zone.sectionsLabel")}>
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
          disabled={demoMode || previewLoading}
          title={demoMode ? tDemo("previewUnavailable") : undefined}
          className="shrink-0"
          onClick={() => void togglePreview()}
        >
          {previewMode ? t("preview.edit") : t("preview.show")}
        </Button>
        <button
          type="button"
          title={demoMode ? tDemo("previewUnavailable") : t("preview.openInTab")}
          aria-label={t("preview.openInTab")}
          disabled={demoMode}
          onClick={() => {
            if (demoMode) return;
            window.open(`${previewBasePath}?${previewQuery}`, "_blank", "noopener,noreferrer");
          }}
          className="inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          <ExternalLinkIcon className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  function toolbarToolsCluster() {
    return (
      <>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 px-2"
          aria-label={t("photos")}
          title={t("photos")}
          data-tour-id="photos"
          onClick={() => setPhotosOpen(true)}
        >
          <Images className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 px-2"
          aria-label={t("theme")}
          title={t("theme")}
          data-tour-id="theme"
          onClick={openTheme}
        >
          <Palette className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 px-2"
          aria-label={t("guide")}
          title={t("guide")}
          data-tour-id="guide"
          onClick={openGuide}
        >
          <CircleHelp className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 px-2"
          aria-label={demoMode ? tDemo("createNewDesign.button") : t("drafts")}
          title={demoMode ? tDemo("createNewDesign.button") : t("drafts")}
          data-tour-id="drafts"
          onClick={() => (demoMode ? setDemoTemplatesOpen(true) : setDraftsOpen(true))}
        >
          <Files className="size-3.5" aria-hidden />
        </Button>
        {demoMode && (
          <span className="shrink-0 text-xs text-muted-foreground" data-testid="demo-block-counter">
            {tDemo("counters.blocks", { count: renderDraftData[activeZone].content.length })}
          </span>
        )}
        <div data-testid="draft-title-slot" className="min-w-0 shrink-0">
          <DraftNameEditor
            ref={nameEditorRef}
            name={draftName}
            error={pendingAction !== null ? null : nameError}
            onCommit={(n) => { setDraftName(n); setNameError(null); markRecoveryEdit(); }}
          />
        </div>
      </>
    );
  }

  function fixedActionsCluster(publishSlot: ReactNode) {
    const saveDisabled = (!isDirty && activeDraftId !== null) || nameError !== null;
    return (
      <div data-testid="portfolio-toolbar-fixed-actions" className="flex w-max shrink-0 items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="brand"
          data-tour-id="save-changes"
          disabled={saveDisabled}
          loading={savingChanges}
          onClick={() => void handleSaveChanges()}
          aria-label={t("saveChanges")}
          title={t("saveChanges")}
          className="px-2"
        >
          <Save className="size-3.5" aria-hidden />
        </Button>
        {publishSlot}
      </div>
    );
  }

  // Three-section top bar: nav (left) · device toggle (center) · tools (right).
  function previewControlsCluster() {
    return (
      <div className="flex items-center gap-1" data-tour-id="canvas-controls">
        {!sidePanelOpen ? (
          <DeviceTogglePreview value={previewDevice} onChange={setPreviewDevice} />
        ) : null}
        <PortfolioLanguageControl
          value={formLocale as Parameters<typeof PortfolioLanguageControl>[0]["value"]}
          onChange={handleFormLocaleChange}
          dir={resolveEffectiveDir(formDir, formLocale)}
          onDirChange={handleFormDirChange}
        />
      </div>
    );
  }

  function topBar(center: ReactNode, publishSlot: ReactNode) {
    return (
      <div className="flex w-full min-w-0 items-center gap-2">
        <div
          data-testid="portfolio-toolbar-scroll"
          className="min-w-0 flex-1 overflow-x-auto"
        >
          <div
            data-testid="portfolio-toolbar-grid"
            className="grid w-max grid-cols-[max-content] items-center"
          >
            <div className="flex min-w-max">{navCluster()}</div>
          </div>
        </div>
        <div data-testid="portfolio-toolbar-canvas-controls" className="shrink-0">
          {center}
        </div>
        <div
          data-testid="portfolio-toolbar-actions"
          data-tour-id="workspace-actions"
          className="flex shrink-0 items-center gap-1"
          role="group"
          aria-label={t("controls.workspaceActions")}
        >
          {toolbarToolsCluster()}
          {fixedActionsCluster(publishSlot)}
        </div>
      </div>
    );
  }

  return (
    <GalleryPickerCacheProvider>
      <MobileBanner publicUrl={portfolioPublicUrl(currentSlug)} />

      <BrandColorsContext.Provider value={brandColors}>
      <DemoPickerContext.Provider
        value={demoMode ? { demoSessionId, onImageCapHit: () => setActiveDemoGate("imageCap") } : null}
      >
      <div
        className={cn(
          "gallurio-editor relative overflow-x-auto",
          demoMode ? "h-full min-h-0" : "min-h-svh",
          className,
        )}
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
        {/* One preview panel for the whole drawer, positioned against whichever
            row the store points at. Deliberately OUTSIDE the drawerItem
            override: Puck renders every row twice, so a panel per row showed
            two stacked copies of the same card. */}
        {showPuck && (
          <PresetPreviewPanel
            config={editorConfig as unknown as Config}
            cssVars={cssVars}
            describe={describePreset}
            dragHint={t("puckConfig.dragToAddHint")}
          />
        )}
        {showPuck ? (
          <SharedChromeCanvasContext.Provider value={sharedChromeCanvasValue}>
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
            metadata={editorRenderMetadata}
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
                    onState={({ contentCount, hasPresetBlock }) => {
                      setPuckContentCount(contentCount);
                      setPuckHasPresetBlock(hasPresetBlock);
                    }}
                  />
                  <ContainerAnchorReconciler />
                  {topBar(
                    <ResponsiveEditCanvasControls
                      formLocale={formLocale}
                      formDir={formDir}
                      onFormLocaleChange={handleFormLocaleChange}
                      onFormDirChange={handleFormDirChange}
                    />,
                    <Button
                      type="button"
                      size="sm"
                      className="px-2"
                      data-tour-id="publish"
                      aria-label={t("publish")}
                      title={t("publish")}
                      onClick={() => void handlePublish()}
                    >
                      <Rocket className="size-3.5" aria-hidden />
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
              ...drawerOverride,
              // Fully stable identity (see drawerItemOverrides above), never
              // changes across renders.
              ...drawerItemOverrides,
            }}
          />
          </SharedChromeCanvasContext.Provider>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-border bg-card px-3 py-2">
              {topBar(
                previewControlsCluster(),
                <Button
                  type="button"
                  size="sm"
                  className="px-2"
                  data-tour-id="publish"
                  aria-label={t("publish")}
                  title={t("publish")}
                  onClick={() => void handlePublish()}
                >
                  <Rocket className="size-3.5" aria-hidden />
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
                      onContactChange={(next) => { setContact(next); markRecoveryEdit(); }}
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
                    onChange={(next) => { setCollectionsPopup(next); markRecoveryEdit(); }}
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
                      onHeaderChange={changeHeaderConfig}
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
      </DemoPickerContext.Provider>
      </BrandColorsContext.Provider>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onConfirm={doPublish}
        publicUrl={portfolioPublicUrl(currentSlug)}
        currentSlug={currentSlug}
        hasBeenPublished={hasBeenPublished}
        onSlugSaved={setCurrentSlug}
        onUpdateSlug={updatePortfolioSlugAction}
      />
      <ThemePanelDialog
        open={themeOpen}
        brandKit={brandKit}
        onBrandKitChange={(next) => { setBrandKit(next); markRecoveryEdit(); }}
        onSaved={() => closeTheme(true)}
        onCancel={() => closeTheme(false)}
        savedThemes={savedThemes}
        onSavedThemesChange={setSavedThemes}
        onCustomizeGate={demoMode ? () => setActiveDemoGate("theme") : undefined}
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
      {/* Welcome template modal — shown to brand-new users (no drafts, no buffer) instead of PortfolioEntryDialog. Never used in demoMode (its own 2-option entry screen replaces this branching entirely). */}
      {!demoMode && (
        <TemplatePickerDialog
          open={welcomeTemplatesOpen}
          onOpenChange={(next) => {
            if (!next) void applyWelcomeTemplate();
          }}
          templates={templates}
          currentTemplateId={templateId}
          isCanvasMatchingSeed={isCanvasMatchingSeed}
          switching={switching}
          error={switchError}
          onConfirm={(id) => { void applyWelcomeTemplate(id); }}
          welcome
          onStartScratch={() => { void applyWelcomeTemplate(); }}
        />
      )}
      {/* "Create new design" — demoMode's on-demand equivalent, opened by the
          toolbar button (not auto-shown), and never auto-applies scratch on close. */}
      {demoMode && (
        <TemplatePickerDialog
          open={demoTemplatesOpen}
          onOpenChange={setDemoTemplatesOpen}
          templates={templates}
          currentTemplateId={templateId}
          isCanvasMatchingSeed={isCanvasMatchingSeed}
          switching={switching}
          error={switchError}
          onConfirm={(id) => guardThenRun(() => void applyDemoTemplate(id), true)}
          welcome
          onStartScratch={() => guardThenRun(() => void applyDemoTemplate(SCRATCH_TEMPLATE_ID), true)}
        />
      )}
      {!guideMode && !demoMode && (
        <StoryPromptDialog
          open={storyPromptOpen}
          workspaceName={workspaceName}
          initialDescription={initialSeoDescription}
          initialKeywords={initialSeoKeywords}
          initialInquiryRecipientEmail={initialInquiryRecipientEmail}
          businessType={workspaceBusinessType}
          portfolioDomain={portfolioDomain}
          persistOnExit
          onBrandingSaved={({ logoUrl, logoAssetId }) => {
            if (!logoUrl || !logoAssetId) return;
            // Deferred — see pendingOnboardingLogoRef. Applied in applyTemplate once
            // the user actually picks a template (including "start from scratch").
            pendingOnboardingLogoRef.current = { logoUrl, logoAssetId };
          }}
          onContinueWithGuide={() => {
            setStoryPromptOpen(false);
          }}
          onExploreSelf={() => {
            setStoryPromptOpen(false);
            setGuideOpen(false);
            dismissPortfolioGuideAction().catch((err) => {
              console.warn("[portfolio] failed to dismiss guide on explore-self exit", err);
            });
            openEntryAfterGuide();
          }}
        />
      )}
      {/* In sandbox (guideMode) the guide runs directly in this shell. In the
          real editor it opens a full-screen sandbox so the live data is never
          touched during the tour. */}
      {!storyPromptOpen && (
        guideMode ? (
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
        ) : demoMode ? (
          // Demo runs the real guide directly in this shell (unlike guideMode's
          // sandbox), with 3 steps' copy overridden to explain the demo limits.
          <SpotlightGuide
            open={guideOpen}
            steps={demoSpotlightSteps}
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
        applyingId={applyingDraftId}
        unsavedDraftName={isNewUnsavedDraft && activeDraftId === null ? draftName : null}
      />
      {!demoMode && (
        <PortfolioEntryDialog
          open={entryOpen}
          // Resume is the only action that applies the browser recovery buffer.
          canContinue={hasRecoverableBuffer}
          hasDrafts={drafts.length > 0}
          onContinue={() => {
            // Resuming the existing buffer as-is — never inject a still-pending
            // onboarding logo into it or a later template switch.
            pendingOnboardingLogoRef.current = null;
            applyBrowserRecovery();
            setEntryOpen(false);
          }}
          onLoadExisting={() => { setEntryOpen(false); setDraftsOpen(true); }}
          onStartScratch={() => { setEntryOpen(false); setTemplatesOpen(true); }}
        />
      )}
      {demoMode && (
        <DemoEntryScreen
          open={demoEntryOpen}
          canContinue={hasRecoverableBuffer}
          onContinue={() => setDemoEntryOpen(false)}
          onStartScratch={() => { setDemoEntryOpen(false); void applyDemoTemplate(SCRATCH_TEMPLATE_ID); }}
          t={tDemo}
        />
      )}
      {demoMode && (
        <DemoIntroDialog
          open={demoIntroOpen}
          onShowGuide={() => { setDemoIntroOpen(false); openGuide(); }}
          // Skips the tour but still lands on the same Continue/Start-scratch
          // entry decision the guide's own skip/finish leads to — a returning
          // visitor with a recoverable local buffer must not lose the chance
          // to resume it just because they opted out of the tour.
          onExploreSelf={() => { setDemoIntroOpen(false); setDemoEntryOpen(true); }}
          t={tDemo}
        />
      )}
      {!demoMode && (
        <DemoImportDetectedDialog
          open={demoImportOpen}
          busy={demoImportBusy}
          onConfirm={handleDemoImportConfirm}
          onDiscard={handleDemoImportDiscard}
        />
      )}
      <UnsavedChangesDialog
        open={pendingAction !== null}
        saving={savingChanges}
        discarding={discarding}
        name={demoMode ? undefined : draftName}
        onNameChange={demoMode ? undefined : (next) => { setDraftName(next); setNameError(validateDraftName(next)); markRecoveryEdit(); }}
        nameLabel={t("draftNameLabel")}
        nameError={nameError}
        title={demoMode ? tDemo("createNewDesign.confirmTitle") : undefined}
        body={demoMode ? tDemo("createNewDesign.confirmBody") : undefined}
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
      <DemoGateModal gate={activeDemoGate} onClose={() => setActiveDemoGate(null)} />

      {/* Task 7 — warn when no FeaturedWork block exists */}
      <AlertDialog
        open={featuredWorkWarningOpen}
        onOpenChange={(open) => {
          if (!open) setFeaturedWorkWarningOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("featuredPopupWarningTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("featuredPopupWarningBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFeaturedWorkWarningOpen(false)}>
              {t("featuredPopupWarningCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setFeaturedWorkWarningOpen(false);
                pendingOpenCollectionsPopup.current?.();
                pendingOpenCollectionsPopup.current = null;
              }}
            >
              {t("featuredPopupWarningProceed")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </GalleryPickerCacheProvider>
  );
}

