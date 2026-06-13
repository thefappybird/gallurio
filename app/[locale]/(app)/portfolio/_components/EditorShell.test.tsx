import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect, useState, type ReactNode, type ReactElement } from "react";
import { screen, fireEvent, within, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

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

vi.mock("@measured/puck", () => ({
  Puck: ({
    headerTitle,
    overrides,
    onPublish,
    onChange,
    data,
  }: {
    headerTitle?: string;
    overrides?: { header?: (p: { actions: ReactNode; children: ReactNode }) => ReactNode };
    onPublish?: () => void;
    onChange?: (data: unknown) => void;
    data?: unknown;
  }) => {
    // Simulate uncontrolled: capture data only on mount (via useState initializer).
    // Subsequent `data` prop changes are ignored — same as real Puck after mount.
    // Only a key change (remount) will re-initialize this seed.
    const [seed] = useState(() => data);

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
          actions: (
            <button type="button" onClick={onPublish}>
              PuckPublish
            </button>
          ),
          children: null,
        })}
      </div>
    );
  },
  usePuck: () => ({
    appState: {
      ui: {
        leftSideBarVisible: true,
        rightSideBarVisible: true,
        viewports: { current: { width: 1280, height: "auto" }, controlsVisible: true, options: [] },
      },
    },
    dispatch: vi.fn(),
  }),
}));

const dismissPortfolioGuideAction = vi.fn().mockResolvedValue({ ok: true });
const saveThemeAction = vi.fn().mockResolvedValue({ ok: true, theme: { id: "t1", name: "Test", brandKit: {} } });
const deleteThemeAction = vi.fn().mockResolvedValue({ ok: true });
const updateThemeAction = vi.fn().mockResolvedValue({ ok: true, theme: { id: "t1", name: "Test", brandKit: {} } });
vi.mock("../_actions", () => ({
  dismissPortfolioGuideAction: (...a: unknown[]) => dismissPortfolioGuideAction(...a),
  saveThemeAction: (...a: unknown[]) => saveThemeAction(...a),
  deleteThemeAction: (...a: unknown[]) => deleteThemeAction(...a),
  updateThemeAction: (...a: unknown[]) => updateThemeAction(...a),
}));

const createDraftAction = vi.fn().mockResolvedValue({ ok: true, draft: { id: "d1", name: "New Draft", templateId: "minimal", updatedAt: new Date().toISOString() } });
const updateDraftAction = vi.fn().mockResolvedValue({ ok: true, draft: { id: "d1", name: "New Draft", templateId: "minimal", updatedAt: new Date().toISOString() } });
const deleteDraftAction = vi.fn().mockResolvedValue({ ok: true });
const getDraftAction = vi.fn().mockResolvedValue({ ok: true, draft: { id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString(), data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } }, brandKit: null, contact: null, header: null, collectionsPopup: null, formLocale: "" } });
const publishDraftAction = vi.fn().mockResolvedValue({ ok: true });
const seedTemplateAction = vi.fn().mockResolvedValue({ ok: true, seed: { templateId: "minimal", data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } }, brandKit: DEFAULT_BRAND_KIT, contact: { title: "" } } });
vi.mock("../_draftActions", () => ({
  createDraftAction: (...a: unknown[]) => createDraftAction(...a),
  updateDraftAction: (...a: unknown[]) => updateDraftAction(...a),
  deleteDraftAction: (...a: unknown[]) => deleteDraftAction(...a),
  getDraftAction: (...a: unknown[]) => getDraftAction(...a),
  publishDraftAction: (...a: unknown[]) => publishDraftAction(...a),
  seedTemplateAction: (...a: unknown[]) => seedTemplateAction(...a),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { EditorShell } from "./EditorShell";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

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
  initialSavedThemes: [],
  // Provide an active draft so the editor starts in a clean (non-dirty) state.
  initialActiveDraftId: "d1",
  initialActiveDraftName: "Test Draft",
  initialDrafts: [{ id: "d1", name: "Test Draft", templateId: "minimal", updatedAt: new Date().toISOString() }],
};

// basePro alias mirrors the existing test usage pattern.
const basePro = baseProps;

/**
 * Seed localStorage so `hasRecoverableBuffer` is true, enabling the
 * "Continue where you left off" option in the entry dialog. Then render and
 * dismiss the entry dialog so toolbar controls are accessible.
 */
async function renderAndDismissEntry(ui: ReactElement) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(LOCAL_DRAFT_V2));
  const result = renderWithProviders(ui);
  // "Continue where you left off" is now enabled; clicking it closes the dialog
  // without opening any secondary dialog, keeping the test environment clean.
  const continueBtn = await screen.findByRole("button", { name: /Continue where you left off/ });
  fireEvent.click(continueBtn);
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  __puckMountCount = 0;
});

