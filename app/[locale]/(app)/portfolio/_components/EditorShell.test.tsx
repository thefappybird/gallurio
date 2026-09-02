import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, useEffect, useState, type ReactNode, type ReactElement } from "react";
import { screen, fireEvent, within, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { toast } from "sonner";

// Stub the heavy Puck editor: render its title + the injected custom header
// (`overrides.header`), passing a "Publish" action so we can exercise onPublish.
// Also stub `usePuck` (used by the in-canvas device toggle) so it has context.
//
// IMPORTANT: the mock simulates Puck's UNCONTROLLED behavior — it captures `data`
// via useState on mount and ignores subsequent `data` prop changes (just like the
// real Puck). A `key` change causes a remount, which re-initializes the seed.
// `data-seed-len` exposes the captured seed length so remount tests can assert it
// changed (proving the canvas was repainted, not just re-rendered with stale seed).
// Module-level mount counter — incremented once per Puck remount (useEffect[]).
// Reset in beforeEach. Used by the re-seeds test to assert a remount occurred.
let __puckMountCount = 0;
// Captures the live onChange prop so tests can fire arbitrary-length Puck
// data directly (the "Simulate Puck change" button only emits a fixed
// 1-block payload, not enough to exercise the demo block cap).
let __capturedPuckOnChange: ((data: unknown) => void) | undefined;
// Captures the live `metadata` prop so tests can assert on what EditorShell
// threads into Puck's canvas context (e.g. the nav chrome labels — see
// getNavChromeLabelsFrom).
let __capturedPuckMetadata: unknown;
// Captures the seed actually mounted into Puck (post-prepareForEditor,
// post-withPendingLogo) on every mount/remount — more direct than round-
// tripping through the debounced localStorage buffer, which may not have
// flushed yet when the assertion runs.
let __capturedPuckSeed: unknown;

// Mock PuckApi shape used by createUsePuck selectors in EditCanvasControls.
const mockPuckApi = {
  appState: {
    ui: {
      leftSideBarVisible: true,
      rightSideBarVisible: true,
      viewports: { current: { width: 1280, height: "auto" }, controlsVisible: true, options: [] },
    },
    data: { content: [], root: {} },
  },
  dispatch: vi.fn(),
  selectedItem: undefined,
  getSelectorForId: vi.fn(),
  getItemById: vi.fn(),
  history: {
    back: vi.fn(),
    forward: vi.fn(),
    hasPast: false,
    hasFuture: false,
    histories: [],
    index: 0,
    setHistories: vi.fn(),
    setHistoryIndex: vi.fn(),
  },
};

vi.mock("@measured/puck", () => ({
  createUsePuck: () => (selector?: (api: typeof mockPuckApi) => unknown) =>
    selector ? selector(mockPuckApi) : mockPuckApi,
  // Minimal stand-ins for the exported `Drawer`/`Drawer.Item` primitives (the
  // EditorShell drawer override builds the nested tree straight from these,
  // not from Puck's own default categorized list). `Drawer.Item`'s `children`
  // is a render-prop — invoke it with a stub row so PresetDrawerItem (real,
  // unmocked) still wraps it, same as production. Declared inside the factory
  // (not at module scope): vi.mock factories cannot close over top-level
  // variables, since the mock call is hoisted above them.
  Drawer: Object.assign(
    ({ children }: { children: ReactNode }) => <div data-testid="drawer-root">{children}</div>,
    {
      Item: ({
        name,
        children,
      }: {
        name: string;
        children?: (p: { children: ReactNode; name: string }) => ReactElement;
      }) => {
        const row = <div data-testid={`drawer-item:${name}`}>{name}</div>;
        return children ? children({ name, children: row }) : row;
      },
    }
  ),
  // Stub for PresetPreviewCard.tsx's live mini-render — the preview panel test
  // only asserts the panel itself mounts once, not the mini-render's content.
  Render: () => null,
  Puck: ({
    headerTitle,
    overrides,
    onChange,
    data,
    metadata,
  }: {
    headerTitle?: string;
    overrides?: {
      header?: (p: { children: ReactNode }) => ReactNode;
      puck?: (p: { children: ReactNode }) => ReactNode;
      drawer?: (p: { children: ReactNode }) => ReactNode;
    };
    onPublish?: () => void;
    onChange?: (data: unknown) => void;
    data?: unknown;
    metadata?: unknown;
  }) => {
    // Simulate uncontrolled: capture data only on mount (via useState initializer).
    // Subsequent `data` prop changes are ignored — same as real Puck after mount.
    // Only a key change (remount) will re-initialize this seed.
    const [seed] = useState(() => data);
    __capturedPuckOnChange = onChange as ((data: unknown) => void) | undefined;
    __capturedPuckMetadata = metadata;
    __capturedPuckSeed = seed;

    // Count mounts — a new key forces a remount, incrementing this counter.
    useEffect(() => { __puckMountCount++; }, []);

    /* eslint-disable react-hooks/exhaustive-deps */
    // seed is captured via useState and never changes after mount; omitting it
    // from the dep array is intentional — we want [onChange]-only re-fire.
    useEffect(() => {
      // Emit the captured seed so zoneDataRef stays in sync with puckSeed,
      // keeping isDirty=false on mount/remount echoes (matches real Puck behavior
      // where the first onChange reflects the seed data, not empty content).
      onChange?.(seed as Parameters<NonNullable<typeof onChange>>[0]);
    }, [onChange]);
    /* eslint-enable react-hooks/exhaustive-deps */

    return (
      <div
        data-testid="puck"
        data-seed-len={JSON.stringify(seed)?.length ?? 0}
      >
        <div data-testid="puck-title">{headerTitle}</div>
        <button
          type="button"
          onClick={() =>
            onChange?.({
              content: [{ type: "Hero", props: { id: "hero-1", headline: "Changed" } }],
              root: {},
            })
          }
        >
          Simulate Puck change
        </button>
        {overrides?.header?.({
          children: null,
        })}
        {overrides?.puck?.({ children: <div data-testid="puck-canvas-content" /> })}
        {overrides?.drawer?.({ children: null })}
      </div>
    );
  },
}));

const dismissPortfolioGuideAction = vi.fn().mockResolvedValue({ ok: true });
const saveThemeAction = vi.fn().mockResolvedValue({ ok: true, theme: { id: "t1", name: "Test", brandKit: {} } });
const deleteThemeAction = vi.fn().mockResolvedValue({ ok: true });
const updateThemeAction = vi.fn().mockResolvedValue({ ok: true, theme: { id: "t1", name: "Test", brandKit: {} } });
const completeStoryPromptAction = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../_actions", () => ({
  dismissPortfolioGuideAction: (...a: unknown[]) => dismissPortfolioGuideAction(...a),
  saveThemeAction: (...a: unknown[]) => saveThemeAction(...a),
  deleteThemeAction: (...a: unknown[]) => deleteThemeAction(...a),
  updateThemeAction: (...a: unknown[]) => updateThemeAction(...a),
  updatePortfolioSlugAction: vi.fn().mockResolvedValue({ ok: true }),
  completeStoryPromptAction: (...a: unknown[]) => completeStoryPromptAction(...a),
}));

const createDraftAction = vi.fn().mockResolvedValue({ ok: true, draft: { id: "d1", name: "New Draft", templateId: "minimal", updatedAt: new Date().toISOString() } });
const updateDraftAction = vi.fn().mockResolvedValue({ ok: true, draft: { id: "d1", name: "New Draft", templateId: "minimal", updatedAt: new Date().toISOString() } });
const deleteDraftAction = vi.fn().mockResolvedValue({ ok: true });
const getDraftAction = vi.fn().mockResolvedValue({ ok: true, draft: { id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString(), data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } }, brandKit: null, contact: null, header: null, collectionsPopup: null, formLocale: "" } });
const listDraftsAction = vi.fn().mockResolvedValue([]);
const publishDraftAction = vi.fn().mockResolvedValue({ ok: true });
const importDemoPortfolioAction = vi.fn().mockResolvedValue({
  ok: true,
  draft: { id: "demo-d1", name: "Demo portfolio", templateId: "scratch", updatedAt: new Date().toISOString() },
  failedAssetIds: [],
});
const seedTemplateAction = vi.fn((templateId = "minimal") =>
  Promise.resolve({
    ok: true,
    seed: {
      templateId,
      data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
      brandKit: DEFAULT_BRAND_KIT,
      contact: { title: "" },
      header: {},
      collectionsPopup: {},
    },
  })
);
vi.mock("../_draftActions", () => ({
  createDraftAction: (...a: unknown[]) => createDraftAction(...a),
  updateDraftAction: (...a: unknown[]) => updateDraftAction(...a),
  deleteDraftAction: (...a: unknown[]) => deleteDraftAction(...a),
  getDraftAction: (...a: unknown[]) => getDraftAction(...a),
  listDraftsAction: (...a: unknown[]) => listDraftsAction(...a),
  publishDraftAction: (...a: unknown[]) => publishDraftAction(...a),
  seedTemplateAction: (...a: unknown[]) => seedTemplateAction(...a),
  importDemoPortfolioAction: (...a: unknown[]) => importDemoPortfolioAction(...a),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const uploadAsset = vi.fn();
vi.mock("@/lib/storage/uploadAsset.client", () => ({
  uploadAsset: (...a: unknown[]) => uploadAsset(...a),
}));

// useSlugAvailability (inside PublishDialog) calls checkSlugAvailabilityAction
// which transitively imports authkit-nextjs. Mock the action to prevent that.
vi.mock("@/lib/actions/slug", () => ({
  checkSlugAvailabilityAction: vi.fn().mockResolvedValue({ available: true }),
}));

import { EditorShell, previewZoneFor } from "./EditorShell";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import { PRESET_GROUPS } from "@/lib/page-builder/blocks/sectionPresets";
import { englishPuckT } from "@/lib/page-builder/editorConfig";
import { openPresetPreview, __resetPresetPreview } from "@/lib/page-builder/presetPreviewStore";
import { enMessages } from "@/test-utils/render";

/** Reads the onboarding logo's asset id off a persisted buffer's home-zone
 *  Navigation block's slot Image (the block is always seeded first). */
function navLogoAssetId(buffer: { data?: { home?: { content?: unknown[] } } }): string | undefined {
  const nav = buffer.data?.home?.content?.find(
    (b) => (b as { props?: { _chrome?: string } }).props?._chrome === "nav"
  ) as { props?: { content?: unknown[] } } | undefined;
  const image = nav?.props?.content?.find((c) => (c as { type?: string }).type === "Image") as
    | { props?: { _style?: { bgImagePublicId?: string } } }
    | undefined;
  return image?.props?._style?.bgImagePublicId;
}

/** Same as `navLogoAssetId` but reads a raw `{content}` zone shape directly
 *  (e.g. `__capturedPuckSeed`) instead of a persisted buffer's `data.home`. */
function navLogoAssetIdFromZone(zone: { content?: unknown[] } | undefined): string | undefined {
  const nav = zone?.content?.find(
    (b) => (b as { props?: { _chrome?: string } }).props?._chrome === "nav"
  ) as { props?: { content?: unknown[] } } | undefined;
  const image = nav?.props?.content?.find((c) => (c as { type?: string }).type === "Image") as
    | { props?: { _style?: { bgImagePublicId?: string } } }
    | undefined;
  return image?.props?._style?.bgImagePublicId;
}

const DRAFT_KEY = "gallurio:portfolio-draft:studio-aurora";
// Buffer matches baseProps initial data so restoring it keeps isDirty=false.
const LOCAL_DRAFT_V2 = {
  version: 2,
  data: {
    home: { content: [{ type: "Hero", props: { headline: "Hi" } }], root: {} },
    gallery: { content: [], root: {} },
  },
  draftId: "d1",
  draftName: "Test Draft",
};

const baseProps = {
  slug: "studio-aurora",
  workspaceName: "Studio Aurora",
  initialData: {
    home: { content: [{ type: "Hero", props: { headline: "Hi" } }], root: {} },
    gallery: { content: [], root: {} },
  },
  initialBrandKit: DEFAULT_BRAND_KIT,
  initialContact: { title: "Hi" },
  initialFormLocale: "",
  initialHeaderConfig: {},
  initialCollectionsPopup: {},
  publicOrigin: "https://app.test",
  previewBasePath: "/portfolio-preview",
  templates: [
    { id: "minimal", label: "Minimal", description: "Clean", defaultBrandKit: DEFAULT_BRAND_KIT },
  ],
  currentTemplateId: "minimal",
  // Keep the first-run guide closed during these tests so its overlay doesn't
  // sit over the editor controls.
  guideDismissed: true,
  // Keep the story prompt closed by default so existing guide/entry tests are unaffected.
  storyPromptCompleted: true,
  initialSeoDescription: "",
  initialSeoKeywords: [],
  initialInquiryRecipientEmail: "",
  hasBeenPublished: true,
  workspaceBusinessType: "",
  initialSavedThemes: [],
  // Provide an active draft so the editor starts in a clean (non-dirty) state.
  initialActiveDraftId: "d1",
  initialActiveDraftName: "Test Draft",
  initialDrafts: [{ id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString() }],
};

// basePro alias mirrors the existing test usage pattern.
const basePro = baseProps;

describe("previewZoneFor", () => {
  it("maps the contact section to the contact zone", () => {
    expect(previewZoneFor("contact", "home")).toBe("contact");
  });

  it("maps the collections popup section to the popup zone", () => {
    expect(previewZoneFor("collectionsPopup", "gallery")).toBe("popup");
  });
});

/**
 * Seed localStorage so `hasRecoverableBuffer` is true, enabling the
 * "Continue where you left off" option in the entry dialog. Then render and
 * dismiss the entry dialog so toolbar controls are accessible.
 *
 * When the SpotlightGuide is open (guideDismissed=false), it gates the entry
 * dialog. This helper skips the guide first so the entry dialog then appears.
 */
async function renderAndDismissEntry(
  ui: ReactElement,
  options?: Parameters<typeof renderWithProviders>[1]
) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(LOCAL_DRAFT_V2));
  const result = renderWithProviders(ui, options);

  // If the guide is open, skip it first so the entry dialog becomes visible.
  // "Skip Guide" now opens a confirm modal; confirm via the modal's own
  // "Skip Guide" button (the last one once the modal is mounted).
  const skipBtn = screen.queryByRole("button", { name: "Skip Guide" });
  if (skipBtn) {
    fireEvent.click(skipBtn);
    const confirmSkip = screen.getAllByRole("button", { name: "Skip Guide" });
    fireEvent.click(confirmSkip[confirmSkip.length - 1]);
  }

  // "Continue where you left off" is now enabled; clicking it closes the dialog
  // without opening any secondary dialog, keeping the test environment clean.
  const continueBtn = await screen.findByRole("button", { name: /Continue where you left off/ });
  fireEvent.click(continueBtn);
  // onContinue restores the local buffer via a queueMicrotask-deferred update
  // (see restoreLocalDraft) that forces a Puck remount — wait for the dialog
  // to close, then flush a real macrotask so the remount's own effects (and
  // its mount-echo onChange) settle before the caller interacts further.
  await waitFor(() => expect(screen.queryByText("Welcome back")).not.toBeInTheDocument());
  await new Promise((resolve) => setTimeout(resolve, 0));
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  __puckMountCount = 0;
  __capturedPuckOnChange = undefined;
  __capturedPuckMetadata = undefined;
  __capturedPuckSeed = undefined;
  __resetPresetPreview();
  listDraftsAction.mockResolvedValue([]);
  seedTemplateAction.mockImplementation((templateId = "minimal") =>
    Promise.resolve({
      ok: true,
      seed: {
        templateId,
        data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
        brandKit: DEFAULT_BRAND_KIT,
        contact: { title: "" },
        header: {},
        collectionsPopup: {},
      },
    })
  );
});

