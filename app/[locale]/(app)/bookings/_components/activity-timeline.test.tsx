import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ActivityTimeline } from "./activity-timeline";
import type { ActivityEntry } from "./activity-types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString();

const CREATED_ENTRY: ActivityEntry = {
  _id: "e1",
  action: "created",
  createdAt: TODAY,
  diff: null,
};

const UPDATED_ENTRY_MONEY: ActivityEntry = {
  _id: "e2",
  action: "updated",
  createdAt: TODAY,
  diff: {
    changes: {
      "amount.total": { before: 5000, after: 8000 },
    },
  },
};

const STATUS_CHANGED_ENTRY: ActivityEntry = {
  _id: "e3",
  action: "status_changed",
  createdAt: TODAY,
  diff: {
    changes: {
      status: { before: "booked", after: "completed" },
    },
  },
};

const CLIENT_CHANGED_ENTRY: ActivityEntry = {
  _id: "e4",
  action: "client_changed",
  createdAt: TODAY,
  diff: {
    changes: {
      clientName: { before: "Alice", after: "Bob" },
    },
  },
};

const MIXED_ENTRIES: ActivityEntry[] = [
  CREATED_ENTRY,
  UPDATED_ENTRY_MONEY,
  STATUS_CHANGED_ENTRY,
  CLIENT_CHANGED_ENTRY,
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ActivityTimeline", () => {
  it("renders without crashing with realistic mixed entries", () => {
    renderWithProviders(
      <ActivityTimeline
        entries={MIXED_ENTRIES}
        locale="en"
        currency="PHP"
      />
    );
    // Four action pills should be rendered
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("Status changed")).toBeInTheDocument();
    expect(screen.getByText("Client changed")).toBeInTheDocument();
  });

  it("renders one action pill per entry", () => {
    renderWithProviders(
      <ActivityTimeline entries={MIXED_ENTRIES} locale="en" currency="PHP" />
    );
    // All four action labels appear exactly once each
    expect(screen.getAllByText("Created")).toHaveLength(1);
    expect(screen.getAllByText("Updated")).toHaveLength(1);
    expect(screen.getAllByText("Status changed")).toHaveLength(1);
    expect(screen.getAllByText("Client changed")).toHaveLength(1);
  });

  it("renders a change pill showing formatted money before → after for amount.total", () => {
    renderWithProviders(
      <ActivityTimeline
        entries={[UPDATED_ENTRY_MONEY]}
        locale="en"
        currency="PHP"
      />
    );
    // The change pill should contain formatted money values.
    // formatMoney(5000, "PHP", "en") → "₱5,000"
    // formatMoney(8000, "PHP", "en") → "₱8,000"
    // The pill text is "Total: ₱5,000 → ₱8,000"
    const pill = screen.getByTitle(/Total:/i);
    expect(pill.textContent).toMatch(/5,000/);
    expect(pill.textContent).toMatch(/8,000/);
    expect(pill.textContent).toContain("→");
  });

  it("renders an empty state message when entries is empty", () => {
    renderWithProviders(
      <ActivityTimeline entries={[]} locale="en" currency="PHP" />
    );
    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
  });

  it("renders translated status labels for a status diff, not raw enum values", () => {
    renderWithProviders(
      <ActivityTimeline
        entries={[STATUS_CHANGED_ENTRY]}
        locale="en"
        currency="PHP"
      />
    );
    // Should show "Booked" and "Completed" — not "booked" / "completed"
    // The pill text is "Status: Booked → Completed"
    const pill = screen.getByTitle(/Status:/i);
    expect(pill.textContent).toContain("Booked");
    expect(pill.textContent).toContain("Completed");
    // Raw enum values should NOT appear as-is in a separate element
    expect(pill.textContent).not.toContain(": booked →");
  });

  it("renders a sessions diff as label-only pill without before→after", () => {
    const sessionEntry: ActivityEntry = {
      _id: "es",
      action: "updated",
      createdAt: TODAY,
      diff: {
        changes: {
          sessions: {
            before: [{ startAt: "2025-01-01T09:00:00Z", endAt: "2025-01-01T17:00:00Z" }],
            after: [{ startAt: "2025-01-02T09:00:00Z", endAt: "2025-01-02T17:00:00Z" }],
          },
        },
      },
    };
    renderWithProviders(
      <ActivityTimeline entries={[sessionEntry]} locale="en" currency="PHP" />
    );
    // The pill for sessions should show the "Schedule" label
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    // There should be NO "→" in the sessions pill since it's label-only
    const pill = screen.getByText("Schedule").closest("span");
    expect(pill?.textContent).not.toContain("→");
  });

  it("renders 'Today' day header for entries created today", () => {
    renderWithProviders(
      <ActivityTimeline entries={[CREATED_ENTRY]} locale="en" currency="PHP" />
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("groups multiple entries on the same day under a single day header", () => {
    renderWithProviders(
      <ActivityTimeline entries={MIXED_ENTRIES} locale="en" currency="PHP" />
    );
    // All entries are TODAY — so there should be exactly one "Today" header
    expect(screen.getAllByText("Today")).toHaveLength(1);
  });

  it("renders entries on different days under separate day headers", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const entries: ActivityEntry[] = [
      { _id: "a", action: "created", createdAt: TODAY, diff: null },
      { _id: "b", action: "updated", createdAt: yesterday, diff: null },
    ];
    renderWithProviders(
      <ActivityTimeline entries={entries} locale="en" currency="PHP" />
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("renders client_changed entry with before→after values", () => {
    renderWithProviders(
      <ActivityTimeline entries={[CLIENT_CHANGED_ENTRY]} locale="en" currency="PHP" />
    );
    const pill = screen.getByTitle(/Client name:/i);
    expect(pill.textContent).toContain("Alice");
    expect(pill.textContent).toContain("Bob");
    expect(pill.textContent).toContain("→");
  });

  it("renders em dash for null/empty before or after values", () => {
    const entry: ActivityEntry = {
      _id: "enull",
      action: "updated",
      createdAt: TODAY,
      diff: {
        changes: {
          notes: { before: null, after: "Some note added" },
        },
      },
    };
    renderWithProviders(
      <ActivityTimeline entries={[entry]} locale="en" currency="PHP" />
    );
    // before is null → rendered as "—"
    const pill = screen.getByTitle(/Notes:/i);
    expect(pill.textContent).toContain("—");
    expect(pill.textContent).toContain("Some note added");
  });

  // M1 — local day bucketing: two entries on different local calendar days must get
  // separate day headers regardless of their UTC representation. We construct two
  // entries whose local YYYY-MM-DD values (via toLocaleDateString('en-CA')) differ,
  // which means one lands in "Today" and the other in "Yesterday".
  it("M1: entries on different LOCAL calendar days group into separate day headers", () => {
    // Anchor to the start of today's local day (midnight local time) then subtract
    // one millisecond to get a timestamp that is still "yesterday" in local time.
    const now = new Date();
    const localMidnightToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0, 0, 0, 0
    );
    // 1 ms before local midnight = yesterday in local timezone
    const yesterdayLocal = new Date(localMidnightToday.getTime() - 1);
    // 1 hour after local midnight = today in local timezone
    const todayLocal = new Date(localMidnightToday.getTime() + 3_600_000);

    const entries: ActivityEntry[] = [
      { _id: "today-entry", action: "created", createdAt: todayLocal.toISOString(), diff: null },
      { _id: "yesterday-entry", action: "updated", createdAt: yesterdayLocal.toISOString(), diff: null },
    ];
    renderWithProviders(
      <ActivityTimeline entries={entries} locale="en" currency="PHP" />
    );
    // Both headers must be present — the entries are in different local calendar days
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("renders a translated 'Payment added' action pill for a payment_added entry", () => {
    const entry: ActivityEntry = {
      _id: "pay1",
      action: "payment_added",
      createdAt: TODAY,
      diff: { changes: { payments: { before: [], after: [{ price: 100 }] } } },
    };
    renderWithProviders(
      <ActivityTimeline entries={[entry]} locale="en" currency="PHP" />
    );
    expect(screen.getByText("Payment added")).toBeInTheDocument();
  });

  it("renders a payments diff as a label-only 'Payments' pill without before→after", () => {
    const entry: ActivityEntry = {
      _id: "pay2",
      action: "payment_updated",
      createdAt: TODAY,
      diff: {
        changes: {
          payments: { before: [{ price: 100 }], after: [{ price: 200 }] },
        },
      },
    };
    renderWithProviders(
      <ActivityTimeline entries={[entry]} locale="en" currency="PHP" />
    );
    expect(screen.getByText("Payments")).toBeInTheDocument();
  });
});
