"use client";

import "@measured/puck/puck.css";
import "./editor.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Puck, Drawer, type Config, type Data } from "@measured/puck";
import { CollapsibleDrawer } from "@/components/ui/collapsible-drawer";
import { usePuckStore } from "@/lib/page-builder/puckHooks";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { isEditableTarget, isSelfManagedComboboxTarget } from "@/lib/page-builder/editableTarget";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CircleHelp,
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
import { createEditorConfig, type PuckTranslate } from "@/lib/page-builder/editorConfig";
import { reconcileContainerAnchors } from "@/lib/page-builder/containerAnchorReconciler";
import { reconcileMasonryClones } from "@/lib/page-builder/masonryCloneReconciler";
import { PRESET_BLOCK_KEYS, MANUAL_BLOCK_KEYS } from "@/lib/page-builder/blockCategories";
import {
  findChrome,
  syncChrome,
  normalizeChrome,
  reanchorChrome,
  canDetach,
  type ChromeKind,
  type Zones,
} from "@/lib/page-builder/chromeSync";
import { ChromeSyncContext, type ChromeSyncCtx } from "@/lib/page-builder/chromeSyncContext";
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

// Puck-editable zones (each round-trips its own Puck data). "contact" is a tab
// too, but it's the fixed prebuilt form — previewed, never Puck-edited.
type Zone = "home" | "gallery";
type EditorSection = Zone | "collectionsPopup" | "contact";

/** Preview-route `zone` param for the active editor section. */
export type PreviewZoneParam = "home" | "gallery" | "contact" | "popup";

/**
 * Map the active editor section to the preview route's `zone` param so the
 * iframe and the open-in-new-tab link land on what the user is viewing.
 * Contact and the collections popup have dedicated preview zones; Navigation/
 * Footer chrome render inline as ordinary zone content, so they fall back to
 * the active zone.
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
const EDITOR_SECTIONS: readonly EditorSection[] = ["home", "gallery", "collectionsPopup", "contact"] as const;
// formDir was added as an optional field; absence defaults to LTR at hydration,
// so v2 buffers stay forward-compatible and must not be invalidated by a bump.
const LOCAL_DRAFT_VERSION = 2;

type PortfolioBrowserDraft = {
  version: typeof LOCAL_DRAFT_VERSION;
  data: Record<Zone, PuckData>;
  brandKit: PortfolioBrandKit;
  contact: PortfolioContactConfig;
  formLocale: string;
  formDir: string;
  /** Legacy field from before Navigation became a Puck block — no longer
   *  written; an old buffer may still carry it, and it's ignored on hydrate. */
  headerConfig?: PortfolioHeaderConfig;
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

/** A single Puck content entry, keeping the same shape PuckData["content"] carries. */
type BlockEntry = PuckData["content"][number];

/** Every chrome kind that mirrors across the home/gallery zones. */
const CHROME_KINDS: readonly ChromeKind[] = ["nav", "footer"] as const;

/** True when `zone` already carries a `kind` chrome block with `detached: true`. */
function isChromeDetached(zone: PuckData, kind: ChromeKind): boolean {
  const block = findChrome(zone as unknown as Data, kind);
  return Boolean(block && (block.props as { detached?: boolean }).detached);
}

/**
 * Content block count excluding pinned chrome (Navigation/Footer) — the demo
 * block cap and its "N/20 blocks" counter both count only blocks the visitor
 * actually added, not the always-present, undeletable Navigation seed.
 */
function demoBlockCount(zone: PuckData): number {
  return (zone.content ?? []).filter((b) => !(b.props as { _chrome?: string })._chrome).length;
}

/**
 * Builds the migrated slot content for a legacy `header` value (predating
 * Navigation-as-a-block): an Image child carrying `logoAssetId` as
 * `_style.bgImagePublicId` (same shape `withPendingLogo` writes — omitted
 * entirely when there is no logo, matching navigationDefaultProps' own
 * no-placeholder-Image default) plus a Heading carrying `brandText` (falling
 * back to the same "Studio Name" default `navigationDefaultProps` uses).
 * Returns undefined when the header carries neither, so `ensureNavigation`
 * leaves `content` unset and `fillBlockDefaults` fills the ordinary default.
 */
function legacyHeaderNavContent(header: PortfolioHeaderConfig): BlockEntry[] | undefined {
  if (!header.logoAssetId && !header.brandText) return undefined;
  const children: BlockEntry[] = [];
  if (header.logoAssetId) {
    children.push({ type: "Image", props: { alt: "Logo", _style: { bgImagePublicId: header.logoAssetId } } });
  }
  children.push({ type: "Heading", props: { level: "h3", text: header.brandText ?? "Studio Name" } });
  return children;
}

/**
 * Prepends a bare Navigation entry (no id, no content slot) when `data` has
 * none. `fillBlockDefaults` (called right after, in `prepareForEditor`) fills
 * the missing `content` slot from `navigationDefaultProps`, and `ensureIds`
 * assigns it a stable id — same pipeline every other seeded block goes
 * through. `header` fields always win over the block's own defaults since
 * every `PortfolioHeaderConfig` key is spread directly onto the props; when
 * `header` carries a legacy logo/brandText, `content` is seeded directly
 * (see `legacyHeaderNavContent`) so that real logo/brand actually renders
 * instead of the block's generic placeholder defaults.
 */
function ensureNavigation(data: PuckData, header: PortfolioHeaderConfig): PuckData {
  const content = data.content ?? [];
  if (content.some((b) => (b.props as { _chrome?: string })._chrome === "nav")) return data;
  const migratedContent = legacyHeaderNavContent(header);
  const navEntry: BlockEntry = {
    type: "Navigation",
    props: { ...header, _chrome: "nav", ...(migratedContent ? { content: migratedContent } : {}) },
  };
  return { ...data, content: [navEntry, ...content] };
}

