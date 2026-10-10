/**
 * Detail modal and edit wizard share ONE booking query key: opening the wizard
 * from the detail modal ("Edit all") is served from cache, and the picker's
 * client list is fetched lazily and cached across wizard opens.
 */
import React, { useState } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { enMessages } from "@/test-utils/messages";
import { AppQueryProvider } from "@/components/app/app-query-provider";
import { BookingDetailModal } from "./booking-detail-modal";
import { BookingWizardModal } from "./booking-wizard-modal";

vi.mock("@/lib/time-format/context", () => ({
  useTimeFormat: vi.fn(() => "24h"),
  useTimeFormatContext: vi.fn(() => ({ timeMode: "24h", setTimeMode: vi.fn() })),
  TimeFormatProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/bookings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/bookings",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children),
}));
vi.mock("@/lib/actions/clients", () => ({
  getClientByIdAction: vi.fn(),
  getClientBookingsAction: vi.fn().mockResolvedValue([]),
  findClientMatchesAction: vi.fn().mockResolvedValue({ matches: [] }),
  updateClientAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/ui/location-picker", () => ({ LocationPicker: () => null, LocationDisplay: () => null }));

const ID = "aabbccddeeff001122334455";
const CLIENT_ID = "aabbccddeeff001122334400";
const BOOKING = {
  _id: ID,
  title: "Cache Wedding",
  clientName: "Emma Carter",
  clientId: CLIENT_ID,
  client: { id: CLIENT_ID, name: "Emma Carter", email: "e@x.com", phone: null },
  eventType: "wedding",
  status: "booked",
  sessions: [{ startAt: "2030-08-15T10:00:00Z", endAt: "2030-08-15T17:00:00Z" }],
  location: { address: "Venue" },
  amount: { total: 1000, deposit: 0, currency: "PHP" },
  payments: [],
  notes: "",
};

function makeFetch() {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.startsWith(`/api/bookings/${ID}?include=activity`)) {
      return { ok: true, status: 200, json: async () => ({ ...BOOKING, activity: { entries: [], total: 0, page: 1, pageSize: 5, actorNames: {} } }) };
    }
    if (u.includes("shifts-on-date")) return { ok: true, json: async () => ({ byDate: {} }) };
    if (u.startsWith("/api/clients")) {
      return { ok: true, json: async () => [{ id: CLIENT_ID, name: "Emma Carter", email: "e@x.com", phone: null }] };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  });
}

afterEach(() => vi.unstubAllGlobals());

const calls = (fetchMock: ReturnType<typeof makeFetch>, needle: string) =>
  fetchMock.mock.calls.filter(([u]) => String(u).includes(needle)).length;

function Flow() {
  const [step, setStep] = useState<"detail" | "wizard">("detail");
  return (
    <>
      <button type="button" onClick={() => setStep(step === "detail" ? "wizard" : "detail")}>
        switch
      </button>
      {step === "detail" ? (
        <BookingDetailModal bookingId={ID} locale="en" />
      ) : (
        <BookingWizardModal mode="edit" bookingId={ID} defaultCurrency="PHP" locale="en" />
      )}
    </>
  );
}

function renderFlow() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <AppQueryProvider workspaceId="ws-test">
        <Flow />
      </AppQueryProvider>
    </NextIntlClientProvider>
  );
}

describe("booking modals share the booking cache", () => {
  it("detail -> edit wizard issues ONE booking request in total", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderFlow();
    await screen.findByRole("heading", { name: "Cache Wedding" });
    fireEvent.click(screen.getByText("switch"));
    await screen.findByText(/Edit Cache Wedding|Cache Wedding/);
    await waitFor(() => expect(screen.queryByLabelText(/loading booking/i)).not.toBeInTheDocument());
    expect(calls(fetchMock, `/api/bookings/${ID}`)).toBe(1);
  });
});

function Reopen() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)}>
        toggle
      </button>
      {open ? <BookingWizardModal mode="create" defaultDate="2030-01-01" defaultCurrency="PHP" locale="en" teamId="507f1f77bcf86cd799439011" /> : null}
    </>
  );
}

describe("client picker list", () => {
  it("is fetched once when the wizard opens and served from cache on reopen", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AppQueryProvider workspaceId="ws-test">
          <Reopen />
        </AppQueryProvider>
      </NextIntlClientProvider>
    );
    await screen.findByText("Emma Carter");
    expect(calls(fetchMock, "/api/clients")).toBe(1);
    fireEvent.click(screen.getByText("toggle"));
    fireEvent.click(screen.getByText("toggle"));
    await screen.findByText("Emma Carter");
    expect(calls(fetchMock, "/api/clients")).toBe(1);
  });
});
