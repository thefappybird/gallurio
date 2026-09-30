import { describe, expect, it, vi } from "vitest";
import { useContext } from "react";
import { act, screen } from "@testing-library/react";
import { io } from "socket.io-client";
import { markLocalEvent } from "@/lib/query/invalidation";
import { QueryClient } from "@tanstack/react-query";
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

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function emit(event: string, payload?: unknown) {
  handlers[event]?.(payload);
}

function LiveArrivalProbe() {
  const ctx = useContext(NotificationContext);
  return <span data-testid="tick">{ctx?.liveArrivalTick ?? -1}</span>;
}

describe("NotificationProvider liveArrivalTick", () => {
  it("uses a polling-first handshake with WebSocket fallback for tunnel compatibility", () => {
    renderWithProviders(
      <NotificationProvider initialNotifications={[]} initialUnreadCount={0} workspaceId="ws-test">
        <LiveArrivalProbe />
      </NotificationProvider>,
    );

    expect(vi.mocked(io)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        transports: ["polling", "websocket"],
        tryAllTransports: true,
        timeout: 5_000,
      }),
    );
  });

  it("increments liveArrivalTick when a live notification:new socket event arrives", () => {
    renderWithProviders(
      <NotificationProvider initialNotifications={[]} initialUnreadCount={0} workspaceId="ws-test">
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

function LastEntityEventProbe() {
  const ctx = useContext(NotificationContext);
  return (
    <span data-testid="entity-event">
      {ctx?.lastEntityEvent
        ? `${ctx.lastEntityEvent.entityType}:${ctx.lastEntityEvent.entityId}:${ctx.lastEntityEvent.tick}`
        : "none"}
    </span>
  );
}

describe("NotificationProvider lastEntityEvent", () => {
  it("bumps lastEntityEvent on notification:new even when silent/read (actor's own tab)", () => {
    renderWithProviders(
      <NotificationProvider initialNotifications={[]} initialUnreadCount={0} workspaceId="ws-test">
        <LastEntityEventProbe />
      </NotificationProvider>,
    );

    expect(screen.getByTestId("entity-event").textContent).toBe("none");

    act(() => {
      emit("notification:new", {
        _id: "n2",
        type: "team.invitation",
        title: "t",
        body: "b",
        href: "/teams",
        entityId: "team1",
        entityType: "team",
        read: true,
        readAt: new Date().toISOString(),
        silent: true,
        createdAt: new Date().toISOString(),
      });
    });

    expect(screen.getByTestId("entity-event").textContent).toBe("team:team1:1");
  });
});

describe("NotificationProvider data:changed", () => {
  it("invalidates mapped keys and skips refresh when the pathname is unaffected", () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    renderWithProviders(
      <NotificationProvider initialNotifications={[]} initialUnreadCount={0} workspaceId="ws-test">
        <span />
      </NotificationProvider>,
    );
    act(() => {
      emit("data:changed", {
        workspaceId: "ws-test",
        event: { type: "inquiry.created", inquiryId: "i1" },
        at: 1,
      });
      vi.advanceTimersByTime(300);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["ws", "ws-test", "inquiries"] });
    expect(refresh).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("refreshes the router when the pathname matches an affected route", () => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/fil/inquiries");
    renderWithProviders(
      <NotificationProvider initialNotifications={[]} initialUnreadCount={0} workspaceId="ws-test">
        <span />
      </NotificationProvider>,
    );
    act(() => {
      emit("data:changed", {
        workspaceId: "ws-test",
        event: { type: "inquiry.created", inquiryId: "i2" },
        at: 1,
      });
      vi.advanceTimersByTime(300);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    window.history.pushState({}, "", "/bookings");
    vi.useRealTimers();
  });

  it("ignores other-workspace payloads and local echoes", () => {
    const spy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    spy.mockClear();
    renderWithProviders(
      <NotificationProvider initialNotifications={[]} initialUnreadCount={0} workspaceId="ws-test">
        <span />
      </NotificationProvider>,
    );
    act(() => {
      emit("data:changed", {
        workspaceId: "other",
        event: { type: "inquiry.created", inquiryId: "i3" },
        at: 1,
      });
      markLocalEvent({ type: "inquiry.created", inquiryId: "i4" });
      emit("data:changed", {
        workspaceId: "ws-test",
        event: { type: "inquiry.created", inquiryId: "i4" },
        at: 1,
      });
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
