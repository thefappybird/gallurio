import { describe, expect, it, vi } from "vitest";
import { useContext } from "react";
import { act, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import {
  NotificationContext,
  NotificationProvider,
} from "./NotificationProvider";

vi.mock("@/app/[locale]/(app)/notifications/_actions", () => ({
  markNotificationReadAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
}));

type Handler = (...args: unknown[]) => void;
const handlers: Record<string, Handler> = {};

const fakeSocket = {
  on: vi.fn((event: string, handler: Handler) => {
    handlers[event] = handler;
  }),
  disconnect: vi.fn(),
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => fakeSocket),
}));

function emit(event: string, payload?: unknown) {
  handlers[event]?.(payload);
}

function LiveArrivalProbe() {
  const ctx = useContext(NotificationContext);
  return <span data-testid="tick">{ctx?.liveArrivalTick ?? -1}</span>;
}

describe("NotificationProvider liveArrivalTick", () => {
  it("increments liveArrivalTick when a live notification:new socket event arrives", () => {
    renderWithProviders(
      <NotificationProvider initialNotifications={[]} initialUnreadCount={0}>
        <LiveArrivalProbe />
      </NotificationProvider>,
    );

    expect(screen.getByTestId("tick").textContent).toBe("0");

    act(() => {
      emit("notification:new", {
        _id: "n1",
        type: "inquiry.created",
        title: "t",
        body: "b",
        href: "/inquiries/1",
        entityId: "e1",
        entityType: "inquiry",
        read: false,
        readAt: null,
        silent: false,
        createdAt: new Date().toISOString(),
      });
    });

    expect(screen.getByTestId("tick").textContent).toBe("1");
  });
});