/**
 * Fill missing defaultProps into every block, assign stable ids, then
 * guarantee the zone's chrome invariants: exactly one Navigation, seeded from
 * `headerFallback` when the zone has none (migrates a legacy header value —
 * see call sites — falling back to the template default), pinned to index 0.
 */
function prepareForEditor(
  data: PuckData,
  headerFallback: PortfolioHeaderConfig = DEFAULT_HEADER_CONFIG
): Data {
  const seeded = ensureNavigation(data, headerFallback);
  const withDefaults = fillBlockDefaults(seeded as unknown as PuckDataLike) as unknown as PuckData;
  // Normalize legacy/restored ContainerAnchor data before the first canvas
  // render, then keep it normalized live with ContainerAnchorReconciler.
  const prepared = reconcileMasonryClones(reconcileContainerAnchors(ensureIds(withDefaults)));
  return normalizeChrome(prepared);
}

/**
 * Patches the onboarding story prompt's captured logo (see
 * `pendingOnboardingLogoRef`) directly into the newly-seeded Navigation
 * block's free `content` slot — the Image child on the left — as
 * `_style.bgImagePublicId`, the same shape ImageBlock reads for any other
 * picked image. A no-op when there is no pending logo or no Navigation block
 * to patch. `navigationDefaultProps` seeds no Image child by default (an
 * unpicked Image renders an "unavailable" placeholder), so when the slot has
 * none yet one is inserted at the front to carry the logo.
 */
function withPendingLogo(
  zone: PuckData,
  logo: { logoUrl: string; logoAssetId: string } | null
): PuckData {
  if (!logo) return zone;
  const content = zone.content ?? [];
  const navIndex = content.findIndex((b) => (b.props as { _chrome?: string })._chrome === "nav");
  if (navIndex === -1) return zone;
  const nav = content[navIndex];
  const slotChildren = (nav.props.content as BlockEntry[] | undefined) ?? [];
  const imageIndex = slotChildren.findIndex((c) => c.type === "Image");
  const image: BlockEntry = imageIndex === -1 ? { type: "Image", props: { alt: "Logo" } } : slotChildren[imageIndex];
  const patchedImage: BlockEntry = {
    ...image,
    props: {
      ...image.props,
      _style: { ...(image.props._style as Record<string, unknown> | undefined), bgImagePublicId: logo.logoAssetId },
    },
  };
  const nextSlotChildren =
    imageIndex === -1
      ? [patchedImage, ...slotChildren]
      : slotChildren.map((c, i) => (i === imageIndex ? patchedImage : c));
  const nextContent = [...content];
  nextContent[navIndex] = { ...nav, props: { ...nav.props, content: nextSlotChildren } };
  return { ...zone, content: nextContent };
}

// Demo mode has no equivalent of the real (auth-gated) collections picker that
// FeaturedWork's Content tab needs (MultiCollectionControl), and the
// CollectionCard manual block shares that same dependency. Registry-derived
// (COLLECTION_PRESET_KEYS), not a hand-picked literal list, so a newly added
// collection-dependent preset can't slip through. Filtered directly against
// the drawer's rendered lists below (Puck 0.20's `categories` config is gone —
// see PresetBlocksDrawer).
const DEMO_HIDDEN_COMPONENT_KEYS: ReadonlySet<string> = new Set([
  ...COLLECTION_PRESET_KEYS,
  "FeaturedWork",
  "CollectionCard",
]);

/** Section-preset entry for a drawer item's component name; undefined for manual blocks. */
export function resolveDrawerItemPreset(name: string): SectionPresetEntry | undefined {
  return SECTION_PRESETS[name as SectionPresetKey];
}

/**
 * Renders `overrides.drawerItem` (or `overrides.componentItem`) for a raw
 * `Drawer.Item`. `Drawer`/`Drawer.Item` exported from `@measured/puck` are
 * unwired primitives — only Puck's own default `ComponentList.Item` (internal,
 * not exported) applies the `drawerItem` override automatically. Since
 * PresetBlocksDrawer builds every `Drawer.Item` itself, it passes this render
 * function in explicitly as each item's `children` render-prop.
 */
type DrawerItemRenderer = (props: { name: string; children: ReactNode }) => ReactElement;

/**
 * Two-level preset drawer: "Preset blocks" > group > variant, plus a flat
 * "Manual blocks" sibling. Puck 0.20's `categories` config is flat and cannot
 * nest, so this replaces it entirely rather than layering on top of it.
 *
 * Wrapped in exactly ONE `<Drawer>` — Puck's dnd wiring keys off a single
 * droppable root, so per-group Drawers would fragment drag-and-drop. The
 * collapsible sections are plain elements nested inside that one Drawer.
 *
 * Demo-mode filtering happens here, directly against
 * DEMO_HIDDEN_COMPONENT_KEYS, at both the group level and the manual level —
 * there is no second source of truth to keep in sync.
 */
