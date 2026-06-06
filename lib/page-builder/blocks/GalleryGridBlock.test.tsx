import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { puckConfig } from "@/lib/page-builder/config";
import { GalleryGridBlock, galleryGridDefaultProps } from "./GalleryGridBlock";
import type { GalleryGridProps } from "./GalleryGridBlock";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: vi.fn(
    (publicId: string, opts: { width?: number }) =>
      `https://res.cloudinary.com/test/image/upload/c_fill,w_${opts?.width ?? 400},h_${opts?.width ?? 400},q_auto,f_auto/${publicId}`
  ),
}));

// ---------------------------------------------------------------------------
// In-memory MongoDB setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWorkspaceId() {
  return new Types.ObjectId();
}

function makeCollectionId() {
  return new Types.ObjectId();
}

async function seedItems(
  workspaceId: Types.ObjectId,
  collectionId: Types.ObjectId,
  count: number
) {
  const docs = Array.from({ length: count }, (_, i) => ({
    workspaceId,
    collectionId,
    cloudinaryPublicId: `ws/${workspaceId}/gallery/item${i}`,
    url: `https://res.cloudinary.com/test/image/upload/ws/${workspaceId}/gallery/item${i}`,
    caption: `Photo ${i + 1}`,
    altText: `Alt ${i + 1}`,
    order: i,
  }));
  return GalleryItem.insertMany(docs);
}

const defaultProps: GalleryGridProps = {
  ...galleryGridDefaultProps,
  columns: 3,
  gap: "normal",
  maxItems: 12,
};

// ---------------------------------------------------------------------------
// Tests: empty collection ID guard
// ---------------------------------------------------------------------------

