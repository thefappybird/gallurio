import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const theme = vi.hoisted(() => ({ resolvedTheme: undefined as string | undefined }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: theme.resolvedTheme }) }));

import { ThemedShot } from "./themed-shot";

describe("ThemedShot", () => {
  it("renders only the light-theme image when resolvedTheme is unset (SSR/pre-mount)", () => {
    theme.resolvedTheme = undefined;
    render(<ThemedShot base="/marketing/screenshots/dashboard-overview" alt="Dashboard" sizes="100vw" />);

    const images = screen.getAllByAltText("Dashboard");
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute("src")).toContain("dashboard-overview-light.png");
  });

  it("swaps to the dark-theme image post-mount when resolvedTheme is dark", async () => {
    theme.resolvedTheme = "dark";
    render(<ThemedShot base="/marketing/screenshots/dashboard-overview" alt="Dashboard" sizes="100vw" />);

    await waitFor(() => {
      const images = screen.getAllByAltText("Dashboard");
      expect(images).toHaveLength(1);
      expect(images[0].getAttribute("src")).toContain("dashboard-overview-dark.png");
    });
  });

  it("renders only the light-theme image when resolvedTheme is light", async () => {
    theme.resolvedTheme = "light";
    render(<ThemedShot base="/marketing/screenshots/dashboard-overview" alt="Dashboard" sizes="100vw" />);

    await waitFor(() => {
      const images = screen.getAllByAltText("Dashboard");
      expect(images).toHaveLength(1);
      expect(images[0].getAttribute("src")).toContain("dashboard-overview-light.png");
    });
  });
});