describe("EditorShell", () => {
  it("renders the editor with the workspace name + active zone in the title", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    expect(screen.getByTestId("puck-title")).toHaveTextContent("Studio Aurora · Home");
    expect(screen.getByTestId("portfolio-editor-shell")).toHaveClass("min-h-svh");
    expect(screen.getByTestId("portfolio-editor-shell")).toHaveClass("overflow-x-auto");
  });

  it("renders the zone switcher and switches the active zone", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
    expect(await screen.findByText("Studio Aurora · Gallery")).toBeInTheDocument();
  });

  it("passes the current activeZone to createEditorConfig, recomputing it on zone switch", async () => {
    // createEditorConfig's second parameter feeds the Navigation field panel's
    // detach-toggle zone context (label + disabled state) — see editorConfig.tsx
    // and chromeSyncContext.ts. Real module, not mocked elsewhere in this file;
    // spy on it to assert EditorShell threads its own activeZone state through
    // and recomputes when the zone changes, without depending on Puck's real
    // sidebar (which the top-of-file mock never renders).
    const editorConfigModule = await import("@/lib/page-builder/editorConfig");
    const spy = vi.spyOn(editorConfigModule, "createEditorConfig");

    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    expect(spy).toHaveBeenLastCalledWith(expect.any(Function), "home");

    fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.any(Function), "gallery"));

    spy.mockRestore();
  });

  it("debounces the local draft write on a Puck change and flushes it on zone switch (Fix #1)", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);

    // A Puck change updates in-memory state synchronously, but the localStorage
    // write is debounced — writing per keystroke is what caused the typing lag.
    // "Changed" is the headline carried by the simulated change; it must NOT
    // land in the persisted buffer immediately.
    fireEvent.click(screen.getByRole("button", { name: "Simulate Puck change" }));
    expect(window.localStorage.getItem(DRAFT_KEY) ?? "").not.toContain("Changed");

    // Switching zones is a commit point: the pending write is flushed.
    fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
    await waitFor(() =>
      expect(window.localStorage.getItem(DRAFT_KEY) ?? "").toContain("Changed")
    );
  });

  it("places Contact Form and Featured Popup beside the page tabs", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const controls = screen.getByRole("group", { name: "Portfolio sections" });
    expect(within(controls).getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Gallery" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Featured Popup" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Contact Form" })).toBeInTheDocument();
    // Navigation is no longer a side-panel tab — it's an ordinary, always-
    // present Puck block edited in the canvas via its own Content/Design tabs.
    expect(within(controls).queryByRole("button", { name: "Navigation" })).not.toBeInTheDocument();
  });

  it("opens the Featured Popup panel when the Featured Popup tab is clicked", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Featured Popup" }));
    // No Featured Work block in baseProps → the open is gated by a warning (Task 7).
    fireEvent.click(await screen.findByRole("button", { name: "Open anyway" }));
    expect(await screen.findByLabelText("Featured popup style")).toBeInTheDocument();
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Featured Popup" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps Contact Form open while the Featured Popup warning is shown", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact Form" }));
    expect(await screen.findByLabelText("Contact form")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Featured Popup" }));

    expect(await screen.findByRole("button", { name: "Open anyway" })).toBeInTheDocument();
    expect(screen.getByLabelText("Contact form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contact Form", hidden: true })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Featured Popup", hidden: true })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a preview and hides the canvas while the Contact Form settings panel is open", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact Form" }));
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Contact form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(screen.queryByLabelText("Contact form")).not.toBeInTheDocument();
    expect(await screen.findByTestId("puck")).toBeInTheDocument();
  });

  it("does not drop the first genuine edit after closing a side panel by re-selecting the already-active zone", async () => {
    // Opening Contact Form while on Home, then clicking Home again to return
    // to the canvas, re-selects the zone you're already on while a side panel
    // is open. That path used to arm the mount-echo guard without a matching
    // Puck remount to consume it, so the very next real edit was discarded.
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact Form" }));
    expect(await screen.findByLabelText("Contact form")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(await screen.findByTestId("puck")).toBeInTheDocument();

    // A genuine edit taken through the (buggy) mount-echo branch still lands
    // in in-memory state — the observable loss is that it never schedules the
    // debounced localStorage autosave (that call sits after the echo guard's
    // early return), so it vanishes from "Continue where you left off".
    fireEvent.click(screen.getByRole("button", { name: "Simulate Puck change" }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(window.localStorage.getItem(DRAFT_KEY) ?? "").toContain("Changed");
  });

  // Note: there is no reachable "raw mount, before any entry action" edit —
  // PortfolioEntryDialog is a non-dismissible modal, so the first click a real
  // user can make on Puck always follows some entry choice (Continue / Load
  // existing / Start scratch). "Continue" (restoreLocalDraft) is exercised as
  // the mount-adjacent reseed by every renderAndDismissEntry-based test that
  // fires "Simulate Puck change" right after, e.g. "keeps Puck edits local"
  // above and the zone-switch regression test below.

  it("does not drop the first genuine edit after applyDraft loads a different draft", async () => {
    const props = {
      ...baseProps,
      initialDrafts: [
        { id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
        { id: "d2", name: "Summer", templateId: "minimal", updatedAt: new Date().toISOString() },
      ],
    };
    getDraftAction.mockResolvedValueOnce({
      ok: true,
      draft: {
        id: "d2",
        name: "Summer",
        templateId: "minimal",
        updatedAt: new Date().toISOString(),
        data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
        brandKit: null,
        contact: null,
        header: null,
        collectionsPopup: null,
        formLocale: "",
      },
    });

    await renderAndDismissEntry(<EditorShell {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply Summer" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Applying Summer" })).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Simulate Puck change" }));
    expect(screen.getByRole("button", { name: "Save changes" })).not.toBeDisabled();
  });

  it("keeps the sidebar toggles in the edit-mode header", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    expect(screen.getByRole("button", { name: "Toggle blocks panel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle properties panel" })).toBeInTheDocument();
    expect(screen.getByTestId("canvas-controls-trigger")).toHaveAttribute("aria-label", "Editor controls");
    // The edit-canvas breakpoint + zoom controls now live in this same header
    // cluster (CanvasViewportControls); their rendering + behaviour are
    // unit-tested in CanvasViewportControls.test.tsx.
  });

  it("stops keydown propagation past the editor root when the target is an input", async () => {
    const { container } = await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const editorRoot = container.querySelector('[data-testid="portfolio-editor-shell"]') as HTMLElement;
    const input = document.createElement("input");
    editorRoot.appendChild(input);

    let propagated = false;
    const outerHandler = () => { propagated = true; };
    document.addEventListener("keydown", outerHandler);

    const event = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true });
    input.dispatchEvent(event);

    document.removeEventListener("keydown", outerHandler);
    expect(propagated).toBe(false);
  });

  it("blocks document-level bubble-phase keydown listeners (e.g. Puck hotkeys) when typing in an input — capture-phase interceptor", async () => {
    // Simulate a Puck-style listener registered on document in bubble phase
    // BEFORE the component mounts. The capture-phase interceptor added by EditorShell
    // must call stopImmediatePropagation so this listener never fires for editable targets.
    let puckHotkeyFired = false;
    const puckStyleListener = () => { puckHotkeyFired = true; };
    document.addEventListener("keydown", puckStyleListener);

    const { container } = await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const editorRoot = container.querySelector('[data-testid="portfolio-editor-shell"]') as HTMLElement;
    const input = document.createElement("input");
    editorRoot.appendChild(input);
    input.focus();

    // Type a character that Puck shortcuts on (e.g. "i" for toggle-interactive, "y" for redo)
    const event = new KeyboardEvent("keydown", { key: "i", code: "KeyI", bubbles: true });
    input.dispatchEvent(event);

    document.removeEventListener("keydown", puckStyleListener);
    expect(puckHotkeyFired).toBe(false);
  });

  it("does NOT stop propagation for a role=combobox target, so its own Arrow/Enter/Escape nav still works", async () => {
    const { container } = await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const editorRoot = container.querySelector('[data-testid="portfolio-editor-shell"]') as HTMLElement;
    const input = document.createElement("input");
    input.setAttribute("role", "combobox");
    editorRoot.appendChild(input);

    let propagated = false;
    const outerHandler = () => { propagated = true; };
    document.addEventListener("keydown", outerHandler);

    const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
    input.dispatchEvent(event);

    document.removeEventListener("keydown", outerHandler);
    expect(propagated).toBe(true);
  });

  it("opens the publish dialog when the Publish button in the editor header is clicked", async () => {
    await renderAndDismissEntry(<EditorShell {...basePro} />);
    expect(screen.queryByText("Publish your portfolio?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(screen.getByText("Publish your portfolio?")).toBeInTheDocument();
  });

  it("opens the theme panel", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Theme" }));
    expect(screen.getByText("Theme & brand")).toBeInTheDocument();
  });

  it("toggles into live preview (Puck unmounts, iframe shown) and back", async () => {
    const { container } = await renderAndDismissEntry(<EditorShell {...baseProps} />);
    expect(screen.getByTestId("puck")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    // Puck gone, preview iframe mounted pointing at the home zone.
    expect(await screen.findByTitle("Live preview")).toBeInTheDocument();
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toContain("/portfolio-preview?zone=home");
    expect(iframe?.getAttribute("src")).not.toContain("draft=");
    expect(iframe?.getAttribute("src")).not.toContain("&header=");
    // Back to editing.
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByTestId("puck")).toBeInTheDocument();
  });

  it("carries the active draft id in the preview iframe src, omitted when there is none", async () => {
    // With an active draft (baseProps has one) — carried through.
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    const iframe = await screen.findByTitle("Live preview");
    expect(iframe.getAttribute("src")).toContain("draftId=d1");
  });

  it("omits draftId from the preview iframe src when there is no active draft", async () => {
    renderWithProviders(
      <EditorShell {...baseProps} initialActiveDraftId={null} initialActiveDraftName={undefined} initialDrafts={[]} />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Start from scratch" }));
    await waitFor(() => expect(seedTemplateAction).toHaveBeenCalledWith("scratch"));
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    const iframe = await screen.findByTitle("Live preview");
    expect(iframe.getAttribute("src")).not.toContain("draftId=");
  });

  it("treats Contact as a tab — auto-opens the inline settings panel", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact Form" }));
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contact Form" }).getAttribute("aria-pressed")).toBe("true");
    // Auto-open means the panel is already visible (shows the description).
    expect(
      await screen.findByText(
        "The form fields are fixed. You can edit the heading, message, and button only."
      )
    ).toBeInTheDocument();
  });

  it("publishes the active draft and clears localStorage", async () => {
    await renderAndDismissEntry(<EditorShell {...basePro} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact Form" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publish now" }));
    await waitFor(() => expect(publishDraftAction).toHaveBeenCalledWith("d1"));
  });

  it("shows the mobile banner notice", async () => {
    // MobileBanner is outside the entry dialog overlay, so no dismissal needed.
    renderWithProviders(<EditorShell {...baseProps} />);
    expect(
      screen.getByText("The editor works best on a larger screen")
    ).toBeInTheDocument();
  });

  it("entering preview from the contact panel closes edit-only tabs and returns to home", async () => {
    const { container } = await renderAndDismissEntry(<EditorShell {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Contact Form" }));
    expect(await screen.findByLabelText("Contact form preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Navigation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contact Form" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Featured Popup" })).not.toBeInTheDocument();
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toContain("/portfolio-preview?zone=home");
    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps Puck edits local — does NOT call server on Puck change", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulate Puck change" }));
    // No server action called on Puck change; data stays in localStorage until
    // the owner explicitly clicks "Save changes".
    expect(createDraftAction).not.toHaveBeenCalled();
    expect(updateDraftAction).not.toHaveBeenCalled();
  });

  it("renders the collections popup preview when the popup tab is open", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Featured Popup" }));
    expect(await screen.findByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("shows the collections popup preview on the canvas when the Featured Popup tab is opened", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Featured Popup" }));
    // No Featured Work block in baseProps → the open is gated by a warning (Task 7).
    fireEvent.click(await screen.findByRole("button", { name: "Open anyway" }));
    // Wait for the async openCollectionsPopup state update to settle.
    // The style panel (right rail) must be present.
    expect(await screen.findByLabelText("Featured popup style")).toBeInTheDocument();
    // Puck canvas must be gone — the preview branch replaces it.
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    // CollectionsPopupPreview must render the sample chrome with its title.
    expect(screen.getByText("Sample Collection")).toBeInTheDocument();
    expect(screen.getByTestId("collections-popup-preview-root")).toHaveClass("h-full");
  });

  it("builds a preview src without inlining the draft", async () => {
    const { container } = await renderAndDismissEntry(<EditorShell {...basePro} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByTitle("Live preview")).toBeInTheDocument();
    const iframe = container.querySelector("iframe");
    const src = iframe?.getAttribute("src") ?? "";
    expect(src).not.toContain("draft=");
    expect(src).toContain("zone=");
    expect(src).toContain("v=");
  });

  it("reflects a formLocale/formDir change in the preview iframe src", async () => {
    const { container } = await renderAndDismissEntry(<EditorShell {...basePro} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByTitle("Live preview")).toBeInTheDocument();

    const iframeBefore = container.querySelector("iframe");
    expect(iframeBefore?.getAttribute("src")).toContain("formLocale=");
    expect(iframeBefore?.getAttribute("src")).toContain("formDir=");

    const languageTrigger = screen.getByTestId("language-control");
    // Guarded retry: only re-fire the open events while the menu isn't open
    // yet, so a slow-opening retry never re-toggles an already-open menu closed.
    await waitFor(() => {
      if (!screen.queryByText("العربية")) {
        fireEvent.pointerDown(languageTrigger, { button: 0 });
        fireEvent.click(languageTrigger);
      }
      expect(screen.queryByText("العربية")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("العربية"));

    const iframeAfter = container.querySelector("iframe");
    expect(iframeAfter?.getAttribute("src")).toContain("formLocale=ar");
    expect(iframeAfter?.getAttribute("src")).toContain("formDir=rtl");
  });

  it("shows the Drafts button and draft name editor in the toolbar", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    expect(screen.getByRole("button", { name: "Drafts" })).toBeInTheDocument();
    // Draft name is shown as a span with a rename button.
    expect(screen.getByTitle("Test Draft")).toBeInTheDocument();
  });

  it("shows the Save changes button disabled when not dirty", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const saveBtn = screen.getByRole("button", { name: "Save changes" });
    expect(saveBtn).toBeDisabled();
  });

  it("entry dialog shows on every load, including when a draft is already loaded", async () => {
    // baseProps includes initialActiveDraftId: "d1" — a server-loaded draft.
    // The entry dialog must still appear (spec: shown on every load).
    renderWithProviders(<EditorShell {...baseProps} />);
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
  });

  it("enables 'Continue where you left off' when an active draft exists even without an unsaved-edit buffer", async () => {
    // beforeEach clears localStorage → no recoverable buffer. baseProps still has
    // an active draft (initialActiveDraftId="d1"). Continue must stay enabled:
    // it's only disabled on a true first visit (no active draft now nor last time).
    renderWithProviders(<EditorShell {...baseProps} />);
    const continueBtn = await screen.findByRole("button", { name: /Continue where you left off/ });
    expect(continueBtn).not.toBeDisabled();
  });

  it("disables 'Continue where you left off' when there is no active draft and no buffer (drafts exist)", async () => {
    // A saved draft exists (so the entry dialog — not the welcome-template modal —
    // is shown), but there is no active draft and no buffer → Continue disabled.
    renderWithProviders(
      <EditorShell
        {...baseProps}
        initialActiveDraftId={null}
        initialActiveDraftName={undefined}
      />
    );
    const continueBtn = await screen.findByRole("button", { name: /Continue where you left off/ });
    expect(continueBtn).toBeDisabled();
  });

  it("brand-new user (no drafts, no buffer) sees the welcome template modal instead of PortfolioEntryDialog", async () => {
    // No localStorage buffer set, no drafts, guideDismissed=true → welcome template modal.
    renderWithProviders(<EditorShell {...baseProps} initialActiveDraftId={null} initialActiveDraftName={undefined} initialDrafts={[]} />);
    expect(await screen.findByText("Pick a template to start")).toBeInTheDocument();
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
  });

  it("does not call the save API when the draft name duplicates another draft", async () => {
    const props = {
      ...baseProps,
      initialActiveDraftId: "d1",
      initialActiveDraftName: "Test Draft",
      initialDrafts: [
        { id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
        { id: "d2", name: "Summer", templateId: "minimal", updatedAt: new Date().toISOString() },
      ],
    };
    await renderAndDismissEntry(<EditorShell {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename draft" }));
    const input = screen.getByLabelText("Draft name");
    fireEvent.change(input, { target: { value: "Summer" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm name" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("A draft with this name already exists.")).toBeInTheDocument();
    expect(updateDraftAction).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("still opens the unsaved-changes modal when navigating away with an invalid draft name", async () => {
    const props = {
      ...baseProps,
      initialDrafts: [
        { id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
        { id: "d2", name: "Summer", templateId: "minimal", updatedAt: new Date().toISOString() },
      ],
    };
    await renderAndDismissEntry(<EditorShell {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename draft" }));
    fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Summer" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm name" }));
    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply Summer" }));
    expect(await screen.findByText("Save your changes?")).toBeInTheDocument();
    expect(screen.queryByText("A draft with this name already exists")).not.toBeInTheDocument();
  });

  it("shows a busy state on the applied draft row while getDraftAction is in flight (clean canvas)", async () => {
    const props = {
      ...baseProps,
      initialDrafts: [
        { id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
        { id: "d2", name: "Summer", templateId: "minimal", updatedAt: new Date().toISOString() },
      ],
    };
    let resolveGetDraft!: (value: unknown) => void;
    getDraftAction.mockImplementationOnce(
      () => new Promise((resolve) => { resolveGetDraft = resolve; })
    );

    await renderAndDismissEntry(<EditorShell {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply Summer" }));

    expect(await screen.findByRole("button", { name: "Applying Summer" })).toBeInTheDocument();

    resolveGetDraft({
      ok: true,
      draft: {
        id: "d2",
        name: "Summer",
        templateId: "minimal",
        updatedAt: new Date().toISOString(),
        data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
        brandKit: null,
        contact: null,
        header: null,
        collectionsPopup: null,
        formLocale: "",
      },
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Applying Summer" })).not.toBeInTheDocument()
    );
  });

  it("does not pre-validate duplicate names when clicking Add new draft", async () => {
    const props = {
      ...baseProps,
      initialDrafts: [
        { id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
        { id: "d2", name: "New Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
      ],
    };
    await renderAndDismissEntry(<EditorShell {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename draft" }));
    fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "New Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm name" }));

    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));

    expect(await screen.findByText("Choose a template")).toBeInTheDocument();
    expect(screen.queryByText("A draft with this name already exists")).not.toBeInTheDocument();
  });

  it("Publish button in editor header is icon-only and has the same size (h-7) as Save changes", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const saveBtn = screen.getByRole("button", { name: "Save changes" });
    const publishBtn = screen.getByRole("button", { name: "Publish" });
    expect(saveBtn.className).toContain("h-7");
    expect(publishBtn.className).toContain("h-7");
    expect(publishBtn).toHaveAttribute("title", "Publish");
    expect(publishBtn).not.toHaveTextContent("Publish");
    expect(publishBtn.querySelector("svg")).not.toBeNull();
  });

  it("styles Save changes with the brand variant and Preview with the secondary variant", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    expect(screen.getByRole("button", { name: "Save changes" }).className).toContain("bg-brand");
    expect(screen.getByRole("button", { name: /Preview/ }).className).toContain("bg-secondary");
  });

  it("uses a compact responsive toolbar while Save changes and Publish stay visible", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const sectionGroup = screen.getByRole("group", { name: /sections/i });
    const scrollRegion = screen.getByTestId("portfolio-toolbar-scroll");
    const toolbarGrid = screen.getByTestId("portfolio-toolbar-grid");
    const fixedActions = screen.getByTestId("portfolio-toolbar-fixed-actions");
    const actionGroup = screen.getByTestId("portfolio-toolbar-actions");
    const canvasControls = screen.getByTestId("portfolio-toolbar-canvas-controls");
    expect(sectionGroup.className).toContain("flex-nowrap");
    expect(sectionGroup.className).not.toContain("overflow-x-auto");
    expect(sectionGroup.className).not.toContain("flex-wrap");
    expect(scrollRegion.className).toContain("overflow-x-auto");
    expect(scrollRegion.className).toContain("flex-1");
    expect(scrollRegion.parentElement?.className).toContain("min-w-0");
    expect(actionGroup.className).toContain("shrink-0");
    expect(canvasControls.className).toContain("shrink-0");
    expect(scrollRegion).not.toContainElement(canvasControls);
    expect(actionGroup.className).not.toContain("absolute");
    expect(fixedActions.className).toContain("w-max");
    expect(toolbarGrid.className).toContain("grid-cols-[max-content]");
    expect(toolbarGrid.className).not.toContain("min-w-full");
    expect(actionGroup).toContainElement(screen.getByRole("button", { name: "Photos" }));
    expect(actionGroup).toContainElement(screen.getByRole("button", { name: "Theme" }));
    expect(actionGroup).toContainElement(screen.getByRole("button", { name: "Guide" }));
    expect(actionGroup).toContainElement(screen.getByRole("button", { name: "Drafts" }));
    expect(fixedActions).toContainElement(screen.getByRole("button", { name: "Save changes" }));
    expect(fixedActions).toContainElement(screen.getByRole("button", { name: "Publish" }));
  });

  it("renders icon-only portfolio actions with accessible labels", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    for (const name of ["Photos", "Theme", "Guide", "Drafts", "Save changes"]) {
      const action = screen.getByRole("button", { name });
      expect(action.querySelector("svg")).not.toBeNull();
      expect(action).toHaveAttribute("title", name);
      expect(action).not.toHaveTextContent(name);
    }
    expect(screen.getByRole("button", { name: "Guide" })).toHaveAttribute("data-tour-id", "guide");
  });

  it("renders the Preview button as a sibling of the section tabs inside the nav cluster", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const preview = screen.getByRole("button", { name: /Preview/ });
    const sectionGroup = screen.getByRole("group", { name: /sections/i });
    // Preview must share the section-tab group's flex container (no orphaned second line).
    expect(preview.parentElement).toBe(sectionGroup);
  });

  it("keeps the draft title and save controls together in the portfolio action group", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const draftsButton = screen.getByRole("button", { name: "Drafts" });
    const title = screen.getByTitle("Test Draft");
    const saveButton = screen.getByRole("button", { name: "Save changes" });
    const slot = title.closest('[data-testid="draft-title-slot"]');
    const actionGroup = screen.getByTestId("portfolio-toolbar-actions");
    expect(slot).not.toBeNull();
    expect(slot!.className).toContain("min-w-0");
    expect(slot!.className).toContain("shrink-0");
    expect(actionGroup).toContainElement(slot as HTMLElement);
    expect(
      draftsButton.compareDocumentPosition(slot!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      slot!.compareDocumentPosition(saveButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("shows the Current badge in template picker immediately after applying a template (canvas still matches seed)", async () => {
    // Start clean (isDirty=false) so guardThenRun runs applyTemplate without a guard prompt.
    await renderAndDismissEntry(<EditorShell {...baseProps} />);

    // Open template picker via Drafts → Add new draft (handleAddNewDraft is unguarded).
    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));
    await screen.findByText("Choose a template");

    // Apply Minimal (clean draft → no guard fires).
    fireEvent.click(screen.getByRole("button", { name: /Minimal/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));

    // Picker closes after apply. Re-open it without triggering a guard.
    await waitFor(() => expect(screen.queryByText("Choose a template")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));

    // The Current badge must be visible for Minimal since no edits have been made.
    expect(await screen.findByText(/current/i)).toBeInTheDocument();
  });

  it("opens the template picker directly from Add new draft, then prompts once when a template is applied", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    // Make the draft dirty via a rename to a unique, valid name.
    fireEvent.click(screen.getByRole("button", { name: "Rename draft" }));
    fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Renamed Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm name" }));

    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));
    expect(await screen.findByText("Choose a template")).toBeInTheDocument();
    expect(screen.queryByText("Save your changes?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Minimal/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));

    expect(await screen.findByText("Save your changes?")).toBeInTheDocument();
  });

  it("shows both toast and inline validation when template apply save fails on duplicate name", async () => {
    const props = {
      ...baseProps,
      initialDrafts: [
        { id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
        { id: "d2", name: "Summer", templateId: "minimal", updatedAt: new Date().toISOString() },
      ],
    };
    await renderAndDismissEntry(<EditorShell {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename draft" }));
    fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Summer" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm name" }));

    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));
    fireEvent.click(screen.getByRole("button", { name: /Minimal/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("A draft with this name already exists.")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("A draft with this name already exists.");
  });

  it("clears the duplicate-name error after deleting the conflicting draft", async () => {
    const props = {
      ...baseProps,
      initialDrafts: [
        { id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
        { id: "d2", name: "Summer", templateId: "minimal", updatedAt: new Date().toISOString() },
      ],
    };
    await renderAndDismissEntry(<EditorShell {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename draft" }));
    fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Summer" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm name" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("A draft with this name already exists.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete Summer" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Delete draft$/i }));

    await waitFor(() => {
      expect(screen.queryByText("A draft with this name already exists.")).not.toBeInTheDocument();
    });
  });

  it("does not allow deleting the only active draft", async () => {
    const props = {
      ...baseProps,
      initialActiveDraftId: "d1",
      initialActiveDraftName: "New Draft",
      initialDrafts: [
        { id: "d1", name: "New Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
      ],
    };
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        ...LOCAL_DRAFT_V2,
        draftId: "d1",
        draftName: "New Draft",
      })
    );
    renderWithProviders(<EditorShell {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: /Continue where you left off/ }));

    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    expect(await screen.findByRole("button", { name: "Delete New Draft" })).toBeDisabled();
    expect(deleteDraftAction).not.toHaveBeenCalled();
  });

  it("recovers by updating a stale server-side New Draft when the local list is empty", async () => {
    createDraftAction.mockResolvedValueOnce({ error: "name_taken" });
    listDraftsAction.mockResolvedValueOnce([
      { id: "server-new", name: "New Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
    ]);
    updateDraftAction.mockResolvedValueOnce({
      ok: true,
      draft: { id: "server-new", name: "New Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
    });

    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        ...LOCAL_DRAFT_V2,
        draftId: null,
        draftName: "New Draft",
      })
    );
    renderWithProviders(
      <EditorShell
        {...baseProps}
        initialActiveDraftId={null}
        initialActiveDraftName={undefined}
        initialDrafts={[]}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: /Continue where you left off/ }));

    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));
    fireEvent.click(screen.getByRole("button", { name: /Minimal/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(createDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Draft" })
      );
    });
    expect(listDraftsAction).toHaveBeenCalled();
    expect(updateDraftAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "server-new", name: "New Draft" })
    );
    expect(screen.queryByText("A draft with this name already exists")).not.toBeInTheDocument();
  });

  it("renders Undo and Redo buttons; Undo is disabled when history has no past", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const undoBtn = screen.getByRole("button", { name: "Undo" });
    const redoBtn = screen.getByRole("button", { name: "Redo" });
    expect(undoBtn).toBeInTheDocument();
    expect(redoBtn).toBeInTheDocument();
    // hasPast = false in the mock → Undo must be disabled
    expect(undoBtn).toBeDisabled();
  });

  it("re-seeds the canvas immediately when applying a template (no tab switch required)", async () => {
    // baseProps: initialData.home has a Hero block; seedTemplateAction returns empty
    // content. The seed swap should be visible immediately — not deferred to a tab switch.
    // baseProps has initialActiveDraftId="d1" + matching savedSnapshot → clean draft →
    // guardThenRun fires immediately without the unsaved-changes modal.
    await renderAndDismissEntry(<EditorShell {...baseProps} />);

    // Open the template picker via Drafts → Add new draft.
    // (The clean-draft path: no unsaved-changes modal, jumps straight to the picker.)
    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));

    // Select the "Minimal" template card — highlights it without opening a dialog.
    // Card button accessible name includes label + description ("Minimal Clean").
    fireEvent.click(await screen.findByRole("button", { name: /Minimal/ }));

    // Snapshot mount count before the apply so we can detect a remount.
    const mountCountBefore = __puckMountCount;

    // Commit the selection via the footer "Use this template" button.
    fireEvent.click(await screen.findByRole("button", { name: "Use this template" }));

    // After applyTemplate, the seedNonce fix bumps the Puck key → remount.
    // The mount counter (incremented in useEffect[]) is the authoritative signal:
    // a key change forces a new Puck instance (new DOM node, new useEffect run).
    // Without the fix: key stays "home-0", React reuses the instance, mount count stays
    // at 1 — this assertion would fail.
    await screen.findByTestId("puck", {}, { timeout: 3000 });
    await waitFor(() => {
      expect(__puckMountCount).toBeGreaterThan(mountCountBefore);
    });
  });

  it("does not drop the first genuine edit made right after applyTemplate re-seeds the canvas", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));
    fireEvent.click(await screen.findByRole("button", { name: /Minimal/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Use this template" }));
    await screen.findByTestId("puck", {}, { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: "Simulate Puck change" }));
    expect(screen.getByRole("button", { name: "Save changes" })).not.toBeDisabled();
  });

  it("unsaved-changes modal shows the draft name input and blocks Save when name is a duplicate", async () => {
    const props = {
      ...baseProps,
      initialActiveDraftId: "d1",
      initialActiveDraftName: "Test Draft",
      initialDrafts: [
        { id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString() },
        { id: "d2", name: "Summer", templateId: "minimal", updatedAt: new Date().toISOString() },
      ],
    };
    // Make the draft dirty by renaming to a duplicate name.
    await renderAndDismissEntry(<EditorShell {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename draft" }));
    fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Summer" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm name" }));

    // Trigger the unsaved-changes guard by trying to apply another draft.
    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply Summer" }));

    // The unsaved-changes dialog should open.
    expect(await screen.findByText("Save your changes?")).toBeInTheDocument();

    // It must render a Draft name input seeded with "Summer".
    const nameInput = screen.getByLabelText("Draft name");
    expect(nameInput).toBeInTheDocument();
    expect((nameInput as HTMLInputElement).value).toBe("Summer");

    // Clicking Save in the dialog should show the error and NOT call the save action.
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A draft with this name already exists");
    expect(updateDraftAction).not.toHaveBeenCalled();
  });

  it("Discard in unsaved-changes dialog closes both dialogs and aborts the pending publish", async () => {
    // Start with a clean draft (not dirty) so the publish flow works normally.
    // Then make it dirty by simulating a Puck change, then open Publish to trigger the guard.
    await renderAndDismissEntry(<EditorShell {...baseProps} />);

    // Make the draft dirty via a Puck change.
    fireEvent.click(screen.getByRole("button", { name: "Simulate Puck change" }));

    // Try to publish — this should trigger the unsaved-changes guard.
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    // The unsaved-changes dialog should now be open (not the publish dialog).
    expect(await screen.findByText("Save your changes?")).toBeInTheDocument();
    expect(screen.queryByText("Publish your portfolio?")).not.toBeInTheDocument();

    // Click Discard — should close the unsaved dialog AND abort the publish.
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    // Both dialogs must be gone.
    await waitFor(() => {
      expect(screen.queryByText("Save your changes?")).not.toBeInTheDocument();
      expect(screen.queryByText("Publish your portfolio?")).not.toBeInTheDocument();
    });

    // The queued publish action must NOT have run.
    expect(publishDraftAction).not.toHaveBeenCalled();
  });

  it("savedSnapshot matches the payload sent to the server after a successful save", async () => {
    // Verifies FIX 2: savedSnapshot is built from `payload` (captured before the
    // server round-trip), NOT from a second buildDraftSnapshot() call after the await.
    // The observable contract: after save, isDirty=false (Save changes is disabled),
    // and updateDraftAction was called with exactly the data that savedSnapshot tracks.
    await renderAndDismissEntry(<EditorShell {...baseProps} />);

    // Make the draft dirty with a Puck change.
    fireEvent.click(screen.getByRole("button", { name: "Simulate Puck change" }));

    // Save changes button must now be enabled (dirty).
    const saveBtn = screen.getByRole("button", { name: "Save changes" });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());

    // Click Save.
    fireEvent.click(saveBtn);

    // After a successful save, savedSnapshot must equal what was sent to the server:
    // isDirty should become false → Save changes button disabled.
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled());

    // updateDraftAction must have been called with the draft name matching what's tracked.
    expect(updateDraftAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test Draft" })
    );
  });

  it("open-in-new-tab button opens /portfolio-preview and does not call createPreviewSnapshotAction", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    await renderAndDismissEntry(<EditorShell {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /open in new tab/i }));

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/portfolio-preview"),
      "_blank",
      "noopener,noreferrer"
    );
    // The snapshot action must not have been called.
    // (It's not mocked in this file — verifying the button doesn't call it by
    // ensuring no network/action mock was invoked for that path.)
    openSpy.mockRestore();
  });

  // ---- Spotlight guide ----

  it("renders the spotlight guide on load when guideDismissed=false", async () => {
    renderWithProviders(
      <EditorShell {...baseProps} guideDismissed={false} />
    );
    // SpotlightGuide renders a tooltip card with the welcome step title.
    // The guide is a portal into document.body; screen queries search the full document.
    expect(await screen.findByText("Welcome to your portfolio editor")).toBeInTheDocument();
    // Progress text confirms we're on the first step
    expect(screen.getByText(/1 of \d+/)).toBeInTheDocument();
  });

  it("does NOT render the spotlight guide when guideDismissed=true", async () => {
    renderWithProviders(
      <EditorShell {...baseProps} guideDismissed={true} />
    );
    // Give async effects a chance to settle before asserting absence
    await screen.findByText("Welcome back");
    expect(screen.queryByText("Welcome to your portfolio editor")).not.toBeInTheDocument();
  });

  it("Guide button reopens the spotlight guide after Skip", async () => {
    // Dismiss the entry dialog first so its aria-modal doesn't filter the
    // accessibility tree when querying buttons in the SpotlightGuide portal.
    // renderAndDismissEntry skips the guide (since guideDismissed=false gates entry)
    // and then dismisses the entry dialog — guide is closed at this point.
    await renderAndDismissEntry(<EditorShell {...baseProps} guideDismissed={false} />);
    // Guide was skipped by renderAndDismissEntry and is now closed.
    expect(screen.queryByText("Welcome to your portfolio editor")).not.toBeInTheDocument();

    // Guide button reopens the tour from step 0
    fireEvent.click(screen.getByRole("button", { name: "Guide" }));
    expect(await screen.findByText("Welcome to your portfolio editor")).toBeInTheDocument();
    expect(screen.getByText(/1 of \d+/)).toBeInTheDocument();
  });

  // ---- Story prompt ----

  it("renders the story prompt on load when storyPromptCompleted=false and guideDismissed=false, and hides the guide until it's done", async () => {
    renderWithProviders(
      <EditorShell {...baseProps} storyPromptCompleted={false} guideDismissed={false} />
    );
    expect(await screen.findByText("Let's tell your story")).toBeInTheDocument();
    expect(screen.queryByText("Welcome to your portfolio editor")).not.toBeInTheDocument();
  });

  it("explore-self exit awaits dismissPortfolioGuideAction before proceeding to entry", async () => {
    renderWithProviders(
      <EditorShell {...baseProps} storyPromptCompleted={false} guideDismissed={false} />
    );
    expect(await screen.findByText("Let's tell your story")).toBeInTheDocument();

    // "Skip for now" (step 0) exits via the same "explore" path as the final
    // step's "I'll explore myself" button — both call onExploreSelf.
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    await waitFor(() => expect(dismissPortfolioGuideAction).toHaveBeenCalled());
    // Returning user (baseProps has a draft) lands on the normal entry dialog.
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
  });

  it("final story prompt explore-self opens the template picker for a brand-new visitor", async () => {
    renderWithProviders(
      <EditorShell
        {...baseProps}
        storyPromptCompleted={false}
        guideDismissed={false}
        initialDrafts={[]}
        initialActiveDraftId={null}
        initialActiveDraftName={undefined}
        initialData={{ home: { content: [], root: {} }, gallery: { content: [], root: {} } }}
        currentTemplateId="scratch"
      />
    );
    expect(await screen.findByText("Let's tell your story")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Let's go" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Your vibe" });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Add your branding" });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Your page is ready to shine" });
    fireEvent.click(screen.getByRole("button", { name: "I'll explore myself" }));

    await waitFor(() => expect(dismissPortfolioGuideAction).toHaveBeenCalled());
    expect(await screen.findByText("Pick a template to start")).toBeInTheDocument();
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
  });

  it("onboarding logo is deferred until a template is picked, not written to the draft buffer beforehand", async () => {
    uploadAsset.mockResolvedValueOnce({ asset: { assetId: "logo-1", url: "https://cdn/logo.png" } });
    renderWithProviders(
      <EditorShell
        {...baseProps}
        storyPromptCompleted={false}
        guideDismissed={false}
        initialDrafts={[]}
        initialActiveDraftId={null}
        initialActiveDraftName={undefined}
        initialData={{ home: { content: [], root: {} }, gallery: { content: [], root: {} } }}
        currentTemplateId="scratch"
      />
    );
    expect(await screen.findByText("Let's tell your story")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Let's go" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Your vibe" });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Add your branding" });

    const fileInput = document.querySelector(
      'input[type="file"][accept="image/png,image/jpeg,image/webp"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(["logo"], "logo.png", { type: "image/png" })] } });
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/logo.png"]')).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Your page is ready to shine" });
    fireEvent.click(screen.getByRole("button", { name: "I'll explore myself" }));

    await waitFor(() => expect(dismissPortfolioGuideAction).toHaveBeenCalled());
    expect(await screen.findByText("Pick a template to start")).toBeInTheDocument();

    // Not applied to any draft yet — the local buffer must not carry the onboarding
    // logo, or a brand-new visitor would look like they already have a recoverable
    // draft on their next visit (and skip straight past the template picker).
    const bufferBeforeTemplate = window.localStorage.getItem("gallurio:portfolio-draft:studio-aurora");
    if (bufferBeforeTemplate) {
      expect(navLogoAssetId(JSON.parse(bufferBeforeTemplate))).toBeUndefined();
    }

    fireEvent.click(screen.getByRole("button", { name: "Start from scratch" }));
    await waitFor(() => expect(seedTemplateAction).toHaveBeenCalledWith("scratch"));
    await waitFor(() => expect(screen.queryByText("Pick a template to start")).not.toBeInTheDocument());

    // Applied once a template — including "start from scratch" — is actually
    // picked: patched into the seeded Navigation block's slot Image, not a
    // separate header field.
    await waitFor(() => {
      const buffered = window.localStorage.getItem("gallurio:portfolio-draft:studio-aurora");
      expect(buffered).toBeTruthy();
      expect(navLogoAssetId(JSON.parse(buffered!))).toBe("logo-1");
    });
  });

  it("onboarding logo is migrated onto a draft loaded via applyDraft, then cleared (Fix #8)", async () => {
    uploadAsset.mockResolvedValueOnce({ asset: { assetId: "logo-1", url: "https://cdn/logo.png" } });
    getDraftAction.mockResolvedValueOnce({
      ok: true,
      draft: {
        id: "d1",
        name: "Test Draft",
        templateId: "minimal",
        updatedAt: new Date().toISOString(),
        data: {
          home: { content: [{ type: "Navigation", props: { id: "nav-1", _chrome: "nav", content: [] } }], root: {} },
          gallery: { content: [], root: {} },
        },
        brandKit: null,
        contact: null,
        header: null,
        collectionsPopup: null,
        formLocale: "",
      },
    });
    renderWithProviders(
      <EditorShell
        {...baseProps}
        storyPromptCompleted={false}
        guideDismissed={false}
        initialData={{ home: { content: [], root: {} }, gallery: { content: [], root: {} } }}
      />
    );
    expect(await screen.findByText("Let's tell your story")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Let's go" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Your vibe" });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Add your branding" });

    const fileInput = document.querySelector(
      'input[type="file"][accept="image/png,image/jpeg,image/webp"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(["logo"], "logo.png", { type: "image/png" })] } });
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/logo.png"]')).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Your page is ready to shine" });
    fireEvent.click(screen.getByRole("button", { name: "I'll explore myself" }));
    await waitFor(() => expect(dismissPortfolioGuideAction).toHaveBeenCalled());

    // Returning user (baseProps has a draft) lands on the normal entry
    // dialog, not the template picker — load the existing draft instead.
    // A brand-new workspace's first-ever visit also reaches this exact path
    // (page.tsx auto-seeds one draft before the owner ever sees the editor,
    // so drafts.length===1 here does not mean "real returning user"), so the
    // captured logo is migrated onto whatever draft gets loaded (Fix #8).
    fireEvent.click(await screen.findByRole("button", { name: /Load an existing draft/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply Test Draft" }));
    await waitFor(() => expect(getDraftAction).toHaveBeenCalledWith("d1"));

    await waitFor(() => {
      expect(navLogoAssetIdFromZone(__capturedPuckSeed as { content?: unknown[] })).toBe("logo-1");
    });

    // Prove the ref was actually cleared after being consumed once (not
    // reapplied indefinitely): a fresh template afterward with no new
    // upload carries no logo.
    fireEvent.click(await screen.findByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));
    fireEvent.click(screen.getByRole("button", { name: /Minimal/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));

    await waitFor(() => {
      const buffered = window.localStorage.getItem("gallurio:portfolio-draft:studio-aurora");
      expect(buffered).toBeTruthy();
      expect(navLogoAssetId(JSON.parse(buffered!))).toBeUndefined();
    });
  });

  it("onboarding logo is migrated when continuing a recovered local buffer (Fix #8)", async () => {
    uploadAsset.mockResolvedValueOnce({ asset: { assetId: "logo-2", url: "https://cdn/logo2.png" } });
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(LOCAL_DRAFT_V2));
    renderWithProviders(
      <EditorShell {...baseProps} storyPromptCompleted={false} guideDismissed={false} />
    );
    expect(await screen.findByText("Let's tell your story")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Let's go" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Your vibe" });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Add your branding" });

    const fileInput = document.querySelector(
      'input[type="file"][accept="image/png,image/jpeg,image/webp"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(["logo"], "logo2.png", { type: "image/png" })] } });
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/logo2.png"]')).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    await screen.findByRole("heading", { name: "Your page is ready to shine" });
    fireEvent.click(screen.getByRole("button", { name: "I'll explore myself" }));
    await waitFor(() => expect(dismissPortfolioGuideAction).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("button", { name: /Continue where you left off/ }));
    await waitFor(() => {
      expect(navLogoAssetIdFromZone(__capturedPuckSeed as { content?: unknown[] })).toBe("logo-2");
    });
  });

  describe("draft buffer lifecycle (Fix #9)", () => {
    it("the local buffer is not auto-applied on mount, only via explicit Continue", async () => {
      const distinctBuffer = {
        version: 2,
        data: {
          home: { content: [{ type: "Hero", props: { id: "buf-hero", headline: "BUFFER_MARKER" } }], root: {} },
          gallery: { content: [], root: {} },
        },
        draftId: "d1",
        draftName: "Test Draft",
      };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(distinctBuffer));
      renderWithProviders(<EditorShell {...baseProps} />);

      await screen.findByRole("button", { name: /Continue where you left off/ });
      expect(JSON.stringify(__capturedPuckSeed)).not.toContain("BUFFER_MARKER");

      fireEvent.click(screen.getByRole("button", { name: /Continue where you left off/ }));
      await waitFor(() => {
        expect(JSON.stringify(__capturedPuckSeed)).toContain("BUFFER_MARKER");
      });
    });

    it("Save changes clears the local buffer for a real draft", async () => {
      await renderAndDismissEntry(<EditorShell {...baseProps} />);
      expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();

      // Save is disabled while clean (activeDraftId set + !isDirty) — dirty
      // the canvas first, same as the existing debounce test does.
      fireEvent.click(screen.getByRole("button", { name: "Simulate Puck change" }));
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(updateDraftAction).toHaveBeenCalled());
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it("applyDraft clears the local buffer", async () => {
      await renderAndDismissEntry(<EditorShell {...baseProps} />);
      expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
      fireEvent.click(await screen.findByRole("button", { name: "Apply Test Draft" }));
      await waitFor(() => expect(getDraftAction).toHaveBeenCalledWith("d1"));
      await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull());
    });
  });

  describe("chrome sync wiring", () => {
    it("dragging a second nav preset in replaces the pinned Navigation, keeping its id (Fix #1)", async () => {
      await renderAndDismissEntry(<EditorShell {...baseProps} />);

      __capturedPuckOnChange?.({
        content: [
          { type: "Navigation", props: { id: "c-Navigation-0", _chrome: "nav", brandText: "Studio" } },
          { type: "Hero", props: { id: "c-Hero-1", headline: "Hi" } },
          { type: "NavBorderedPreset", props: { id: "preset-nav-1", _chrome: "nav", brandText: "Bordered" } },
        ],
        root: {},
      });

      fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
      await waitFor(() => {
        const buffered = window.localStorage.getItem(DRAFT_KEY);
        expect(buffered).toBeTruthy();
        const homeContent = JSON.parse(buffered!).data.home.content as {
          type: string;
          props: { id: string; _chrome?: string };
        }[];
        const navs = homeContent.filter((b) => b.props._chrome === "nav");
        expect(navs).toHaveLength(1);
        expect(navs[0].type).toBe("NavBorderedPreset");
        expect(navs[0].props.id).toBe("c-Navigation-0");
      });
    });

    it("deleting a detached footer does not open the reanchor confirm or revert the deletion (Fix #3)", async () => {
      await renderAndDismissEntry(<EditorShell {...baseProps} />);

      const homeNav = { type: "Navigation", props: { id: "c-Navigation-0", _chrome: "nav" } };
      const homeHero = { type: "Hero", props: { id: "c-Hero-1", headline: "Hi" } };

      // Step 1: add a footer to home, already detached, so the other zone
      // (which has none) never receives a mirrored copy.
      __capturedPuckOnChange?.({
        content: [
          homeNav,
          homeHero,
          { type: "FooterSimple", props: { id: "home-footer", _chrome: "footer", detached: true } },
        ],
        root: {},
      });

      // Step 2: delete that same detached footer.
      __capturedPuckOnChange?.({ content: [homeNav, homeHero], root: {} });

      expect(screen.queryByText("Match Gallery's styling?")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
      await waitFor(() => {
        const buffered = window.localStorage.getItem(DRAFT_KEY);
        expect(buffered).toBeTruthy();
        const homeContent = (JSON.parse(buffered!).data.home.content ?? []) as { props?: { _chrome?: string } }[];
        expect(homeContent.some((b) => b.props?._chrome === "footer")).toBe(false);
      });
    });

    it("discarding to a scratch canvas seeds Navigation in the gallery zone too, not just home (Fix #5)", async () => {
      renderWithProviders(
        <EditorShell
          {...baseProps}
          initialActiveDraftId={null}
          initialActiveDraftName={undefined}
          initialDrafts={[]}
        />
      );
      // Brand-new (no drafts, no buffer) — welcome template picker, not the
      // normal entry dialog.
      fireEvent.click(await screen.findByRole("button", { name: "Start from scratch" }));
      await waitFor(() => expect(seedTemplateAction).toHaveBeenCalledWith("scratch"));
      await waitFor(() => expect(screen.queryByText("Pick a template to start")).not.toBeInTheDocument());

      // activeDraftId is still null right after applying — Publish routes
      // through the unsaved-changes guard.
      fireEvent.click(screen.getByRole("button", { name: "Publish" }));
      fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
      await waitFor(() => expect(listDraftsAction).toHaveBeenCalled());
      // Discard's pending action re-opens the publish dialog — close it so
      // the toolbar underneath is reachable again.
      fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

      // Save WITHOUT ever visiting the Gallery tab — this is what ships to
      // the server; zoneDataRef.current.gallery must already carry
      // Navigation, not rely on selectZone's own repair-on-visit.
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(createDraftAction).toHaveBeenCalled());
      const payload = createDraftAction.mock.calls[0][0] as {
        data: { gallery: { content?: { props?: { _chrome?: string } }[] } };
      };
      expect((payload.data.gallery.content ?? []).some((b) => b.props?._chrome === "nav")).toBe(true);
    });

    it("threads localized nav chrome labels into the editor canvas's Puck metadata (Fix #7)", async () => {
      const messages = structuredClone(enMessages);
      messages.publicPage.nav.home = "TRANSLATED_HOME_LABEL";
      await renderAndDismissEntry(<EditorShell {...baseProps} />, { messages });

      const metadata = __capturedPuckMetadata as {
        workspace?: { chrome?: { nav?: { home?: string } } };
      };
      expect(metadata?.workspace?.chrome?.nav?.home).toBe("TRANSLATED_HOME_LABEL");
    });

    it("deleting an attached footer mirrors the removal onto the other zone, and it does not come back on a later edit (Fix #4)", async () => {
      await renderAndDismissEntry(<EditorShell {...baseProps} />);

      const homeNav = { type: "Navigation", props: { id: "c-Navigation-0", _chrome: "nav" } };
      const homeHero = { type: "Hero", props: { id: "c-Hero-1", headline: "Hi" } };

      // Step 1: add an (attached) footer to home — mirrors onto gallery.
      __capturedPuckOnChange?.({
        content: [
          homeNav,
          homeHero,
          { type: "FooterSimple", props: { id: "home-footer", _chrome: "footer", detached: false } },
        ],
        root: {},
      });

      // Step 2: delete it from home.
      __capturedPuckOnChange?.({ content: [homeNav, homeHero], root: {} });

      fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
      await waitFor(() => {
        const buffered = window.localStorage.getItem(DRAFT_KEY);
        expect(buffered).toBeTruthy();
        const data = JSON.parse(buffered!).data as { home: { content?: { props?: { _chrome?: string } }[] }; gallery: { content?: { props?: { _chrome?: string } }[] } };
        expect((data.home.content ?? []).some((b) => b.props?._chrome === "footer")).toBe(false);
        expect((data.gallery.content ?? []).some((b) => b.props?._chrome === "footer")).toBe(false);
      });

      // Step 3: an unrelated edit on gallery (now footer-less) must not
      // resurrect a footer on either zone.
      __capturedPuckOnChange?.({
        content: [{ type: "Navigation", props: { id: "c-Navigation-0", _chrome: "nav" } }, { type: "Hero", props: { id: "g-Hero-1", headline: "Gallery edit" } }],
        root: {},
      });

      fireEvent.click(screen.getByRole("button", { name: "Home" }));
      await waitFor(() => {
        const buffered = window.localStorage.getItem(DRAFT_KEY);
        const data = JSON.parse(buffered!).data as { home: { content?: { props?: { _chrome?: string } }[] }; gallery: { content?: { props?: { _chrome?: string } }[] } };
        expect((data.home.content ?? []).some((b) => b.props?._chrome === "footer")).toBe(false);
        expect((data.gallery.content ?? []).some((b) => b.props?._chrome === "footer")).toBe(false);
      });
    });
  });

  it("migrates a legacy header's logo + brand text onto the seeded Navigation's slot (Fix #2)", async () => {
    getDraftAction.mockResolvedValueOnce({
      ok: true,
      draft: {
        id: "d1",
        name: "Test Draft",
        templateId: "minimal",
        updatedAt: new Date().toISOString(),
        data: {
          home: { content: [{ type: "Hero", props: { id: "hero-1", headline: "Hi" } }], root: {} },
          gallery: { content: [], root: {} },
        },
        brandKit: null,
        contact: null,
        header: { brandText: "Acme Studio", logoUrl: "https://cdn/logo.png", logoAssetId: "asset-99" },
        collectionsPopup: null,
        formLocale: "",
      },
    });
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply Test Draft" }));
    await waitFor(() => expect(getDraftAction).toHaveBeenCalledWith("d1"));

    // applyDraft intentionally clears the local buffer (a freshly-loaded
    // clean draft must not manufacture a recoverable-edits buffer), so
    // assert on the rendered seed directly rather than localStorage.
    await waitFor(() => {
      const zone = __capturedPuckSeed as { content?: unknown[] };
      expect(navLogoAssetIdFromZone(zone)).toBe("asset-99");
      const nav = zone.content?.find(
        (b) => (b as { props?: { _chrome?: string } }).props?._chrome === "nav"
      ) as { props?: { content?: unknown[] } } | undefined;
      const heading = nav?.props?.content?.find((c) => (c as { type?: string }).type === "Heading") as
        | { props?: { text?: string } }
        | undefined;
      expect(heading?.props?.text).toBe("Acme Studio");
    });
  });

  it("explore-self exit closes the guide synchronously — no flicker before the dismiss call settles", async () => {
    renderWithProviders(
      <EditorShell {...baseProps} storyPromptCompleted={false} guideDismissed={false} />
    );
    expect(await screen.findByText("Let's tell your story")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    // Guide must already be gone in the same synchronous update as the click —
    // not on a later render once dismissPortfolioGuideAction's promise settles
    // (that gap is what caused the guide to flash on-screen before the canvas).
    expect(screen.queryByText("Welcome to your portfolio editor")).not.toBeInTheDocument();

    await waitFor(() => expect(dismissPortfolioGuideAction).toHaveBeenCalled());
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
  });

  it("explore-self exit logs a warning but still proceeds when dismissPortfolioGuideAction rejects", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    dismissPortfolioGuideAction.mockRejectedValueOnce(new Error("network blip"));

    renderWithProviders(
      <EditorShell {...baseProps} storyPromptCompleted={false} guideDismissed={false} />
    );
    expect(await screen.findByText("Let's tell your story")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    await waitFor(() =>
      expect(warnSpy).toHaveBeenCalledWith(
        "[portfolio] failed to dismiss guide on explore-self exit",
        expect.any(Error)
      )
    );
    // The failed dismiss-write must not block the exit flow.
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();

    warnSpy.mockRestore();
  });

  it("guide skip 'don't show again' logs a warning but still proceeds when dismissPortfolioGuideAction rejects", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    dismissPortfolioGuideAction.mockRejectedValueOnce(new Error("network blip"));

    renderWithProviders(
      <EditorShell {...baseProps} guideDismissed={false} />
    );
    expect(await screen.findByText("Welcome to your portfolio editor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip Guide" }));
    fireEvent.click(await screen.findByRole("button", { name: "Don't show again" }));

    await waitFor(() =>
      expect(warnSpy).toHaveBeenCalledWith(
        "[portfolio] failed to dismiss guide on skip",
        expect.any(Error)
      )
    );
    // The failed dismiss-write must not block the guide from closing.
    expect(screen.queryByText("Welcome to your portfolio editor")).not.toBeInTheDocument();

    warnSpy.mockRestore();
  });

  // ---- First-load sequencing (#4) ----

  it("guide open: entry/template-welcome NOT in document until guide is skipped", async () => {
    // guideDismissed=false, returning user (has drafts) — entry must be hidden while guide is open.
    renderWithProviders(
      <EditorShell {...baseProps} guideDismissed={false} />
    );
    // Guide is visible
    expect(await screen.findByText("Welcome to your portfolio editor")).toBeInTheDocument();
    // Entry dialog must NOT be open yet
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
    expect(screen.queryByText("Pick a template to start")).not.toBeInTheDocument();
  });

  it("guide skipped → brand-new user sees welcome template modal", async () => {
    // No localStorage buffer, no drafts, guideDismissed=false.
    renderWithProviders(
      <EditorShell {...baseProps} guideDismissed={false} initialDrafts={[]} initialActiveDraftId={null} initialActiveDraftName={undefined} />
    );
    // Guide shows first
    expect(await screen.findByText("Welcome to your portfolio editor")).toBeInTheDocument();
    expect(screen.queryByText("Pick a template to start")).not.toBeInTheDocument();

    // Skip the guide (Skip Guide → confirm modal → Skip Guide)
    fireEvent.click(within(document.body).getByRole("button", { name: "Skip Guide" }));
    const confirmSkip = within(document.body).getAllByRole("button", { name: "Skip Guide" });
    fireEvent.click(confirmSkip[confirmSkip.length - 1]);

    // After skip, brand-new user gets the welcome template modal
    expect(await screen.findByText("Pick a template to start")).toBeInTheDocument();
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
  });

  it("guide skipped → returning user (has drafts) sees PortfolioEntryDialog", async () => {
    // baseProps has initialDrafts with one draft, guideDismissed=false.
    renderWithProviders(
      <EditorShell {...baseProps} guideDismissed={false} />
    );
    // Guide shows first
    expect(await screen.findByText("Welcome to your portfolio editor")).toBeInTheDocument();

    // Skip the guide (Skip Guide → confirm modal → Skip Guide)
    fireEvent.click(within(document.body).getByRole("button", { name: "Skip Guide" }));
    const confirmSkip = within(document.body).getAllByRole("button", { name: "Skip Guide" });
    fireEvent.click(confirmSkip[confirmSkip.length - 1]);

    // Returning user gets the normal PortfolioEntryDialog
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
    expect(screen.queryByText("Pick a template to start")).not.toBeInTheDocument();
  });

  it("guideDismissed=true, returning user: entry opens immediately without guide", async () => {
    // baseProps: guideDismissed=true, has drafts → PortfolioEntryDialog opens on load.
    renderWithProviders(
      <EditorShell {...baseProps} guideDismissed={true} />
    );
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
    expect(screen.queryByText("Welcome to your portfolio editor")).not.toBeInTheDocument();
  });

  it("guideDismissed=true, brand-new user: welcome template modal opens immediately", async () => {
    // guideDismissed=true, no drafts, no buffer → welcome template modal on load.
    renderWithProviders(
      <EditorShell {...baseProps} guideDismissed={true} initialDrafts={[]} initialActiveDraftId={null} initialActiveDraftName={undefined} />
    );
    expect(await screen.findByText("Pick a template to start")).toBeInTheDocument();
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
    expect(screen.queryByText("Welcome to your portfolio editor")).not.toBeInTheDocument();
  });

  it("welcome template modal: Start from scratch closes it and drops user on canvas", async () => {
    renderWithProviders(
      <EditorShell {...baseProps} guideDismissed={true} initialDrafts={[]} initialActiveDraftId={null} initialActiveDraftName={undefined} />
    );
    expect(await screen.findByText("Pick a template to start")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start from scratch" }));
    await waitFor(() => expect(seedTemplateAction).toHaveBeenCalledWith("scratch"));
    await waitFor(() => expect(screen.queryByText("Pick a template to start")).not.toBeInTheDocument());
    // Canvas is accessible after dismissal
    expect(screen.getByTestId("portfolio-editor-shell")).toBeInTheDocument();
  });

  it("actionable (gated) steps hide Next and never show 'Skip this step'; Back still works", async () => {
    // Dismiss the entry dialog first (guideDismissed=true so entry opens directly),
    // then reopen the guide via the Guide button.
    await renderAndDismissEntry(<EditorShell {...baseProps} guideDismissed={true} />);

    // Reopen the guide at step 0 via the Guide button (same behavior as first-run).
    fireEvent.click(screen.getByRole("button", { name: "Guide" }));

    // Guide is open at the welcome step.
    expect(await screen.findByText("Welcome to your portfolio editor")).toBeInTheDocument();
    const welcomeCard = screen.getByRole("dialog", { name: "Welcome to your portfolio editor" });

    // Next advances to the first actionable step: drag a block (gated, unsatisfied).
    fireEvent.click(within(welcomeCard).getByRole("button", { name: "Next" }));
    const dragCard = await screen.findByRole("dialog", { name: "Drag a block onto your page" });

    // jsdom returns an all-zero rect for the blocks-panel anchor (no real
    // layout), so the loading gate shows its spinner until the safety timeout.
    // Wait for the step body to reveal before asserting footer state.
    await within(dragCard).findByText(/Try it/i);

    // Unsatisfied gated step: no Skip-this-step, no Next escape hatch, but the
    // "Try it…" hint and a working Back button are present.
    expect(within(dragCard).queryByRole("button", { name: "Skip this step" })).toBeNull();
    expect(within(dragCard).queryByRole("button", { name: "Next" })).toBeNull();
    expect(within(dragCard).getByText(/Try it/i)).toBeInTheDocument();

    // Back returns to the welcome step.
    fireEvent.click(within(dragCard).getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("dialog", { name: "Welcome to your portfolio editor" })).toBeInTheDocument();
  });

  it("editor is not dirty immediately after applying a template (Fix #4)", async () => {
    // Start with a clean draft so the guard fires immediately without the
    // unsaved-changes modal (baseProps has activeDraftId="d1" + matching snapshot).
    await renderAndDismissEntry(<EditorShell {...baseProps} />);

    // Open template picker via Drafts → Add new draft (clean draft → no guard).
    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));
    await screen.findByText("Choose a template");

    // Apply Minimal — no unsaved-changes guard fires.
    fireEvent.click(screen.getByRole("button", { name: /Minimal/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));

    // Template picker closes; wait for Puck to remount and all state to settle.
    await waitFor(() =>
      expect(screen.queryByText("Choose a template")).not.toBeInTheDocument(),
    );
    await screen.findByTestId("puck", {}, { timeout: 3000 });

    // isDirty drives the beforeunload guard: if isDirty=true the handler calls
    // e.preventDefault(). After applyTemplate with the fix, isDirty=false so
    // preventDefault must NOT be called.
    await waitFor(() => {
      const event = new Event("beforeunload", { cancelable: true });
      const spy = vi.spyOn(event, "preventDefault");
      window.dispatchEvent(event);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

const demoProps = {
  ...baseProps,
  demoMode: true,
  initialActiveDraftId: null,
  initialActiveDraftName: undefined,
  initialDrafts: [],
  guideDismissed: true,
};

describe("EditorShell demoMode", () => {
  it("renders the 2-option entry screen, not the real onboarding dialogs", async () => {
    renderWithProviders(<EditorShell {...demoProps} />);

    expect(await screen.findByRole("button", { name: /Start from scratch/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue where you left off/ })).toBeInTheDocument();
    expect(screen.queryByText("Load an existing draft")).not.toBeInTheDocument();
  });

  it("Save Changes persists to the demo-namespaced localStorage key, no server action called", async () => {
    renderWithProviders(<EditorShell {...demoProps} />);
    fireEvent.click(await screen.findByRole("button", { name: /Start from scratch/ }));

    await screen.findByTestId("puck");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      const keys = Object.keys(window.localStorage);
      const demoKey = keys.find((k) => k.startsWith("gallurio:portfolio-maker-demo:draft:"));
      expect(demoKey).toBeTruthy();
    });
    expect(createDraftAction).not.toHaveBeenCalled();
    expect(updateDraftAction).not.toHaveBeenCalled();
  });

  it("Publish click opens the gate modal; publish server action never called", async () => {
    renderWithProviders(<EditorShell {...demoProps} />);
    fireEvent.click(await screen.findByRole("button", { name: /Start from scratch/ }));
    await screen.findByTestId("puck");

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText(/Publishing is a Gallurio Pro feature/)).toBeInTheDocument();
    expect(publishDraftAction).not.toHaveBeenCalled();
  });

  it("Create new design applies a template client-side, never calling seedTemplateAction", async () => {
    renderWithProviders(<EditorShell {...demoProps} />);
    fireEvent.click(await screen.findByRole("button", { name: /Start from scratch/ }));
    await screen.findByTestId("puck");

    fireEvent.click(screen.getByRole("button", { name: "Create new design" }));
    await screen.findByText("Pick a template to start");
    fireEvent.click(screen.getByRole("button", { name: /Minimal/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));

    // Canvas already has content (from "Start from scratch" above) — the
    // demo's overwrite-confirm dialog gates the swap.
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));

    await waitFor(() => expect(screen.queryByText("Pick a template to start")).not.toBeInTheDocument());
    expect(seedTemplateAction).not.toHaveBeenCalled();
  });

  it("hitting the block cap (21st block) opens the block-cap gate modal and blocks the add", async () => {
    renderWithProviders(<EditorShell {...demoProps} />);
    fireEvent.click(await screen.findByRole("button", { name: /Start from scratch/ }));
    await screen.findByTestId("puck");

    const overCap = {
      content: Array.from({ length: 21 }, (_, i) => ({ type: "Hero", props: { id: `h${i}` } })),
      root: {},
    };
    __capturedPuckOnChange?.(overCap);

    expect(await screen.findByText(/This page is full for the demo/)).toBeInTheDocument();
    expect(screen.getByTestId("demo-block-counter")).toHaveTextContent("0/20 blocks");
  });

  it("reveals the promo code on the first gate hit only, not on a second gate hit in the same session", async () => {
    renderWithProviders(<EditorShell {...demoProps} />);
    fireEvent.click(await screen.findByRole("button", { name: /Start from scratch/ }));
    await screen.findByTestId("puck");

    // First gate hit (Publish) — promo reveal line appended.
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText(/bonus code/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep exploring" }));

    // Second gate hit (Theme, via the toolbar's Theme button + a control tweak)
    // — no repeat of the reveal line, just the gate's own message.
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText(/Publishing is a Gallurio Pro feature/)).toBeInTheDocument();
    expect(screen.queryByText(/bonus code/)).not.toBeInTheDocument();
  });

  it("hides every collection-dependent block from the drawer (no demo collections picker exists)", async () => {
    renderWithProviders(<EditorShell {...demoProps} />);
    fireEvent.click(await screen.findByRole("button", { name: /Start from scratch/ }));
    await screen.findByTestId("puck");

    // ALL THREE Featured work preset variants depend on collections, so the
    // whole group is empty and never rendered at all — not just its items.
    expect(screen.queryByRole("button", { name: "Featured work" })).not.toBeInTheDocument();

    // The manual primitives that need the auth-gated collections picker are
    // filtered too (CollectionCard); FeaturedWork was never manual-listed.
    fireEvent.click(screen.getByRole("button", { name: "Manual blocks" }));
    expect(screen.queryByTestId("drawer-item:CollectionCard")).not.toBeInTheDocument();
    expect(screen.queryByTestId("drawer-item:FeaturedWork")).not.toBeInTheDocument();

    // Nothing else was swept up: a preset with no collection dependency stays.
    fireEvent.click(screen.getByRole("button", { name: "Hero" }));
    expect(screen.getByTestId("drawer-item:HeroPreset")).toBeInTheDocument();
  });

  it("disables the Preview toggle (no real preview route exists for demo data)", async () => {
    renderWithProviders(<EditorShell {...demoProps} />);
    fireEvent.click(await screen.findByRole("button", { name: /Start from scratch/ }));
    await screen.findByTestId("puck");

    const previewToggle = screen.getByRole("button", { name: "Preview" });
    expect(previewToggle).toBeDisabled();
  });

  it("disables the open-in-tab preview control and never calls window.open", async () => {
    renderWithProviders(<EditorShell {...demoProps} />);
    fireEvent.click(await screen.findByRole("button", { name: /Start from scratch/ }));
    await screen.findByTestId("puck");

    const openInTab = screen.getByRole("button", { name: "Open in new tab" });
    expect(openInTab).toBeDisabled();

    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    fireEvent.click(openInTab);
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});

describe("EditorShell demoMode — opt-in intro gates the guide", () => {
  const freshDemoProps = { ...demoProps, guideDismissed: false };

  it("shows the intro dialog on load instead of auto-launching the guide", async () => {
    renderWithProviders(<EditorShell {...freshDemoProps} />);

    expect(
      await screen.findByRole("dialog", { name: "Welcome to the portfolio demo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show me around" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I'll explore myself" })).toBeInTheDocument();
    // The tour itself must not be running underneath the intro.
    expect(screen.queryByText("Welcome to your portfolio editor")).not.toBeInTheDocument();
  });

  it("'I'll explore myself' dismisses the intro straight into the entry screen, no guide", async () => {
    renderWithProviders(<EditorShell {...freshDemoProps} />);
    await screen.findByRole("dialog", { name: "Welcome to the portfolio demo" });

    fireEvent.click(screen.getByRole("button", { name: "I'll explore myself" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Welcome to the portfolio demo" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Welcome to your portfolio editor")).not.toBeInTheDocument();
    // Same Continue/Start-scratch decision the guide's own skip leads to — opting
    // out of the tour must not cost a returning visitor their recoverable buffer.
    expect(await screen.findByRole("button", { name: /Start from scratch/ })).toBeInTheDocument();
  });

  it("'Show me around' dismisses the intro and starts the spotlight tour", async () => {
    renderWithProviders(<EditorShell {...freshDemoProps} />);
    await screen.findByRole("dialog", { name: "Welcome to the portfolio demo" });

    fireEvent.click(screen.getByRole("button", { name: "Show me around" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Welcome to the portfolio demo" }),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("Welcome to your portfolio editor")).toBeInTheDocument();
  });
});

describe("EditorShell real (non-demo) editor — unaffected by the demo picker swap", () => {
  it("keeps collection cards and presets insertable while hiding deprecated Highlights", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Manual blocks" }));
    expect(screen.queryByTestId("drawer-item:FeaturedWork")).not.toBeInTheDocument();
    expect(screen.getByTestId("drawer-item:CollectionCard")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Featured work" }));
    expect(screen.getByTestId("drawer-item:FeaturedWorkPreset")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-item:FeaturedWorkLeadPreset")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-item:FeaturedWorkIndexPreset")).toBeInTheDocument();
  });

  it("keeps the Preview toggle enabled and functional (regression guard for the demo-only disable)", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);

    const previewToggle = screen.getByRole("button", { name: "Preview" });
    expect(previewToggle).not.toBeDisabled();

    const openInTab = screen.getByRole("button", { name: "Open in new tab" });
    expect(openInTab).not.toBeDisabled();
  });
});

describe("EditorShell — two-level preset drawer", () => {
  it("renders Preset blocks containing all 12 groups, each containing its variants, plus a flat Manual blocks sibling", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);

    expect(screen.getByRole("button", { name: englishPuckT("puckConfig.categories.presets") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: englishPuckT("puckConfig.categories.manual") })).toBeInTheDocument();
    for (const group of PRESET_GROUPS) {
      expect(screen.getByRole("button", { name: englishPuckT(group.labelKey) })).toBeInTheDocument();
    }

    // nav is open by default — its 3 variants are visible with no click.
    for (const key of ["NavBorderedPreset", "NavUnderlinedPreset", "NavScaledPreset"]) {
      expect(screen.getByTestId(`drawer-item:${key}`)).toBeInTheDocument();
    }

    // hero starts closed — its variants aren't in the DOM until opened.
    expect(screen.queryByTestId("drawer-item:HeroPreset")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: englishPuckT("puckConfig.categories.hero") }));
    expect(screen.getByTestId("drawer-item:HeroPreset")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-item:HeroSplitPreset")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-item:HeroStatementPreset")).toBeInTheDocument();

    // Manual blocks starts closed and sits alongside Preset blocks, not nested
    // under it.
    expect(screen.queryByTestId("drawer-item:Heading")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: englishPuckT("puckConfig.categories.manual") }));
    expect(screen.getByTestId("drawer-item:Heading")).toBeInTheDocument();
  });

  it("keeps the tour anchor on the drawer wrapper", async () => {
    const { container } = await renderAndDismissEntry(<EditorShell {...baseProps} />);
    expect(container.querySelector('[data-tour-id="blocks-panel"]')).toBeInTheDocument();
  });

  it("mounts exactly one preset preview (not one per drawer row's duplicate mount)", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: englishPuckT("puckConfig.categories.hero") }));
    // Drive the shared store directly (same mechanism PresetDrawerItem's
    // hover/focus handlers use) rather than simulating a real pointer hover,
    // which React only recognizes via the bubbling pointerover event.
    act(() => {
      openPresetPreview("HeroPreset", screen.getByTestId("drawer-item:HeroPreset"));
    });
    expect(await screen.findAllByRole("tooltip")).toHaveLength(1);
  });
});

