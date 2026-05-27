import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models/Workspace";
import { findPublishedWorkspaceBySlug } from "./publicPage";
import { Types } from "mongoose";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWorkspaceBase(overrides: Record<string, unknown> = {}) {
  return {
    slug: "test-workspace",
    name: "Test Workspace",
    ownerUserId: "user_001",
    clerkOrgId: `org_${new Types.ObjectId().toHexString()}`,
    currency: "PHP",
    publicPage: {
      publishedAt: new Date(),
      data: { home: null, gallery: null },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
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
// Tests
// ---------------------------------------------------------------------------

describe("findPublishedWorkspaceBySlug", () => {
  it("returns null for an empty string", async () => {
    const result = await findPublishedWorkspaceBySlug("");
    expect(result).toBeNull();
  });

  it("returns null for a whitespace-only string", async () => {
    const result = await findPublishedWorkspaceBySlug("   ");
    expect(result).toBeNull();
  });

  it("returns null when no workspace with that slug exists", async () => {
    const result = await findPublishedWorkspaceBySlug("does-not-exist");
    expect(result).toBeNull();
  });

  it("returns null for an unpublished workspace", async () => {
    await Workspace.create(
      makeWorkspaceBase({
        slug: "unpublished-ws",
        publicPage: {
          publishedAt: null,
          data: { home: null, gallery: null },
        },
      })
    );

    const result = await findPublishedWorkspaceBySlug("unpublished-ws");
    expect(result).toBeNull();
  });

  it("returns the workspace document for a published workspace", async () => {
    await Workspace.create(makeWorkspaceBase({ slug: "my-studio" }));

    const result = await findPublishedWorkspaceBySlug("my-studio");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("my-studio");
    expect(result?.name).toBe("Test Workspace");
  });

  it("matches slug case-insensitively (Mongoose normalises to lowercase)", async () => {
    // Mongoose's lowercase:true stores slug as lowercase. The query helper also
    // normalises input. So "My-Studio" input should match "my-studio" in the DB.
    await Workspace.create(makeWorkspaceBase({ slug: "my-studio" }));

    const result = await findPublishedWorkspaceBySlug("MY-STUDIO");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("my-studio");
  });

  it("returns a lean (plain) object, not a Mongoose document", async () => {
    await Workspace.create(makeWorkspaceBase({ slug: "lean-test" }));

    const result = await findPublishedWorkspaceBySlug("lean-test");
    expect(result).not.toBeNull();
    // A lean doc has no Mongoose prototype methods like .save()
    expect(typeof (result as unknown as { save?: unknown }).save).toBe("undefined");
  });

  // ---------------------------------------------------------------------------
  // Cross-tenant isolation (mandatory per CLAUDE.md)
  // ---------------------------------------------------------------------------

  it("cross-tenant: workspace A slug never resolves to workspace B data", async () => {
    const slugA = "workspace-alpha";
    const slugB = "workspace-beta";

    await Workspace.create(
      makeWorkspaceBase({
        slug: slugA,
        name: "Alpha Studio",
        clerkOrgId: `org_alpha_${new Types.ObjectId().toHexString()}`,
        ownerUserId: "user_alpha",
      })
    );

    await Workspace.create(
      makeWorkspaceBase({
        slug: slugB,
        name: "Beta Studio",
        clerkOrgId: `org_beta_${new Types.ObjectId().toHexString()}`,
        ownerUserId: "user_beta",
      })
    );

    const resultA = await findPublishedWorkspaceBySlug(slugA);
    const resultB = await findPublishedWorkspaceBySlug(slugB);

    expect(resultA?.name).toBe("Alpha Studio");
    expect(resultB?.name).toBe("Beta Studio");

    // No cross-contamination: A's result is not B and vice versa
    expect(resultA?.slug).not.toBe(slugB);
    expect(resultB?.slug).not.toBe(slugA);
  });

  it("cross-tenant: requesting a non-existent slug does not leak another workspace", async () => {
    await Workspace.create(
      makeWorkspaceBase({
        slug: "real-workspace",
        name: "Real Studio",
      })
    );

    const result = await findPublishedWorkspaceBySlug("fake-workspace");
    expect(result).toBeNull();
  });
});
