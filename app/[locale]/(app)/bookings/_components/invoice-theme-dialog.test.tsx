import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { enMessages } from "@/test-utils/messages";
import { INVOICE_THEME_PRESETS } from "@/lib/invoices/theme";
import { InvoiceThemeDialog } from "./invoice-theme-dialog";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/bookings",
}));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bookings",
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const updateInvoiceThemeActionMock = vi.fn();
vi.mock("../_actions", () => ({
  updateInvoiceThemeAction: (...args: unknown[]) => updateInvoiceThemeActionMock(...args),
}));

const refreshMock = vi.fn();
const invalidateSpy = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-data-events", () => ({ useInvalidateFor: () => invalidateSpy }));

const BRAND_KIT = {
  primaryColor: "#102030",
  accentColor: "#c08040",
  foregroundColor: "#111111",
  backgroundColor: "#f5f5f5",
};
const SAVED = [{ id: "s1", name: "Studio Sage", main: "#445544", accent: "#aabbaa", text: "#ffffff" }];

function renderDialog(
  props: Partial<React.ComponentProps<typeof InvoiceThemeDialog>> = {},
  onClose = vi.fn()
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <InvoiceThemeDialog
        open
        onClose={onClose}
        initialTheme={{ preset: "minimal", main: "#1A1A1A", accent: "#FFFFFF", text: "#FFFFFF" }}
        portfolioBrandKit={BRAND_KIT}
        savedThemes={SAVED}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  updateInvoiceThemeActionMock.mockReset();
  refreshMock.mockReset();
});

describe("InvoiceThemeDialog", () => {
  it("renders portfolio, preset, saved and custom tiles", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /Match my portfolio/ })).toBeEnabled();
    for (const name of ["Minimal", "Editorial", "Luxury", "Bold", "Romantic", "Modern", "Studio Sage", "Custom"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("disables the portfolio tile with a hint when nothing is published", () => {
    renderDialog({ portfolioBrandKit: null });
    expect(screen.getByRole("button", { name: /Match my portfolio/ })).toBeDisabled();
    expect(screen.getByText("Publish your portfolio first")).toBeInTheDocument();
  });

  it("shows workspace data in compact A4 invoice and receipt previews", () => {
    renderDialog({
      business: {
        name: "North Star Stories",
        logoUrl: "https://imagedelivery.net/example/logo/public",
        address: "24 Palm Avenue, Dubai",
        email: "hello@northstar.test",
        currency: "AED",
      },
    });

    const invoicePreview = screen.getByLabelText("Invoice preview");
    expect(invoicePreview).toHaveClass("aspect-[210/297]", "max-w-[18rem]");
    expect(screen.getByText("North Star Stories")).toBeInTheDocument();
    expect(screen.getAllByText("24 Palm Avenue, Dubai")).toHaveLength(2);
    expect(document.querySelector('img[src="https://imagedelivery.net/example/logo/public"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Receipt" }));
    expect(screen.getByLabelText("Receipt preview")).toBeInTheDocument();
    expect(screen.getByText("Paid in full for Summer wedding.")).toBeInTheDocument();
  });

  it("saving a preset sends its colors and text, then closes and invalidates", async () => {
    updateInvoiceThemeActionMock.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    renderDialog({}, onClose);

    fireEvent.click(screen.getByRole("button", { name: "Luxury" }));
    fireEvent.click(screen.getByRole("button", { name: /save and apply/i }));

    await waitFor(() => {
      expect(updateInvoiceThemeActionMock).toHaveBeenCalledWith({
        preset: "luxury",
        main: INVOICE_THEME_PRESETS.luxury.main,
        accent: INVOICE_THEME_PRESETS.luxury.accent,
        text: INVOICE_THEME_PRESETS.luxury.text,
      });
      expect(onClose).toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith({ type: "workspace.updated" });
    });
  });

  it("saving a saved theme sends savedThemeId", async () => {
    updateInvoiceThemeActionMock.mockResolvedValue({ ok: true });
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Studio Sage" }));
    fireEvent.click(screen.getByRole("button", { name: /save and apply/i }));

    await waitFor(() =>
      expect(updateInvoiceThemeActionMock).toHaveBeenCalledWith({
        preset: "saved",
        savedThemeId: "s1",
        main: "#445544",
        accent: "#aabbaa",
        text: "#ffffff",
      })
    );
  });

  it("selecting Custom reveals Main color and Accent color swatch pickers", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.getByText("Main color")).toBeInTheDocument();
    expect(screen.getByText("Accent color")).toBeInTheDocument();
  });

  it("paints the preview band text with the theme text color", () => {
    renderDialog({ initialTheme: { preset: "saved", savedThemeId: "s1", main: "#445544", accent: "#aabbaa", text: "#ffffff" } });
    const header = screen.getByLabelText("Invoice preview").querySelector("header") as HTMLElement;
    expect(header).toHaveStyle({ color: "#ffffff", backgroundColor: "#445544" });
  });

  it("expands the active document full-screen and returns focus to the button on Escape", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("tab", { name: "Receipt" }));
    const expand = screen.getByRole("button", { name: "Expand preview" });
    expand.focus();
    fireEvent.click(expand);

    const dialogs = await screen.findAllByRole("dialog");
    const viewer = dialogs[dialogs.length - 1];
    expect(viewer.querySelector('[aria-label="Receipt preview"]')).toBeTruthy();

    fireEvent.keyDown(viewer, { key: "Escape" });
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
    expect(expand).toHaveFocus();
  });
});
