import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { puckConfig } from "@/lib/page-builder/config";
import { GalleryMasonryBlock, galleryMasonryDefaultProps } from "./GalleryMasonryBlock";

vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: vi.fn(
    (publicId: string, opts: { width?: number }) =>
      `https://res.cloudinary.com/test/${opts?.width ?? 400}/${publicId}`
  ),
}));

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
});

async function makeCollection(workspaceId: Types.ObjectId, isPublic = true) {
  return GalleryCollection.create({
    workspaceId,
    name: "C",
    slug: `c-${new Types.ObjectId().toString()}`,
    isPublic,
  });
}
async function seed(workspaceId: Types.ObjectId, collectionId: Types.ObjectId, n: number) {
  return GalleryItem.insertMany(
    Array.from({ length: n }, (_, i) => ({
      workspaceId,
      collectionId,
      cloudinaryPublicId: `${workspaceId}/item${i}`,
      url: `u${i}`,
      caption: `Photo ${i + 1}`,
      altText: `Alt ${i + 1}`,
      order: i,
    }))
  );
}

const base = { ...galleryMasonryDefaultProps };

it("is registered in puckConfig", () => {
  expect(puckConfig.components.GalleryMasonry).toBeDefined();
});

describe("GalleryMasonryBlock", () => {
  it("renders empty state with no workspace context", async () => {
    render(await GalleryMasonryBlock({ ...base, collectionId: new Types.ObjectId().toString() }));
    expect(screen.getByText(/gallery not available/i)).toBeInTheDocument();
  });

  it("renders 'no collection selected' for blank id", async () => {
    const ws = new Types.ObjectId();
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      GalleryMasonryBlock({ ...base, collectionId: "" })
    );
    render(el);
    expect(screen.getByText(/no collection selected/i)).toBeInTheDocument();
  });

  it("renders empty state for collection with no items", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      GalleryMasonryBlock({ ...base, collectionId: col._id.toString() })
    );
    render(el);
    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
  });

  it("renders images for a populated public collection", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seed(ws, col._id, 4);
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      GalleryMasonryBlock({ ...base, collectionId: col._id.toString() })
    );
    const { container } = render(el);
    expect(container.querySelectorAll("img")).toHaveLength(4);
  });

  it("hides items from a private collection", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws, false);
    await seed(ws, col._id, 4);
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      GalleryMasonryBlock({ ...base, collectionId: col._id.toString() })
    );
    render(el);
    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
  });

  it("respects maxItems cap", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seed(ws, col._id, 20);
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      GalleryMasonryBlock({ ...base, collectionId: col._id.toString(), maxItems: 6 })
    );
    const { container } = render(el);
    expect(container.querySelectorAll("img")).toHaveLength(6);
  });

  it("applies column-count from columns prop", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seed(ws, col._id, 3);
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      GalleryMasonryBlock({ ...base, collectionId: col._id.toString(), columns: 4 })
    );
    const { container } = render(el);
    const grid = container.querySelector("[data-block='gallery-masonry'] .pf-masonry") as HTMLElement;
    expect(grid.style.columnCount).toBe("4");
  });
});
