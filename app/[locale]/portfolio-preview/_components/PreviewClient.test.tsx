import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@measured/puck", () => ({
  Render: ({ data }: { data: unknown }) => (
    <pre data-testid="render-data">{JSON.stringify(data)}</pre>
  ),
  createUsePuck: () => () => undefined,
}));

import { PreviewClient } from "./PreviewClient";

const KEY = "gallurio:portfolio-draft:studio-aurora";

describe("PreviewClient", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the home zone from the localStorage draft", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        draftId: null,
        data: {
          home: { content: [{ type: "Heading", props: { id: "h1", text: "Hi" } }], root: {} },
          gallery: { content: [], root: {} },
        },
      }),
    );
    render(
      <PreviewClient
        slug="studio-aurora"
        zone="home"
        workspace={{ slug: "studio-aurora" } as never}
        fallbackData={{ content: [], root: {} }}
        draftId={null}
      />,
    );
    expect(screen.getByTestId("render-data").textContent).toContain("Hi");
  });

  it("falls back to server data when no draft is present", () => {
    render(
      <PreviewClient
        slug="studio-aurora"
        zone="home"
        workspace={{ slug: "studio-aurora" } as never}
        fallbackData={{ content: [{ type: "Heading", props: { id: "f1", text: "Fallback" } }], root: {} }}
        draftId={null}
      />,
    );
    expect(screen.getByTestId("render-data").textContent).toContain("Fallback");
  });

  it("applies the localStorage buffer when its draftId matches the requested draftId", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        draftId: "draft-a",
        data: {
          home: { content: [{ type: "Heading", props: { id: "h1", text: "Draft A content" } }], root: {} },
        },
      }),
    );
    render(
      <PreviewClient
        slug="studio-aurora"
        zone="home"
        workspace={{ slug: "studio-aurora" } as never}
        fallbackData={{ content: [{ type: "Heading", props: { id: "f1", text: "Server B content" } }], root: {} }}
        draftId="draft-a"
      />,
    );
    expect(screen.getByTestId("render-data").textContent).toContain("Draft A content");
  });

  it("ignores the localStorage buffer when its draftId does not match the requested draftId", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        draftId: "draft-a",
        data: {
          home: { content: [{ type: "Heading", props: { id: "h1", text: "Draft A content" } }], root: {} },
        },
      }),
    );
    render(
      <PreviewClient
        slug="studio-aurora"
        zone="home"
        workspace={{ slug: "studio-aurora" } as never}
        fallbackData={{ content: [{ type: "Heading", props: { id: "f1", text: "Server B content" } }], root: {} }}
        draftId="draft-b"
      />,
    );
    expect(screen.getByTestId("render-data").textContent).toContain("Server B content");
    expect(screen.getByTestId("render-data").textContent).not.toContain("Draft A content");
  });

  it("applies the localStorage buffer with no draftId when the requested draftId is also null (unsaved-draft back-compat)", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        data: {
          home: { content: [{ type: "Heading", props: { id: "h1", text: "Unsaved content" } }], root: {} },
        },
      }),
    );
    render(
      <PreviewClient
        slug="studio-aurora"
        zone="home"
        workspace={{ slug: "studio-aurora" } as never}
        fallbackData={{ content: [{ type: "Heading", props: { id: "f1", text: "Server content" } }], root: {} }}
        draftId={null}
      />,
    );
    expect(screen.getByTestId("render-data").textContent).toContain("Unsaved content");
  });
});
