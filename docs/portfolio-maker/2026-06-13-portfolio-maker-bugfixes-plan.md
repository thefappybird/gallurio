# Portfolio Maker Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 12 portfolio-maker bugs across the editor shell, drafts/templates dialogs, responsive layout, app sidebar, and the public `/w/[orgSlug]` 500 regression.

**Architecture:** Almost all editor work is in-place edits to `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` and its sibling dialog components (client components, hardcoded-English chrome). Tests use Vitest + Testing Library via `test-utils/render.tsx` (`renderWithProviders`) and the existing `EditorShell.test.tsx` harness. The public 500 is a Next.js 16 RSC render regression fixed in `app/(public)/w/[orgSlug]/`.

**Tech Stack:** Next.js 16 App Router, React 19.2, Tailwind v4, `@measured/puck`, next-intl, Vitest, Testing Library, mongodb-memory-server.

**Spec:** `docs/portfolio-maker/2026-06-13-portfolio-maker-bugfixes-spec.md`

---

## Key facts discovered (read before starting)

- **`<Puck key={activeZone} data={puckSeed} … />`** (`EditorShell.tsx:892-893`). Puck is **uncontrolled** after mount — `setPuckSeed(...)` only takes effect when the `key` changes. Today the `key` is just `activeZone`, so re-seeds that don't change the zone (start-from-scratch / re-apply same zone) don't repaint until a tab switch. Fix = add a `seedNonce` to the key (Spec #1).
- **Editor chrome is English-only by design** (RELEASE-CHECKLIST §4f). `DraftsDialog`, `TemplatePickerDialog`, `UnsavedChangesDialog`, `DraftNameEditor` use local `const L = {…}` string objects, **not** next-intl. Items #2 and #3 therefore **do NOT touch the 4 locale files**. Only Spec #12 (public-facing) involves real i18n.
- **Button variants** (`components/ui/button.tsx:12-18`): `default` = primary (used by Publish), `brand` = `bg-brand`, `secondary` = `bg-secondary`. Decision: Save changes → `brand`, Preview → `secondary`, Publish stays `default`.
- **`isDirty`** (`EditorShell.tsx:348-351`) compares a JSON snapshot to `savedSnapshot`. **`saveDisabled`** is computed locally in `toolsCluster` (`EditorShell.tsx:831`) as `!isDirty && activeDraftId !== null`.
- **`drafts`** state (array of `{id, name, …}`) is available in `EditorShell`, so duplicate-name validation can be done **client-side** (no server round-trip) for Spec #7/#11.
- **`guardThenRun`** (`EditorShell.tsx:492-498`) gates risky actions behind the unsaved-changes modal. `onApply` and `applyTemplate` already route through it; `onAddNew` does **not**.
- Public render path: `app/(public)/w/[orgSlug]/{layout,page,gallery/page}.tsx`. No `error.tsx` exists anywhere under `app/(public)`. Middleware (`proxy.ts:48,133`) correctly allows `/w/` and skips next-intl for it. Request config: `lib/i18n/request.ts`.
- Test harness: `test-utils/render.tsx` → `renderWithProviders(ui, {messages?})` wraps in `NextIntlClientProvider` with `messages/en.json`. `EditorShell.test.tsx` defines `baseProps`, `DRAFT_KEY`, `LOCAL_DRAFT_V2`, and `renderAndDismissEntry(ui)` (renders then clicks "Continue where you left off"). `mongodb-memory-server` helpers live in `test-utils/mongo.ts` (replica set, used by integration tests like `app/api/bookings/route.test.ts`).

**Commit after every task.** Run `rtk vitest <file>` for the touched test, `rtk tsc`, and `rtk lint` before each commit.

---

## Task 1 (Spec #12): Public portfolio `/w/[orgSlug]` returns 500

**Files:**
- Investigate: `app/(public)/w/[orgSlug]/layout.tsx`, `page.tsx`, `gallery/page.tsx`, `lib/i18n/request.ts`, `lib/db/queries/publicPage.ts`, `lib/i18n/localeForCountry.ts`, `proxy.ts`
- Create: `app/(public)/error.tsx`
- Create test: `app/(public)/w/[orgSlug]/publicPage.regression.test.ts` (layer chosen after Step 1)
- Modify: the file the captured stack points to (decision tree in Step 3)

- [ ] **Step 1: Reproduce and capture the real stack trace**

This is a runtime RSC error; reproduce against a real build, not the dev overlay.

Run:
```bash
pnpm build
pnpm start
```
In another terminal, request a published workspace's public page (replace `<slug>` with a published workspace slug; seed one with `pnpm seed` if needed):
```bash
curl -i http://localhost:3000/w/<slug>
```
Read the **server terminal** output (not the browser) and copy the full stack trace into the task notes. Expected: a 500 with a concrete error — most likely one of:
- next-intl: `Couldn't find next-intl config` / "opts into dynamic rendering" (locale/request-config not established for the intl-skipped `/w/` route), **or**
- a `TypeError: Cannot read properties of undefined` dereferencing a `workspace.*` field in `layout.tsx`/`page.tsx`, **or**
- a Puck `<Render>` error on a block/config mismatch.

Do not proceed to the fix until the actual error string is captured.

- [ ] **Step 2: Add a public error boundary (defense in depth, independent of root cause)**

Create `app/(public)/error.tsx`:
```tsx
"use client";

import { useEffect } from "react";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in server/client logs so a single bad field can't silently 500.
    console.error("[public-portfolio] render error:", error);
  }, [error]);

  return (
    <main className="grid min-h-svh place-items-center p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium">This portfolio is temporarily unavailable.</p>
        <button
          type="button"
          onClick={reset}
          className="border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write the failing regression test at the layer the stack points to**

Pick the layer from Step 1's stack:

**(a) If next-intl / locale resolution** — test `resolvePublicChromeLocale` + that `getTranslations` resolves for every published-workspace locale. Create `app/(public)/w/[orgSlug]/publicPage.regression.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getTranslations } from "next-intl/server";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";

