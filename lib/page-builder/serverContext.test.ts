import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import {
  buildRenderWorkspace,
  runWithRenderWorkspace,
  getRenderWorkspace,
  getRenderWorkspaceIdOrThrow,
  type RenderWorkspace,
} from "@/lib/page-builder/serverContext";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWs(overrides: Partial<RenderWorkspace> = {}): RenderWorkspace {
  return { _id: "ws-001", name: "Test Studio", ...overrides };
}

// ---------------------------------------------------------------------------
// Outside-context behaviour
// ---------------------------------------------------------------------------

describe("getRenderWorkspace — outside context", () => {
  it("returns null when no runWithRenderWorkspace is active", () => {
    // No storage context active — must not throw, must return null.
    expect(getRenderWorkspace()).toBeNull();
  });
});

describe("getRenderWorkspaceIdOrThrow — outside context", () => {
  it("throws an Error mentioning runWithRenderWorkspace", () => {
    expect(() => getRenderWorkspaceIdOrThrow()).toThrowError(/runWithRenderWorkspace/);
  });

  it("throws an Error (not a non-Error exception)", () => {
    expect(() => getRenderWorkspaceIdOrThrow()).toThrow(Error);
  });
});

// ---------------------------------------------------------------------------
// Inside-context behaviour — synchronous
// ---------------------------------------------------------------------------

describe("runWithRenderWorkspace / getRenderWorkspace — inside context", () => {
  it("exposes the workspace inside the callback (string _id)", () => {
    const ws = makeWs({ _id: "plain-string-id" });
    const result = runWithRenderWorkspace(ws, () => getRenderWorkspace());
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Test Studio");
    expect(result!._id).toBe("plain-string-id");
  });

  it("exposes the workspace inside the callback (ObjectId _id)", () => {
    const oid = new Types.ObjectId();
    const ws = makeWs({ _id: oid });
    const seen = runWithRenderWorkspace(ws, () => getRenderWorkspace());
    // The RenderWorkspace stores the raw value; the toString contract is in getRenderWorkspaceIdOrThrow.
    expect(seen!._id.toString()).toBe(oid.toString());
  });

  it("context is not visible outside the callback", () => {
    const ws = makeWs();
    runWithRenderWorkspace(ws, () => getRenderWorkspace());
    // After the synchronous callback returns, the store must be gone.
    expect(getRenderWorkspace()).toBeNull();
  });
});

