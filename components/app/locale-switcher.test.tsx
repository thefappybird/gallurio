import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { SidebarProvider } from "@/components/ui/sidebar";
import { LocaleSwitcher } from "./locale-switcher";

const replace = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/clients",
}));
let searchString = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchString),
}));

beforeAll(() => {
  // SidebarProvider's mobile detection needs matchMedia, absent in happy-dom.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

function renderAt(locale: string) {
  return render(
    <NextIntlClientProvider locale={locale} messages={enMessages}>
      <SidebarProvider>
        <LocaleSwitcher />
      </SidebarProvider>
    </NextIntlClientProvider>,
  );
}

describe("LocaleSwitcher", () => {
  it("shows the active locale's native name on the trigger", () => {
    renderAt("ar");
    expect(screen.getByText("العربية")).toBeInTheDocument();
  });

  it("renders a plain icon-button trigger (no sidebar context) when variant is standalone", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <LocaleSwitcher variant="standalone" />
      </NextIntlClientProvider>
    );
    expect(screen.getByRole("button", { name: /english/i })).toBeInTheDocument();
  });

  it("switches locale on the current path when an option is selected", async () => {
    renderAt("en");
    fireEvent.click(screen.getByRole("button", { name: /english/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "العربية" }));
    expect(replace).toHaveBeenCalledWith("/clients", { locale: "ar" });
  });

  it("preserves the current query string when switching locale", async () => {
    searchString = "status=pending&view=calendar";
    try {
      renderAt("en");
      fireEvent.click(screen.getByRole("button", { name: /english/i }));
      fireEvent.click(await screen.findByRole("menuitem", { name: "العربية" }));
      expect(replace).toHaveBeenCalledWith("/clients?status=pending&view=calendar", {
        locale: "ar",
      });
    } finally {
      searchString = "";
    }
  });
});
