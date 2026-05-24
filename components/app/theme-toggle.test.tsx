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
  });
});