describe("public portfolio chrome locale", () => {
  it("resolves translations for a workspace whose country maps to each supported locale", async () => {
    for (const country of ["PH", "MY", "ID", "US"]) {
      const locale = resolvePublicChromeLocale({ country } as never);
      const t = await getTranslations({ locale, namespace: "publicPage.nav" });
      expect(t("home")).toBeTruthy();
    }
  });
});
```

**(b) If a `workspace.*` undefined dereference** — test `findPublishedWorkspaceBySlug` returns the dereferenced fields for a seeded published workspace (integration test using `test-utils/mongo.ts`):
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models/Workspace";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";

describe("findPublishedWorkspaceBySlug", () => {
  beforeAll(startInMemoryMongo);
  afterAll(stopInMemoryMongo);
  beforeEach(clearCollections);

  it("returns a published workspace with the fields the public render reads", async () => {
    await Workspace.create({
      slug: "studio-aurora",
      name: "Studio Aurora",
      country: "PH",
      ownerUserId: "user_1",
      publicPage: { publishedAt: new Date(), data: { home: { content: [], root: {} } } },
    });
    const ws = await findPublishedWorkspaceBySlug("studio-aurora");
    expect(ws).not.toBeNull();
    expect(ws!.publicPage?.publishedAt).toBeTruthy();
    expect(ws!.name).toBe("Studio Aurora");
  });
});
```
(Adapt required `Workspace.create` fields to the current schema — add whatever the model marks `required` post-migration; a missing required field surfacing here may itself be the bug.)

Run: `rtk vitest publicPage.regression`
Expected: FAIL reproducing the captured error.

- [ ] **Step 4: Implement the root-cause fix per the captured stack**

Decision tree (apply the branch matching Step 1):
- **next-intl config not established for `/w/`:** in `layout.tsx`, `page.tsx`, and `gallery/page.tsx`, import `setRequestLocale` and call it immediately after resolving `locale`, before any `getTranslations`:
  ```ts
  import { getTranslations, setRequestLocale } from "next-intl/server";
  // …after: const locale = resolvePublicChromeLocale(workspace);
  setRequestLocale(locale);
  ```
  If the error is instead "Couldn't find next-intl config" from `getRequestConfig` ignoring the explicit locale, update `lib/i18n/request.ts` to honor an explicitly-passed `locale`:
  ```ts
  export default getRequestConfig(async ({ locale, requestLocale }) => {
    const requested = locale ?? (await requestLocale);
    const resolved = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
    const messages = (await import(`../../messages/${resolved}.json`)).default;
    return { locale: resolved, messages };
  });
  ```
- **`workspace.*` undefined dereference:** add the missing guard / default at the exact line from the stack (e.g. `workspace.publicPage?.brandKit ?? DEFAULT_BRAND_KIT` already exists in `layout.tsx`; replicate the pattern for the field that threw). If a required schema field is absent post-migration, restore it in the `.select(...)` projection in `lib/db/queries/publicPage.ts` or in `buildRenderWorkspace`.
- **Puck `<Render>` block mismatch:** the `error.tsx` from Step 2 now contains it; fix the offending block config in `lib/page-builder/config.ts` so the stored `data` matches a registered component.

- [ ] **Step 5: Verify green and re-confirm the live page**

Run: `rtk vitest publicPage.regression` → Expected: PASS.
Then `pnpm build && pnpm start` and `curl -i http://localhost:3000/w/<slug>` → Expected: `HTTP/1.1 200`. Confirm Home, `/gallery`, and the Contact modal render.

- [ ] **Step 6: Commit**
```bash
git add app/(public)/error.tsx app/(public)/w/[orgSlug] lib/i18n/request.ts lib/db/queries/publicPage.ts
git commit -m "fix(public-page): resolve /w/[orgSlug] 500 regression and add error boundary"
```

---

