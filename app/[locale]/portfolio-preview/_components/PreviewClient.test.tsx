import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@measured/puck", () => ({
  Render: ({ data }: { data: unknown }) => (
    <pre data-testid="render-data">{JSON.stringify(data)}</pre>
  ),
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
      />,
    );
    expect(screen.getByTestId("render-data").textContent).toContain("Fallback");
  });
});