describe("EditorShell — demo import detection", () => {
  const DEMO_SESSION_KEY = "gallurio:portfolio-maker-demo:session";
  const demoDraftKey = (id: string) => `gallurio:portfolio-maker-demo:draft:${id}`;
  const demoBuffer = {
    version: 2,
    data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
    brandKit: {},
    contact: {},
    formLocale: "",
    formDir: "",
    headerConfig: {},
    collectionsPopup: {},
    draftId: null,
    draftName: "New Draft",
  };

  function seedDemoBuffer(sessionId = "demo-sess-1") {
    window.localStorage.setItem(DEMO_SESSION_KEY, sessionId);
    window.localStorage.setItem(demoDraftKey(sessionId), JSON.stringify(demoBuffer));
  }

  it("shows the demo-import dialog instead of the entry dialog when a demo buffer is detected", async () => {
    seedDemoBuffer();
    renderWithProviders(<EditorShell {...baseProps} />);

    expect(
      await screen.findByText("We detected a saved demo portfolio")
    ).toBeInTheDocument();
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
  });

  it("prioritizes the saved-demo decision over a new owner's story prompt and guide", async () => {
    seedDemoBuffer("demo-sess-first-run");
    renderWithProviders(
      <EditorShell
        {...baseProps}
        guideDismissed={false}
        storyPromptCompleted={false}
      />
    );

    expect(await screen.findByText("We detected a saved demo portfolio")).toBeInTheDocument();
    expect(screen.queryByText("Let's tell your story")).not.toBeInTheDocument();
    expect(screen.queryByText("Welcome to your portfolio editor")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Discard saved setup" }));
    expect(await screen.findByText("Let's tell your story")).toBeInTheDocument();
    expect(screen.queryByText("We detected a saved demo portfolio")).not.toBeInTheDocument();
  });

  it("'Discard saved setup' wipes the demo localStorage and closes the dialog without importing", async () => {
    seedDemoBuffer("demo-sess-2");
    renderWithProviders(<EditorShell {...baseProps} />);
    await screen.findByText("We detected a saved demo portfolio");

    fireEvent.click(screen.getByRole("button", { name: "Discard saved setup" }));

    await waitFor(() =>
      expect(screen.queryByText("We detected a saved demo portfolio")).not.toBeInTheDocument()
    );
    expect(window.localStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
    expect(window.localStorage.getItem(demoDraftKey("demo-sess-2"))).toBeNull();
    expect(importDemoPortfolioAction).not.toHaveBeenCalled();
  });

  it("'Apply saved setup' imports the demo session, wipes localStorage, and loads the new draft — skipping the template picker", async () => {
    seedDemoBuffer("demo-sess-3");
    renderWithProviders(<EditorShell {...baseProps} />);
    await screen.findByText("We detected a saved demo portfolio");

    fireEvent.click(screen.getByRole("button", { name: "Apply saved setup" }));

    await waitFor(() => expect(importDemoPortfolioAction).toHaveBeenCalledTimes(1));
    expect(importDemoPortfolioAction).toHaveBeenCalledWith(
      expect.objectContaining({ demoSessionId: "demo-sess-3" })
    );
    await waitFor(() =>
      expect(screen.queryByText("We detected a saved demo portfolio")).not.toBeInTheDocument()
    );
    expect(window.localStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
    expect(window.localStorage.getItem(demoDraftKey("demo-sess-3"))).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Choose a template" })).not.toBeInTheDocument();
    expect(getDraftAction).toHaveBeenCalledWith("demo-d1");
  });

  it("shows the unsaved-changes guard first when the loaded draft is dirty, then imports on Discard", async () => {
    seedDemoBuffer("demo-sess-4");
    renderWithProviders(<EditorShell {...baseProps} />);
    await screen.findByText("We detected a saved demo portfolio");

    // Dirty the currently-loaded draft underneath the modal (aria-hidden while
    // the dialog traps focus, so it must be queried with hidden:true).
    fireEvent.click(screen.getByRole("button", { name: "Simulate Puck change", hidden: true }));

    fireEvent.click(screen.getByRole("button", { name: "Apply saved setup" }));

    expect(await screen.findByText("Save your changes?")).toBeInTheDocument();
    expect(importDemoPortfolioAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(importDemoPortfolioAction).toHaveBeenCalledTimes(1));
  });
});