## Task 2 (Spec #7 + #11): Client-side draft-name validation — gate the save API and the unsaved-changes modal

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` (add `validateDraftName`, gate `handleSaveChanges` at `:452`, gate `guardThenRun` at `:492`)
- Test: `app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `EditorShell.test.tsx` (uses existing `baseProps`, `renderAndDismissEntry`, and the mocked `_draftActions`):
```ts
import { updateDraftAction } from "../_draftActions";

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

  // Rename the active draft to clash with d2.
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

  // Trigger a guarded action (open Drafts → Apply another draft).
  fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
  fireEvent.click(await screen.findByRole("button", { name: "Apply Summer" }));

  expect(screen.queryByText("Save your changes?")).not.toBeInTheDocument();
  expect(screen.getByText("A draft with this name already exists")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `rtk vitest EditorShell`
Expected: FAIL — the API is currently called and/or the modal opens.

- [ ] **Step 3: Add the validation helper and gates**

In `EditorShell.tsx`, add this pure helper near `handleSaveChanges` (before line 452):
```ts
function validateDraftName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "This field is required";
  const clash = drafts.some(
    (d) => d.id !== activeDraftId && d.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (clash) return "A draft with this name already exists";
  return null;
}
```

Gate `handleSaveChanges` — add at the very top of the function body (`:453`, before `setSavingChanges(true)`):
```ts
async function handleSaveChanges(): Promise<boolean> {
  const validationError = validateDraftName(draftName);
  if (validationError) {
    setNameError(validationError);
    return false;
  }
  setSavingChanges(true);
  // …unchanged…
```

Gate `guardThenRun` (`:492-498`) — validate before opening the modal:
```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk vitest EditorShell`
Expected: PASS. Then `rtk tsc` and `rtk lint`.

- [ ] **Step 5: Commit**
```bash
git add app/[locale]/(app)/portfolio/_components/EditorShell.tsx app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx
git commit -m "fix(portfolio): validate draft name before saving or opening the unsaved-changes modal"
```

---

## Task 3 (Spec #7 + #10): Standout colors + fold `nameError` into `saveDisabled`

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` (`toolsCluster` `:830-864`, Preview button `:816-824`)
- Test: `app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx`

- [ ] **Step 1: Write the failing test**
```ts
it("styles Save changes with the brand variant and Preview with the secondary variant", async () => {
  await renderAndDismissEntry(<EditorShell {...baseProps} />);
  expect(screen.getByRole("button", { name: "Save changes" }).className).toContain("bg-brand");
  expect(screen.getByRole("button", { name: /Preview/ }).className).toContain("bg-secondary");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk vitest EditorShell`
Expected: FAIL — both buttons are `variant="outline"` today.

- [ ] **Step 3: Apply the variant changes**

Save changes button in `toolsCluster` (`:851-860`): change `variant="outline"` → `variant="brand"`, and fold `nameError` into the disabled guard (`:831`):
```tsx
const saveDisabled = (!isDirty && activeDraftId !== null) || nameError !== null;
```
```tsx
<Button
  type="button"
  size="sm"
  variant="brand"
  disabled={saveDisabled}
  loading={savingChanges}
  onClick={() => void handleSaveChanges()}
>
  Save changes
</Button>
```

Preview toggle button in `navCluster` (`:816-824`): change `variant="outline"` → `variant="secondary"`:
```tsx
<Button
  type="button"
  size="sm"
  variant="secondary"
  aria-pressed={previewMode}
  onClick={() => void togglePreview()}
>
  {previewMode ? t("preview.edit") : t("preview.show")}
</Button>
```

- [ ] **Step 4: Run to verify it passes**

Run: `rtk vitest EditorShell` → PASS. Then `rtk tsc`, `rtk lint`.

- [ ] **Step 5: Commit**
```bash
git add app/[locale]/(app)/portfolio/_components/EditorShell.tsx app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx
git commit -m "feat(portfolio): make Save changes (brand) and Preview (secondary) stand out"
```

---

## Task 4 (Spec #10): Keep the Preview button inline beside the Contact Form control

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` (`navCluster` `:784-827`)
- Test: `app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx`

**Context:** Today `navCluster` is `<div flex flex-wrap gap-2>[<div role=group> …section tabs…</div>][Preview button]</div>`. The section-tab group and the Preview button are siblings; on narrow widths the group fills the row and Preview wraps to its own line. Move the Preview button **into** the same wrapping flow as the tabs so it sits immediately after the Contact Form tab.

- [ ] **Step 1: Write the failing test (DOM order: Preview immediately follows the section-tab group, same flex parent)**
```ts
it("renders the Preview button as a sibling of the section tabs inside one flex row", async () => {
  await renderAndDismissEntry(<EditorShell {...baseProps} />);
  const preview = screen.getByRole("button", { name: /Preview/ });
  const sectionGroup = screen.getByRole("group", { name: /sections/i });
  // Same parent → no orphaned second line.
  expect(preview.parentElement).toBe(sectionGroup.parentElement);
  expect(preview.parentElement?.className).toContain("flex-wrap");
});
```

- [ ] **Step 2: Run to verify it fails (or already passes structurally)**

Run: `rtk vitest EditorShell`
Expected: confirm current parent/className. If it already passes, tighten to assert ordering: `expect(sectionGroup.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()` and that they share a non-wrapping inline container.

- [ ] **Step 3: Restructure `navCluster` so Preview flows with the tabs**

Make the section tabs and the Preview button share one `flex flex-wrap items-center gap-1` container so Preview reflows directly after the Contact Form tab instead of being pushed to its own line:
```tsx
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
      <Button
        type="button"
        size="sm"
        variant="secondary"
        aria-pressed={previewMode}
        onClick={() => void togglePreview()}
      >
        {previewMode ? t("preview.edit") : t("preview.show")}
      </Button>
    </div>
  );
}
```
(The `role="group"` moves to the single combined container; update the test selector in Step 1 if you change the labelled element — keep `aria-label={t("zone.sectionsLabel")}` on the group that holds the tabs.)

- [ ] **Step 4: Run to verify it passes**

Run: `rtk vitest EditorShell` → PASS. Re-run the Task 3 Preview-variant assertion to confirm no regression. `rtk tsc`, `rtk lint`.

- [ ] **Step 5: Commit**
```bash
git add app/[locale]/(app)/portfolio/_components/EditorShell.tsx app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx
git commit -m "fix(portfolio): keep Preview button inline with the section tabs"
```

---

## Task 5 (Spec #4): "Add new draft" prompts to save unsaved changes

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` (`DraftsDialog` render site `:1066-1074`)
- Test: `app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx`

