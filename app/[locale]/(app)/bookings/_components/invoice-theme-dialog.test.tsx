import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
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

function renderDialog(onClose = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <InvoiceThemeDialog
        open
        onClose={onClose}
        initialTheme={{ preset: "classic", main: "#1A1A1A", accent: "#FFFFFF" }}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  updateInvoiceThemeActionMock.mockReset();
  refreshMock.mockReset();
});

describe("InvoiceThemeDialog", () => {
  it("renders all 5 theme tiles", () => {
    renderDialog();
    expect(screen.getByText("Classic")).toBeInTheDocument();
    expect(screen.getByText("Slate")).toBeInTheDocument();
    expect(screen.getByText("Navy Gold")).toBeInTheDocument();
    expect(screen.getByText("Forest")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("shows workspace data in compact A4 invoice and receipt previews", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <InvoiceThemeDialog
          open
          onClose={vi.fn()}
          initialTheme={{ preset: "classic", main: "#1A1A1A", accent: "#FFFFFF" }}
          business={{
            name: "North Star Stories",
            logoUrl: "https://imagedelivery.net/example/logo/public",
            address: "24 Palm Avenue, Dubai",
            email: "hello@northstar.test",
            currency: "AED",
          }}
        />
      </NextIntlClientProvider>
    );

    const invoicePreview = screen.getByLabelText("Invoice preview");
    expect(invoicePreview).toHaveClass("aspect-[210/297]", "max-w-[18rem]");
    expect(screen.getByText("North Star Stories")).toBeInTheDocument();
    expect(screen.getAllByText("24 Palm Avenue, Dubai")).toHaveLength(2);
    expect(document.querySelector('img[src="https://imagedelivery.net/example/logo/public"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Receipt" }));
    expect(screen.getByLabelText("Receipt preview")).toBeInTheDocument();
    expect(screen.getByText("Paid in full for Summer wedding.")).toBeInTheDocument();
  });

  it("selecting Slate and clicking Save and apply calls the action with preset slate, then closes and refreshes", async () => {
    updateInvoiceThemeActionMock.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    renderDialog(onClose);

    fireEvent.click(screen.getByText("Slate"));
    fireEvent.click(screen.getByRole("button", { name: /save and apply/i }));

    await waitFor(() => {
      expect(updateInvoiceThemeActionMock).toHaveBeenCalledWith(
        expect.objectContaining({ preset: "slate" })
      );
      expect(onClose).toHaveBeenCalled();
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("selecting Custom reveals Main color and Accent color swatch pickers", () => {
    renderDialog();
    fireEvent.click(screen.getByText("Custom"));
    expect(screen.getByText("Main color")).toBeInTheDocument();
    expect(screen.getByText("Accent color")).toBeInTheDocument();
  });
});
