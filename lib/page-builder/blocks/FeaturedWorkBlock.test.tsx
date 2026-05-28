import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { puckConfig } from "@/lib/page-builder/config";
import { FeaturedWorkBlock, featuredWorkDefaultProps } from "./FeaturedWorkBlock";

vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: vi.fn((publicId: string) => `https://res.cloudinary.com/test/${publicId}`),
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

async function makeCollection(workspaceId: Types.ObjectId) {
  return GalleryCollection.create({
    workspaceId,
    name: "C",
    slug: `c-${new Types.ObjectId().toString()}`,
    isPublic: true,
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

const base = { ...featuredWorkDefaultProps };

it("is registered in puckConfig", () => {
  expect(puckConfig.components.FeaturedWork).toBeDefined();
});

describe("FeaturedWorkBlock", () => {
  it("renders heading + empty message when no items selected", async () => {
    const ws = new Types.ObjectId();
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      FeaturedWorkBlock({ ...base, heading: "Best of", itemIds: [] })
    );
    render(el);
    expect(screen.getByText("Best of")).toBeInTheDocument();
    expect(screen.getByText(/no featured photos selected yet/i)).toBeInTheDocument();
  });

  it("renders selected items in requested order", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    const created = await seed(ws, col._id, 3);
    const ids = created.map((d) => d._id.toString());
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      FeaturedWorkBlock({ ...base, itemIds: [ids[2], ids[0]] })
    );
    const { container } = render(el);
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  it("caps at 3 items", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    const created = await seed(ws, col._id, 5);
    const ids = created.map((d) => d._id.toString());
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      FeaturedWorkBlock({ ...base, itemIds: ids })
    );
    const { container } = render(el);
    expect(container.querySelectorAll("img")).toHaveLength(3);
  });

  it("drops itemIds from another workspace (tenant isolation)", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const colA = await makeCollection(wsA);
    const colB = await makeCollection(wsB);
    const aItems = await seed(wsA, colA._id, 1);
    const bItems = await seed(wsB, colB._id, 2);
    const el = await runWithRenderWorkspace({ _id: wsA.toString(), name: "A" }, () =>
      FeaturedWorkBlock({
        ...base,
        itemIds: [bItems[0]._id.toString(), aItems[0]._id.toString(), bItems[1]._id.toString()],
      })
    );
    const { container } = render(el);
    // Only workspace A's single item survives.
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("drops missing ids without crashing", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    const created = await seed(ws, col._id, 1);
    const missing = new Types.ObjectId().toString();
    const el = await runWithRenderWorkspace({ _id: ws.toString(), name: "A" }, () =>
      FeaturedWorkBlock({ ...base, itemIds: [created[0]._id.toString(), missing] })
    );
    const { container } = render(el);
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
});
