import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { enMessages } from "@/test-utils/messages";
import { PricingTeaser } from "./pricing-teaser";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const proPricing = { currency: "PHP", monthly: 250, yearly: 2500 };

beforeEach(() => {
  // Never resolves by default -- keeps the SSR price/tabs stable for every
  // test that doesn't care about the fetch swap.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {}))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PricingTeaser", () => {
  it("renders a single Pro plan with the live monthly price", () => {
    render(<PricingTeaser proPricing={proPricing} betaEnabled={false} />, { wrapper });

    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("1 month free")).toBeInTheDocument();
    expect(screen.getByText(/₱250/)).toBeInTheDocument();
  });

  it("switches to the live yearly price when the Yearly cadence is selected", () => {
    render(<PricingTeaser proPricing={proPricing} betaEnabled={false} />, { wrapper });

    fireEvent.click(screen.getByRole("button", { name: /yearly/i }));
    expect(screen.getByText(/₱2,500/)).toBeInTheDocument();
  });

  it("names the billed amount under the local-currency headline", () => {
    render(
      <PricingTeaser
        proPricing={{ ...proPricing, local: { currency: "USD", monthly: 4.3, yearly: 43 } }}
        betaEnabled={false}
      />,
      { wrapper }
    );

    expect(screen.getByText(/Billed as ₱250 PHP/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /yearly/i }));
    expect(screen.getByText(/Billed as ₱2,500 PHP/)).toBeInTheDocument();
  });

  it("does not show a Beta tab when betaEnabled is false", () => {
    render(<PricingTeaser proPricing={proPricing} betaEnabled={false} />, { wrapper });

    expect(screen.queryByRole("button", { name: /^beta$/i })).not.toBeInTheDocument();
  });

  it("selects the Beta tab by default when betaEnabled is true", () => {
    render(<PricingTeaser proPricing={proPricing} betaEnabled={true} />, { wrapper });

    expect(screen.getByRole("button", { name: /^beta$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Join the beta" });
    expect(cta).toHaveAttribute("href", "/sign-up");
  });

  it("shows the Pro price after switching to Monthly from the Beta default", () => {
    render(<PricingTeaser proPricing={proPricing} betaEnabled={true} />, { wrapper });

    fireEvent.click(screen.getByRole("button", { name: /^monthly$/i }));
    expect(screen.getByText(/₱250/)).toBeInTheDocument();
  });

  it("swaps in the live price after a successful fetch resolves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ pricing: { currency: "USD", monthly: 12, yearly: 120 }, betaEnabled: false }),
        })
      )
    );

    render(<PricingTeaser proPricing={proPricing} betaEnabled={false} />, { wrapper });

    expect(screen.getByText(/₱250/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/\$12/)).toBeInTheDocument());
  });

  it("re-derives the default tab when the beta flag flips and the visitor hasn't touched the tabs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ pricing: proPricing, betaEnabled: true }),
        })
      )
    );

    render(<PricingTeaser proPricing={proPricing} betaEnabled={false} />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^beta$/i })).toHaveAttribute("aria-pressed", "true")
    );
  });

  it("keeps a touched tab choice when the beta flag flips on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ pricing: proPricing, betaEnabled: true }),
        })
      )
    );

    render(<PricingTeaser proPricing={proPricing} betaEnabled={false} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /^yearly$/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /^beta$/i })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^yearly$/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("forces a touched Beta selection to Monthly if the flag flips off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ pricing: proPricing, betaEnabled: false }),
        })
      )
    );

    render(<PricingTeaser proPricing={proPricing} betaEnabled={true} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /^beta$/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^monthly$/i })).toHaveAttribute("aria-pressed", "true")
    );
    expect(screen.queryByRole("button", { name: /^beta$/i })).not.toBeInTheDocument();
  });

  it("keeps the server-rendered price and warns once on a failed fetch", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }))
    );

    render(<PricingTeaser proPricing={proPricing} betaEnabled={false} />, { wrapper });

    await waitFor(() => expect(warnSpy).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/₱250/)).toBeInTheDocument();
    warnSpy.mockRestore();
  });

  it("does not wrap the plan card in aria-live so tab clicks don't re-announce the whole card", () => {
    render(<PricingTeaser proPricing={proPricing} betaEnabled={false} />, { wrapper });

    expect(document.querySelector("[aria-live]")).not.toBeInTheDocument();
  });

  it("aborts the in-flight fetch on unmount", () => {
    const abort = vi.fn();
    const fetchMock = vi.fn(() => new Promise(() => {}));
    const OriginalAbortController = globalThis.AbortController;
    class FakeAbortController extends OriginalAbortController {
      abort(...args: Parameters<AbortController["abort"]>) {
        abort();
        super.abort(...args);
      }
    }
    vi.stubGlobal("AbortController", FakeAbortController);
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<PricingTeaser proPricing={proPricing} betaEnabled={false} />, { wrapper });
    unmount();

    expect(abort).toHaveBeenCalledTimes(1);
  });
});
