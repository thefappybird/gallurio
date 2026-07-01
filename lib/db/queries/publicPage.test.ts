import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models/Workspace";
import { User } from "@/lib/db/models/User";
import {
  findPublishedWorkspaceBySlug,
  resolveWorkspaceIdBySlug,
  getOwnerTimeFormat,
  resolveWorkspaceOwnerBySlug,
} from "./publicPage";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWorkspaceBase(overrides: Record<string, unknown> = {}) {
  return {
    slug: "test-workspace",
    name: "Test Workspace",
    ownerUserId: "user_001",
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
        ownerUserId: "user_alpha",
      })
    );

    await Workspace.create(
      makeWorkspaceBase({
        slug: slugB,
        name: "Beta Studio",
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

  // ---------------------------------------------------------------------------
  // Projection / response shaping
  // ---------------------------------------------------------------------------

  it("projection: sensitive billing and identity fields are stripped from the returned doc", async () => {
    await Workspace.create(
      makeWorkspaceBase({
        slug: "sensitive-ws",
        name: "Sensitive Studio",
        ownerUserId: "user_sensitive",
        plan: "starter",
        currency: "PHP",
        paddleSubscriptionId: "sub_secret_001",
        paddleCustomerId: "ctm_secret_001",
        paddleSubscriptionStatus: "active",
        paddleCurrentPeriodEnd: new Date("2026-12-31"),
      })
    );

    const result = await findPublishedWorkspaceBySlug("sensitive-ws");
    expect(result).not.toBeNull();

    // Sensitive fields must be absent (projected out)
    const doc = result as Record<string, unknown>;
    expect(doc.paddleSubscriptionId).toBeUndefined();
    expect(doc.paddleCustomerId).toBeUndefined();
    expect(doc.paddleSubscriptionStatus).toBeUndefined();
    expect(doc.paddleCurrentPeriodEnd).toBeUndefined();
    expect(doc.paddleCheckoutWorkflowRunId).toBeUndefined();
    expect(doc.ownerUserId).toBeUndefined();
    expect(doc.plan).toBeUndefined();
  });

  it("projection: public fields needed by consumers are present in the returned doc", async () => {
    await Workspace.create(
      makeWorkspaceBase({
        slug: "public-fields-ws",
        name: "Public Fields Studio",
        country: "PH",
        publicPage: {
          publishedAt: new Date(),
          seoTitle: "Public Fields Studio — Photography",
          seoDescription: "Award-winning photography in Manila.",
          brandKit: { theme: "light", fontPair: "merriweather-only" },
          data: { home: { content: [], root: { props: {} } }, gallery: null },
          inquiryRecipientEmail: "hello@publicfields.studio",
        },
        contact: { phone: "+63 912 345 6789", address: "Manila, PH" },
      })
    );

    const result = await findPublishedWorkspaceBySlug("public-fields-ws");
    expect(result).not.toBeNull();

    const doc = result as Record<string, unknown>;
    // _id included by default
    expect(doc._id).toBeDefined();
    expect(doc.slug).toBe("public-fields-ws");
    expect(doc.name).toBe("Public Fields Studio");
    expect(doc.country).toBe("PH");
    expect(doc.publicPage).toBeDefined();
    expect(doc.contact).toBeDefined();
  });
});

describe("resolveWorkspaceIdBySlug", () => {
  it("returns id + timezone for a published workspace, null otherwise", async () => {
    await Workspace.create(
      makeWorkspaceBase({ slug: "beacon-ws", timezone: "Asia/Jakarta" })
    );
    const ok = await resolveWorkspaceIdBySlug("BEACON-WS");
    expect(ok).not.toBeNull();
    expect(ok?.timezone).toBe("Asia/Jakarta");
    expect(String(ok?._id)).toMatch(/^[a-f0-9]{24}$/);

    expect(await resolveWorkspaceIdBySlug("")).toBeNull();
    expect(await resolveWorkspaceIdBySlug("nope")).toBeNull();

    await Workspace.create(
      makeWorkspaceBase({
        slug: "draft-ws",
        publicPage: { publishedAt: null, data: { home: null, gallery: null } },
      })
    );
    expect(await resolveWorkspaceIdBySlug("draft-ws")).toBeNull();
  });
});

describe("getOwnerTimeFormat", () => {
  it("returns the owner's saved timeFormat", async () => {
    await User.create({ workosUserId: "user_12h", email: "owner@example.com", timeFormat: "12h" });

    const result = await getOwnerTimeFormat("user_12h");
    expect(result).toBe("12h");
  });
});

describe("resolveWorkspaceOwnerBySlug", () => {
  it("returns the ownerUserId for a published workspace slug, without exposing it via findPublishedWorkspaceBySlug", async () => {
    await Workspace.create(makeWorkspaceBase({ slug: "owner-lookup-ws", ownerUserId: "user_owner_lookup" }));

    const ownerId = await resolveWorkspaceOwnerBySlug("owner-lookup-ws");
    expect(ownerId).toBe("user_owner_lookup");
  });
});
