# Portfolio Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the implicit single-buffer portfolio editor with named, durable, plan-capped drafts the owner can save, switch between, publish, and delete — with unsaved-change guards and an entry chooser.

**Architecture:** A new `PortfolioDraft` Mongoose collection (tenant-scoped) stores full portfolio snapshots. Owner-only server actions create/update/delete/get/list drafts and publish the active draft into `publicPage` (the published mirror). The editor edits a localStorage working buffer tagged with the active `draftId`; the DB changes only on **Save changes** or **Publish**. A 6th "scratch" template seeds an empty canvas. Existing `publicPage.data` migrates into one "New Draft" on first entry.

**Tech Stack:** Next.js 16 App Router, React 19, Mongoose 8, Zod, next-intl (editor chrome is English-only — no new keys), Vitest + @testing-library/react + mongodb-memory-server, shadcn/ui (Dialog/AlertDialog/Input/Button), Puck.

**Spec:** `docs/superpowers/specs/2026-06-11-portfolio-drafts-design.md`

---

## Conventions used by this plan (verified against the codebase)

- Models: `mongoose.models.X ?? mongoose.model<...>("X", schema)`, `{ timestamps: true }`, indexes via `schema.index(...)`. Tenant ref: `workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true }`.
- Server actions: top `"use server"`; `const ctx = await requireOrg(); if (ctx.role !== "owner") return { error: "owner_only" };`; `await connectDB();`; scope every query by `ctx.workspace._id`; result type `{ ok: true; ... } | { error: string }`.
- `PLAN_TIERS = ["free","starter","pro"]`, `type PlanTier`, exported from `lib/db/models/Workspace.ts`. `ctx.workspace.plan` holds the tier.
- Validators in `lib/validators/publicPage.ts`: `brandKitSchema`, `portfolioContactConfigSchema`, `portfolioHeaderConfigSchema`, `portfolioCollectionsPopupConfigSchema`, `puckDataSchema`.
- Defaults in `lib/page-builder/types.ts`: `DEFAULT_BRAND_KIT`, `DEFAULT_HEADER_CONFIG`. There is **no** default collections-popup constant — the empty object `{}` is the default.
- Tests: `import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo"`. Mongo helper is a replica set (transactions work). Model tests may also use `mongodb-memory-server` directly (see `lib/db/models/team.test.ts`). Vitest globals are OFF — import `describe/it/expect/vi` from `"vitest"`. Run a single file with `pnpm test --run <path-fragment>`.
- Editor chrome is English-only (RELEASE-CHECKLIST §4f); sibling `TemplatePickerDialog.tsx` hardcodes copy in a local `L` constant. New dialogs follow that — **no next-intl keys**.
- Models barrel: `lib/db/models/index.ts` re-exports models (e.g. `import { Workspace, GalleryItem } from "@/lib/db/models"`).

> **EditorShell/page.tsx caveat:** `EditorShell.tsx` is large and changed across recent commits; two exploratory reads disagreed on its exact current buffer shape. Tasks 13–15 begin with a **read the current file** step and describe changes by function/behavior with concrete code to insert. Anchor line numbers at execution time, do not trust numbers quoted here.

---

## File structure

**Create:**
- `lib/page-builder/drafts.ts` — shared constants + plan→cap map + snapshot type.
- `lib/db/models/PortfolioDraft.ts` — Mongoose model.
- `lib/db/models/PortfolioDraft.test.ts` — model + tenant isolation tests.
- `lib/validators/portfolioDraft.ts` — Zod schemas.
- `app/[locale]/(app)/portfolio/_draftActions.ts` — server actions.
- `app/[locale]/(app)/portfolio/_draftActions.test.ts` — action tests.
- `lib/page-builder/migrateDraft.ts` — legacy migration helper.
- `lib/page-builder/migrateDraft.test.ts` — migration tests.
- `lib/page-builder/templates/scratch.ts` — empty "scratch" template.
- `public/template-previews/scratch.svg` — preview thumbnail.
- `app/[locale]/(app)/portfolio/_components/DraftNameEditor.tsx` (+ `.test.tsx`).
- `app/[locale]/(app)/portfolio/_components/DraftsDialog.tsx` (+ `.test.tsx`).
- `app/[locale]/(app)/portfolio/_components/PortfolioEntryDialog.tsx` (+ `.test.tsx`).
- `app/[locale]/(app)/portfolio/_components/UnsavedChangesDialog.tsx`.

**Modify:**
- `lib/page-builder/templates/types.ts` — add `"scratch"` to `PORTFOLIO_TEMPLATE_IDS`.
- `lib/page-builder/templates/index.ts` — register `scratchTemplate`.
- `lib/db/models/index.ts` — export `PortfolioDraft`.
- `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` — draft state machine, Drafts button, name editor, dialogs, panel reroute, publish-from-draft, left-cluster wrap.
- `app/[locale]/(app)/portfolio/page.tsx` — migration + load drafts + pass props.

---

## Task 1: Shared draft constants + plan caps

**Files:**
- Create: `lib/page-builder/drafts.ts`
- Test: `lib/page-builder/drafts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/page-builder/drafts.test.ts
import { describe, it, expect } from "vitest";
import { draftCapForPlan, DEFAULT_DRAFT_NAME, DRAFT_NAME_MAX } from "./drafts";

describe("draftCapForPlan", () => {
  it("caps free at 5, starter at 15, pro unlimited", () => {
    expect(draftCapForPlan("free")).toBe(5);
    expect(draftCapForPlan("starter")).toBe(15);
    expect(draftCapForPlan("pro")).toBe(Number.POSITIVE_INFINITY);
  });

  it("falls back to the free cap for an unknown plan", () => {
    // @ts-expect-error testing runtime fallback
    expect(draftCapForPlan("enterprise")).toBe(5);
  });

  it("exposes the default name and max length", () => {
    expect(DEFAULT_DRAFT_NAME).toBe("New Draft");
    expect(DRAFT_NAME_MAX).toBe(60);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test --run drafts.test`
Expected: FAIL — cannot find module `./drafts`.

- [ ] **Step 3: Implement**

```ts
// lib/page-builder/drafts.ts
import type { PlanTier } from "@/lib/db/models/Workspace";

/** Name a brand-new, unsaved draft carries until the owner renames it. */
export const DEFAULT_DRAFT_NAME = "New Draft";

/** Max length of a draft name (matches the saved-theme name ceiling). */
export const DRAFT_NAME_MAX = 60;

/** Per-plan ceiling on the number of saved drafts a workspace may keep. */
export const DRAFT_CAP_BY_PLAN: Record<PlanTier, number> = {
  free: 5,
  starter: 15,
  pro: Number.POSITIVE_INFINITY,
};

export function draftCapForPlan(plan: PlanTier): number {
  return DRAFT_CAP_BY_PLAN[plan] ?? DRAFT_CAP_BY_PLAN.free;
}
```