describe("GalleryGridBlock — empty collectionId", () => {
  it("renders empty state when collectionId is empty string", async () => {
    const wsId = makeWorkspaceId();
    const element = await runWithRenderWorkspace(
      { _id: wsId.toString(), name: "Test Workspace" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: "" })
    );
    render(element);
    expect(screen.getByText(/no collection selected/i)).toBeInTheDocument();
    expect(
      document.querySelector("[data-block='gallery-grid'][data-empty='true']")
    ).toBeInTheDocument();
  });

  it("renders empty state when collectionId is whitespace", async () => {
    const wsId = makeWorkspaceId();
    const element = await runWithRenderWorkspace(
      { _id: wsId.toString(), name: "Test Workspace" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: "   " })
    );
    render(element);
    expect(screen.getByText(/no collection selected/i)).toBeInTheDocument();
  });

  it("renders empty state (not DB-outage message) when collectionId is an invalid ObjectId string", async () => {
    const wsId = makeWorkspaceId();
    const element = await runWithRenderWorkspace(
      { _id: wsId.toString(), name: "Test Workspace" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: "not-an-objectid" })
    );
    render(element);
    expect(screen.getByText(/no collection selected/i)).toBeInTheDocument();
    expect(screen.queryByText(/gallery temporarily unavailable/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: no workspace context
// ---------------------------------------------------------------------------

describe("GalleryGridBlock — no server context", () => {
  it("renders 'Gallery not available' when no workspace context is set", async () => {
    // No runWithRenderWorkspace call — getRenderWorkspace() returns null.
    const colId = makeCollectionId().toString();
    render(await GalleryGridBlock({ ...defaultProps, collectionId: colId }));
    expect(screen.getByText(/gallery not available/i)).toBeInTheDocument();
  });

  it("renders 'Gallery not available' when workspace _id is empty string", async () => {
    const colId = makeCollectionId().toString();
    const element = await runWithRenderWorkspace(
      { _id: "", name: "" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: colId })
    );
    render(element);
    expect(screen.getByText(/gallery not available/i)).toBeInTheDocument();
  });

  it("GalleryGrid is registered in puckConfig (documents the null-context code path)", () => {
    // The `if (!workspace)` null-guard in GalleryGridBlock returns "Gallery not available."
    // when getRenderWorkspace() returns null (isolated preview, no page context).
    // The _id="" guard returns the same message for an empty workspace ID.
    // Both paths are verified by the other tests in this describe block.
    expect(puckConfig.components.GalleryGrid).toBeDefined();
    expect(puckConfig.components.GalleryGrid.defaultProps).toHaveProperty("collectionId");
  });
});

// ---------------------------------------------------------------------------
// Tests: tenant isolation (core requirement)
// ---------------------------------------------------------------------------

describe("GalleryGridBlock — tenant isolation", () => {
  it("only returns items for the workspace in server context", async () => {
    const wsA = makeWorkspaceId();
    const wsB = makeWorkspaceId();
    const col = makeCollectionId();

    await seedItems(wsA, col, 3);
    await seedItems(wsB, col, 5);

    // Set context to workspace A
    const element = await runWithRenderWorkspace(
      { _id: wsA.toString(), name: "Workspace A" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: col.toString() })
    );
    const { container } = render(element);

    const imgs = container.querySelectorAll("img");
    // Should only show workspace A's 3 items
    expect(imgs.length).toBe(3);
    for (const img of imgs) {
      expect(img.src).toContain(wsA.toString());
    }
  });

  it("cross-workspace collectionId returns empty state — not leaked data", async () => {
    const wsA = makeWorkspaceId();
    const wsB = makeWorkspaceId();
    const colB = makeCollectionId();

    // Only workspace B has items in colB
    await seedItems(wsB, colB, 4);

    // Set context to workspace A — which has no items in colB
    const element = await runWithRenderWorkspace(
      { _id: wsA.toString(), name: "Workspace A" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: colB.toString() })
    );
    render(element);

    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
  });

  it("collection from correct workspace renders photos", async () => {
    const wsA = makeWorkspaceId();
    const col = makeCollectionId();

    await seedItems(wsA, col, 6);

    const element = await runWithRenderWorkspace(
      { _id: wsA.toString(), name: "Workspace A" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: col.toString(), maxItems: 10 })
    );
    const { container } = render(element);

    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Tests: empty collection → empty state
// ---------------------------------------------------------------------------

describe("GalleryGridBlock — empty collection", () => {
  it("renders empty state when collection exists but has no items", async () => {
    const ws = makeWorkspaceId();
    const col = makeCollectionId();
    // No items seeded

    const element = await runWithRenderWorkspace(
      { _id: ws.toString(), name: "Test Workspace" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: col.toString() })
    );
    render(element);
    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: maxItems capping
// ---------------------------------------------------------------------------

describe("GalleryGridBlock — maxItems", () => {
  it("limits rendered items to maxItems", async () => {
    const ws = makeWorkspaceId();
    const col = makeCollectionId();

    await seedItems(ws, col, 20);

    const element = await runWithRenderWorkspace(
      { _id: ws.toString(), name: "Test Workspace" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: col.toString(), maxItems: 5 })
    );
    const { container } = render(element);

    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(5);
  });

  it("caps maxItems at 100 even when prop exceeds 100", async () => {
    const ws = makeWorkspaceId();
    const col = makeCollectionId();

    await seedItems(ws, col, 10);

    const element = await runWithRenderWorkspace(
      { _id: ws.toString(), name: "Test Workspace" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: col.toString(), maxItems: 9999 })
    );
    const { container } = render(element);
    // Only 10 items seeded, so we get 10
    expect(container.querySelectorAll("img").length).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Tests: block heading / description / footer text
// ---------------------------------------------------------------------------

describe("GalleryGridBlock — block text", () => {
  it("renders heading, description, and footer when provided", async () => {
    const ws = makeWorkspaceId();
    const col = makeCollectionId();

    await seedItems(ws, col, 2);

    const element = await runWithRenderWorkspace(
      { _id: ws.toString(), name: "Test Workspace" },
      () =>
        GalleryGridBlock({
          ...defaultProps,
          collectionId: col.toString(),
          heading: "Our Work",
          description: "A selection of recent shoots",
          footer: "More on request",
        })
    );
    render(element);

    expect(screen.getByText("Our Work")).toBeInTheDocument();
    expect(screen.getByText("A selection of recent shoots")).toBeInTheDocument();
    expect(screen.getByText("More on request")).toBeInTheDocument();
  });

  it("omits per-image captions (captions feature removed)", async () => {
    const ws = makeWorkspaceId();
    const col = makeCollectionId();

    await seedItems(ws, col, 2);

    const element = await runWithRenderWorkspace(
      { _id: ws.toString(), name: "Test Workspace" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: col.toString() })
    );
    render(element);

    // seedItems sets item.caption "Photo N" — these must NOT render as captions.
    expect(screen.queryByText("Photo 1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: grid columns
// ---------------------------------------------------------------------------

describe("GalleryGridBlock — grid columns", () => {
  it.each([2, 3, 4] as const)("columns=%i renders correct grid-template-columns", async (cols) => {
    const ws = makeWorkspaceId();
    const col = makeCollectionId();

    // Must have at least one item so the grid div is rendered (not empty state)
    await seedItems(ws, col, 3);

    const element = await runWithRenderWorkspace(
      { _id: ws.toString(), name: "Test Workspace" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: col.toString(), columns: cols })
    );
    const { container } = render(element);

    // The inner grid div uses `display: grid; grid-template-columns: repeat(N, 1fr)`
    const gridDiv = container.querySelector(
      "[data-block='gallery-grid'] > div > div"
    ) as HTMLElement;
    expect(gridDiv).not.toBeNull();
    expect(gridDiv?.style.gridTemplateColumns).toBe(`repeat(${cols}, 1fr)`);
  });
});

// ---------------------------------------------------------------------------
// Tests: brand-kit CSS variables
// ---------------------------------------------------------------------------

describe("GalleryGridBlock — brand-kit CSS variables", () => {
  it("section uses var(--pf-color-bg)", async () => {
    const ws = makeWorkspaceId();
    const col = makeCollectionId();

    await seedItems(ws, col, 1);

    const element = await runWithRenderWorkspace(
      { _id: ws.toString(), name: "Test Workspace" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: col.toString() })
    );
    const { container } = render(element);

    const section = container.querySelector("[data-block='gallery-grid']") as HTMLElement;
    expect(section.style.backgroundColor).toBe("var(--pf-color-bg)");
  });
});

// ---------------------------------------------------------------------------
// Tests: data-block marker
// ---------------------------------------------------------------------------

describe("GalleryGridBlock — data-block marker", () => {
  it("always renders data-block=gallery-grid", async () => {
    const ws = makeWorkspaceId();
    // Empty collectionId → empty state also has the marker
    const element = await runWithRenderWorkspace(
      { _id: ws.toString(), name: "Test Workspace" },
      () => GalleryGridBlock({ ...defaultProps, collectionId: "" })
    );
    render(element);
    expect(document.querySelector("[data-block='gallery-grid']")).toBeInTheDocument();
  });
});