describe("EditorShell", () => {
  it("renders the editor with the workspace name + active zone in the title", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    expect(screen.getByTestId("puck-title")).toHaveTextContent("Studio Aurora · Home");
    expect(screen.getByTestId("portfolio-editor-shell")).toHaveClass("min-h-svh");
  });

  it("renders the zone switcher and switches the active zone", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
    expect(await screen.findByText("Studio Aurora · Gallery")).toBeInTheDocument();
  });

  it("places Navigation and Contact Form beside the page tabs", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const controls = screen.getByRole("group", { name: "Portfolio sections" });
    expect(within(controls).getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Gallery" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Collections Popup" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Navigation" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Contact Form" })).toBeInTheDocument();
  });

  it("opens the Collections Popup panel when the Collections Popup tab is clicked", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Collections Popup" }));
    expect(await screen.findByLabelText("Collections popup style")).toBeInTheDocument();
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collections Popup" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows a preview and swaps the right editor panel between header and contact settings", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact Form" }));
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Contact form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Navigation" }));
    expect(screen.queryByLabelText("Contact form")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Navigation")).toBeInTheDocument();
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    expect(screen.getByText("Studio Aurora")).toBeInTheDocument();
  });

  it("removes viewport buttons from edit mode but keeps sidebar toggles", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    expect(screen.getByRole("button", { name: "Toggle blocks panel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle properties panel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mobile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tablet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desktop" })).not.toBeInTheDocument();
  });

  it("opens the publish dialog when Puck's publish fires", async () => {
    await renderAndDismissEntry(<EditorShell {...basePro} />);
    expect(screen.queryByText("Publish your portfolio?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PuckPublish" }));
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
    expect(screen.queryByRole("button", { name: "Collections Popup" })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Collections Popup" }));
    expect(await screen.findByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("shows the collections popup preview on the canvas when the Collections Popup tab is opened", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Collections Popup" }));
    // Wait for the async openCollectionsPopup state update to settle.
    // The style panel (right rail) must be present.
    expect(await screen.findByLabelText("Collections popup style")).toBeInTheDocument();
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

  it("entry dialog shows on first render when no active draft", async () => {
    renderWithProviders(<EditorShell {...baseProps} initialActiveDraftId={null} initialActiveDraftName={undefined} initialDrafts={[]} />);
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
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
    expect(await screen.findByText("A draft with this name already exists")).toBeInTheDocument();
    expect(updateDraftAction).not.toHaveBeenCalled();
  });

  it("does not open the unsaved-changes modal when the name is invalid; shows the error instead", async () => {
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
    expect(screen.queryByText("Save your changes?")).not.toBeInTheDocument();
    expect(screen.getByText("A draft with this name already exists")).toBeInTheDocument();
  });

  it("styles Save changes with the brand variant and Preview with the secondary variant", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    expect(screen.getByRole("button", { name: "Save changes" }).className).toContain("bg-brand");
    expect(screen.getByRole("button", { name: /Preview/ }).className).toContain("bg-secondary");
  });

  it("renders the Preview button as a sibling of the section tabs inside one flex-wrap row", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const preview = screen.getByRole("button", { name: /Preview/ });
    const sectionGroup = screen.getByRole("group", { name: /sections/i });
    // Preview must share the section-tab group's flex container (no orphaned second line).
    expect(preview.parentElement).toBe(sectionGroup);
    expect(preview.parentElement?.className).toContain("flex-wrap");
  });

  it("renders the draft title in a full-width, order-first slot for small screens", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    const title = screen.getByTitle("Test Draft");
    const slot = title.closest('[data-testid="draft-title-slot"]');
    expect(slot).not.toBeNull();
    expect(slot!.className).toContain("basis-full");
    expect(slot!.className).toContain("order-first");
    expect(slot!.className).toContain("sm:basis-auto");
    expect(slot!.className).toContain("sm:order-last");
  });

  it("prompts to save unsaved changes when clicking Add new draft", async () => {
    await renderAndDismissEntry(<EditorShell {...baseProps} />);
    // Make the draft dirty via a rename to a unique, valid name.
    fireEvent.click(screen.getByRole("button", { name: "Rename draft" }));
    fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Renamed Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm name" }));

    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));

    expect(await screen.findByText("Save your changes?")).toBeInTheDocument();
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

    // Select the "Minimal" template card — opens the confirmation AlertDialog.
    // Card button accessible name includes label + description ("Minimal Clean").
    fireEvent.click(await screen.findByRole("button", { name: /Minimal/ }));

    // Snapshot mount count before the destructive apply so we can detect a remount.
    const mountCountBefore = __puckMountCount;

    // Confirm the switch in the AlertDialog.
    fireEvent.click(await screen.findByRole("button", { name: "Switch template" }));

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
});
