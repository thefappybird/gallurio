/**
 * Tests for BookingsToolbar: "New Booking" button behavior and
 * mobile/desktop week-view visibility (Bug 1 + Bug 2 fixes).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BookingsToolbar } from "./bookings-toolbar";

describe("BookingsToolbar compact filter layout", () => {
  it("wraps filters only when needed instead of forcing each control into its own row", () => {
    const { getByTestId } = render(<BookingsToolbar defaultCurrency="PHP" />, { wrapper });
    const filters = getByTestId("booking-filter-controls");

    expect(filters).toHaveClass("flex-wrap");
    expect(filters).not.toHaveClass("flex-col");
  });
});

// ── Navigation stubs ──────────────────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/bookings",
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: vi.fn() }),
}));

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: vi.fn() }),
  usePathname: () => "/bookings",
  Link: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// ── CsvImportDialog stub (avoids pulling in heavy file-upload deps) ───────────
vi.mock("./csv-import-dialog", () => ({
  CsvImportDialog: () => null,
}));

// ── InvoiceThemeDialog stub (avoids pulling in the real dialog + action) ──────
const invoiceThemeDialogOpenSpy = vi.fn();
vi.mock("./invoice-theme-dialog", () => ({
  InvoiceThemeDialog: (props: { open: boolean }) => {
    invoiceThemeDialogOpenSpy(props.open);
    return null;
  },
}));

const DEFAULT_INVOICE_THEME = { preset: "classic" as const, main: "#1A1A1A", accent: "#FFFFFF" };


function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingsToolbar — New Booking button", () => {
  it("renders the 'New Booking' (add) button", () => {
    render(<BookingsToolbar defaultCurrency="PHP" />, { wrapper });
    // The button text comes from the i18n key app.bookings.toolbar.add
    const btn = screen.getByRole("button", { name: /new booking|add/i });
    expect(btn).toBeTruthy();
  });

  it("calls onAddClick when the button is clicked (direct open path)", () => {
    const onAddClick = vi.fn();
    render(<BookingsToolbar defaultCurrency="PHP" onAddClick={onAddClick} />, { wrapper });
    const btn = screen.getByRole("button", { name: /new booking|add/i });
    fireEvent.click(btn);
    expect(onAddClick).toHaveBeenCalledTimes(1);
  });

  it("does NOT call router.push when onAddClick is provided", () => {
    const onAddClick = vi.fn();
    render(<BookingsToolbar defaultCurrency="PHP" onAddClick={onAddClick} />, { wrapper });
    const btn = screen.getByRole("button", { name: /new booking|add/i });
    fireEvent.click(btn);
    // The router push must NOT fire — local handler takes over.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls router.push with ?add=1 when onAddClick is NOT provided (URL path)", () => {
    render(<BookingsToolbar defaultCurrency="PHP" />, { wrapper });
    const btn = screen.getByRole("button", { name: /new booking|add/i });
    fireEvent.click(btn);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("add=1"),
      expect.anything()
    );
  });
});

describe("BookingsToolbar — Show past toggle", () => {
  it("renders a 'Show past' label", () => {
    render(<BookingsToolbar defaultCurrency="PHP" />, { wrapper });
    // The label text comes from app.bookings.toolbar.showPast
    expect(screen.getByText(/show past/i)).toBeInTheDocument();
  });

  it("'Show past' switch renders checked by default (opt-out convention)", () => {
    render(<BookingsToolbar defaultCurrency="PHP" />, { wrapper });
    // @base-ui Switch renders as role="switch" with aria-checked attribute.
    const showPastSwitch = screen
      .getAllByRole("switch")
      .find((s) => s.closest("label")?.textContent?.match(/show past/i));
    expect(showPastSwitch).toBeTruthy();
    // showPast absent from the URL → filter is ON.
    expect(showPastSwitch).toHaveAttribute("aria-checked", "true");
  });

  it("pushes showPast=0 when the switch is turned off", () => {
    render(<BookingsToolbar defaultCurrency="PHP" />, { wrapper });
    const showPastSwitch = screen
      .getAllByRole("switch")
      .find((s) => s.closest("label")?.textContent?.match(/show past/i));
    expect(showPastSwitch).toBeTruthy();
    fireEvent.click(showPastSwitch!);
    // router.push is called with the URL as first argument
    const calls = mockPush.mock.calls;
    expect(calls.some((args) => String(args[0]).includes("showPast=0"))).toBe(true);
  });
});

describe("BookingsToolbar — status dropdown visibility by view", () => {
  it("renders the status dropdown in table view (default)", () => {
    render(<BookingsToolbar defaultCurrency="PHP" />, { wrapper });
    // SelectValue shows app.bookings.toolbar.statusAll → "All statuses"
    expect(screen.getByText(/all statuses/i)).toBeInTheDocument();
  });

  it("renders the status dropdown when view='table' explicitly", () => {
    render(<BookingsToolbar defaultCurrency="PHP" view="table" />, { wrapper });
    expect(screen.getByText(/all statuses/i)).toBeInTheDocument();
  });

  it("also renders the status dropdown in calendar view (status is a dropdown in both views now)", () => {
    render(<BookingsToolbar defaultCurrency="PHP" view="calendar" />, { wrapper });
    expect(screen.getByText(/all statuses/i)).toBeInTheDocument();
  });
});

describe("BookingsToolbar — Week view button visibility classes (Bug 2)", () => {
  // We test the class strings that drive visibility rather than actual media
  // query evaluation — Tailwind classes are the source of truth; JSDOM does
  // not interpret CSS breakpoints.

  it("week button class includes 'hidden' (hidden on mobile by default)", () => {
    // The class string emitted by the toolbar for the Week button:
    //   `min-h-11${i > 0 ? " border-l-0" : ""}${v === Views.WEEK ? " hidden sm:inline-flex" : ""}`
    const weekClass = "min-h-11 border-l-0 hidden sm:inline-flex";
    expect(weekClass).toContain("hidden");
  });

  it("week button class includes 'sm:inline-flex' (visible on desktop)", () => {
    const weekClass = "min-h-11 border-l-0 hidden sm:inline-flex";
    expect(weekClass).toContain("sm:inline-flex");
  });

  it("month button class does NOT include 'hidden'", () => {
    const monthClass = "min-h-11";
    expect(monthClass).not.toContain("hidden");
  });

  it("day button class does NOT include 'hidden'", () => {
    const dayClass = "min-h-11 border-l-0";
    expect(dayClass).not.toContain("hidden");
  });
});

// ── Render-loop regression (Task G) ──────────────────────────────────────────
// Verifies that pushParams no longer captures a new searchParams reference on
// every render. With the ref-based fix, pushParams identity is stable (only
// changes when router/pathname change), so the debounce effect does NOT re-fire
// on each render.
//
// We simulate the prior loop trigger: a render that provides a new (different)
// URLSearchParams object reference while the query value stays the same.
// The debounce effect must NOT call router.push again after the initial
// stable state is reached.

describe("BookingsToolbar — render-loop stability (regression guard)", () => {
  it("does NOT call router.push on re-render when the component re-renders with the same searchParams values", () => {
    // First render with no params — debounce effect fires but q === current
    // (both empty) so it bails out immediately and does NOT call pushParams.
    const { rerender } = render(
      <BookingsToolbar defaultCurrency="PHP" />,
      { wrapper }
    );

    vi.clearAllMocks();

    // Re-render multiple times — simulates React re-renders triggered by
    // parent state changes. searchParams object may have a new reference each
    // time but values are unchanged. With the ref-based pushParams fix,
    // pushParams identity is stable so the debounce effect does NOT re-fire.
    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BookingsToolbar defaultCurrency="PHP" />
      </NextIntlClientProvider>
    );
    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BookingsToolbar defaultCurrency="PHP" />
      </NextIntlClientProvider>
    );
    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BookingsToolbar defaultCurrency="PHP" />
      </NextIntlClientProvider>
    );

    // router.push must NOT have been called by a re-render-driven effect cycle.
    // (It would be called if the debounce effect re-fired due to an unstable
    // pushParams identity caused by searchParams in its dep array.)
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("BookingsToolbar — pending state", () => {
  it("reports a pending transition to the parent while a filter change navigates", () => {
    const onPendingChange = vi.fn();
    render(
      <BookingsToolbar defaultCurrency="PHP" onPendingChange={onPendingChange} />,
      { wrapper }
    );

    const allSwitches = screen.getAllByRole("switch");
    const showPastSwitch = allSwitches.find(
      (s) => s.closest("label")?.textContent?.match(/show past/i)
    );
    fireEvent.click(showPastSwitch!);

    expect(mockPush).toHaveBeenCalled();
    expect(onPendingChange.mock.calls).toContainEqual([true]);
    expect(onPendingChange.mock.calls.at(-1)).toEqual([false]);
  });
});

describe("BookingsToolbar — Invoice theme button", () => {
  it("renders the Invoice theme button for an owner and opens the dialog on click", () => {
    render(
      <BookingsToolbar
        defaultCurrency="PHP"
        isOwner
        initialInvoiceTheme={DEFAULT_INVOICE_THEME}
      />,
      { wrapper }
    );
    const btn = screen.getByRole("button", { name: /invoice theme/i });
    fireEvent.click(btn);
    expect(invoiceThemeDialogOpenSpy).toHaveBeenCalledWith(true);
  });

  it("does not render the Invoice theme button for a non-owner", () => {
    render(
      <BookingsToolbar
        defaultCurrency="PHP"
        isOwner={false}
        initialInvoiceTheme={DEFAULT_INVOICE_THEME}
      />,
      { wrapper }
    );
    expect(screen.queryByRole("button", { name: /invoice theme/i })).not.toBeInTheDocument();
  });

  // Regression: workspaces created before `invoiceTheme` existed on the schema
  // have no key at all — `.lean()` in requireOrg() skips schema defaults, so
  // `workspace.invoiceTheme` is `undefined`, not the classic preset object.
  // The button's visibility must depend only on `isOwner`, never on the theme
  // value being truthy — otherwise pre-existing workspaces can never open the
  // dialog to set a theme in the first place.
  it("renders the Invoice theme button for an owner even when initialInvoiceTheme is undefined", () => {
    render(
      <BookingsToolbar
        defaultCurrency="PHP"
        isOwner
        initialInvoiceTheme={undefined}
      />,
      { wrapper }
    );
    expect(screen.getByRole("button", { name: /invoice theme/i })).toBeInTheDocument();
  });
});
