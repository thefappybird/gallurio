import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import arMessages from "@/messages/ar.json";
import { ActivityFeed } from "./activity-feed";
import type { SerializedActivity } from "../_data/dashboard-metrics";

let activitySeed = 0;

function makeActivity(overrides: Partial<SerializedActivity> = {}): SerializedActivity {
  activitySeed += 1;
  return {
    _id: `activity-${activitySeed}`,
    workspaceId: "workspace-1",
    actorUserId: "user_1",
    entity: "booking",
    entityId: null,
    action: "created",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ActivityFeed", () => {
  it("renders empty state when activity is empty", () => {
    renderWithProviders(
      <ActivityFeed activity={[]} locale="en" title="Recent activity" empty="Nothing here yet." />
    );
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("lists each activity row with entity and action", () => {
    renderWithProviders(
      <ActivityFeed
        activity={[
          makeActivity({ entity: "booking", action: "created" }),
          makeActivity({ entity: "inquiry", action: "status_changed" }),
        ]}
        locale="en"
        title="Recent activity"
        empty="Nothing here yet."
      />
    );
    expect(screen.getByText(/booking created/i)).toBeInTheDocument();
    expect(screen.getByText(/inquiry status changed/i)).toBeInTheDocument();
  });

  it("renders translated payment activity labels", () => {
    renderWithProviders(
      <ActivityFeed
        activity={[makeActivity({ entity: "transaction", action: "payment_updated" })]}
        locale="en"
        title="Recent activity"
        empty="Nothing here yet."
      />
    );
    expect(screen.getByText(/transaction payment updated/i)).toBeInTheDocument();
  });

  it("translates the entity and action labels for non-English locales", () => {
    renderWithProviders(
      <ActivityFeed
        activity={[makeActivity({ entity: "booking", action: "updated" })]}
        locale="ar"
        title="النشاط الأخير"
        empty="لا يوجد شيء هنا بعد."
      />,
      { locale: "ar", messages: arMessages as never }
    );
    // Arabic for "booking" / "updated" — the raw enum must not leak through.
    expect(screen.getByText(/حجز/)).toBeInTheDocument();
    expect(screen.getByText(/حُدّث/)).toBeInTheDocument();
    expect(screen.queryByText(/booking/i)).toBeNull();
  });

  it("falls back to a humanized action label without logging MISSING_MESSAGE", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithProviders(
      <ActivityFeed
        activity={[makeActivity({ action: "legacy_action" })]}
        locale="en"
        title="Recent activity"
        empty="Nothing here yet."
      />
    );
    expect(screen.getByText(/booking legacy action/i)).toBeInTheDocument();
    expect(
      errorSpy.mock.calls.some((args) =>
        args.some((arg) => String(arg).includes("MISSING_MESSAGE"))
      )
    ).toBe(false);
    errorSpy.mockRestore();
  });

  it("formats createdAt as a relative time", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    renderWithProviders(
      <ActivityFeed
        activity={[makeActivity({ createdAt: oneHourAgo.toISOString() })]}
        locale="en"
        title="Recent activity"
        empty="Nothing here yet."
      />
    );
    // Intl.RelativeTimeFormat('en', {numeric:'auto'}).format(-1,'hour') → "1 hour ago"
    expect(screen.getByText(/1 hour ago/)).toBeInTheDocument();
  });
});
