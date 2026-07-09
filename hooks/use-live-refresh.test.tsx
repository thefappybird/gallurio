import { describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import { useLiveRefresh } from "./use-live-refresh";

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

vi.mock("@/app/[locale]/(app)/notifications/_actions", () => ({
  markNotificationReadAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function emit(event: string, payload?: unknown) {
  handlers[event]?.(payload);
}

function Probe() {
  useLiveRefresh(["team"]);
  return <span data-testid="probe" />;
}

describe("useLiveRefresh", () => {
  it("refreshes only for matching entity types, never on mount", () => {
    renderWithProviders(
      <NotificationProvider initialNotifications={[]} initialUnreadCount={0}>
        <Probe />
      </NotificationProvider>,
    );
    screen.getByTestId("probe");

    // No refresh on initial mount.
    expect(refresh).not.toHaveBeenCalled();

    // Non-matching entity type: no refresh.
    act(() => {
      emit("notification:new", {
        _id: "n1",
        type: "inquiry.created",
        title: "t",
        body: "b",
        href: "/inquiries/1",
        entityId: "i1",
        entityType: "inquiry",
        read: false,
        readAt: null,
        silent: false,
        createdAt: new Date().toISOString(),
      });
    });
    expect(refresh).not.toHaveBeenCalled();

    // Matching entity type: refreshes.
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
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