function PresetBlocksDrawer({
  t,
  demoMode,
  hideManualBlocks,
  drawerItem,
  resolveLabel,
}: {
  t: PuckTranslate;
  demoMode: boolean;
  /** The tour sandbox's first task needs the Style Toolkit tabs a composed
   *  preset section provides — manual blocks (including bare Video) are kept
   *  out of the sandbox drawer entirely so only preset sections can be dropped. */
  hideManualBlocks: boolean;
  drawerItem: DrawerItemRenderer;
  /** `editorConfig.components[key].label` — raw `Drawer.Item` shows the
   *  component KEY (e.g. "NavBorderedPreset") unless a `label` is passed
   *  explicitly, unlike Puck's own default categorized list which resolved
   *  it automatically. Reusing the config's already-translated label keeps
   *  one source of truth instead of re-deriving it here. */
  resolveLabel: (key: string) => string | undefined;
}) {
  const manualKeys = MANUAL_BLOCK_KEYS.filter(
    (key) => !demoMode || !DEMO_HIDDEN_COMPONENT_KEYS.has(key),
  );

  return (
    <Drawer>
      <CollapsibleDrawer title={t("puckConfig.categories.presets")} defaultOpen>
        <div className="flex flex-col gap-2">
          {PRESET_GROUPS.map((group) => {
            const keys = group.keys.filter((key) => !demoMode || !DEMO_HIDDEN_COMPONENT_KEYS.has(key));
            if (keys.length === 0) return null;
            return (
              <CollapsibleDrawer key={group.id} title={t(group.labelKey)} defaultOpen={group.id === "nav"}>
                <div className="flex flex-col gap-1">
                  {keys.map((key) => (
                    <Drawer.Item key={key} name={key} label={resolveLabel(key)}>
                      {drawerItem}
                    </Drawer.Item>
                  ))}
                </div>
              </CollapsibleDrawer>
            );
          })}
        </div>
      </CollapsibleDrawer>
      {!hideManualBlocks && manualKeys.length > 0 && (
        <CollapsibleDrawer title={t("puckConfig.categories.manual")}>
          <div className="flex flex-col gap-1">
            {manualKeys.map((key) => (
              <Drawer.Item key={key} name={key} label={resolveLabel(key)}>
                {drawerItem}
              </Drawer.Item>
            ))}
          </div>
        </CollapsibleDrawer>
      )}
    </Drawer>
  );
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
  const tPublicForm = useTranslations("publicPage.inquiryForm");
  const tNav = useTranslations("publicPage.nav");
  const tLocationPicker = useTranslations("app.bookings.locationPicker");
  const errMsg = useActionError();
  // Declared ahead of editorConfig below (normally further down with the rest
  // of this component's state) because the Navigation field panel's detach
  // toggle needs to know which zone is currently mounted in Puck — see
  // createEditorConfig's second parameter.
  const [activeZone, setActiveZone] = useState<Zone>("home");
  // Demo/guide-mode drawer filtering (collection-dependent presets, manual
  // blocks) happens in PresetBlocksDrawer's render, not here — the config's
  // `components` registry stays the same in every mode.
  const editorConfig = useMemo(() => createEditorConfig(t, activeZone), [t, activeZone]);

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
  const [renderDraftData, setRenderDraftData] = useState<Record<Zone, PuckData>>(() => ({
    home: prepareForEditor(initialData.home ?? EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData,
    gallery: prepareForEditor(initialData.gallery ?? EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData,
  }));
  // currentSlug tracks the live slug after in-dialog edits (optimistic update).
  const [currentSlug, setCurrentSlug] = useState(slug);
  const [publishOpen, setPublishOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
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

  // Entry dialog shown on load; deferred until after the guide when guide is not dismissed.
  // When guideDismissed=true, open the entry immediately — but brand-new users (no saved
  // drafts AND no recoverable buffer) go to the welcome template modal instead.
  // When guideDismissed=false, both stay closed until guide finishes/skips.
  // detectedDemo was captured before the first-run dialog state above so this
  // decision always takes priority over onboarding prompts.
  const [entryOpen, setEntryOpen] = useState(() => {
    if (detectedDemo) return false;
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
    if (detectedDemo) return false;
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
        home: prepareForEditor(initialData.home ?? EMPTY_ZONE, initialHeaderConfig),
        gallery: prepareForEditor(initialData.gallery ?? EMPTY_ZONE, initialHeaderConfig),
      },
      brandKit: initialBrandKit,
      contact: initialContact,
      header: {},
      collectionsPopup: initialCollectionsPopup ?? {},
      formLocale: initialFormLocale,
      formDir: initialFormDir ?? "",
    });
  });

  const sidePanelOpen = contactOpen || collectionsPopupOpen;
  const activeSection: EditorSection = contactOpen ? "contact" : collectionsPopupOpen ? "collectionsPopup" : activeZone;
  const showPuck = !previewMode && !sidePanelOpen;

  // Source of truth for each zone's latest data, updated by Puck's onChange.
  // A ref (not state) so editing doesn't re-feed Puck mid-session.
  const zoneDataRef = useRef<Record<Zone, PuckData>>({
    home: prepareForEditor(initialData.home ?? EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData,
    gallery: prepareForEditor(initialData.gallery ?? EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData,
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
  const contactHasSaved = useRef(false);
  const collectionsPopupSnapshot = useRef<PortfolioCollectionsPopupConfig | null>(null);
  const collectionsPopupHasSaved = useRef(false);
  // Logo captured by the onboarding story prompt, held here instead of applied
  // to the seeded Navigation block's slot immediately — patching it in this
  // early would get written into the localStorage draft buffer by the
  // persistLocalDraft effect below, making a brand-new visitor look like they
  // already have a recoverable draft. Applied once, into the new draft's
  // Navigation block, when a template is actually picked (applyTemplate).
  const pendingOnboardingLogoRef = useRef<{ logoUrl: string; logoAssetId: string } | null>(null);

  // The data object handed to <Puck> at mount. Set only on zone switch (in the
  // event handler, from the ref) and initialized from props — never read the ref
  // during render. Paired with key={`${activeZone}-${seedNonce}`} so brand-kit
  // re-renders never reset the editor mid-edit, and full re-seeds (applyTemplate,
  // applyDraft) force a remount by bumping seedNonce.
  const [puckSeed, setPuckSeed] = useState<Data>(() =>
    prepareForEditor(initialData.home ?? EMPTY_ZONE, initialHeaderConfig)
  );
  const [seedNonce, setSeedNonce] = useState(0);
  // Demo sessions use a distinct namespace (keyed by demoSessionId, not slug)
  // so a demo session can never collide with or leak into a real workspace's draft.
  const draftKey = demoMode ? demoDraftKey(demoSessionId) : `gallurio:portfolio-draft:${slug}`;

  // ---- Snapshot helpers ----
  // `header` is a fixed empty placeholder, not live state: the real header now
  // lives inside `data`'s Navigation block. The key stays present only because
  // draftSnapshotSchema still requires it (every field inside is optional) —
  // see the Backend handoff note about dropping it once the schema allows.
  function buildDraftSnapshot() {
    return {
      templateId,
      data: {
        home: zoneDataRef.current.home,
        gallery: zoneDataRef.current.gallery,
      },
      brandKit,
      contact,
      header: {},
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
  // `header: {}` is the same fixed placeholder buildDraftSnapshot uses — both sides must
  // agree so isDirty settles to false right after a save.
  const isDirty =
    savedSnapshot === null ||
    JSON.stringify({ name: draftName, templateId, data: renderDraftData, brandKit, contact, header: {}, collectionsPopup, formLocale, formDir }) !==
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
  }, [brandKit, collectionsPopup, contact, draftKey, formDir, formLocale, guideMode, activeDraftId, draftName]);

  // Saving any draft retires the local buffer — there is one buffer per
  // workspace, and a save means the server now has the freshest copy.
  const clearLocalDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(draftKey);
  }, [draftKey]);

  // Typing emits a Puck onChange per keystroke; persisting to localStorage on
  // every one makes text blocks laggy. Debounce the local write (trailing) and
  // flush it at every commit point (zone switch, save, blur, unload, unmount).
  const { debounced: debouncedPersistLocalDraft, flush: flushLocalDraft } = useDebounce<void>(
    () => persistLocalDraft(),
    350,
  );

  // Compute on mount whether a recoverable localStorage buffer exists.
  const [hasRecoverableBuffer] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<PortfolioBrowserDraft>;
      return parsed.version === LOCAL_DRAFT_VERSION && Boolean(parsed.data);
    } catch {
      return false;
    }
  });

  // Applies the localStorage buffer onto the canvas — including its
  // draftId/draftName, so a subsequent Save re-targets the right draft. NOT
  // run automatically on mount for the real (non-demo) editor: applying it
  // before the owner has chosen an entry option would silently re-attribute
  // stale unsaved edits to whichever draft ends up active. Called only from
  // PortfolioEntryDialog's "Continue where you left off".
  const restoreLocalDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Partial<PortfolioBrowserDraft>;
      if (draft.version !== LOCAL_DRAFT_VERSION || !draft.data) return;
      queueMicrotask(() => {
        // prepareForEditor both zones so zoneDataRef, renderDraftData, and the
        // Puck seed are all in the same shape — mismatched shapes cause isDirty=true.
        const home = prepareForEditor(draft.data?.home ?? zoneDataRef.current.home, initialHeaderConfig) as unknown as PuckData;
        const gallery = prepareForEditor(draft.data?.gallery ?? zoneDataRef.current.gallery, initialHeaderConfig) as unknown as PuckData;
        zoneDataRef.current = { home, gallery };
        setRenderDraftData({ home, gallery });
        if (draft.brandKit) setBrandKit(draft.brandKit);
        if (draft.contact) setContact(draft.contact);
        if (typeof draft.formLocale === "string") setFormLocale(draft.formLocale);
        if (typeof draft.formDir === "string") setFormDir(draft.formDir as "ltr" | "rtl" | "");
        // draft.headerConfig (legacy) is intentionally never read — the real
        // header now lives inside draft.data's Navigation block above.
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
  }, [draftKey, initialHeaderConfig]);

  // demoMode has no per-workspace "saved draft" to protect — the buffer is
  // its only storage — so it keeps the old unconditional auto-restore, fired
  // at mount regardless of when the demo's own (guide-deferred) entry choice
  // shows. guideMode (sandbox tour preview) never restores: all persistence
  // is disabled there.
  useEffect(() => {
    if (guideMode) return;
    if (!demoMode) return;
    restoreLocalDraft();
  }, [demoMode, guideMode, restoreLocalDraft]);

  useEffect(() => {
    if (guideMode) return;
    persistLocalDraft();
  }, [activeDraftId, collectionsPopup, contact, draftName, formDir, formLocale, guideMode, persistLocalDraft]);

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

  // A chrome (Navigation/Footer) block's `detached` prop just flipped false ->
  // true -> back to false in the active zone. Turning detach off makes that
  // zone ADOPT the anchor zone's chrome — destructive, so it's gated behind
  // this confirm dialog instead of applying immediately.
  const [pendingReanchor, setPendingReanchor] = useState<{ zone: Zone; kind: ChromeKind } | null>(null);

  const handleChange = useCallback(
    (data: Data) => {
      let next = data as unknown as PuckData;
      if (demoMode) {
        const prevLen = demoBlockCount(zoneDataRef.current[activeZone]);
        const nextLen = demoBlockCount(next);
        // Only a genuine block ADD past the cap is blocked (reorders/edits
        // never grow content.length). Puck is uncontrolled after mount, so the
        // only way to revert the visual canvas is the same remount technique
        // used elsewhere in this file (bump seedNonce with the pre-add data).
        if (nextLen > DEMO_BLOCK_CAP && nextLen > prevLen) {
          setActiveDemoGate("blockCap");
          ignoreNextChange.current = true;
          setPuckSeed(prepareForEditor(zoneDataRef.current[activeZone], initialHeaderConfig));
          setSeedNonce((n) => n + 1);
          return;
        }
      }

      // Every mount/remount forces a `setPuckSeed` + `seedNonce` bump elsewhere
      // in this file, which sets this flag so the resulting echo can be told
      // apart from a genuine edit. Chrome mirroring/detach handling must only
      // run for genuine edits: the echo replays data that already went
      // through prepareForEditor (sync + normalize already applied), and
      // re-running syncChrome on it would regenerate the OTHER zone's slot-
      // child ids for no reason (chromeSync always mints fresh ids for
      // mirrored slot children — see cloneChromeBlock), corrupting isDirty.
      if (ignoreNextChange.current) {
        zoneDataRef.current = { ...zoneDataRef.current, [activeZone]: next };
        setRenderDraftData((current) => ({ ...current, [activeZone]: next }));
        ignoreNextChange.current = false;
        return;
      }

      // Dropping a preset Navigation (e.g. from the drawer) REPLACES the
      // pinned one at index 0, rather than being collapsed away as a
      // duplicate by normalizeChrome below. Detected as a genuine growth in
      // nav-block count carrying an id not present before — an ordinary
      // reorder never changes the count, and the mount echo already
      // returned above, so this can't misfire on either.
      {
        const prevNavBlocks = (zoneDataRef.current[activeZone].content ?? []).filter(
          (b) => (b.props as { _chrome?: string })._chrome === "nav",
        );
        const nextNavBlocks = (next.content ?? []).filter(
          (b) => (b.props as { _chrome?: string })._chrome === "nav",
        );
        if (nextNavBlocks.length > prevNavBlocks.length && prevNavBlocks.length >= 1) {
          const prevIds = new Set(prevNavBlocks.map((b) => b.props.id as string));
          const inserted = nextNavBlocks.find((b) => !prevIds.has(b.props.id as string));
          if (inserted) {
            const pinnedId = prevNavBlocks[0].props.id as string;
            const replacement = { ...inserted, props: { ...inserted.props, id: pinnedId } };
            const withoutNavs = (next.content ?? []).filter(
              (b) => (b.props as { _chrome?: string })._chrome !== "nav",
            );
            next = { ...next, content: [replacement, ...withoutNavs] };
          }
        }
      }

      // Chrome detach toggling — react before committing anything else, since
      // both transitions need to revert what Puck already rendered
      // optimistically (its own uncontrolled field state already flipped).
      for (const kind of CHROME_KINDS) {
        const prevChrome = findChrome(zoneDataRef.current[activeZone] as unknown as Data, kind);
        const nextChrome = findChrome(next as unknown as Data, kind);
        const wasDetached = Boolean(prevChrome && (prevChrome.props as { detached?: boolean }).detached);
        const isDetachedNow = Boolean(nextChrome && (nextChrome.props as { detached?: boolean }).detached);
        // Only a genuine "detach off" toggle enters reanchor. A deleted block
        // also reads isDetachedNow=false but must NOT be treated the same —
        // require the block to still exist next.
        if (wasDetached && nextChrome && !isDetachedNow) {
          setPendingReanchor({ zone: activeZone, kind });
          ignoreNextChange.current = true;
          setPuckSeed(prepareForEditor(zoneDataRef.current[activeZone], initialHeaderConfig));
          setSeedNonce((n) => n + 1);
          return;
        }
        if (!wasDetached && isDetachedNow) {
          const zonesNow = {
            home: zoneDataRef.current.home,
            gallery: zoneDataRef.current.gallery,
          } as unknown as Zones;
          if (!canDetach(zonesNow, activeZone, kind)) {
            // Only one zone per kind may be detached — refuse the second toggle.
            ignoreNextChange.current = true;
            setPuckSeed(prepareForEditor(zoneDataRef.current[activeZone], initialHeaderConfig));
            setSeedNonce((n) => n + 1);
            return;
          }
        }
      }

      // Navigation/Footer mirror across zones: sync the changed zone's chrome
      // into the other zone (no-op when detached), then re-pin the active
      // zone's Navigation to index 0 in case another block landed above it.
      // The previous (pre-edit) zone is passed through so a genuine deletion
      // (block existed, now doesn't) mirrors as a removal instead of being
      // silently ignored — see syncChrome's deletion-mirroring doc.
      const previousActiveZone = zoneDataRef.current[activeZone] as unknown as Data;
      let zones = { ...zoneDataRef.current, [activeZone]: next } as unknown as Zones;
      zones = syncChrome(zones, activeZone, "nav", undefined, previousActiveZone);
      zones = syncChrome(zones, activeZone, "footer", undefined, previousActiveZone);
      zones = { ...zones, [activeZone]: normalizeChrome(zones[activeZone]) };
      const updated = zones as unknown as Record<Zone, PuckData>;

      zoneDataRef.current = updated;
      setRenderDraftData(updated);
      debouncedPersistLocalDraft();
      // isDirty is derived at render time from savedSnapshot state — no manual update needed.
    },
    [activeZone, debouncedPersistLocalDraft, demoMode, initialHeaderConfig]
  );

  /** Anchor wins: the pending zone adopts the other zone's chrome. */
  function confirmReanchor() {
    if (!pendingReanchor) return;
    const { zone, kind } = pendingReanchor;
    const zones = {
      home: zoneDataRef.current.home,
      gallery: zoneDataRef.current.gallery,
    } as unknown as Zones;
    const reanchored = reanchorChrome(zones, zone, kind);
    const updated = reanchored as unknown as Record<Zone, PuckData>;
    zoneDataRef.current = updated;
    setRenderDraftData(updated);
    setPendingReanchor(null);
    ignoreNextChange.current = true;
    setPuckSeed(prepareForEditor(updated[activeZone], initialHeaderConfig));
    setSeedNonce((n) => n + 1);
    debouncedPersistLocalDraft();
  }

  /** Canvas was already reverted to the still-detached state in handleChange
   *  before this dialog opened — closing it is the only thing left to do. */
  function cancelReanchor() {
    setPendingReanchor(null);
  }

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
      // One buffer per workspace — saving any draft retires it (the server
      // now has the freshest copy).
      clearLocalDraft();
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
          // The real header now lives inside the buffer's Navigation block
          // (already carried by `data` above) — this field is a fixed
          // placeholder only, kept because draftSnapshotSchema requires it.
          header: {},
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
    const d = res.draft;
    // A draft predating Navigation-as-a-block may still carry a legacy
    // top-level `header` — feed it (falling back to the workspace's already-
    // resolved header, then the bare default) as the injection source so a
    // zone with no Navigation block gets one seeded with those exact values.
    const resolvedHeader =
      (d.header as PortfolioHeaderConfig | null | undefined) ?? initialHeaderConfig ?? DEFAULT_HEADER_CONFIG;
    // prepareForEditor must be applied here so zoneDataRef, renderDraftData, and
    // savedSnapshot all carry the same shape — without it the gallery zone stays
    // raw while the snapshot holds the prepared version → isDirty=true on load.
    const homeData = prepareForEditor((d.data.home as PuckData) ?? EMPTY_ZONE, resolvedHeader) as unknown as PuckData;
    const galleryData = prepareForEditor((d.data.gallery as PuckData) ?? EMPTY_ZONE, resolvedHeader) as unknown as PuckData;
    // Resolve each field to the value that will be committed to state, so the
    // saved snapshot always matches post-apply render state.
    const resolvedBrandKit = (d.brandKit as PortfolioBrandKit) ?? DEFAULT_BRAND_KIT;
    const resolvedContact = (d.contact as PortfolioContactConfig) ?? contact;
    const resolvedCollectionsPopup = (d.collectionsPopup as PortfolioCollectionsPopupConfig) ?? collectionsPopup;
    const resolvedFormLocale = typeof d.formLocale === "string" ? d.formLocale : formLocale;
    const resolvedFormDir = typeof d.formDir === "string" ? (d.formDir as "ltr" | "rtl" | "") : formDir;
    const resolvedTemplateId = d.templateId || templateId;
    zoneDataRef.current = { home: homeData, gallery: galleryData };
    setRenderDraftData(zoneDataRef.current);
    setBrandKit(resolvedBrandKit);
    setContact(resolvedContact);
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
      data: { home: homeData, gallery: galleryData },
      brandKit: resolvedBrandKit,
      contact: resolvedContact,
      header: {},
      collectionsPopup: resolvedCollectionsPopup,
      formLocale: resolvedFormLocale,
      formDir: resolvedFormDir,
    }));
    // A freshly-loaded clean draft must not manufacture a "Continue where you
    // left off" buffer for edits that never happened.
    clearLocalDraft();
    setDraftsOpen(false);
  }

  // ---- Reset canvas to an empty scratch state (no backing draft) ----
  function resetToScratchCanvas() {
    // Both zones go through prepareForEditor (not just puckSeed/home) — a
    // Save/Publish that never visits the Gallery tab reads zoneDataRef
    // directly, so an unprepared gallery would ship with no Navigation.
    const homeData = prepareForEditor(EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData;
    const galleryData = prepareForEditor(EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData;
    zoneDataRef.current = { home: homeData, gallery: galleryData };
    setRenderDraftData(zoneDataRef.current);
    setTemplateId(SCRATCH_TEMPLATE_ID);
    setTemplateSeedSnapshot(JSON.stringify(zoneDataRef.current));
    setActiveDraftId(null);
    setIsNewUnsavedDraft(true);
    setDraftName(DEFAULT_DRAFT_NAME);
    setNameError(null);
    setSavedSnapshot(null);
    ignoreNextChange.current = true;
    setPuckSeed(homeData as unknown as Data);
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
    setCollectionsPopupOpen(false);
  }

  async function selectZone(zone: Zone) {
    if (zone === activeZone && !sidePanelOpen) return;

    hideEditorPanels();
    if (sidePanelOpen) {
      hideEditorPanels();
      ignoreNextChange.current = true;
      setPuckSeed(prepareForEditor(zoneDataRef.current.home, initialHeaderConfig));
      setActiveZone("home");
    }
    await flushPendingSave(activeZone);
    ignoreNextChange.current = true;
    setPuckSeed(prepareForEditor(zoneDataRef.current[zone], initialHeaderConfig));
    setActiveZone(zone);
    if (previewMode) setPreviewNonce((n) => n + 1);
  }

  async function togglePreview() {
    setPreviewLoading(true);
    try {
      if (previewMode) {
        // Back to editing — remount Puck from the freshest data; ignore its echo.
        ignoreNextChange.current = true;
        setPuckSeed(prepareForEditor(zoneDataRef.current[activeZone], initialHeaderConfig));
        setPreviewMode(false);
        return;
      }
      // Entering preview — guarantee the iframe shows the latest edits.
      await flushPendingSave(activeZone);
      if (sidePanelOpen) {
        hideEditorPanels();
        ignoreNextChange.current = true;
        setPuckSeed(prepareForEditor(zoneDataRef.current.home, initialHeaderConfig));
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

  async function activateCollectionsPopup() {
    if (contactOpen) setContactOpen(false);
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
    // Every template already seeds its own Navigation into both zones, so
    // ensureNavigation is a no-op here — initialHeaderConfig is passed only
    // for consistency with every other prepareForEditor call site.
    // A still-pending onboarding logo (captured by the story prompt, held in
    // the ref instead of applied immediately — see its declaration) is
    // patched directly into the freshly-seeded Navigation block's slot.
    const pendingLogo = pendingOnboardingLogoRef.current;
    pendingOnboardingLogoRef.current = null;
    const homeData = withPendingLogo(
      prepareForEditor((seed.data.home as PuckData) ?? EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData,
      pendingLogo,
    );
    const galleryData = withPendingLogo(
      prepareForEditor((seed.data.gallery as PuckData) ?? EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData,
      pendingLogo,
    );
    zoneDataRef.current = { home: homeData, gallery: galleryData };
    setRenderDraftData(zoneDataRef.current);
    setBrandKit(seed.brandKit as PortfolioBrandKit);
    setContact(seed.contact as PortfolioContactConfig);
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
      header: {},
      collectionsPopup: (seed.collectionsPopup as PortfolioCollectionsPopupConfig) ?? {},
      formLocale,
      formDir,
    }));
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
  // pure-data seedData()/defaultBrandKit/defaultContact/defaultCollectionsPopup
  // instead of a server response. Every template's seedData() already includes
  // its own Navigation block, so there is no header to resolve separately —
  // and demoMode never runs the (non-demo-only) onboarding story prompt, so
  // there is no pending logo to patch in either.
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
    const homeData = prepareForEditor(seedData.home ?? EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData;
    const galleryData = prepareForEditor(seedData.gallery ?? EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData;
    const seedCollectionsPopup = template.defaultCollectionsPopup ?? {};
    zoneDataRef.current = { home: homeData, gallery: galleryData };
    setRenderDraftData(zoneDataRef.current);
    setBrandKit(template.defaultBrandKit);
    setContact(template.defaultContact);
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
      header: {},
      collectionsPopup: seedCollectionsPopup,
      formLocale,
      formDir,
    }));
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
    // Brand-new = no recoverable local buffer AND no saved drafts.
    const isNewUser = !hasRecoverableBuffer && drafts.length === 0;
    if (isNewUser) {
      setWelcomeTemplatesOpen(true);
    } else {
      setEntryOpen(true);
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
    // Both zones through prepareForEditor (mirrors resetToScratchCanvas —
    // an unprepared gallery has no Navigation), and ignoreNextChange set
    // before the remount so its mount echo isn't processed as a real edit
    // (every other setPuckSeed+setSeedNonce site in this file does the same).
    const homeData = prepareForEditor(EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData;
    const galleryData = prepareForEditor(EMPTY_ZONE, initialHeaderConfig) as unknown as PuckData;
    zoneDataRef.current = { home: homeData, gallery: galleryData };
    setRenderDraftData(zoneDataRef.current);
    ignoreNextChange.current = true;
    setPuckSeed(homeData as unknown as Data);
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
      guidePanelActions(currentId, { contactOpen }),
      {
        openContact: () => { void openContact(); },
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
    activeSection === "contact"
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
  const previewSrc = `${previewBasePath}?zone=${previewZone}&v=${previewNonce}&formLocale=${formLocale}&formDir=${formDir}`;

  // Wraps section-preset drawer items with PresetDrawerItem, which triggers
  // the shared PresetPreviewPanel (rendered once, above) on hover/focus — the
  // per-row description moved into that popover, so this override no longer
  // needs `t` or anything else that changes at runtime. Kept in its own
  // empty-dep memo (not merged into puckStableOverrides below) so it stays a
  // fully stable reference regardless of what that memo's contents end up
  // depending on. Defined ahead of puckStableOverrides so its `drawerItem`
  // render function is available there (passed explicitly to every raw
  // `Drawer.Item` PresetBlocksDrawer builds — see that component's comment).
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

  // Stable references for Puck overrides that must not change identity on every
  // re-render. Puck treats a new function reference as a reason to unmount and
  // remount the subtree — causing canvas scroll-to-top for `puck`, and focus loss
  // on every keystroke for `drawer`/`fields` (Puck onChange → re-render → new
  // inline arrow → remounted right panel → focused input destroyed).
  // `puck`/`preview`/`fields`/`actionBar` are stable because none of their JSX
  // closes over changing values (RootCanvasStyle/RightPanelTourMarker are
  // module-level). `drawer` closes over `t`/`demoMode`/`guideMode`/
  // `drawerItemOverrides.drawerItem`, listed honestly below — none of the four
  // actually changes after mount (demoMode/guideMode are fixed per route;
  // editor chrome is English-only so `t`'s catalog never changes;
  // drawerItemOverrides is itself a stable empty-dep reference above), so the
  // memo never recomputes in practice and identity stays stable to Puck too.
  // It also closes over `editorConfig.components` (for each drawer row's
  // label) WITHOUT listing `editorConfig` as a dep — deliberately: labels are
  // built from `t` alone and never vary with `activeZone`, but `editorConfig`'s
  // own reference DOES change on every Home/Gallery zone switch, and listing
  // it here would remount the canvas/drawer on every tab click.
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
          {children}
        </div>
      ),
      // Left sidebar drawer — tour anchor for the "drag a block" spotlight step.
      // `children` (Puck's own flat category-based list) is ignored: the two-
      // level tree is built by PresetBlocksDrawer instead, wrapped in the same
      // single Drawer Puck's own list would have used, so drag-and-drop still
      // has one droppable root.
      drawer: () => (
        <div data-tour-id="blocks-panel" className="flex min-h-0 flex-1 flex-col">
          <PresetBlocksDrawer
            t={t}
            demoMode={demoMode}
            hideManualBlocks={guideMode}
            drawerItem={drawerItemOverrides.drawerItem}
            resolveLabel={(key) =>
              (editorConfig.components as Record<string, { label?: string } | undefined>)[key]?.label
            }
          />
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
    [t, demoMode, guideMode, drawerItemOverrides.drawerItem]
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
          {EDITOR_SECTIONS.filter((section) => !previewMode || (section !== "contact" && section !== "collectionsPopup")).map((section) => {
            const label =
              section === "contact"
                ? t("contactSettingsShort")
                : section === "collectionsPopup"
                  ? t("featuredPopup")
                  : t(`zone.${section}`);
            // Tour anchor: contact gets a dedicated id for its own gated step;
            // page tabs have no individual id.
            const tourId = section === "contact" ? "contact-tab" : undefined;
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
                  if (section === "contact") openContact();
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
            window.open(`${previewBasePath}?zone=${previewZone}`, "_blank", "noopener,noreferrer");
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
            {tDemo("counters.blocks", { count: demoBlockCount(renderDraftData[activeZone]) })}
          </span>
        )}
        <div data-testid="draft-title-slot" className="min-w-0 shrink-0">
          <DraftNameEditor
            ref={nameEditorRef}
            name={draftName}
            error={pendingAction !== null ? null : nameError}
            onCommit={(n) => { setDraftName(n); setNameError(null); }}
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
          onDirChange={setFormDir}
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

  // Read-only cross-zone chrome info for the (separately-built) detach toggle
  // control inside StyleToolkitField — see chromeSyncContext.ts. Derived from
  // renderDraftData (not the zoneDataRef ref) so it stays reactive.
  const chromeSyncCtxValue = useMemo<ChromeSyncCtx>(
    () => ({
      canDetach: (zone, kind) =>
        canDetach(
          { home: renderDraftData.home, gallery: renderDraftData.gallery } as unknown as Zones,
          zone,
          kind
        ),
      detachedZone: (kind) => {
        if (isChromeDetached(renderDraftData.home, kind)) return "home";
        if (isChromeDetached(renderDraftData.gallery, kind)) return "gallery";
        return null;
      },
    }),
    [renderDraftData]
  );

  return (
    <GalleryPickerCacheProvider>
      <MobileBanner publicUrl={portfolioPublicUrl(currentSlug)} />

      <BrandColorsContext.Provider value={brandColors}>
      <DemoPickerContext.Provider
        value={demoMode ? { demoSessionId, onImageCapHit: () => setActiveDemoGate("imageCap") } : null}
      >
      <ChromeSyncContext.Provider value={chromeSyncCtxValue}>
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
                brandVars: cssVars,
                // Without this, getNavChromeLabelsFrom falls back to English —
                // the public page and the preview route both pass chrome.nav
                // already; the canvas was the one surface missing it.
                chrome: {
                  nav: {
                    navLandmark: tNav("navLandmark"),
                    home: tNav("home"),
                    gallery: tNav("gallery"),
                    contact: tNav("contact"),
                    openMenu: tNav("openMenu"),
                    closeMenu: tNav("closeMenu"),
                  },
                },
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
                      onFormDirChange={setFormDir}
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
              // Fully stable identity (see drawerItemOverrides above), never
              // changes across renders.
              ...drawerItemOverrides,
            }}
          />
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
                    onContactChange={setContact}
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
      </ChromeSyncContext.Provider>
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
        onBrandKitChange={setBrandKit}
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
          // "Continue where you left off" resumes the most recent state: the
          // unsaved-edit buffer if present, otherwise the active draft. It is only
          // disabled on a true first visit — no active draft now (initialActiveDraftId)
          // nor a recoverable buffer from last time. Note the buffer is cleared on
          // save/publish, so it must NOT be the sole gate.
          canContinue={hasRecoverableBuffer || initialActiveDraftId !== null}
          hasDrafts={drafts.length > 0}
          onContinue={() => {
            // Resuming the existing buffer as-is — never inject a still-pending
            // onboarding logo into it or a later template switch. Applying the
            // buffer only NOW (not on mount) is what keeps "Load an existing
            // draft"/"Start from scratch" from ever seeing it — restoreLocalDraft
            // no-ops when there is nothing to restore.
            pendingOnboardingLogoRef.current = null;
            restoreLocalDraft();
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
        onNameChange={demoMode ? undefined : (next) => { setDraftName(next); setNameError(validateDraftName(next)); }}
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

      {/* Anchor wins when a detached zone's chrome toggle turns back off — the
          detached zone's own styling is discarded, so confirm first. */}
      <AlertDialog
        open={pendingReanchor !== null}
        onOpenChange={(open) => {
          if (!open) cancelReanchor();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("chromeReanchorConfirmTitle", {
                page: pendingReanchor ? t(`zone.${pendingReanchor.zone === "home" ? "gallery" : "home"}`) : "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("chromeReanchorConfirmBody", {
                page: pendingReanchor ? t(`zone.${pendingReanchor.zone === "home" ? "gallery" : "home"}`) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelReanchor}>
              {t("chromeReanchorConfirmCancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmReanchor}>
              {t("chromeReanchorConfirmProceed", {
                page: pendingReanchor ? t(`zone.${pendingReanchor.zone === "home" ? "gallery" : "home"}`) : "",
              })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </GalleryPickerCacheProvider>
  );
}

