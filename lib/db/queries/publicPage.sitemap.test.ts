import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models/Workspace";
import { listPublishedWorkspaceSlugs } from "./publicPage";

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

function makePublished(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    name: `Workspace ${slug}`,
    ownerUserId: `user_${slug}`,
    currency: "PHP",
    publicPage: {
      publishedAt: new Date(),
      data: { home: null, gallery: null },
    },
    ...overrides,
  };
}

describe("listPublishedWorkspaceSlugs", () => {
  it("returns only published workspaces, excluding drafts", async () => {
    await Workspace.create([
      makePublished("pub-ws-one"),
      makePublished("pub-ws-two"),
      {
        slug: "draft-ws",
        name: "Draft Workspace",
        ownerUserId: "user_draft",
        currency: "PHP",
        publicPage: { publishedAt: null, data: { home: null, gallery: null } },
      },
    ]);

    const result = await listPublishedWorkspaceSlugs();
    const slugs = result.map((r) => r.slug);

    expect(slugs).toContain("pub-ws-one");
    expect(slugs).toContain("pub-ws-two");
    expect(slugs).not.toContain("draft-ws");
  });

  it("returns an empty array when no workspaces exist", async () => {
    const result = await listPublishedWorkspaceSlugs();
    expect(result).toEqual([]);
  });

  it("projects slug and lastPublishedAt, strips sensitive fields", async () => {
    const ts = new Date("2026-05-01T09:00:00.000Z");
    await Workspace.create(
      makePublished("proj-test", {
        publicPage: {
          publishedAt: new Date(),
          lastPublishedAt: ts,
          data: { home: null, gallery: null },
        },
      })
    );

    const result = await listPublishedWorkspaceSlugs();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("proj-test");
    expect(result[0].lastPublishedAt).toEqual(ts);

    const entry = result[0] as Record<string, unknown>;
    expect(entry._id).toBeUndefined();
    expect(entry.name).toBeUndefined();
  });

  it("returns null lastPublishedAt when field is absent on the document", async () => {
    // makePublished without overrides → schema default lastPublishedAt: null
    await Workspace.create(makePublished("no-ts-slug"));

    const result = await listPublishedWorkspaceSlugs();
    expect(result).toHaveLength(1);
    expect(result[0].lastPublishedAt).toBeNull();
  });
});