> `import type` is erased at build time, so this file never pulls Mongoose into a client bundle even though `EditorShell` imports `DEFAULT_DRAFT_NAME` from it.

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm test --run drafts.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/drafts.ts lib/page-builder/drafts.test.ts
git commit -m "feat(portfolio): draft constants + per-plan caps"
```

---

## Task 2: PortfolioDraft model + tenant isolation

**Files:**
- Create: `lib/db/models/PortfolioDraft.ts`
- Modify: `lib/db/models/index.ts` (add export)
- Test: `lib/db/models/PortfolioDraft.test.ts`

Snapshot sub-fields (`data`, `brandKit`, `contact`, `header`, `collectionsPopup`) are stored as `Schema.Types.Mixed` — exactly like `publicPage.data` — because the Zod action layer validates their shapes on write. This avoids duplicating ~120 lines of field defs from `Workspace.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/models/PortfolioDraft.test.ts
import { describe, beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import mongoose from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { PortfolioDraft } from "./PortfolioDraft";

beforeAll(async () => {
  await startInMemoryMongo();
  await PortfolioDraft.createIndexes();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

const wsA = () => new mongoose.Types.ObjectId();

describe("PortfolioDraft", () => {
  it("persists a snapshot with timestamps", async () => {
    const d = await PortfolioDraft.create({
      workspaceId: wsA(),
      name: "New Draft",
      templateId: "minimal",
      data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
      brandKit: { themePreset: "minimal" },
      contact: {},
      header: {},
      collectionsPopup: {},
      formLocale: "",
    });
    expect(d.name).toBe("New Draft");
    expect(d.createdAt).toBeInstanceOf(Date);
    expect(d.updatedAt).toBeInstanceOf(Date);
  });

  it("does not leak a draft across workspaces (tenant isolation)", async () => {
    const a = wsA();
    const b = wsA();
    await PortfolioDraft.create({ workspaceId: a, name: "Secret A" });
    const found = await PortfolioDraft.findOne({ workspaceId: b, name: "Secret A" }).lean();
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test --run PortfolioDraft.test`
Expected: FAIL — cannot find module `./PortfolioDraft`.

- [ ] **Step 3: Implement the model**

```ts
// lib/db/models/PortfolioDraft.ts
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { DRAFT_NAME_MAX } from "@/lib/page-builder/drafts";

// A draft is a full, named portfolio snapshot. Snapshot sub-documents are stored
// as Mixed (like publicPage.data) — the server-action Zod layer validates their
// shape on every write, so the model stays a thin, fast container.
const portfolioDraftSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: DRAFT_NAME_MAX },
    templateId: { type: String, default: "" },
    data: {
      home: { type: Schema.Types.Mixed, default: null },
      gallery: { type: Schema.Types.Mixed, default: null },
    },
    brandKit: { type: Schema.Types.Mixed, default: null },
    contact: { type: Schema.Types.Mixed, default: null },
    header: { type: Schema.Types.Mixed, default: null },
    collectionsPopup: { type: Schema.Types.Mixed, default: null },
    formLocale: { type: String, default: "" },
  },
  { timestamps: true }
);

// Lists the drafts board newest-first, scoped to one tenant.
portfolioDraftSchema.index({ workspaceId: 1, updatedAt: -1 });

export type PortfolioDraftDoc = InferSchemaType<typeof portfolioDraftSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PortfolioDraft: Model<PortfolioDraftDoc> =
  (mongoose.models.PortfolioDraft as Model<PortfolioDraftDoc>) ??
  mongoose.model<PortfolioDraftDoc>("PortfolioDraft", portfolioDraftSchema);
```

- [ ] **Step 4: Export from the models barrel**

In `lib/db/models/index.ts`, add alongside the other model re-exports:

```ts
export { PortfolioDraft, type PortfolioDraftDoc } from "./PortfolioDraft";
```

- [ ] **Step 5: Run it, verify it passes**

Run: `pnpm test --run PortfolioDraft.test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/db/models/PortfolioDraft.ts lib/db/models/index.ts lib/db/models/PortfolioDraft.test.ts
git commit -m "feat(portfolio): PortfolioDraft model + tenant-scoped index"
```

---

## Task 3: Draft validators

**Files:**
- Create: `lib/validators/portfolioDraft.ts`
- Test: `lib/validators/portfolioDraft.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/validators/portfolioDraft.test.ts
import { describe, it, expect } from "vitest";
import { createDraftSchema, updateDraftSchema } from "./portfolioDraft";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

const snapshot = {
  templateId: "minimal",
  data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
  brandKit: DEFAULT_BRAND_KIT,
  contact: {},
  header: {},
  collectionsPopup: {},
  formLocale: "",
};

describe("createDraftSchema", () => {
  it("accepts a valid snapshot with a name", () => {
    const r = createDraftSchema.safeParse({ name: "My Draft", ...snapshot });
    expect(r.success).toBe(true);
  });

  it("rejects an empty/whitespace name with name_required", () => {
    const r = createDraftSchema.safeParse({ name: "   ", ...snapshot });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.errors[0]?.message).toBe("name_required");
  });
});

describe("updateDraftSchema", () => {
  it("requires an id", () => {
    const r = updateDraftSchema.safeParse({ name: "X", ...snapshot });
    expect(r.success).toBe(false);
  });

  it("accepts id + name + snapshot", () => {
    const r = updateDraftSchema.safeParse({ id: "abc123", name: "X", ...snapshot });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test --run portfolioDraft.test` (validators)
Expected: FAIL — cannot find module `./portfolioDraft`.

- [ ] **Step 3: Implement**

```ts
// lib/validators/portfolioDraft.ts
import { z } from "zod";
import {
  brandKitSchema,
  portfolioContactConfigSchema,
  portfolioHeaderConfigSchema,
  portfolioCollectionsPopupConfigSchema,
  puckDataSchema,
} from "./publicPage";
import { DRAFT_NAME_MAX } from "@/lib/page-builder/drafts";

// Empty/whitespace -> trimmed to "" -> min(1) fails with the UI's error key.
export const draftNameSchema = z.string().trim().min(1, "name_required").max(DRAFT_NAME_MAX);

export const draftSnapshotSchema = z.object({
  templateId: z.string().max(64).optional().or(z.literal("")),
  data: z.object({
    home: puckDataSchema.nullable(),
    gallery: puckDataSchema.nullable(),
  }),
  brandKit: brandKitSchema,
  contact: portfolioContactConfigSchema,
  header: portfolioHeaderConfigSchema,
  collectionsPopup: portfolioCollectionsPopupConfigSchema,
  formLocale: z.string().max(8).optional().or(z.literal("")),
});

export const createDraftSchema = draftSnapshotSchema.extend({
  name: draftNameSchema,
});

export const updateDraftSchema = draftSnapshotSchema.extend({
  id: z.string().min(1).max(64),
  name: draftNameSchema,
});

export type DraftSnapshotInput = z.infer<typeof draftSnapshotSchema>;
export type CreateDraftInput = z.infer<typeof createDraftSchema>;
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm test --run portfolioDraft.test` (validators)
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/validators/portfolioDraft.ts lib/validators/portfolioDraft.test.ts
git commit -m "feat(portfolio): draft create/update Zod schemas"
```

---

## Task 4: Draft CRUD server actions

**Files:**
- Create: `app/[locale]/(app)/portfolio/_draftActions.ts`
- Test: `app/[locale]/(app)/portfolio/_draftActions.test.ts`

This task covers `createDraftAction`, `updateDraftAction`, `deleteDraftAction`, `getDraftAction`, `listDraftsAction`. Publish is Task 5.

- [ ] **Step 1: Write the failing test**

```ts
// app/[locale]/(app)/portfolio/_draftActions.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

let mockCtx: {
  userId: string;
  role: "owner" | "staff";
  workspace: { _id: Types.ObjectId; slug: string; plan: "free" | "starter" | "pro" };
};
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: mockCtx.userId,
    clerkOrgId: "org_test",
    role: mockCtx.role,
    workspace: mockCtx.workspace,
  }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { PortfolioDraft } from "@/lib/db/models";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import {
  createDraftAction,
  updateDraftAction,
  deleteDraftAction,
  listDraftsAction,
  getDraftAction,
} from "./_draftActions";

const snapshot = {
  templateId: "minimal",
  data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
  brandKit: DEFAULT_BRAND_KIT,
  contact: {},
  header: {},
  collectionsPopup: {},
  formLocale: "",
};

function setWorkspace(plan: "free" | "starter" | "pro" = "free") {
  mockCtx = {
    userId: "user_owner",
    role: "owner",
    workspace: { _id: new Types.ObjectId(), slug: "studio-aurora", plan },
  };
}

beforeAll(async () => {
  await startInMemoryMongo();
  await PortfolioDraft.createIndexes();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  revalidatePath.mockClear();
  setWorkspace();
});

describe("createDraftAction", () => {
  it("creates a draft and returns a summary", async () => {
    const res = await createDraftAction({ name: "My Draft", ...snapshot });
    expect("ok" in res && res.ok).toBe(true);
    const count = await PortfolioDraft.countDocuments({ workspaceId: mockCtx.workspace._id });
    expect(count).toBe(1);
  });

  it("rejects an empty name with name_required", async () => {
    const res = await createDraftAction({ name: "  ", ...snapshot });
    expect(res).toEqual({ error: "name_required" });
  });

  it("rejects a duplicate name with name_taken", async () => {
    await createDraftAction({ name: "Dupe", ...snapshot });
    const res = await createDraftAction({ name: "Dupe", ...snapshot });
    expect(res).toEqual({ error: "name_taken" });
  });

  it("enforces the free-plan cap of 5", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await createDraftAction({ name: `D${i}`, ...snapshot });
      expect("ok" in r).toBe(true);
    }
    const res = await createDraftAction({ name: "D6", ...snapshot });
    expect(res).toEqual({ error: "draft_limit_reached:5" });
  });

  it("lets pro create past 15 (unlimited)", async () => {
    setWorkspace("pro");
    for (let i = 0; i < 16; i++) {
      const r = await createDraftAction({ name: `P${i}`, ...snapshot });
      expect("ok" in r).toBe(true);
    }
  });

  it("blocks staff (owner_only)", async () => {
    mockCtx.role = "staff";
    const res = await createDraftAction({ name: "X", ...snapshot });
    expect(res).toEqual({ error: "owner_only" });
  });
});

describe("updateDraftAction", () => {
  it("updates by id and keeps the same name (no false name_taken)", async () => {
    const created = await createDraftAction({ name: "Keep", ...snapshot });
    if (!("ok" in created)) throw new Error("setup failed");
    const res = await updateDraftAction({ id: created.draft.id, name: "Keep", ...snapshot });
    expect("ok" in res && res.ok).toBe(true);
  });

  it("rejects renaming onto another draft's name (name_taken)", async () => {
    await createDraftAction({ name: "Taken", ...snapshot });
    const b = await createDraftAction({ name: "B", ...snapshot });
    if (!("ok" in b)) throw new Error("setup failed");
    const res = await updateDraftAction({ id: b.draft.id, name: "Taken", ...snapshot });
    expect(res).toEqual({ error: "name_taken" });
  });

  it("cannot update another workspace's draft (tenant isolation)", async () => {
    const otherWs = new Types.ObjectId();
    const foreign = await PortfolioDraft.create({ workspaceId: otherWs, name: "Foreign", ...snapshot });
    const res = await updateDraftAction({ id: String(foreign._id), name: "Hijacked", ...snapshot });
    expect(res).toEqual({ error: "draft_not_found" });
    const still = await PortfolioDraft.findById(foreign._id).lean();
    expect(still!.name).toBe("Foreign");
  });
});

describe("deleteDraftAction", () => {
  it("deletes only within the workspace", async () => {
    const created = await createDraftAction({ name: "Bye", ...snapshot });
    if (!("ok" in created)) throw new Error("setup failed");
    const res = await deleteDraftAction(created.draft.id);
    expect(res).toEqual({ ok: true });
    expect(await PortfolioDraft.countDocuments({})).toBe(0);
  });
});

describe("listDraftsAction / getDraftAction", () => {
  it("lists summaries newest-first and loads a full draft", async () => {
    await createDraftAction({ name: "First", ...snapshot });
    const second = await createDraftAction({ name: "Second", ...snapshot });
    if (!("ok" in second)) throw new Error("setup failed");

    const list = await listDraftsAction();
    expect(list.map((d) => d.name)).toEqual(["Second", "First"]);

    const full = await getDraftAction(second.draft.id);
    expect("ok" in full && full.ok).toBe(true);
    if ("ok" in full) expect(full.draft.brandKit).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test --run _draftActions.test`
Expected: FAIL — cannot find module `./_draftActions`.

- [ ] **Step 3: Implement the CRUD actions**

```ts
// app/[locale]/(app)/portfolio/_draftActions.ts
"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, PortfolioDraft, type PortfolioDraftDoc } from "@/lib/db/models";
import type { PlanTier } from "@/lib/db/models/Workspace";
import { createDraftSchema, updateDraftSchema } from "@/lib/validators/portfolioDraft";
import { draftCapForPlan } from "@/lib/page-builder/drafts";
import { reconcileGalleryImages, reconcileFeaturedCollections } from "@/lib/page-builder/reconcile";
import { PORTFOLIO_TEMPLATE_IDS } from "@/lib/page-builder/templates/types";
import type { PuckData } from "@/lib/page-builder/types";

export type DraftSummary = {
  id: string;
  name: string;
  templateId: string;
  updatedAt: string;
};

export type FullDraft = DraftSummary & {
  data: { home: PuckData | null; gallery: PuckData | null };
  brandKit: unknown;
  contact: unknown;
  header: unknown;
  collectionsPopup: unknown;
  formLocale: string;
};

export type DraftMutationResult = { ok: true; draft: DraftSummary } | { error: string };
export type DraftLoadResult = { ok: true; draft: FullDraft } | { error: string };
export type DraftActionResult = { ok: true } | { error: string };

function toSummary(doc: PortfolioDraftDoc): DraftSummary {
  return {
    id: String(doc._id),
    name: doc.name,
    templateId: doc.templateId ?? "",
    updatedAt: (doc.updatedAt instanceof Date ? doc.updatedAt : new Date()).toISOString(),
  };
}

export async function createDraftAction(input: unknown): Promise<DraftMutationResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = createDraftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "invalid_data" };

  await connectDB();
  const workspaceId = ctx.workspace._id;
  const cap = draftCapForPlan(ctx.workspace.plan as PlanTier);

  // Name-uniqueness + cap are checked-and-applied in one transaction so two tabs
  // can't both slip past the cap or create the same name (replica set required —
  // the in-memory test Mongo is one).
  const session = await mongoose.startSession();
  try {
    let result: DraftMutationResult = { error: "invalid_data" };
    await session.withTransaction(async () => {
      const dupe = await PortfolioDraft.findOne({ workspaceId, name: parsed.data.name })
        .select({ _id: 1 })
        .session(session)
        .lean();
      if (dupe) {
        result = { error: "name_taken" };
        return;
      }
      if (Number.isFinite(cap)) {
        const count = await PortfolioDraft.countDocuments({ workspaceId }).session(session);
        if (count >= cap) {
          result = { error: `draft_limit_reached:${cap}` };
          return;
        }
      }
      const [doc] = await PortfolioDraft.create(
        [
          {
            workspaceId,
            name: parsed.data.name,
            templateId: parsed.data.templateId || "",
            data: parsed.data.data,
            brandKit: parsed.data.brandKit,
            contact: parsed.data.contact,
            header: parsed.data.header,
            collectionsPopup: parsed.data.collectionsPopup,
            formLocale: parsed.data.formLocale || "",
          },
        ],
        { session }
      );
      result = { ok: true, draft: toSummary(doc) };
    });
    if ("ok" in result) revalidatePath("/portfolio");
    return result;
  } finally {
    await session.endSession();
  }
}

export async function updateDraftAction(input: unknown): Promise<DraftMutationResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = updateDraftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "invalid_data" };

  await connectDB();
  const workspaceId = ctx.workspace._id;

  // Uniqueness against OTHER drafts only — a draft may keep its own name.
  const dupe = await PortfolioDraft.findOne({
    workspaceId,
    name: parsed.data.name,
    _id: { $ne: parsed.data.id },
  })
    .select({ _id: 1 })
    .lean();
  if (dupe) return { error: "name_taken" };

  const doc = await PortfolioDraft.findOneAndUpdate(
    { _id: parsed.data.id, workspaceId },
    {
      $set: {
        name: parsed.data.name,
        templateId: parsed.data.templateId || "",
        data: parsed.data.data,
        brandKit: parsed.data.brandKit,
        contact: parsed.data.contact,
        header: parsed.data.header,
        collectionsPopup: parsed.data.collectionsPopup,
        formLocale: parsed.data.formLocale || "",
      },
    },
    { new: true }
  );
  if (!doc) return { error: "draft_not_found" };
  revalidatePath("/portfolio");
  return { ok: true, draft: toSummary(doc) };
}

export async function deleteDraftAction(id: unknown): Promise<DraftActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };
  const idParsed = z.string().min(1).max(64).safeParse(id);
  if (!idParsed.success) return { error: "invalid_id" };

  await connectDB();
  await PortfolioDraft.deleteOne({ _id: idParsed.data, workspaceId: ctx.workspace._id });
  revalidatePath("/portfolio");
  return { ok: true };
}

export async function listDraftsAction(): Promise<DraftSummary[]> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return [];
  await connectDB();
  const docs = await PortfolioDraft.find({ workspaceId: ctx.workspace._id })
    .sort({ updatedAt: -1 })
    .select({ name: 1, templateId: 1, updatedAt: 1 })
    .lean();
  return docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    templateId: d.templateId ?? "",
    updatedAt: (d.updatedAt instanceof Date ? d.updatedAt : new Date()).toISOString(),
  }));
}

export async function getDraftAction(id: unknown): Promise<DraftLoadResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };
  const idParsed = z.string().min(1).max(64).safeParse(id);
  if (!idParsed.success) return { error: "invalid_id" };

  await connectDB();
  const doc = await PortfolioDraft.findOne({ _id: idParsed.data, workspaceId: ctx.workspace._id }).lean();
  if (!doc) return { error: "draft_not_found" };
  return {
    ok: true,
    draft: {
      id: String(doc._id),
      name: doc.name,
      templateId: doc.templateId ?? "",
      data: {
        home: (doc.data?.home as PuckData | null) ?? null,
        gallery: (doc.data?.gallery as PuckData | null) ?? null,
      },
      brandKit: doc.brandKit ?? null,
      contact: doc.contact ?? null,
      header: doc.header ?? null,
      collectionsPopup: doc.collectionsPopup ?? null,
      formLocale: doc.formLocale ?? "",
    },
  };
}
```

> `reconcileGalleryImages` / `reconcileFeaturedCollections` / `PORTFOLIO_TEMPLATE_IDS` imports are unused until Task 5; add them now so Task 5 only appends a function. If your linter blocks unused imports, add them in Task 5 instead.

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm test --run _draftActions.test`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(app)/portfolio/_draftActions.ts app/[locale]/(app)/portfolio/_draftActions.test.ts
git commit -m "feat(portfolio): draft CRUD server actions (cap, uniqueness, tenant isolation)"
```

---

## Task 5: publishDraftAction (supersedes publishPortfolioAction)

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_draftActions.ts` (append)
- Test: `app/[locale]/(app)/portfolio/_draftActions.test.ts` (append)

- [ ] **Step 1: Add the failing test (append to the test file)**

```ts
// append to _draftActions.test.ts
import { Workspace } from "@/lib/db/models";
import { publishDraftAction } from "./_draftActions";

describe("publishDraftAction", () => {
  it("copies the draft into publicPage and stamps publishedAt", async () => {
    await Workspace.create({
      _id: mockCtx.workspace._id,
      slug: "studio-aurora",
      name: "Studio Aurora",
      ownerUserId: "user_owner",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
      plan: "free",
      publicPage: { data: { home: null, gallery: null }, latestVersion: 0 },
    });
    const created = await createDraftAction({
      name: "Live",
      ...snapshot,
      data: { home: { content: [{ type: "HeroPreset", props: { id: "h" } }], root: {} }, gallery: { content: [], root: {} } },
    });
    if (!("ok" in created)) throw new Error("setup failed");

    const res = await publishDraftAction(created.draft.id);
    expect(res).toEqual({ ok: true });

    const ws = await Workspace.findById(mockCtx.workspace._id).lean();
    expect(ws!.publicPage!.publishedAt).toBeInstanceOf(Date);
    expect((ws!.publicPage!.data!.home as { content: unknown[] }).content.length).toBe(1);
  });

  it("rejects a draft from another workspace (tenant isolation)", async () => {
    const foreign = await PortfolioDraft.create({ workspaceId: new Types.ObjectId(), name: "F", ...snapshot });
    const res = await publishDraftAction(String(foreign._id));
    expect(res).toEqual({ error: "draft_not_found" });
  });
});
```

> The CRUD test file mocks `connectDB`, so `Workspace.create` writes to the in-memory Mongo that `startInMemoryMongo` connected. Creating the Workspace with an explicit `_id` matching `mockCtx.workspace._id` lets the publish action find it.

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test --run _draftActions.test`
Expected: FAIL — `publishDraftAction` is not exported.

- [ ] **Step 3: Implement (append to `_draftActions.ts`)**

```ts
// append to _draftActions.ts
export async function publishDraftAction(id: unknown): Promise<DraftActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };
  const idParsed = z.string().min(1).max(64).safeParse(id);
  if (!idParsed.success) return { error: "invalid_id" };

  await connectDB();
  const workspaceId = ctx.workspace._id;
  const doc = await PortfolioDraft.findOne({ _id: idParsed.data, workspaceId }).lean();
  if (!doc) return { error: "draft_not_found" };

  const wsIdStr = String(workspaceId);
  const home = (doc.data?.home as PuckData | null) ?? null;
  const gallery = (doc.data?.gallery as PuckData | null) ?? null;

  const set: Record<string, unknown> = {};
  set["publicPage.data.home"] = home
    ? await reconcileFeaturedCollections(wsIdStr, await reconcileGalleryImages(wsIdStr, home))
    : null;
  set["publicPage.data.gallery"] = gallery
    ? await reconcileFeaturedCollections(wsIdStr, await reconcileGalleryImages(wsIdStr, gallery))
    : null;
  if (doc.brandKit) set["publicPage.brandKit"] = doc.brandKit;
  if (doc.contact) set["publicPage.contact"] = doc.contact;
  if (doc.header) set["publicPage.header"] = doc.header;
  if (doc.collectionsPopup) set["publicPage.collectionsPopup"] = doc.collectionsPopup;
  set["publicPage.formLocale"] = doc.formLocale ?? "";
  set["publicPage.templateId"] = PORTFOLIO_TEMPLATE_IDS.includes(
    (doc.templateId ?? "") as (typeof PORTFOLIO_TEMPLATE_IDS)[number]
  )
    ? doc.templateId
    : "minimal";

  const now = new Date();
  set["publicPage.publishedAt"] = now;
  set["publicPage.lastPublishedAt"] = now;

  await Workspace.updateOne({ _id: workspaceId }, { $set: set });

  revalidatePath(`/w/${ctx.workspace.slug}`);
  revalidatePath(`/w/${ctx.workspace.slug}/gallery`);
  revalidatePath("/sitemap.xml");
  return { ok: true };
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm test --run _draftActions.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(app)/portfolio/_draftActions.ts app/[locale]/(app)/portfolio/_draftActions.test.ts
git commit -m "feat(portfolio): publish the active draft into publicPage"
```

---

## Task 6: Legacy migration helper

**Files:**
- Create: `lib/page-builder/migrateDraft.ts`
- Test: `lib/page-builder/migrateDraft.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/page-builder/migrateDraft.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace, PortfolioDraft } from "@/lib/db/models";
import { ensureLegacyDraftMigrated } from "./migrateDraft";

async function makeWorkspace(home: unknown) {
  return Workspace.create({
    slug: `s-${Math.round(Math.random() * 1e9)}`,
    name: "Studio",
    ownerUserId: "u",
    clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
    currency: "PHP",
    plan: "free",
    publicPage: { data: { home, gallery: null }, latestVersion: 0 },
  });
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

describe("ensureLegacyDraftMigrated", () => {
  it("creates one 'New Draft' from existing publicPage.data", async () => {
    const ws = await makeWorkspace({ content: [{ type: "HeroPreset", props: { id: "h" } }], root: {} });
    await ensureLegacyDraftMigrated(ws._id);
    const drafts = await PortfolioDraft.find({ workspaceId: ws._id }).lean();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].name).toBe("New Draft");
  });

  it("is idempotent — running twice does not duplicate", async () => {
    const ws = await makeWorkspace({ content: [], root: {} });
    await ensureLegacyDraftMigrated(ws._id);
    await ensureLegacyDraftMigrated(ws._id);
    expect(await PortfolioDraft.countDocuments({ workspaceId: ws._id })).toBe(1);
  });

  it("no-ops when publicPage.data is empty", async () => {
    const ws = await makeWorkspace(null);
    await ensureLegacyDraftMigrated(ws._id);
    expect(await PortfolioDraft.countDocuments({ workspaceId: ws._id })).toBe(0);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test --run migrateDraft.test`
Expected: FAIL — cannot find module `./migrateDraft`.

- [ ] **Step 3: Implement**

```ts
// lib/page-builder/migrateDraft.ts
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, PortfolioDraft } from "@/lib/db/models";
import { DEFAULT_DRAFT_NAME } from "./drafts";

/**
 * One-time, idempotent migration: when a workspace has no drafts yet but already
 * has portfolio content in publicPage.data, fold that content into a single
 * "New Draft" so the owner keeps editing their current portfolio as a draft.
 * Runs on first editor entry post-ship.
 */
export async function ensureLegacyDraftMigrated(workspaceId: Types.ObjectId): Promise<void> {
  await connectDB();
  const existing = await PortfolioDraft.countDocuments({ workspaceId });
  if (existing > 0) return;

  const ws = await Workspace.findById(workspaceId).select({ publicPage: 1 }).lean();
  const pp = ws?.publicPage;
  const home = pp?.data?.home ?? null;
  const gallery = pp?.data?.gallery ?? null;
  if (!home && !gallery) return;

  await PortfolioDraft.create({
    workspaceId,
    name: DEFAULT_DRAFT_NAME,
    templateId: pp?.templateId ?? "",
    data: { home, gallery },
    brandKit: pp?.brandKit ?? null,
    contact: pp?.contact ?? null,
    header: pp?.header ?? null,
    collectionsPopup: pp?.collectionsPopup ?? null,
    formLocale: pp?.formLocale ?? "",
  });
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm test --run migrateDraft.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/migrateDraft.ts lib/page-builder/migrateDraft.test.ts
git commit -m "feat(portfolio): migrate legacy publicPage content into a New Draft"
```

---

## Task 7: "I'll start from scratch" template

**Files:**
- Create: `lib/page-builder/templates/scratch.ts`
- Create: `public/template-previews/scratch.svg`
- Modify: `lib/page-builder/templates/types.ts` (add id), `lib/page-builder/templates/index.ts` (register)
- Test: `lib/page-builder/templates/scratch.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/page-builder/templates/scratch.test.ts
import { describe, it, expect } from "vitest";
import { scratchTemplate } from "./scratch";
import { getTemplate, PORTFOLIO_TEMPLATES } from "./index";

describe("scratchTemplate", () => {
  it("seeds empty home and gallery zones", () => {
    const data = scratchTemplate.seedData({ workspace: { name: "X", branding: null } });
    expect(data.home).toEqual({ content: [], root: {} });
    expect(data.gallery).toEqual({ content: [], root: {} });
  });

  it("is registered and resolvable by id, in the reserved last slot", () => {
    expect(getTemplate("scratch")).toBe(scratchTemplate);
    expect(PORTFOLIO_TEMPLATES[PORTFOLIO_TEMPLATES.length - 1].id).toBe("scratch");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test --run scratch.test`
Expected: FAIL — cannot find module `./scratch`.

- [ ] **Step 3: Add the id to the canonical list**

In `lib/page-builder/templates/types.ts`, append `"scratch"` as the last entry:

```ts
export const PORTFOLIO_TEMPLATE_IDS = [
  "wedding-photographer",
  "event-photographer",
  "planner",
  "venue-stylist",
  "minimal",
  "scratch",
] as const;
```

- [ ] **Step 4: Create the template**

```ts
// lib/page-builder/templates/scratch.ts
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import { zone } from "./_blocks";

// An intentionally empty canvas. Brand kit, nav, collections popup, and contact
// form all fall back to their defaults (DEFAULT_BRAND_KIT here; header/popup keep
// the editor defaults applied when this template is chosen).
export const scratchTemplate: PortfolioTemplate = {
  id: "scratch",
  label: "I'll start from scratch",
  businessType: "other",
  description: "An empty canvas. Add blocks yourself, your way.",
  previewImage: "/template-previews/scratch.svg",
  defaultBrandKit: { ...DEFAULT_BRAND_KIT },
  defaultContact: {
    title: "Get in touch",
    description: "Send a message and we'll get back to you soon.",
    buttonStyle: "solid",
    buttonColor: "foreground",
  },
  seedData: () => ({
    home: zone([]),
    gallery: zone([]),
  }),
};
```

- [ ] **Step 5: Register it (last slot)**

In `lib/page-builder/templates/index.ts`, import and append:

```ts
import { scratchTemplate } from "./scratch";
// ...
export const PORTFOLIO_TEMPLATES: PortfolioTemplate[] = [
  weddingPhotographerTemplate,
  eventPhotographerTemplate,
  plannerTemplate,
  venueStylistTemplate,
  minimalTemplate,
  scratchTemplate,
];
```

- [ ] **Step 6: Create the preview SVG**

```svg
<!-- public/template-previews/scratch.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200" role="img" aria-label="Empty canvas">
  <rect width="320" height="200" fill="#ffffff" stroke="#e5e5e5"/>
  <rect x="16" y="16" width="288" height="168" fill="none" stroke="#cccccc" stroke-dasharray="6 6"/>
  <line x1="160" y1="80" x2="160" y2="120" stroke="#999999" stroke-width="2"/>
  <line x1="140" y1="100" x2="180" y2="100" stroke="#999999" stroke-width="2"/>
</svg>
```

- [ ] **Step 7: Run it, verify it passes**

Run: `pnpm test --run scratch.test`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add lib/page-builder/templates/scratch.ts lib/page-builder/templates/types.ts lib/page-builder/templates/index.ts lib/page-builder/templates/scratch.test.ts public/template-previews/scratch.svg
git commit -m "feat(portfolio): add 'I'll start from scratch' template"
```

---

## Task 8: DraftNameEditor component

**Files:**
- Create: `app/[locale]/(app)/portfolio/_components/DraftNameEditor.tsx`
- Test: `app/[locale]/(app)/portfolio/_components/DraftNameEditor.test.tsx`

A presentational, controlled component: shows the draft name + a pencil button; clicking pencil swaps to an `<Input>` with check (✓) and cancel (✕). Check calls `onCommit(name)` (the parent updates the working buffer, **not** the DB). Optional `error` renders an inline validation message. No i18n.

- [ ] **Step 1: Write the failing test**

```tsx
// DraftNameEditor.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraftNameEditor } from "./DraftNameEditor";

describe("DraftNameEditor", () => {
  it("shows the name and a pencil button in read mode", () => {
    render(<DraftNameEditor name="New Draft" onCommit={vi.fn()} error={null} />);
    expect(screen.getByText("New Draft")).toBeTruthy();
    expect(screen.getByRole("button", { name: /rename draft/i })).toBeTruthy();
  });

  it("edits then commits the new name", () => {
    const onCommit = vi.fn();
    render(<DraftNameEditor name="New Draft" onCommit={onCommit} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: /rename draft/i }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Spring Wedding" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm name/i }));
    expect(onCommit).toHaveBeenCalledWith("Spring Wedding");
  });

  it("cancel restores the original name without committing", () => {
    const onCommit = vi.fn();
    render(<DraftNameEditor name="New Draft" onCommit={onCommit} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: /rename draft/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Throwaway" } });
    fireEvent.click(screen.getByRole("button", { name: /cancel rename/i }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText("New Draft")).toBeTruthy();
  });

  it("renders an inline error", () => {
    render(<DraftNameEditor name="New Draft" onCommit={vi.fn()} error="A draft with this name already exists" />);
    expect(screen.getByRole("alert").textContent).toMatch(/already exists/i);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test --run DraftNameEditor.test`
Expected: FAIL — cannot find module `./DraftNameEditor`.

- [ ] **Step 3: Implement**

```tsx
// DraftNameEditor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DraftNameEditor({
  name,
  onCommit,
  error,
}: {
  name: string;
  onCommit: (next: string) => void;
  error: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the field in sync when the active draft changes from outside.
  useEffect(() => {
    if (!editing) setValue(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    onCommit(value);
    setEditing(false);
  }
  function cancel() {
    setValue(name);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate text-sm font-medium" title={name}>
          {name}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          aria-label="Rename draft"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          className="h-7 w-44 text-sm"
          aria-label="Draft name"
          aria-invalid={Boolean(error)}
        />
        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label="Confirm name" onClick={commit}>
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label="Cancel rename" onClick={cancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm test --run DraftNameEditor.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(app)/portfolio/_components/DraftNameEditor.tsx app/[locale]/(app)/portfolio/_components/DraftNameEditor.test.tsx
git commit -m "feat(portfolio): inline draft name editor"
```

---

## Task 9: DraftsDialog component

**Files:**
- Create: `app/[locale]/(app)/portfolio/_components/DraftsDialog.tsx`
- Test: `app/[locale]/(app)/portfolio/_components/DraftsDialog.test.tsx`

Grid of saved drafts mirroring `TemplatePickerDialog`. Empty-state fallback copy. Footer **Add new draft**. The active draft shows an "Active" pill. Each card: Apply + Delete (delete behind an `AlertDialog` confirm). Purely presentational — parent supplies `drafts`, `activeDraftId`, and the `onApply` / `onDelete` / `onAddNew` callbacks. No i18n.

- [ ] **Step 1: Write the failing test**

```tsx
// DraftsDialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraftsDialog } from "./DraftsDialog";
import type { DraftSummary } from "../_draftActions";

const drafts: DraftSummary[] = [
  { id: "a", name: "Spring", templateId: "minimal", updatedAt: new Date().toISOString() },
  { id: "b", name: "Bold", templateId: "scratch", updatedAt: new Date().toISOString() },
];

function setup(props: Partial<React.ComponentProps<typeof DraftsDialog>> = {}) {
  return render(
    <DraftsDialog
      open
      onOpenChange={vi.fn()}
      drafts={drafts}
      activeDraftId="a"
      onApply={vi.fn()}
      onDelete={vi.fn()}
      onAddNew={vi.fn()}
      {...props}
    />
  );
}

describe("DraftsDialog", () => {
  it("lists drafts and marks the active one", () => {
    setup();
    expect(screen.getByText("Spring")).toBeTruthy();
    expect(screen.getByText("Bold")).toBeTruthy();
    expect(screen.getByText(/active/i)).toBeTruthy();
  });

  it("shows empty-state copy and Add new draft when there are no drafts", () => {
    const onAddNew = vi.fn();
    setup({ drafts: [], activeDraftId: null, onAddNew });
    expect(screen.getByText(/no drafts yet/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add new draft/i }));
    expect(onAddNew).toHaveBeenCalled();
  });

  it("applies a draft", () => {
    const onApply = vi.fn();
    setup({ onApply });
    fireEvent.click(screen.getByRole("button", { name: /apply Bold/i }));
    expect(onApply).toHaveBeenCalledWith("b");
  });

  it("confirms before deleting", () => {
    const onDelete = vi.fn();
    setup({ onDelete });
    fireEvent.click(screen.getByRole("button", { name: /delete Bold/i }));
    fireEvent.click(screen.getByRole("button", { name: /^delete draft$/i }));
    expect(onDelete).toHaveBeenCalledWith("b");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test --run DraftsDialog.test`
Expected: FAIL — cannot find module `./DraftsDialog`.

- [ ] **Step 3: Implement**

```tsx
// DraftsDialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DraftSummary } from "../_draftActions";

const L = {
  title: "Your drafts",
  subtitle: "Pick a saved layout to load it onto the canvas. Loading replaces what you're editing now.",
  empty: "No drafts yet. Save your current work, or start a new one from a template.",
  active: "Active",
  apply: "Apply",
  delete: "Delete",
  addNew: "Add new draft",
  close: "Close",
  confirmTitle: "Delete this draft?",
  confirmBody: "This permanently removes the saved draft. This can't be undone.",
  confirmAction: "Delete draft",
  cancel: "Cancel",
};

export function DraftsDialog({
  open,
  onOpenChange,
  drafts,
  activeDraftId,
  onApply,
  onDelete,
  onAddNew,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: DraftSummary[];
  activeDraftId: string | null;
  onApply: (id: string) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<DraftSummary | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <p className="text-sm text-muted-foreground">{L.subtitle}</p>

          {drafts.length === 0 ? (
            <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {L.empty}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {drafts.map((d) => {
                const isActive = d.id === activeDraftId;
                return (
                  <li
                    key={d.id}
                    className={cn(
                      "flex flex-col gap-2 border p-3",
                      isActive ? "border-foreground" : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold" title={d.name}>
                        {d.name}
                      </span>
                      {isActive && (
                        <span className="border border-border px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                          {L.active}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        aria-label={`Apply ${d.name}`}
                        onClick={() => onApply(d.id)}
                      >
                        {L.apply}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${d.name}`}
                        onClick={() => setPendingDelete(d)}
                      >
                        {L.delete}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {L.close}
          </Button>
          <Button type="button" onClick={onAddNew}>
            {L.addNew}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{L.confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>{L.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              {L.confirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm test --run DraftsDialog.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(app)/portfolio/_components/DraftsDialog.tsx app/[locale]/(app)/portfolio/_components/DraftsDialog.test.tsx
git commit -m "feat(portfolio): drafts board dialog with active pill + delete confirm"
```

---

## Task 10: PortfolioEntryDialog component

**Files:**
- Create: `app/[locale]/(app)/portfolio/_components/PortfolioEntryDialog.tsx`
- Test: `app/[locale]/(app)/portfolio/_components/PortfolioEntryDialog.test.tsx`

Shown on every editor load. Three options, gated: *Continue where you left off* (enabled only if `canContinue`), *Load an existing draft* (enabled only if `hasDrafts`), *Start from scratch* (always). Presentational; parent decides gating + handlers. No i18n.

- [ ] **Step 1: Write the failing test**

```tsx
// PortfolioEntryDialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortfolioEntryDialog } from "./PortfolioEntryDialog";

function setup(props: Partial<React.ComponentProps<typeof PortfolioEntryDialog>> = {}) {
  return render(
    <PortfolioEntryDialog
      open
      canContinue
      hasDrafts
      onContinue={vi.fn()}
      onLoadExisting={vi.fn()}
      onStartScratch={vi.fn()}
      {...props}
    />
  );
}

describe("PortfolioEntryDialog", () => {
  it("calls the right handler for each option", () => {
    const onContinue = vi.fn();
    const onLoadExisting = vi.fn();
    const onStartScratch = vi.fn();
    setup({ onContinue, onLoadExisting, onStartScratch });
    fireEvent.click(screen.getByRole("button", { name: /continue where you left off/i }));
    fireEvent.click(screen.getByRole("button", { name: /load an existing draft/i }));
    fireEvent.click(screen.getByRole("button", { name: /start from scratch/i }));
    expect(onContinue).toHaveBeenCalled();
    expect(onLoadExisting).toHaveBeenCalled();
    expect(onStartScratch).toHaveBeenCalled();
  });

  it("disables continue when nothing to resume and load when no drafts", () => {
    setup({ canContinue: false, hasDrafts: false });
    expect(screen.getByRole("button", { name: /continue where you left off/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /load an existing draft/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /start from scratch/i })).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test --run PortfolioEntryDialog.test`
Expected: FAIL — cannot find module `./PortfolioEntryDialog`.

- [ ] **Step 3: Implement**

```tsx
// PortfolioEntryDialog.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const L = {
  title: "Welcome back",
  subtitle: "Where would you like to start?",
  continue: "Continue where you left off",
  continueHint: "Resume your most recent unsaved edits.",
  load: "Load an existing draft",
  loadHint: "Open one of your saved portfolio layouts.",
  scratch: "Start from scratch",
  scratchHint: "Pick a template (or an empty canvas) and begin a new draft.",
};

function Option({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className="flex h-auto w-full flex-col items-start gap-1 p-4 text-left"
    >
      <span className="font-semibold">{label}</span>
      <span className="text-xs font-normal text-muted-foreground">{hint}</span>
    </Button>
  );
}

export function PortfolioEntryDialog({
  open,
  canContinue,
  hasDrafts,
  onContinue,
  onLoadExisting,
  onStartScratch,
}: {
  open: boolean;
  canContinue: boolean;
  hasDrafts: boolean;
  onContinue: () => void;
  onLoadExisting: () => void;
  onStartScratch: () => void;
}) {
  // Not dismissible by backdrop/escape: the user must pick a starting point.
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
          <DialogDescription>{L.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Option label={L.continue} hint={L.continueHint} disabled={!canContinue} onClick={onContinue} />
          <Option label={L.load} hint={L.loadHint} disabled={!hasDrafts} onClick={onLoadExisting} />
          <Option label={L.scratch} hint={L.scratchHint} onClick={onStartScratch} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

> Verify the project's `DialogContent` supports `showCloseButton` and `onPointerDownOutside`/`onEscapeKeyDown` props (Radix passes the latter two through). If `showCloseButton` is not a prop on the local wrapper, drop it and instead hide the close button via the component's API or omit it.

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm test --run PortfolioEntryDialog.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(app)/portfolio/_components/PortfolioEntryDialog.tsx app/[locale]/(app)/portfolio/_components/PortfolioEntryDialog.test.tsx
git commit -m "feat(portfolio): entry chooser dialog (continue / load / scratch)"
```

---

## Task 11: UnsavedChangesDialog component

**Files:**
- Create: `app/[locale]/(app)/portfolio/_components/UnsavedChangesDialog.tsx`
- Test: `app/[locale]/(app)/portfolio/_components/UnsavedChangesDialog.test.tsx`

A confirm gate before switching away from a dirty/new draft. **Save changes** persists then proceeds; **Discard** wipes and proceeds; **Cancel** stays. Presentational. No i18n.

- [ ] **Step 1: Write the failing test**

```tsx
// UnsavedChangesDialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

describe("UnsavedChangesDialog", () => {
  it("fires save / discard / cancel", () => {
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    const onCancel = vi.fn();
    render(
      <UnsavedChangesDialog open onSave={onSave} onDiscard={onDiscard} onCancel={onCancel} saving={false} />
    );
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    fireEvent.click(screen.getByRole("button", { name: /keep editing/i }));
    expect(onSave).toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm test --run UnsavedChangesDialog.test`
Expected: FAIL — cannot find module `./UnsavedChangesDialog`.

- [ ] **Step 3: Implement**

```tsx
// UnsavedChangesDialog.tsx
"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const L = {
  title: "Save your changes?",
  body: "You have unsaved changes on this draft. Switching now will lose them unless you save.",
  save: "Save changes",
  discard: "Discard",
  cancel: "Keep editing",
};

export function UnsavedChangesDialog({
  open,
  saving,
  onSave,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (!next && !saving ? onCancel() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{L.title}</AlertDialogTitle>
          <AlertDialogDescription>{L.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            {L.cancel}
          </Button>
          <Button type="button" variant="outline" onClick={onDiscard} disabled={saving}>
            {L.discard}
          </Button>
          <Button type="button" onClick={onSave} loading={saving} disabled={saving}>
            {L.save}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

> Verify the local `Button` supports a `loading` prop (it does in `TemplatePickerDialog`'s `AlertDialogAction`). If not, drop `loading` and rely on `disabled`.

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm test --run UnsavedChangesDialog.test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(app)/portfolio/_components/UnsavedChangesDialog.tsx app/[locale]/(app)/portfolio/_components/UnsavedChangesDialog.test.tsx
git commit -m "feat(portfolio): unsaved-changes guard dialog"
```

---

## Task 12: EditorShell — draft state machine + wiring

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/EditorShell.tsx`

> **Read the current `EditorShell.tsx` in full before editing.** This task describes behavioral changes; anchor the exact insertion points against the live file. The file already: keeps a localStorage working buffer (`draftKey = gallurio:portfolio-draft:${slug}`), holds `brandKit`/`contact`/`headerConfig`/`collectionsPopup`/`formLocale` React state, persists those + zone data to the buffer on change, and flushes everything to the server only inside `handlePublish()`. We extend that buffer with draft identity, route saves to drafts, and replace the publish path.

This task has no standalone unit test (it's integration glue exercised by the component tests already written and by manual verification in Task 15). Keep each step small and run `pnpm typecheck` after the structural changes.

- [ ] **Step 1: Add new props for drafts**

Extend the `Props` type and destructuring with:

```ts
import type { DraftSummary } from "../_draftActions";
// ...
  /** Saved drafts for this workspace (summaries), newest-first. */
  initialDrafts: DraftSummary[];
  /** Id of the draft the working buffer is currently tied to (server-resolved active), or null. */
  initialActiveDraftId: string | null;
  /** Name of the active draft (server-resolved), defaults to "New Draft". */
  initialActiveDraftName: string;
```

- [ ] **Step 2: Extend the localStorage buffer with draft identity**

Add `draftId` and `draftName` to the `PortfolioBrowserDraft` type and to `persistLocalDraft`/restore. Bump `LOCAL_DRAFT_VERSION` by 1 so any stale pre-drafts buffer is ignored on first load (the restore guard already drops mismatched versions):

```ts
const LOCAL_DRAFT_VERSION = 2; // was 1 — drafts identity added

type PortfolioBrowserDraft = {
  version: typeof LOCAL_DRAFT_VERSION;
  draftId: string | null;
  draftName: string;
  data: Record<Zone, PuckData>;
  brandKit: PortfolioBrandKit;
  contact: PortfolioContactConfig;
  formLocale: string;
  headerConfig: PortfolioHeaderConfig;
  collectionsPopup: PortfolioCollectionsPopupConfig;
};
```

Include `draftId`/`draftName` in the object written by `persistLocalDraft`, and read them back in the restore effect.

- [ ] **Step 3: Add draft state + dirty tracking**

```ts
import {
  createDraftAction,
  updateDraftAction,
  deleteDraftAction,
  getDraftAction,
  publishDraftAction,
  type DraftSummary,
} from "../_draftActions";
import { DEFAULT_DRAFT_NAME } from "@/lib/page-builder/drafts";
import { DEFAULT_HEADER_CONFIG } from "@/lib/page-builder/types";
// ...
const [drafts, setDrafts] = useState<DraftSummary[]>(initialDrafts);
const [activeDraftId, setActiveDraftId] = useState<string | null>(initialActiveDraftId);
const [draftName, setDraftName] = useState(initialActiveDraftName || DEFAULT_DRAFT_NAME);
const [nameError, setNameError] = useState<string | null>(null);
const [savingChanges, setSavingChanges] = useState(false);
const [draftsOpen, setDraftsOpen] = useState(false);
const [entryOpen, setEntryOpen] = useState(true); // always shown on load
const [pendingSwitch, setPendingSwitch] = useState<null | (() => void)>(null);

// Baseline = JSON of the last-saved snapshot. null for a never-saved new draft.
const savedSnapshotRef = useRef<string | null>(null);
const [isDirty, setIsDirty] = useState(false);
```

Add a snapshot builder + a recompute that runs whenever any draft field changes:

```ts
const buildDraftSnapshot = useCallback(() => ({
  templateId,
  data: { home: zoneDataRef.current.home, gallery: zoneDataRef.current.gallery },
  brandKit,
  contact,
  header: headerConfig,
  collectionsPopup,
  formLocale,
}), [templateId, brandKit, contact, headerConfig, collectionsPopup, formLocale]);

const recomputeDirty = useCallback(() => {
  const current = JSON.stringify({ name: draftName, ...buildDraftSnapshot() });
  setIsDirty(savedSnapshotRef.current === null ? true : current !== savedSnapshotRef.current);
}, [draftName, buildDraftSnapshot]);
```

Call `recomputeDirty()` inside `handleChange` (after writing the buffer) and from an effect keyed on `[brandKit, contact, headerConfig, collectionsPopup, formLocale, draftName, recomputeDirty]`. Initialize `savedSnapshotRef.current` on mount: if `activeDraftId` is set, set it to `JSON.stringify({ name: draftName, ...buildDraftSnapshot() })` (clean), else `null` (new, dirty).

- [ ] **Step 4: Route the brandKit panel save away from the server**

In `ThemePanelDialog.tsx`, the `save()` currently calls `updateBrandKitAction(brandKit)`. Change it to NOT hit the server — just call `onSaved()` (the parent already keeps `brandKit` in state + buffer). Concretely, replace the action call with an immediate success path:

```tsx
function save() {
  // Brand kit now lives in the active draft; persistence happens on Save changes.
  onSaved();
}
```

Remove the now-unused `updateBrandKitAction` import from `ThemePanelDialog.tsx`. (Contact/Header/Popup panels already only update state + snapshot, so they need no change.)

- [ ] **Step 5: Replace publish wiring with publish-from-draft**

Rewrite `handlePublish()` so it does NOT call `savePortfolioDraftAction` / `updateContactConfigAction` / `updateFormLocaleAction` / `updateHeaderConfigAction` / `updateCollectionsPopupConfigAction` / `publishPortfolioAction`. New behavior:

```ts
async function handlePublish() {
  // Publish the active draft. If it's new or has unsaved edits, save first.
  if (activeDraftId === null || isDirty) {
    setPendingSwitch(() => () => void doPublish());
    return; // UnsavedChangesDialog opens (see Step 7 gate)
  }
  await doPublish();
}

async function doPublish() {
  if (!activeDraftId) return;
  setSaveStatus("saving");
  const res = await publishDraftAction(activeDraftId);
  if ("error" in res) {
    setSaveStatus("idle");
    toast.error(t("errorToast"));
    return;
  }
  setSaveStatus("saved");
  setPublishOpen(false);
  toast.success(t("publishedToast"));
  if (!showPuck) setPreviewNonce((n) => n + 1);
}
```

Remove the now-unused action imports (`savePortfolioDraftAction`, `publishPortfolioAction`, `updateContactConfigAction`, `updateFormLocaleAction`, `updateHeaderConfigAction`, `updateCollectionsPopupConfigAction`) from `EditorShell.tsx`. Do **not** delete those exports from `_actions.ts` yet — Task 14 handles dead-code cleanup after a repo-wide usage check.

- [ ] **Step 6: Implement Save changes**

```ts
async function handleSaveChanges(): Promise<boolean> {
  setSavingChanges(true);
  setNameError(null);
  const payload = { name: draftName, ...buildDraftSnapshot() };
  const res = activeDraftId
    ? await updateDraftAction({ id: activeDraftId, ...payload })
    : await createDraftAction(payload);
  setSavingChanges(false);

  if ("error" in res) {
    if (res.error === "name_required") setNameError("This field is required");
    else if (res.error === "name_taken") setNameError("A draft with this name already exists");
    else if (res.error.startsWith("draft_limit_reached")) toast.error("You've reached your draft limit. Upgrade or delete a draft.");
    else toast.error(t("errorToast"));
    return false;
  }

  setActiveDraftId(res.draft.id);
  setDrafts((prev) => {
    const without = prev.filter((d) => d.id !== res.draft.id);
    return [res.draft, ...without];
  });
  savedSnapshotRef.current = JSON.stringify(payload);
  setIsDirty(false);
  persistLocalDraft(); // buffer now carries the saved draftId/name
  toast.success(t("savedToast"));
  return true;
}
```

Wire a **Save changes** button into the right cluster (`toolsCluster`) next to Publish, disabled when `!isDirty && activeDraftId !== null`.

- [ ] **Step 7: Add the unsaved-changes gate**

A helper that guards any draft switch:

```ts
function guardThenRun(run: () => void) {
  if (activeDraftId === null ? true : isDirty) {
    setPendingSwitch(() => run);
  } else {
    run();
  }
}
```

Render `<UnsavedChangesDialog open={pendingSwitch !== null} saving={savingChanges} onSave={...} onDiscard={...} onCancel={...} />`:
- **onSave:** `const ok = await handleSaveChanges(); if (ok) { const run = pendingSwitch; setPendingSwitch(null); run?.(); }`
- **onDiscard:** wipe the buffer (`window.localStorage.removeItem(draftKey)`), then `const run = pendingSwitch; setPendingSwitch(null); run?.();`
- **onCancel:** `setPendingSwitch(null)`

Also add a `beforeunload` guard while dirty:

```ts
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (isDirty) { e.preventDefault(); e.returnValue = ""; }
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [isDirty]);
```

- [ ] **Step 8: Apply a draft / apply a template / start new**

Add loaders that all go through `guardThenRun`:

```ts
async function applyDraft(id: string) {
  const res = await getDraftAction(id);
  if ("error" in res) { toast.error(t("errorToast")); return; }
  const d = res.draft;
  zoneDataRef.current = {
    home: (d.data.home as PuckData) ?? EMPTY_ZONE,
    gallery: (d.data.gallery as PuckData) ?? EMPTY_ZONE,
  };
  setBrandKit((d.brandKit as PortfolioBrandKit) ?? DEFAULT_BRAND_KIT);
  setContact((d.contact as PortfolioContactConfig) ?? {});
  setHeaderConfig((d.header as PortfolioHeaderConfig) ?? DEFAULT_HEADER_CONFIG);
  setCollectionsPopup((d.collectionsPopup as PortfolioCollectionsPopupConfig) ?? {});
  setFormLocale(d.formLocale ?? "");
  setTemplateId(d.templateId || "minimal");
  setActiveDraftId(d.id);
  setDraftName(d.name);
  ignoreNextChange.current = true;
  setPuckSeed(ensureIds(zoneDataRef.current[activeZone]));
  savedSnapshotRef.current = JSON.stringify({
    name: d.name,
    templateId: d.templateId || "minimal",
    data: { home: zoneDataRef.current.home, gallery: zoneDataRef.current.gallery },
    brandKit: d.brandKit, contact: d.contact, header: d.header,
    collectionsPopup: d.collectionsPopup, formLocale: d.formLocale ?? "",
  });
  setIsDirty(false);
  persistLocalDraft();
  setDraftsOpen(false);
  if (!showPuck) setPreviewNonce((n) => n + 1);
}
```

Adapt the existing `handleSwitchTemplate` so that applying a template starts a **new unsaved draft** instead of calling `switchTemplateAction`: seed the zones from the template's `seedData` (use the client `PORTFOLIO_TEMPLATES`/summaries you already pass, or fetch via a small client seed), set `brandKit`/`contact` from the template, **reset `headerConfig` to `DEFAULT_HEADER_CONFIG` and `collectionsPopup` to `{}`** (so nav/popup get defaults — closes the seed gap), set `templateId`, `activeDraftId = null`, `draftName = DEFAULT_DRAFT_NAME`, `savedSnapshotRef.current = null` (dirty), and remount Puck. The picker's "Use this template" no longer needs the destructive AlertDialog copy — switching is now non-destructive (it just stages a new draft); simplify or keep the confirm as preferred.

> Templates currently only carry `defaultBrandKit` + `defaultContact` in the `EditorTemplateSummary` passed to the client, and `seedData` lives server-side. To apply a template fully on the client, either (a) extend the summary with the seeded `data` (call `seedData` in `page.tsx` and pass it), or (b) add a thin `seedTemplateAction(templateId)` that returns `{ data, brandKit, contact }` without writing to the DB. Prefer (b) — it mirrors `switchTemplateAction` minus the persistence and keeps the client bundle lean. Add `seedTemplateAction` to `_draftActions.ts` returning the template seed (reuse `getTemplate` + `seedData`), and call it from the apply-template flow.

- [ ] **Step 9: Replace the Templates button with Drafts; render the new dialogs**

- In `toolsCluster`, replace the **Templates** button with a **Drafts** button: `onClick={() => setDraftsOpen(true)}`, label `"Drafts"`.
- Render `<DraftNameEditor name={draftName} error={nameError} onCommit={(n) => { setDraftName(n); setNameError(null); }} />` where the "Saved" status span used to be. Keep a small saved/saving indicator if desired, but the draft name is the primary element.
- Render `<DraftsDialog open={draftsOpen} ... drafts={drafts} activeDraftId={activeDraftId} onApply={(id) => guardThenRun(() => void applyDraft(id))} onDelete={(id) => void handleDeleteDraft(id)} onAddNew={() => { setDraftsOpen(false); setTemplatesOpen(true); }} />`.
- Keep `TemplatePickerDialog` mounted (now reached via Drafts → Add new draft, and via the entry dialog). Its `onConfirm` now calls the apply-template-as-new-draft flow from Step 8.
- Render `<PortfolioEntryDialog open={entryOpen} canContinue={hasRecoverableBuffer} hasDrafts={drafts.length > 0} onContinue={...} onLoadExisting={() => { setEntryOpen(false); setDraftsOpen(true); }} onStartScratch={() => { setEntryOpen(false); setTemplatesOpen(true); }} />`.
- `handleDeleteDraft(id)`: call `deleteDraftAction(id)`, drop it from `drafts`; if it was active, treat the canvas as an unsaved new draft (`setActiveDraftId(null)`, `savedSnapshotRef.current = null`, `setIsDirty(true)`).

- [ ] **Step 10: Entry-dialog continue logic + dirty-diff**

Compute `hasRecoverableBuffer` once on mount: read the raw buffer; it's recoverable if it parsed at the current version and either has `draftId === null` (unsaved new) or differs from its DB draft. For the dirty-vs-DB diff when `draftId` is set, call `getDraftAction(draftId)` and compare JSON of the snapshot fields. *Continue* loads the buffer as working state and sets dirty accordingly; if `draftId` references a deleted draft, fall back to unsaved-new. (The existing restore effect already hydrates state from the buffer — keep it, but only actually surface that state after the user picks *Continue*; gate the restore on the entry choice, or restore eagerly and let *Start scratch* / *Load* overwrite it.)

- [ ] **Step 11: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. Fix any type mismatches (notably `unknown` snapshot fields from `FullDraft` cast to the editor's concrete config types).

- [ ] **Step 12: Commit**

```bash
git add app/[locale]/(app)/portfolio/_components/EditorShell.tsx app/[locale]/(app)/portfolio/_components/ThemePanelDialog.tsx app/[locale]/(app)/portfolio/_draftActions.ts
git commit -m "feat(portfolio): wire drafts into the editor (save/switch/publish/entry guards)"
```

---

## Task 13: page.tsx — migration + load drafts + pass props

**Files:**
- Modify: `app/[locale]/(app)/portfolio/page.tsx`

> Read the current `page.tsx` first (it derives all EditorShell props from `workspace.publicPage`).

- [ ] **Step 1: Run migration + load drafts before render**

After `requireOrg()` and the existing public-page derivation, add:

```ts
import { ensureLegacyDraftMigrated } from "@/lib/page-builder/migrateDraft";
import { listDraftsAction } from "./_draftActions";
import { DEFAULT_DRAFT_NAME } from "@/lib/page-builder/drafts";
// ...
await ensureLegacyDraftMigrated(workspace._id);
const initialDrafts = await listDraftsAction();
// The active draft on first paint is the newest one (the migrated/most recent).
// The client entry dialog lets the owner pick differently.
const active = initialDrafts[0] ?? null;
const initialActiveDraftId = active?.id ?? null;
const initialActiveDraftName = active?.name ?? DEFAULT_DRAFT_NAME;
```

> `listDraftsAction` calls `requireOrg()` again; that's fine (it's cheap and already memoized by Clerk within a request). If you prefer one resolution, inline a direct `PortfolioDraft.find(...)` here instead.

- [ ] **Step 2: Pass the new props to EditorShell**

```tsx
<EditorShell
  /* ...existing props... */
  initialDrafts={initialDrafts}
  initialActiveDraftId={initialActiveDraftId}
  initialActiveDraftName={initialActiveDraftName}
/>
```

If `page.tsx` does not currently pass `initialCollectionsPopup`, confirm whether `EditorShell` reads collections-popup from props or elsewhere (the two reads disagreed). If it expects `initialCollectionsPopup`, derive it like the others: `toPlain<PortfolioCollectionsPopupConfig>(pp?.collectionsPopup ?? null, {})` and pass it. If it does not, leave as-is.

- [ ] **Step 3: Dead-code check for removed publish actions**

Grep the repo for remaining usages of `savePortfolioDraftAction`, `publishPortfolioAction`, `updateBrandKitAction`, `updateContactConfigAction`, `updateHeaderConfigAction`, `updateCollectionsPopupConfigAction`, `updateFormLocaleAction`. If the editor was their only caller, remove them from `_actions.ts` and delete their now-dead tests. If anything else references them, leave them.

Run: `pnpm exec grep -rn "publishPortfolioAction\|savePortfolioDraftAction\|updateBrandKitAction\|updateContactConfigAction\|updateHeaderConfigAction\|updateCollectionsPopupConfigAction\|updateFormLocaleAction" app lib` (or use ripgrep).

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/(app)/portfolio/page.tsx app/[locale]/(app)/portfolio/_actions.ts
git commit -m "feat(portfolio): migrate + load drafts in the editor page loader"
```

---

## Task 14: Left control buttons wrap on small screens

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` (the `navCluster` left cluster)

- [ ] **Step 1: Add flex-wrap to the left cluster**

In `navCluster()`, the outer container and the sections group use `flex items-center gap-1/2` without wrapping. Add `flex-wrap` so the Home/Gallery/Header/Contact/Preview controls wrap like the right cluster:

```tsx
// outer
<div className="flex flex-wrap items-center gap-2">
  <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t("zone.sectionsLabel")}>
    {/* section buttons */}
  </div>
  {/* preview toggle */}
</div>
```

Also confirm the `topBar` left wrapper allows wrapping: the left column uses `flex min-w-0 flex-1 justify-start` — keep `min-w-0` so it can shrink. If the three top-bar columns crowd on a 375px screen, allow the top bar itself to wrap (it already uses `flex w-full flex-wrap`).

- [ ] **Step 2: Verify at 375px (manual)**

Run `pnpm dev`, open the portfolio editor, set the viewport to 375px (DevTools device toolbar). Confirm the left buttons wrap to multiple lines and remain tappable; no horizontal overflow.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/(app)/portfolio/_components/EditorShell.tsx
git commit -m "fix(portfolio): wrap left editor controls on small screens"
```

---

## Task 15: Full verification sweep

- [ ] **Step 1: Run all new/affected tests**

```bash
pnpm test --run drafts.test
pnpm test --run PortfolioDraft.test
pnpm test --run portfolioDraft.test
pnpm test --run _draftActions.test
pnpm test --run migrateDraft.test
pnpm test --run scratch.test
pnpm test --run DraftNameEditor.test
pnpm test --run DraftsDialog.test
pnpm test --run PortfolioEntryDialog.test
pnpm test --run UnsavedChangesDialog.test
```

Expected: all PASS.

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck
pnpm lint
```

Expected: clean. Fix any issues.

- [ ] **Step 3: Manual smoke at 375px and desktop**

Verify the full flow: entry dialog gating → start from scratch (empty canvas) → edit → Save changes (name validation: empty + duplicate) → draft appears in Drafts board with Active pill → switch drafts with unsaved changes triggers the guard → Publish blocks-then-saves when dirty, publishes directly when clean → delete a draft → reload shows entry dialog with Continue enabled when buffer differs.

- [ ] **Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "test(portfolio): drafts verification fixes"
```

---

## Self-review notes (addressed)

- **Spec coverage:** §Data model→T2; §Plan caps→T1/T4; §Server actions→T4/T5; client buffer + dirty + panel routing→T12; §UI (drafts board, entry, unsaved, name editor, active pill, Drafts button, save rejection)→T8–T12; §Scratch template→T7; §Migration→T6/T13; §Responsive→T14; §Testing→each task + T15; publish-from-draft + dirty gating→T5/T12.
- **Type consistency:** `DraftSummary`/`FullDraft`/`DraftMutationResult` defined in T4 and reused in T9/T12; `draftCapForPlan`/`DEFAULT_DRAFT_NAME`/`DRAFT_NAME_MAX` from T1; `createDraftAction`/`updateDraftAction` payload shape (name + flattened snapshot) consistent between T4 validators, T4 actions, and T12 `handleSaveChanges`.
- **Known soft spots flagged inline:** EditorShell current-state ambiguity (read-first steps), `seedTemplateAction` vs summary-data choice for client template apply, `showCloseButton`/`loading`/`onPointerDownOutside` prop availability on local UI wrappers, collections-popup prop wiring in `page.tsx`.