**Depends on:** Task 2 (`guardThenRun` now validates first).

- [ ] **Step 1: Write the failing test**
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk vitest EditorShell`
Expected: FAIL — `onAddNew` opens the template picker directly today.

- [ ] **Step 3: Route Add-new through the guard**

Change the `DraftsDialog` `onAddNew` prop (`:1073`):
```tsx
onAddNew={() =>
  guardThenRun(() => {
    setDraftsOpen(false);
    setTemplatesOpen(true);
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `rtk vitest EditorShell` → PASS. `rtk tsc`, `rtk lint`.

- [ ] **Step 5: Commit**
```bash
git add app/[locale]/(app)/portfolio/_components/EditorShell.tsx app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx
git commit -m "fix(portfolio): prompt to save unsaved changes before adding a new draft"
```

---

## Task 6 (Spec #2): Icon buttons for Apply and Delete in the drafts list

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/DraftsDialog.tsx` (`:105-125`)
- Create test: `app/[locale]/(app)/portfolio/_components/DraftsDialog.test.tsx`

**Note:** Chrome is English-only; keep the existing `aria-label` strings (`Apply ${d.name}` / `Delete ${d.name}`) so the controls stay accessible after the visible text is replaced by icons.

- [ ] **Step 1: Write the failing test**

Create `DraftsDialog.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { DraftsDialog } from "./DraftsDialog";

const drafts = [{ id: "d1", name: "Summer", templateId: "minimal", updatedAt: new Date().toISOString() }];

it("renders Apply and Delete as labeled icon buttons and fires their handlers", () => {
  const onApply = vi.fn();
  const onDelete = vi.fn();
  renderWithProviders(
    <DraftsDialog
      open
      onOpenChange={() => {}}
      drafts={drafts}
      activeDraftId={null}
      onApply={onApply}
      onDelete={onDelete}
      onAddNew={() => {}}
    />
  );

  const applyBtn = screen.getByRole("button", { name: "Apply Summer" });
  const deleteBtn = screen.getByRole("button", { name: "Delete Summer" });
  // Icon-only: an SVG child, no visible text label.
  expect(applyBtn.querySelector("svg")).toBeTruthy();
  expect(applyBtn).not.toHaveTextContent("Apply");

  fireEvent.click(applyBtn);
  expect(onApply).toHaveBeenCalledWith("d1");

  fireEvent.click(deleteBtn);
  expect(screen.getByText("Delete this draft?")).toBeInTheDocument(); // confirm dialog still gates delete
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk vitest DraftsDialog`
Expected: FAIL — buttons currently render text "Apply"/"Delete", no SVG.

- [ ] **Step 3: Replace the text buttons with icon buttons**

In `DraftsDialog.tsx`, add the icon import at the top:
```tsx
import { Check, Trash2 } from "lucide-react";
```
Replace the action row (`:105-125`):
```tsx
<div className="mt-1 flex items-center justify-end gap-1">
  <Button
    type="button"
    size="icon-sm"
    variant="outline"
    aria-label={`Apply ${d.name}`}
    onClick={() => onApply(d.id)}
  >
    <Check />
  </Button>
  <Button
    type="button"
    size="icon-sm"
    variant="ghost"
    aria-label={`Delete ${d.name}`}
    onClick={() => setPendingDelete(d)}
  >
    <Trash2 />
  </Button>
</div>
```
(`size="icon-sm"` exists in the button CVA. The `L.apply`/`L.delete` strings are now unused for the visible label but keep them in `L` only if referenced elsewhere; otherwise remove the two keys.)

- [ ] **Step 4: Run to verify it passes**

Run: `rtk vitest DraftsDialog` → PASS. `rtk tsc`, `rtk lint`.

- [ ] **Step 5: Commit**
```bash
git add app/[locale]/(app)/portfolio/_components/DraftsDialog.tsx app/[locale]/(app)/portfolio/_components/DraftsDialog.test.tsx
git commit -m "feat(portfolio): use icon buttons for Apply and Delete in the drafts list"
```

---

## Task 7 (Spec #3): Template picker — select then Apply; remove the switch warning

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/TemplatePickerDialog.tsx`
- Create test: `app/[locale]/(app)/portfolio/_components/TemplatePickerDialog.test.tsx`

**Behavior:** Clicking a template only **selects/highlights** it (sets `pending`). A footer **"Use this template"** button commits via `onConfirm(pending.id)`. Remove the nested destructive `AlertDialog` warning entirely. Keep the `switching`/`error` props for the in-flight state on the Apply button.

- [ ] **Step 1: Write the failing test**

Create `TemplatePickerDialog.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

const templates = [
  { id: "minimal", label: "Minimal", description: "Clean", defaultBrandKit: DEFAULT_BRAND_KIT },
  { id: "bold", label: "Bold", description: "Loud", defaultBrandKit: DEFAULT_BRAND_KIT },
];

it("selects a template on click and applies only when Use this template is pressed; no warning dialog", () => {
  const onConfirm = vi.fn();
  renderWithProviders(
    <TemplatePickerDialog
      open
      onOpenChange={() => {}}
      templates={templates}
      currentTemplateId="minimal"
      switching={false}
      error={null}
      onConfirm={onConfirm}
    />
  );

  // Clicking a template does NOT apply and does NOT open a warning.
  fireEvent.click(screen.getByRole("button", { name: /Bold/ }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.queryByText("Switch template?")).not.toBeInTheDocument();

  // Apply button is enabled once a template is selected.
  const apply = screen.getByRole("button", { name: "Use this template" });
  fireEvent.click(apply);
  expect(onConfirm).toHaveBeenCalledWith("bold");
});

it("disables Use this template until a template is selected", () => {
  renderWithProviders(
    <TemplatePickerDialog
      open
      onOpenChange={() => {}}
      templates={templates}
      currentTemplateId="minimal"
      switching={false}
      error={null}
      onConfirm={() => {}}
    />
  );
  expect(screen.getByRole("button", { name: "Use this template" })).toBeDisabled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk vitest TemplatePickerDialog`
Expected: FAIL — clicking a template opens the "Switch template?" `AlertDialog`; no footer Apply button exists.

- [ ] **Step 3: Rewrite the dialog body and footer; delete the AlertDialog**

In `TemplatePickerDialog.tsx`:
- Remove the `AlertDialog*` imports and the entire nested `<AlertDialog>…</AlertDialog>` block (`:127-154`).
- Trim `L` to drop the warning strings (`confirmTitle`, `confirmBody`, `confirmAction`); keep `title`, `subtitle`, `current`, `use`, `cancel`, `switching`, `error`.
- Add selected-state styling: the template `<button>` `onClick={() => setPending(tpl)}` stays, but the `className` highlights `pending?.id === tpl.id` (selected) in addition to `isCurrent`:
  ```tsx
  className={cn(
    "flex w-full flex-col gap-3 border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
    pending?.id === tpl.id
      ? "border-foreground ring-1 ring-ring"
      : isCurrent
        ? "border-foreground"
        : "border-border hover:bg-accent/40 focus-visible:bg-accent/40"
  )}
  ```
- Replace the footer (`:120-123`) with a Cancel + Apply pair:
  ```tsx
  <DialogFooter>
    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={switching}>
      {L.cancel}
    </Button>
    <Button
      type="button"
      onClick={() => pending && onConfirm(pending.id)}
      loading={switching}
      disabled={switching || pending === null}
    >
      {switching ? L.switching : L.use}
    </Button>
  </DialogFooter>
  ```
- If `error` should remain visible, render it above the footer:
  ```tsx
  {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  ```

- [ ] **Step 4: Run to verify it passes**

Run: `rtk vitest TemplatePickerDialog` → PASS. `rtk tsc`, `rtk lint`.
Also run `rtk vitest EditorShell` to confirm template-switch flows (which now go select→Apply→`guardThenRun`→`applyTemplate`) still pass; update any EditorShell test that drove the old warning-confirm path.

- [ ] **Step 5: Commit**
```bash
git add app/[locale]/(app)/portfolio/_components/TemplatePickerDialog.tsx app/[locale]/(app)/portfolio/_components/TemplatePickerDialog.test.tsx
git commit -m "fix(portfolio): template picker selects then applies; remove switch warning"
```

---

## Task 8 (Spec #5): Fixed-width draft title with ellipsis; smaller error text

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/DraftNameEditor.tsx` (`:70-89`)
- Create test: `app/[locale]/(app)/portfolio/_components/DraftNameEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `DraftNameEditor.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DraftNameEditor } from "./DraftNameEditor";

it("truncates a long title to a fixed width and renders the error in smaller text", () => {
  render(
    <DraftNameEditor
      name="New Draft lorem ipsum dolor sit amet consectetur"
      onCommit={vi.fn()}
      error="A draft with this name already exists"
    />
  );
  const title = screen.getByTitle("New Draft lorem ipsum dolor sit amet consectetur");
  expect(title.className).toContain("truncate");
  expect(title.className).toMatch(/max-w-\[/); // fixed/max width cap
  const err = screen.getByRole("alert");
  expect(err.className).toContain("text-[11px]"); // smaller than text-xs
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk vitest DraftNameEditor`
Expected: FAIL — title has no `max-w-[…]`; error uses `text-xs`.

- [ ] **Step 3: Apply the width cap and smaller error**

In the non-editing branch (`:70-82`), cap the title width and keep the edit button tight:
```tsx
<div className="flex min-w-0 items-center gap-0.5">
  <span className="max-w-[11rem] truncate text-sm font-medium" title={name}>
    {name}
  </span>
  <Button
    type="button"
    size="icon-xs"
    variant="ghost"
    aria-label="Rename draft"
    onClick={() => { setValue(name); setEditing(true); }}
  >
    <Pencil />
  </Button>
</div>
```
Error line (`:83-87`): shrink to `text-[11px]` and allow it to use the full editor width:
```tsx
{error && (
  <p role="alert" className="text-[11px] leading-tight text-destructive">
    {error}
  </p>
)}
```

- [ ] **Step 4: Run to verify it passes**

Run: `rtk vitest DraftNameEditor` → PASS. `rtk tsc`, `rtk lint`.

- [ ] **Step 5: Commit**
```bash
git add app/[locale]/(app)/portfolio/_components/DraftNameEditor.tsx app/[locale]/(app)/portfolio/_components/DraftNameEditor.test.tsx
git commit -m "fix(portfolio): cap draft title width with ellipsis and shrink the error text"
```

---

## Task 9 (Spec #6): On small screens, move the draft title above the Puck page

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` (`topBar` `:867-875`, `toolsCluster` `:830-864`)
- Test: `app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx`

**Approach (single mount):** Extract `DraftNameEditor` out of `toolsCluster` and render it as a dedicated slot in `topBar` that uses flex-order + `basis-full` so it occupies its own full-width row **first** on mobile and sits inline on `sm+`. One mount only — no breakpoint-duplicated state.

- [ ] **Step 1: Write the failing test**
```ts
it("renders the draft title in a full-width, order-first slot for small screens", async () => {
  await renderAndDismissEntry(<EditorShell {...baseProps} />);
  const title = screen.getByTitle("Test Draft");
  // Walk up to the topBar slot wrapping the DraftNameEditor.
  const slot = title.closest('[data-testid="draft-title-slot"]');
  expect(slot).not.toBeNull();
  expect(slot!.className).toContain("basis-full");
  expect(slot!.className).toContain("order-first");
  expect(slot!.className).toContain("sm:basis-auto");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk vitest EditorShell`
Expected: FAIL — no `draft-title-slot`; title lives inside `toolsCluster`.

- [ ] **Step 3: Move the title into a responsive `topBar` slot**

Remove the `DraftNameEditor` block from `toolsCluster` (`:834-838`). Then change `topBar` (`:867-875`) to add the full-width-first title slot and ensure the row wraps:
```tsx
function topBar(center: ReactNode, publishSlot: ReactNode) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <div
        data-testid="draft-title-slot"
        className="order-first basis-full sm:order-none sm:basis-auto"
      >
        <DraftNameEditor
          name={draftName}
          error={nameError}
          onCommit={(n) => { setDraftName(n); setNameError(null); }}
        />
      </div>
      <div className="flex min-w-0 flex-1 justify-start">{navCluster()}</div>
      {center && <div className="flex shrink-0 items-center justify-center">{center}</div>}
      <div className="flex min-w-0 flex-1 justify-end">{toolsCluster(publishSlot)}</div>
    </div>
  );
}
```
On mobile (`basis-full` + `order-first`) the title is its own row above everything; on `sm+` it returns to inline flow. Because `topBar` renders inside the Puck `header` override and the non-Puck branch header (both above the canvas), the title sits above the Puck page on small screens as required.

- [ ] **Step 4: Run to verify it passes**

Run: `rtk vitest EditorShell` → PASS. Re-run earlier EditorShell assertions (Save/Preview, validation) for no regressions. `rtk tsc`, `rtk lint`.

- [ ] **Step 5: Manual 375px check**

`pnpm dev`, open `/portfolio`, DevTools responsive at 375px. Confirm the title is a full-width row above the canvas and not crushed at the right edge; confirm desktop is unchanged at ≥640px.

- [ ] **Step 6: Commit**
```bash
git add app/[locale]/(app)/portfolio/_components/EditorShell.tsx app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx
git commit -m "fix(portfolio): move draft title to its own row above the canvas on small screens"
```

---

## Task 10 (Spec #1): Start-from-scratch (and re-apply) repaint the canvas immediately

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` (add `seedNonce` state; bump in `applyTemplate` `:702-731` and `applyDraft` `:501-544`; Puck `key` `:892`)
- Test: `app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx`

**Root cause:** `<Puck key={activeZone} data={puckSeed}>` only remounts when `activeZone` changes. `applyTemplate` re-seeds without changing the zone, so the canvas keeps stale content until a tab switch.

- [ ] **Step 1: Write the failing test**

The Puck mock in `EditorShell.test.tsx` renders its `data`/key; assert the editor canvas reflects the seeded template immediately after apply, with no tab change. Use the mock's exposed seed (check how `vi.mock("@measured/puck")` renders — it typically renders a `data-testid` with the content). Concretely, assert the Puck wrapper key changes:
```ts
it("remounts the canvas immediately after applying a template (no tab switch needed)", async () => {
  await renderAndDismissEntry(<EditorShell {...baseProps} />);

  const canvasBefore = screen.getByTestId("puck-mock");
  const keyBefore = canvasBefore.getAttribute("data-puck-key");

  // Open template picker → select → apply.
  fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
  fireEvent.click(await screen.findByRole("button", { name: "Add new draft" }));
  // (clean draft path opens the picker directly; if dirty, save first)
  fireEvent.click(await screen.findByRole("button", { name: /Minimal/ }));
  fireEvent.click(screen.getByRole("button", { name: "Use this template" }));

  await waitFor(() => {
    expect(screen.getByTestId("puck-mock").getAttribute("data-puck-key")).not.toBe(keyBefore);
  });
});
```
If the existing Puck mock does not expose `data-puck-key`, extend the mock in this test file to render `data-puck-key={key}` (read the current `vi.mock("@measured/puck", …)` factory and add the attribute).

- [ ] **Step 2: Run to verify it fails**

Run: `rtk vitest EditorShell`
Expected: FAIL — key (`activeZone`) is unchanged by `applyTemplate`.

- [ ] **Step 3: Add `seedNonce` and bump it on every full re-seed**

Add state near `puckSeed` (`:325`):
```ts
const [seedNonce, setSeedNonce] = useState(0);
```
In `applyTemplate`, immediately after `setPuckSeed(...)` (`:727`):
```ts
setPuckSeed(ensureIds(zoneDataRef.current[activeZone]));
setSeedNonce((n) => n + 1);
```
In `applyDraft`, after `setPuckSeed(ensureIds(homeData));` (`:530`):
```ts
setPuckSeed(ensureIds(homeData));
setSeedNonce((n) => n + 1);
```
Update the Puck `key` (`:892`):
```tsx
<Puck
  key={`${activeZone}-${seedNonce}`}
  config={editorPuckConfig as unknown as Config}
  data={puckSeed}
  …
```

- [ ] **Step 4: Run to verify it passes**

Run: `rtk vitest EditorShell` → PASS. Confirm `selectZone` (tab switch) still works — its key changes via `activeZone`. `rtk tsc`, `rtk lint`.

- [ ] **Step 5: Manual check**

`pnpm dev` → `/portfolio` → start from scratch / apply a template → canvas updates without touching tabs.

- [ ] **Step 6: Commit**
```bash
git add app/[locale]/(app)/portfolio/_components/EditorShell.tsx app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx
git commit -m "fix(portfolio): repaint the canvas immediately when applying a template or draft"
```

---

## Task 11 (Spec #9): Close the main app sidebar when a nav link is clicked (mobile)

**Files:**
- Modify: `components/app/app-sidebar.tsx` (`:102-115` nav loop; footer Settings link `:125-133`)
- Create test: `components/app/app-sidebar.test.tsx`

**Mechanism:** `useSidebar()` exposes `isMobile` and `setOpenMobile`. Wire each nav `<Link>` `onClick` to `setOpenMobile(false)` when `isMobile`. Desktop is unaffected.

- [ ] **Step 1: Write the failing test**

Create `components/app/app-sidebar.test.tsx`. Mock `useSidebar` to report mobile and capture `setOpenMobile`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const setOpenMobile = vi.fn();
vi.mock("@/components/ui/sidebar", async (orig) => {
  const actual = await orig<typeof import("@/components/ui/sidebar")>();
  return { ...actual, useSidebar: () => ({ ...actual, isMobile: true, openMobile: true, setOpenMobile, state: "expanded" }) };
});
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, onClick, ...p }: any) => <a href={String(href)} onClick={onClick} {...p}>{children}</a>,
  usePathname: () => "/dashboard",
}));

