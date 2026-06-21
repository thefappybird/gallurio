import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

// ── navigation / router ────────────────────────────────────────────────────
const refresh = vi.fn();
const replace = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh, replace, push: vi.fn() }),
  usePathname: () => "/en/inquiries",
  Link: ({ children, href }: { children: ReactNode; href: string }) =>
    createElement("a", { href }, children),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("inquiryId=inq-1"),
}));

// ── heavy sub-components ───────────────────────────────────────────────────
// Expose the rendered rows so tests can inspect optimistic patches.
let lastRenderedRows: InquiryRow[] = [];
vi.mock("./inquiry-table", () => ({
  InquiryTable: ({ rows }: { rows: InquiryRow[] }) => {
    lastRenderedRows = rows;
    return <div data-testid="inquiry-table" />;
  },
}));

vi.mock("./inquiry-view-toggle", () => ({
  InquiryViewToggle: () => <div />,
}));

vi.mock("./inquiries-calendar-manager", () => ({
  InquiriesCalendarManager: () => <div />,
}));

// Capture modal props so tests can call onClose / onInquiryChanged / onConverted directly
const capturedProps: Record<string, unknown> = {};
vi.mock("./inquiry-detail-modal", () => ({
  InquiryDetailModal: (props: {
    onClose: () => void;
    onConverted?: () => void;
    onInquiryChanged?: (id: string, patch: object) => void;
    open: boolean;
  }) => {
    capturedProps.onClose = props.onClose;
    capturedProps.onConverted = props.onConverted;
    capturedProps.onInquiryChanged = props.onInquiryChanged;
    capturedProps.open = props.open;
    return props.open ? <div data-testid="inquiry-detail-modal" /> : null;
  },
}));

import { InquiriesPageClient } from "./inquiries-page-client";
import type { InquiryRow } from "./inquiry-table";
import type { InquiryDetailModalData } from "./inquiry-detail-modal";

const row: InquiryRow = {
  id: "inq-1",
  name: "Alice",
  email: "alice@example.com",
  status: "new",
  eventTitle: null,
  eventDate: null,
  eventType: "wedding",
  submittedAt: "2026-01-01T00:00:00.000Z",
  source: null,
};

const detail: InquiryDetailModalData = {
  inquiryId: "inq-1",
  locale: "en",
  name: "Alice",
  email: "alice@example.com",
  phone: null,
  preferredContact: "email",
  status: "new",
  eventType: "wedding",
  guestCount: null,
  location: null,
  message: "",
  sessions: [],
  submittedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  bookingMissing: false,
  booking: null,
  isOwner: true,
};

const baseProps = {
  rows: [row],
  total: 1,
  page: 1,
  limit: 20,
  locale: "en",
  status: "all",
  counts: { all: 1, new: 1, booked: 0, archived: 0 },
  from: "",
  to: "",
  empty: "No inquiries",
  emptyHint: "",
  initialDetail: detail,
};

beforeEach(() => {
  refresh.mockReset();
  replace.mockReset();
});

describe("InquiriesPageClient", () => {
  it("does not call router.refresh() when modal closes with no changes", () => {
    renderWithProviders(<InquiriesPageClient {...baseProps} />);
    expect(screen.getByTestId("inquiry-detail-modal")).toBeDefined();
    (capturedProps.onClose as () => void)();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("calls router.refresh() exactly once when modal closes after a change", () => {
    renderWithProviders(<InquiriesPageClient {...baseProps} />);
    (capturedProps.onInquiryChanged as (id: string, patch: object) => void)(
      "inq-1",
      { phone: "+63999999999" }
    );
    (capturedProps.onClose as () => void)();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("onConverted closes the modal, strips inquiryId param, and marks row booked optimistically", () => {
    renderWithProviders(<InquiriesPageClient {...baseProps} />);
    expect(screen.getByTestId("inquiry-detail-modal")).toBeDefined();

    act(() => {
      (capturedProps.onConverted as () => void)();
    });

    // Modal closed
    expect(screen.queryByTestId("inquiry-detail-modal")).toBeNull();

    // inquiryId param stripped via router.replace
    expect(replace).toHaveBeenCalledOnce();
    const replaceArg = (replace.mock.calls[0] as string[])[0];
    expect(replaceArg).not.toContain("inquiryId");

    // No duplicate refresh (revalidatePath handles the server update)
    expect(refresh).not.toHaveBeenCalled();

    // Row shows booked optimistically
    const patchedRow = lastRenderedRows.find((r) => r.id === "inq-1");
    expect(patchedRow?.status).toBe("booked");
  });
});
