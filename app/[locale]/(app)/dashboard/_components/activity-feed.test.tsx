import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import arMessages from "@/messages/ar.json";
import { ActivityFeed } from "./activity-feed";
import type { ActivityLogDoc } from "@/lib/db/models";

function makeActivity(overrides: Partial<ActivityLogDoc> = {}): ActivityLogDoc {
  return {
    _id: new Types.ObjectId(),
    workspaceId: new Types.ObjectId(),
    actorUserId: "user_1",
    entity: "booking",
    entityId: null,
    action: "created",
    diff: null,
    createdAt: new Date(),
    ...overrides,
  } as ActivityLogDoc;
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

  it("formats createdAt as a relative time", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    renderWithProviders(
      <ActivityFeed
        activity={[makeActivity({ createdAt: oneHourAgo })]}
        locale="en"
        title="Recent activity"
        empty="Nothing here yet."
      />
    );
    expect(screen.getByText(/1h ago/)).toBeInTheDocument();
  });
});