import { AppSidebar } from "./app-sidebar";

it("closes the mobile sidebar when a nav link is clicked", () => {
  renderWithProviders(
    <AppSidebar role="owner" workspaceName="Studio" userName="A" userEmail="a@b.c" userAvatarUrl={null} />
  );
  fireEvent.click(screen.getByRole("link", { name: /bookings/i }));
  expect(setOpenMobile).toHaveBeenCalledWith(false);
});
```
(If `useSidebar` cannot be partially mocked this way, instead render inside a real `SidebarProvider` with a forced-mobile context and spy on the sheet's open state. Use whichever the codebase's other sidebar tests use.)

- [ ] **Step 2: Run to verify it fails**

Run: `rtk vitest app-sidebar`
Expected: FAIL — links don't call `setOpenMobile`.

- [ ] **Step 3: Wire the link clicks**

In `app-sidebar.tsx`, read the hook in the component body (`:59`):
```tsx
import { useSidebar } from "@/components/ui/sidebar";
// …inside AppSidebar:
const { isMobile, setOpenMobile } = useSidebar();
const closeOnNav = () => { if (isMobile) setOpenMobile(false); };
```
Add `onClick={closeOnNav}` to the nav `<Link>` (`:106`) and the footer Settings `<Link>` (`:126`):
```tsx
<SidebarMenuButton
  render={<Link href={href} onClick={closeOnNav} />}
  isActive={pathname === href || pathname.startsWith(href + "/")}
  tooltip={label}
  className="group-data-[collapsible=icon]:mx-auto"
