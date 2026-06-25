import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  ContactDetailsBlock,
  contactDetailsDefaultProps,
  type ContactDetailsProps,
} from "./ContactDetailsBlock";
import { buildRenderWorkspace } from "@/lib/page-builder/serverContext";
import type { RenderWorkspace } from "@/lib/page-builder/blockContext";

// ---------------------------------------------------------------------------
// Test workspace helpers
// ---------------------------------------------------------------------------

function makeWorkspace(overrides: Partial<RenderWorkspace> = {}): RenderWorkspace {
  return {
    _id: "ws-test-001",
    name: "Test Studio",
    contact: {
      email: "hello@teststudio.com",
      phone: "+63 912 345 6789",
      address: "Taguig City, Metro Manila",
      socials: {
        instagram: "teststudio",
        facebook: "teststudioph",
        tiktok: null,
        website: "https://teststudio.com",
      },
    },
    ...overrides,
  };
}

function renderBlock(ws: RenderWorkspace | null, props: ContactDetailsProps = {}) {
  const puck = ws ? { metadata: { workspace: ws } } : undefined;
  return render(<ContactDetailsBlock {...props} puck={puck} />);
}

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe("ContactDetailsBlock — smoke", () => {
  it("renders without crashing", () => {
    expect(() => renderBlock(makeWorkspace())).not.toThrow();
  });

  it("renders a <dl> with data-block='contact-details'", () => {
    const { container } = renderBlock(makeWorkspace());
    expect(container.querySelector("[data-block='contact-details']")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Blank props -> workspace fallback
// ---------------------------------------------------------------------------

describe("ContactDetailsBlock — blank props fall back to workspace", () => {
  it("shows workspace email when no override", () => {
    renderBlock(makeWorkspace(), {});
    expect(screen.getByText("hello@teststudio.com")).toBeTruthy();
  });

  it("shows workspace phone when no override", () => {
    renderBlock(makeWorkspace(), {});
    expect(screen.getByText("+63 912 345 6789")).toBeTruthy();
  });

  it("shows workspace address when no override", () => {
    renderBlock(makeWorkspace(), {});
    expect(screen.getByText("Taguig City, Metro Manila")).toBeTruthy();
  });

  it("shows workspace socials when no override", () => {
    renderBlock(makeWorkspace(), {});
    expect(screen.getByText("Instagram")).toBeTruthy();
    expect(screen.getByText("Facebook")).toBeTruthy();
    expect(screen.getByText("Website")).toBeTruthy();
  });
});

describe("ContactDetailsBlock — override replaces workspace value", () => {
  it("shows override email, not workspace email", () => {
    renderBlock(makeWorkspace(), { email: "override@x.com" });
    expect(screen.getByText("override@x.com")).toBeTruthy();
    expect(screen.queryByText("hello@teststudio.com")).toBeNull();
  });

  it("shows override phone, not workspace phone", () => {
    renderBlock(makeWorkspace(), { phone: "+1 555 000 0000" });
    expect(screen.getByText("+1 555 000 0000")).toBeTruthy();
    expect(screen.queryByText("+63 912 345 6789")).toBeNull();
  });

  it("shows override address, not workspace address", () => {
    renderBlock(makeWorkspace(), { address: "BGC, Taguig" });
    expect(screen.getByText("BGC, Taguig")).toBeTruthy();
    expect(screen.queryByText("Taguig City, Metro Manila")).toBeNull();
  });
});

describe("ContactDetailsBlock — socials override merges per-key", () => {
  it("override instagram replaces workspace instagram; other socials fall through", () => {
    renderBlock(makeWorkspace(), { instagram: "override_ig" });
    const igLink = screen.getByText("Instagram") as HTMLAnchorElement;
    expect(igLink.closest("a")?.href).toContain("override_ig");
    expect(screen.getByText("Facebook")).toBeTruthy();
    expect(screen.getByText("Website")).toBeTruthy();
  });
});

describe("ContactDetailsBlock — website href safety", () => {
  it("prefixes bare domain override with https://", () => {
    renderBlock(makeWorkspace(), { website: "example.com" });
    const link = screen.getByText("Website") as HTMLAnchorElement;
    expect(link.closest("a")?.href).toBe("https://example.com/");
  });
});

describe("ContactDetailsBlock — no workspace + no overrides", () => {
  it("renders empty <dl> with zero dt elements", () => {
    const { container } = renderBlock(null, {});
    const dl = container.querySelector("[data-block='contact-details']") as HTMLElement;
    expect(dl).not.toBeNull();
    expect(dl.querySelectorAll("dt").length).toBe(0);
  });
});

describe("ContactDetailsBlock — null socials skipped", () => {
  it("does not render TikTok link when workspace tiktok is null", () => {
    renderBlock(makeWorkspace(), {});
    expect(screen.queryByText("TikTok")).toBeNull();
  });
});

describe("ContactDetailsBlock — via buildRenderWorkspace", () => {
  it("renders email + phone from a built workspace doc", () => {
    const doc = {
      _id: "doc-id-1",
      name: "Studio Doc",
      contact: {
        email: "doc@studio.com",
        phone: "+63 917 000 1111",
        address: "Makati",
        socials: { instagram: "doc_studio", facebook: null, tiktok: null, website: null },
      },
    };
    const rw = buildRenderWorkspace(doc);
    renderBlock(rw, {});
    expect(screen.getByText("doc@studio.com")).toBeTruthy();
    expect(screen.getByText("+63 917 000 1111")).toBeTruthy();
    expect(screen.getByText("Makati")).toBeTruthy();
    expect(screen.getByText("Instagram")).toBeTruthy();
  });

  it("does not render any rows when workspace doc has no contact field", () => {
    const doc = { _id: "doc-id-2", name: "No Contact Studio" };
    const rw = buildRenderWorkspace(doc);
    const { container } = renderBlock(rw, {});
    const dl = container.querySelector("[data-block='contact-details']") as HTMLElement;
    expect(dl).not.toBeNull();
    expect(dl.querySelectorAll("dt").length).toBe(0);
  });
});