describe("getRenderWorkspaceIdOrThrow — inside context", () => {
  it("returns _id as a plain string for a string _id", () => {
    const ws = makeWs({ _id: "str-123" });
    const id = runWithRenderWorkspace(ws, () => getRenderWorkspaceIdOrThrow());
    expect(id).toBe("str-123");
    expect(typeof id).toBe("string");
  });

  it("returns _id as a plain string for an ObjectId _id (String() coercion)", () => {
    const oid = new Types.ObjectId();
    const ws = makeWs({ _id: oid });
    const id = runWithRenderWorkspace(ws, () => getRenderWorkspaceIdOrThrow());
    expect(id).toBe(oid.toString());
    expect(typeof id).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// buildRenderWorkspace — mapping
// ---------------------------------------------------------------------------

describe("buildRenderWorkspace", () => {
  it("maps a full lean doc correctly, stringifying _id", () => {
    const oid = new Types.ObjectId();
    const doc = {
      _id: oid,
      name: "Luminos Photography",
      branding: { logoUrl: "https://cdn/logo.png", tagline: "Capture moments", description: "A studio." },
      publicPage: { inquiryRecipientEmail: "owner@luminos.ph" },
      contact: {
        email: "hello@luminos.ph",
        phone: "+63 912 345 6789",
        address: "Makati City, PH",
        socials: {
          instagram: "@luminos",
          facebook: "luminos.ph",
          tiktok: "@luminostudio",
          website: "https://luminos.ph",
        },
      },
    };

    const result = buildRenderWorkspace(doc);

    expect(result._id).toBe(oid.toString());
    expect(typeof result._id).toBe("string");
    expect(result.name).toBe("Luminos Photography");

    expect(result.branding).toEqual({
      logoUrl: "https://cdn/logo.png",
      tagline: "Capture moments",
      description: "A studio.",
    });
    expect(result.publicPage).toEqual({ inquiryRecipientEmail: "owner@luminos.ph", collectionsPopup: null });
    expect(result.contact).toEqual({
      email: "hello@luminos.ph",
      phone: "+63 912 345 6789",
      address: "Makati City, PH",
      socials: {
        instagram: "@luminos",
        facebook: "luminos.ph",
        tiktok: "@luminostudio",
        website: "https://luminos.ph",
      },
    });
  });

  it("returns branding: null, publicPage: null, contact: null when those fields are absent", () => {
    const result = buildRenderWorkspace({ _id: "ws-min", name: "Minimal" });
    expect(result.branding).toBeNull();
    expect(result.publicPage).toBeNull();
    expect(result.contact).toBeNull();
  });

  it("returns branding: null, publicPage: null, contact: null when those fields are explicitly null", () => {
    const result = buildRenderWorkspace({
      _id: "ws-null",
      name: "Null Fields",
      branding: null,
      publicPage: null,
      contact: null,
    });
    expect(result.branding).toBeNull();
    expect(result.publicPage).toBeNull();
    expect(result.contact).toBeNull();
  });

  it("null-coalesces missing nested branding fields to null", () => {
    const result = buildRenderWorkspace({
      _id: "ws-partial",
      name: "Partial Branding",
      branding: { logoUrl: "https://cdn/logo.png" }, // tagline and description absent
    });
    expect(result.branding).toEqual({
      logoUrl: "https://cdn/logo.png",
      tagline: null,
      description: null,
    });
  });

  it("null-coalesces missing contact fields to null, sets socials: null when socials is absent", () => {
    const result = buildRenderWorkspace({
      _id: "ws-contact-partial",
      name: "Partial Contact",
      contact: { email: "only@email.ph" }, // phone, address, socials absent
    });
    expect(result.contact).toEqual({
      email: "only@email.ph",
      phone: null,
      address: null,
      socials: null,
    });
  });

  it("null-coalesces missing socials sub-fields to null when socials object is present but sparse", () => {
    const result = buildRenderWorkspace({
      _id: "ws-socials-partial",
      name: "Partial Socials",
      contact: {
        email: "hi@ph.com",
        socials: { instagram: "@only_insta" }, // facebook, tiktok, website absent
      },
    });
    expect(result.contact!.socials).toEqual({
      instagram: "@only_insta",
      facebook: null,
      tiktok: null,
      website: null,
    });
  });

  it("null-coalesces missing publicPage.inquiryRecipientEmail to null", () => {
    const result = buildRenderWorkspace({
      _id: "ws-pp",
      name: "Missing Email",
      publicPage: {}, // inquiryRecipientEmail absent
    });
    expect(result.publicPage).toEqual({ inquiryRecipientEmail: null, collectionsPopup: null });
  });

  it("maps publicPage.collectionsPopup when present", () => {
    const result = buildRenderWorkspace({
      _id: "ws-popup",
      name: "Popup",
      publicPage: {
        inquiryRecipientEmail: "owner@popup.ph",
        collectionsPopup: { backgroundColor: "surface", borderColor: "#1a1a1a", borderWidth: 2, radius: "subtle" },
      },
    });
    expect(result.publicPage).toEqual({
      inquiryRecipientEmail: "owner@popup.ph",
      collectionsPopup: { backgroundColor: "surface", borderColor: "#1a1a1a", borderWidth: 2, radius: "subtle" },
    });
  });

  it("does NOT set locale or chrome (they are undefined)", () => {
    const result = buildRenderWorkspace({ _id: "ws-no-locale", name: "No Locale" });
    expect(result.locale).toBeUndefined();
    expect(result.chrome).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// CRITICAL — concurrent tenant-isolation test
// Proves that two simultaneous runWithRenderWorkspace calls do not clobber
// each other's AsyncLocalStorage context across awaits.
// ---------------------------------------------------------------------------

describe("runWithRenderWorkspace — concurrent isolation (tenant-leak prevention)", () => {
  it("each concurrent context reads back its own workspace after yielding to the event loop", async () => {
    const wsA: RenderWorkspace = { _id: "aaa-aaa-aaa", name: "Alpha Studio" };
    const wsB: RenderWorkspace = { _id: "bbb-bbb-bbb", name: "Beta Studio" };

    // Context A yields for 20 ms; context B yields for 5 ms.
    // B will resume and complete while A is still suspended, which is exactly
    // the interleaving that a module-level singleton would fail.
    const runA = runWithRenderWorkspace(wsA, async () => {
      await new Promise<void>((r) => setTimeout(r, 20));
      return {
        id: getRenderWorkspaceIdOrThrow(),
        name: getRenderWorkspace()!.name,
      };
    });

    const runB = runWithRenderWorkspace(wsB, async () => {
      await new Promise<void>((r) => setTimeout(r, 5));
      return {
        id: getRenderWorkspaceIdOrThrow(),
        name: getRenderWorkspace()!.name,
      };
    });

    const [resultA, resultB] = await Promise.all([runA, runB]);

    expect(resultA.id).toBe("aaa-aaa-aaa");
    expect(resultA.name).toBe("Alpha Studio");
    expect(resultB.id).toBe("bbb-bbb-bbb");
    expect(resultB.name).toBe("Beta Studio");
  });

  it("a third context started mid-flight does not bleed into either existing context", async () => {
    const wsA: RenderWorkspace = { _id: "concurrent-a", name: "Concurrent Alpha" };
    const wsB: RenderWorkspace = { _id: "concurrent-b", name: "Concurrent Beta" };
    const wsC: RenderWorkspace = { _id: "concurrent-c", name: "Concurrent Gamma" };

    // A waits 30 ms; B is launched after 10 ms (mid-flight for A); C is synchronous.
    const runA = runWithRenderWorkspace(wsA, async () => {
      await new Promise<void>((r) => setTimeout(r, 30));
      return getRenderWorkspaceIdOrThrow();
    });

    // Let A get into its await before we start B and C.
    await new Promise<void>((r) => setTimeout(r, 10));

    const runB = runWithRenderWorkspace(wsB, async () => {
      await new Promise<void>((r) => setTimeout(r, 5));
      return getRenderWorkspaceIdOrThrow();
    });

    // C is fully synchronous — starts and finishes while A and B are suspended.
    const idC = runWithRenderWorkspace(wsC, () => getRenderWorkspaceIdOrThrow());

    const [idA, idB] = await Promise.all([runA, runB]);

    expect(idA).toBe("concurrent-a");
    expect(idB).toBe("concurrent-b");
    expect(idC).toBe("concurrent-c");

    // After all contexts have settled, the store must be empty (no leakage).
    expect(getRenderWorkspace()).toBeNull();
  });
});