>
```
```tsx
<SidebarMenuButton
  render={<Link href="/settings" onClick={closeOnNav} />}
  tooltip={t("settings")}
  className="group-data-[collapsible=icon]:mx-auto"
>
```

- [ ] **Step 4: Run to verify it passes**

Run: `rtk vitest app-sidebar` → PASS. `rtk tsc`, `rtk lint`.

- [ ] **Step 5: Commit**
```bash
git add components/app/app-sidebar.tsx components/app/app-sidebar.test.tsx
git commit -m "fix(app): close the mobile sidebar after clicking a nav link"
```

---

## Task 12 (Spec #8): Collections popup preview not showing on the canvas — diagnose and fix

**Files:**
- Investigate: `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` (`sidePanelOpen` derivation; `openCollectionsPopup` `:683`; collections render branch `:973-985`), `CollectionsPopupPreview.tsx`, `lib/page-builder/blocks/CollectionPopupChrome.tsx`
- Modify: the file the diagnosis points to
- Test: `app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx`

**Known:** Opening the Collections Popup tab calls `openCollectionsPopup()` → `setCollectionsPopupOpen(true)`; `showPuck = !previewMode && !sidePanelOpen`; the branch `collectionsPopupOpen ? (<CollectionsPopupPreview …/> + panel) : …` renders only when `!showPuck`. There is an existing test "renders the collections popup preview when the popup tab is open".

- [ ] **Step 1: Diagnose why the preview area is blank**

Read `sidePanelOpen`'s definition in `EditorShell.tsx` (grep within the file) and confirm `collectionsPopupOpen` is included — if `sidePanelOpen` omits `collectionsPopupOpen`, then `showPuck` stays `true`, Puck keeps the canvas, and the collections branch never renders (**prime suspect**). Then open `CollectionPopupChrome.tsx` and check whether, with an empty `config` (`{}`, the default for a fresh draft) and `preview`, it renders visible chrome or returns null / renders a closed (hidden) popup. Record the exact root cause in the task notes.

- [ ] **Step 2: Write the failing test reproducing the blank preview**
```ts
it("shows the collections popup preview on the canvas when the Collections Popup tab is opened", async () => {
  await renderAndDismissEntry(<EditorShell {...baseProps} />);
  fireEvent.click(screen.getByRole("button", { name: "Collections Popup" }));
  // The preview chrome renders a sample collection title.
  expect(await screen.findByText("Sample Collection")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `rtk vitest EditorShell`
Expected: FAIL — preview not in the document (matches the reported bug).

- [ ] **Step 4: Apply the fix from the diagnosis**

- If `sidePanelOpen` omits `collectionsPopupOpen`: include it, e.g.
  ```ts
  const sidePanelOpen = contactOpen || headerOpen || collectionsPopupOpen;
  ```
- If `CollectionPopupChrome` hides itself when "closed" under `preview`: pass an open/forced-visible flag in `CollectionsPopupPreview` (it already passes `preview`) so the chrome renders visibly in preview mode regardless of an `open` prop. Make the minimal change that renders the sample chrome.

- [ ] **Step 5: Run to verify it passes**

Run: `rtk vitest EditorShell` → PASS (including the pre-existing collections-preview test). `rtk tsc`, `rtk lint`.

- [ ] **Step 6: Manual check**

`pnpm dev` → `/portfolio` → click "Collections Popup" → the preview renders on the left canvas and updates as panel controls change.

- [ ] **Step 7: Commit**
```bash
git add app/[locale]/(app)/portfolio/_components/EditorShell.tsx app/[locale]/(app)/portfolio/_components/CollectionsPopupPreview.tsx app/[locale]/(app)/portfolio/_components/EditorShell.test.tsx
git commit -m "fix(portfolio): render the collections popup preview on the canvas when its tab is open"
```

---

## Final verification (pre-merge sweep)

- [ ] **Run the full portfolio + sidebar + public suites**

```bash
rtk vitest EditorShell DraftsDialog DraftNameEditor TemplatePickerDialog app-sidebar publicPage.regression
```
Expected: all PASS.

- [ ] **Typecheck and lint the whole change**

```bash
rtk tsc
rtk lint
```
Expected: no errors.

- [ ] **Locale consolidation check (Spec #12 only touches user-facing strings)**

Confirm no new keys were needed in editor chrome (English-only). If any public-facing string was added for the #12 fix, add it to all of `en`, `fil`, `ms`, `id`. No `th`.

- [ ] **Mobile 375px pass**

`pnpm dev`, verify at 375px: draft title row above canvas (#6), drafts icon buttons (#2), Preview inline + standout colors (#7/#10), sidebar closes on nav (#9).

- [ ] **Re-index the worktree for codebase-memory**

After the edits land, refresh the graph: `index_repository { repo_path: "<worktree abs path>", mode: "moderate" }`.

- [ ] **Final commit / push**

```bash
git push
```

---

## Self-review notes

- **Spec coverage:** #1→Task 10, #2→Task 6, #3→Task 7, #4→Task 5, #5→Task 8, #6→Task 9, #7→Tasks 2+3, #8→Task 12, #9→Task 11, #10→Tasks 3+4, #11→Task 2, #12→Task 1. All 12 covered.
- **i18n correction:** editor chrome is English-only (RELEASE-CHECKLIST §4f); only #12 may touch locale files. Spec's "update 4 locales for #2/#3" is superseded by this plan.
- **Type/name consistency:** `validateDraftName` (Task 2) is referenced by Tasks 2 and 5; `seedNonce`/`setSeedNonce` (Task 10) used in `applyTemplate`, `applyDraft`, and the Puck `key`; `closeOnNav` (Task 11); `draft-title-slot` test id (Task 9). Button variants `brand`/`secondary` (Tasks 3, 4) exist in the CVA.
- **Risk:** Tasks 2–10 all edit `EditorShell.tsx`; execute sequentially (not in parallel) to avoid merge churn, re-running `rtk vitest EditorShell` after each. Task 1 (public page) and Tasks 6/7/8/11 (separate files) are independent.
- **Diagnose-first tasks:** #12 (Task 1) and #8 (Task 12) capture the real failure before the fix; their fix steps include a decision tree rather than a single assumed change.
