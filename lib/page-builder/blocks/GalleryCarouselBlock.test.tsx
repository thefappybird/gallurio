import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { puckConfig } from "@/lib/page-builder/config";
import { GalleryCarouselBlock, galleryCarouselDefaultProps } from "./GalleryCarouselBlock";

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

const base = { ...galleryCarouselDefaultProps };

it("is registered in puckConfig", () => {
  expect(puckConfig.components.GalleryCarousel).toBeDefined();
});

describe("GalleryCarouselBlock", () => {
  it("renders empty state with no workspace context", async () => {
    render(await GalleryCarouselBlock({ ...base, collectionId: new Types.ObjectId().toString() }));
    expect(screen.getByText(/gallery not available/i)).toBeInTheDocument();
  });

  it("renders empty state for collection with no items", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      GalleryCarouselBlock({ ...base, collectionId: col._id.toString() })
    );
    render(el);
    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
  });

  it("renders slides + accessible prev/next controls for a populated collection", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seed(ws, col._id, 3);
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      GalleryCarouselBlock({ ...base, collectionId: col._id.toString() })
    );
    const { container } = render(el);
    expect(container.querySelectorAll("img")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /previous image/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next image/i })).toBeInTheDocument();
  });

  it("hides nav buttons when only one slide", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seed(ws, col._id, 1);
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      GalleryCarouselBlock({ ...base, collectionId: col._id.toString() })
    );
    render(el);
    expect(screen.queryByRole("button", { name: /next image/i })).toBeNull();
  });

  it("respects maxItems cap", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seed(ws, col._id, 15);
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      GalleryCarouselBlock({ ...base, collectionId: col._id.toString(), maxItems: 4 })
    );
    const { container } = render(el);
    expect(container.querySelectorAll("img")).toHaveLength(4);
  });

  it("hides items from a private collection", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws, false);
    await seed(ws, col._id, 5);
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      GalleryCarouselBlock({ ...base, collectionId: col._id.toString() })
    );
    render(el);
    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
  });
});
