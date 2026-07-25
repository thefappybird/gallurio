import { describe, expect, it } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { SidebarProvider } from "@/components/ui/sidebar";
import { renderWithProviders } from "@/test-utils/render";
import { ThemeToggle } from "./theme-toggle";

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <SidebarProvider>{children}</SidebarProvider>
    </NextThemesProvider>
  );
}

describe("ThemeToggle", () => {
  it("renders the trigger button", () => {
    renderWithProviders(
      <Wrapper>
        <ThemeToggle />
      </Wrapper>
    );
    expect(screen.getAllByText("Theme").length).toBeGreaterThan(0);
  });

  it("opens a menu with light/dark/system options", () => {
    renderWithProviders(
      <Wrapper>
        <ThemeToggle />
      </Wrapper>
    );
    const trigger = screen.getAllByText("Theme")[0];
    fireEvent.click(trigger);
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Light").closest('[data-slot="dropdown-menu-content"]')).toHaveAttribute("data-side", "inline-end");
  });

  it("renders a plain icon-button trigger (no sidebar context) when variant is standalone", () => {
    renderWithProviders(
      <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggle variant="standalone" />
      </NextThemesProvider>
    );
    expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument();
  });

  it("opens below the trigger when used in the standalone header variant", () => {
    renderWithProviders(
      <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggle variant="standalone" />
      </NextThemesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Theme" }));
    expect(screen.getByText("Light").closest('[data-slot="dropdown-menu-content"]')).toHaveAttribute("data-side", "bottom");
  });

  it("selected theme item has data-active=true; others have data-active=false", () => {
    renderWithProviders(
      <Wrapper>
        <ThemeToggle />
      </Wrapper>
    );
    const trigger = screen.getAllByText("Theme")[0];
    fireEvent.click(trigger);
    // defaultTheme is "light" in the Wrapper — Light item should be active
    const lightItem = screen.getByText("Light").closest("[data-active]");
    expect(lightItem).toHaveAttribute("data-active", "true");
    const darkItem = screen.getByText("Dark").closest("[data-active]");
    expect(darkItem).toHaveAttribute("data-active", "false");
  });
});
