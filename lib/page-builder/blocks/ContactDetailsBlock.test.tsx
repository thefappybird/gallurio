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

// The render path threads the workspace through Puck `metadata` (RSC-safe).
// Tests mirror that by passing the workspace via the `puck` prop rather than
// the server-only AsyncLocalStorage store.
function renderBlock(ws: RenderWorkspace | null, props: ContactDetailsProps) {
  const puck = ws ? { metadata: { workspace: ws } } : undefined;
  return render(<ContactDetailsBlock {...props} puck={puck} />);
}

// ---------------------------------------------------------------------------
// Smoke test — renders without crashing
// ---------------------------------------------------------------------------

describe("ContactDetailsBlock — smoke test", () => {
  it("renders without crashing inside a workspace context", () => {
    const ws = makeWorkspace();
    expect(() => renderBlock(ws, contactDetailsDefaultProps)).not.toThrow();
  });

  it("renders a <dl> element with data-block='contact-details'", () => {
    const ws = makeWorkspace();
    const { container } = renderBlock(ws, contactDetailsDefaultProps);
    expect(container.querySelector("[data-block='contact-details']")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// showEmail toggle
// ---------------------------------------------------------------------------

describe("ContactDetailsBlock — showEmail", () => {
  it("renders the email when showEmail=true and workspace has an email", () => {
    renderBlock(makeWorkspace(), { showEmail: true, showPhone: false, showAddress: false, showSocials: false });
    expect(screen.getByText("hello@teststudio.com")).toBeTruthy();
  });

  it("does NOT render the email when showEmail=false", () => {
    renderBlock(makeWorkspace(), { showEmail: false, showPhone: false, showAddress: false, showSocials: false });
    expect(screen.queryByText("hello@teststudio.com")).toBeNull();
  });

  it("does NOT render the email when workspace has no email", () => {
    const ws = makeWorkspace({ contact: { email: null, phone: "+63 912 345 6789", address: null, socials: null } });
    renderBlock(ws, { showEmail: true, showPhone: false, showAddress: false, showSocials: false });
    expect(screen.queryByText(/hello@/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// showPhone toggle
// ---------------------------------------------------------------------------

describe("ContactDetailsBlock — showPhone", () => {
  it("renders the phone when showPhone=true and workspace has a phone", () => {
    renderBlock(makeWorkspace(), { showEmail: false, showPhone: true, showAddress: false, showSocials: false });
    expect(screen.getByText("+63 912 345 6789")).toBeTruthy();
  });

  it("does NOT render the phone when showPhone=false", () => {
    renderBlock(makeWorkspace(), { showEmail: false, showPhone: false, showAddress: false, showSocials: false });
    expect(screen.queryByText("+63 912 345 6789")).toBeNull();
  });

  it("does NOT render the phone when workspace has no phone", () => {
    const ws = makeWorkspace({ contact: { email: "a@b.com", phone: null, address: null, socials: null } });
    renderBlock(ws, { showEmail: false, showPhone: true, showAddress: false, showSocials: false });
    expect(screen.queryByText(/\+63/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// showAddress toggle
// ---------------------------------------------------------------------------

describe("ContactDetailsBlock — showAddress", () => {
  it("renders the address when showAddress=true", () => {
    renderBlock(makeWorkspace(), { showEmail: false, showPhone: false, showAddress: true, showSocials: false });
    expect(screen.getByText("Taguig City, Metro Manila")).toBeTruthy();
  });

  it("does NOT render the address when showAddress=false", () => {
    renderBlock(makeWorkspace(), { showEmail: false, showPhone: false, showAddress: false, showSocials: false });
    expect(screen.queryByText("Taguig City, Metro Manila")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// showSocials toggle
// ---------------------------------------------------------------------------

describe("ContactDetailsBlock — showSocials", () => {
  it("renders social links when showSocials=true", () => {
    renderBlock(makeWorkspace(), { showEmail: false, showPhone: false, showAddress: false, showSocials: true });
    expect(screen.getByText("Instagram")).toBeTruthy();
    expect(screen.getByText("Facebook")).toBeTruthy();
    expect(screen.getByText("Website")).toBeTruthy();
  });

  it("does NOT render social links when showSocials=false", () => {
    renderBlock(makeWorkspace(), { showEmail: false, showPhone: false, showAddress: false, showSocials: false });
    expect(screen.queryByText("Instagram")).toBeNull();
  });

  it("does NOT render the socials row when workspace has no socials", () => {
    const ws = makeWorkspace({ contact: { email: "a@b.com", phone: null, address: null, socials: null } });
    renderBlock(ws, { showEmail: false, showPhone: false, showAddress: false, showSocials: true });
    expect(screen.queryByTestId("socials-row")).toBeNull();
  });

  it("skips a social link for null values (TikTok null in fixture)", () => {
    renderBlock(makeWorkspace(), { showEmail: false, showPhone: false, showAddress: false, showSocials: true });
    // tiktok is null in the fixture, so TikTok link should not appear
    expect(screen.queryByText("TikTok")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// No workspace context
// ---------------------------------------------------------------------------

describe("ContactDetailsBlock — no workspace context", () => {
  it("renders an empty <dl> without crashing when no workspace context is provided", () => {
    // ContactDetailsBlock calls getRenderWorkspaceFrom(puck) — when puck is
    // undefined it returns null, so the block renders an empty <dl>.
    const { container } = render(
      React.createElement(ContactDetailsBlock, contactDetailsDefaultProps)
    );
    expect(container.querySelector("[data-block='contact-details']")).not.toBeNull();
    // No text rows appear since contact is null
    expect(screen.queryByText(/Email/i)).toBeNull();
    expect(screen.queryByText(/Phone/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildRenderWorkspace integration (puck metadata path)
// ---------------------------------------------------------------------------

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
    renderBlock(rw, { showEmail: true, showPhone: true, showAddress: true, showSocials: true });
    expect(screen.getByText("doc@studio.com")).toBeTruthy();
    expect(screen.getByText("+63 917 000 1111")).toBeTruthy();
    expect(screen.getByText("Makati")).toBeTruthy();
    expect(screen.getByText("Instagram")).toBeTruthy();
  });

  it("does not render any rows when workspace doc has no contact field", () => {
    const doc = { _id: "doc-id-2", name: "No Contact Studio" };
    const rw = buildRenderWorkspace(doc);
    const { container } = renderBlock(rw, { showEmail: true, showPhone: true, showAddress: true, showSocials: true });
    // The <dl> renders but is empty (no child rows)
    const dl = container.querySelector("[data-block='contact-details']") as HTMLElement;
    expect(dl).not.toBeNull();
    // No label terms (dt elements) should exist
    expect(dl.querySelectorAll("dt").length).toBe(0);
  });
});
