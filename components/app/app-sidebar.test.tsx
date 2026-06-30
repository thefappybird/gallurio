import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { fireEvent, screen, act } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// signOutAction is a server action; stub it to avoid server-only imports.
vi.mock("@/lib/auth/signOut", () => ({
  signOutAction: vi.fn(),
}));

// useNotifications is context-bound; stub so tests don't need the full provider.
const mockUnreadCount = { value: 0 };
const mockLiveArrivalTick = { value: 0 };
vi.mock("@/lib/hooks/useNotifications", () => ({
  useNotifications: () => ({
    unreadCount: mockUnreadCount.value,
    liveArrivalTick: mockLiveArrivalTick.value,
  }),
}));

vi.mock("@/components/app/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>;
}

function renderSidebar(role: "owner" | "staff") {
  return renderWithProviders(
    <Wrapper>
      <AppSidebar
        role={role}
        workspaceName="Test Workspace"
        workspaceLogoUrl={null}
        userName="Test User"
        userEmail="test@example.com"
        userAvatarUrl={null}
      />
    </Wrapper>
  );
}

describe("AppSidebar nav items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("role=owner", () => {
    it("renders dashboard, bookings, clients, inquiries, portfolio, and teams nav links", () => {
      renderSidebar("owner");
      expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /bookings/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /clients/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /inquiries/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /portfolio/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /teams/i })).toBeInTheDocument();
    });

    it("does not render a gallery link", () => {
      renderSidebar("owner");
      expect(screen.queryByRole("link", { name: /gallery/i })).not.toBeInTheDocument();
    });

    it("renders the Settings link", () => {
      renderSidebar("owner");
      const settingsLinks = screen.getAllByRole("link", { name: /settings/i });
      expect(settingsLinks.length).toBeGreaterThan(0);
    });
  });

  describe("role=staff", () => {
    it("renders bookings and clients nav links", () => {
      renderSidebar("staff");
      expect(screen.getByRole("link", { name: /bookings/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /clients/i })).toBeInTheDocument();
    });

    it("renders the Settings footer link", () => {
      renderSidebar("staff");
      const settingsLinks = screen.getAllByRole("link", { name: /settings/i });
      expect(settingsLinks.length).toBeGreaterThan(0);
    });

    it("does not render the dashboard nav link", () => {
      renderSidebar("staff");
      expect(screen.queryByRole("link", { name: /^dashboard$/i })).not.toBeInTheDocument();
    });

    it("renders the teams nav link", () => {
      renderSidebar("staff");
      expect(screen.getByRole("link", { name: /^teams$/i })).toBeInTheDocument();
    });

    it("does not render inquiries or portfolio nav links", () => {
      renderSidebar("staff");
      expect(screen.queryByRole("link", { name: /^inquiries$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /^portfolio$/i })).not.toBeInTheDocument();
    });
  });
});

describe("AppSidebar account identity", () => {
  it("shows the user's name and email in the footer", () => {
    renderSidebar("owner");
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /account menu/i })).not.toBeInTheDocument();
  });
});

describe("AppSidebar footer logout", () => {
  it("renders a logout trigger button in the sidebar footer", () => {
    renderSidebar("owner");
    const button = screen.getByRole("button", { name: /log.?out/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("opens a confirmation dialog when the logout button is clicked", () => {
    renderSidebar("owner");
    expect(screen.queryByText("Log out?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /log.?out/i }));
    expect(screen.getByText("Log out?")).toBeInTheDocument();
  });

  it("renders the logout button for staff too", () => {
    renderSidebar("staff");
    expect(screen.getByRole("button", { name: /log.?out/i })).toBeInTheDocument();
  });
});

describe("AppSidebar SidebarTrigger", () => {
  it("renders the collapse trigger inside the sidebar header", () => {
    renderSidebar("owner");
    const triggers = document.querySelectorAll('[data-sidebar="trigger"]');
    expect(triggers).toHaveLength(1);
  });

  it("truncates the workspace name with a hover title when expanded", () => {
    renderSidebar("owner");
    expect(screen.getByTitle("Test Workspace")).toBeInTheDocument();
  });

  it("uses the collapsed header stack classes so the toggle can sit above the workspace icon", () => {
    renderSidebar("owner");
    const headerChrome = screen.getByTestId("sidebar-workspace-header");
    expect(headerChrome.className).toContain("group-data-[collapsible=icon]:flex-col-reverse");
    expect(headerChrome.className).toContain("group-data-[collapsible=icon]:items-center");
  });
});

describe("AppSidebar bell button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnreadCount.value = 0;
    mockLiveArrivalTick.value = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not nudge the bell or show a toast when unreadCount changes without a live socket arrival (e.g. initial fetch)", () => {
    mockUnreadCount.value = 0;
    mockLiveArrivalTick.value = 0;
    const { rerender } = renderSidebar("owner");

    // Simulate unreadCount populating post-mount from a non-live source —
    // liveArrivalTick stays unchanged, so this must NOT be treated as a live arrival.
    mockUnreadCount.value = 5;
    act(() => {
      rerender(
        <Wrapper>
          <AppSidebar
            role="owner"
            workspaceName="Test Workspace"
            workspaceLogoUrl={null}
            userName="Test User"
            userEmail="test@example.com"
            userAvatarUrl={null}
          />
        </Wrapper>
      );
    });

    const bellBtn = screen.getByRole("button", { name: /notification/i });
    const bellSvg = bellBtn.querySelector("svg");
    expect(bellSvg?.getAttribute("class") ?? "").not.toContain("animate-bell-nudge");
    expect(screen.queryByText(/new notification/i)).toBeNull();
  });

  it("bell icon receives animate-bell-nudge class when a live notification arrives", async () => {
    mockLiveArrivalTick.value = 0;
    const { rerender } = renderSidebar("owner");

    mockLiveArrivalTick.value = 1;
    act(() => {
      rerender(
        <Wrapper>
          <AppSidebar
            role="owner"
            workspaceName="Test Workspace"
            workspaceLogoUrl={null}
            userName="Test User"
            userEmail="test@example.com"
            userAvatarUrl={null}
          />
        </Wrapper>
      );
    });

    const bellBtn = screen.getByRole("button", { name: /notification/i });
    const bellSvg = bellBtn.querySelector("svg");
    expect(bellSvg?.getAttribute("class") ?? "").toContain("animate-bell-nudge");
  });

  it("bundles a burst of live arrivals within 5s into a single toast with the total count", async () => {
    mockLiveArrivalTick.value = 0;
    const { rerender } = renderSidebar("owner");

    function bumpTick(value: number) {
      mockLiveArrivalTick.value = value;
      act(() => {
        rerender(
          <Wrapper>
            <AppSidebar
              role="owner"
              workspaceName="Test Workspace"
              workspaceLogoUrl={null}
              userName="Test User"
              userEmail="test@example.com"
              userAvatarUrl={null}
            />
          </Wrapper>
        );
      });
    }

    // First arrival arms the 5s bundling window.
    bumpTick(1);
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Two more arrivals land inside the window — must NOT reset/extend the timer.
    bumpTick(2);
    bumpTick(3);

    expect(screen.queryByText(/new notification/i)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000); // total 5000ms since the first arrival
    });

    expect(screen.getByText(/you have 3 new notifications/i)).toBeInTheDocument();
  });

  it("shows the singular toast after the bundling window for a single arrival, then auto-dismisses it", async () => {
    mockLiveArrivalTick.value = 0;
    const { rerender } = renderSidebar("owner");

    mockLiveArrivalTick.value = 1;
    act(() => {
      rerender(
        <Wrapper>
          <AppSidebar
            role="owner"
            workspaceName="Test Workspace"
            workspaceLogoUrl={null}
            userName="Test User"
            userEmail="test@example.com"
            userAvatarUrl={null}
          />
        </Wrapper>
      );
    });

    // A single arrival still waits out the 5s bundling window before showing.
    expect(screen.queryByText(/you have a new notification/i)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText(/you have a new notification/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText(/you have a new notification/i)).toBeNull();
  });
});

describe("AppSidebar mobile close on nav", () => {
  const setOpenMobileSpy = vi.fn();

  function renderMobileSidebar() {
    return renderWithProviders(
      <SidebarProvider>
        <AppSidebar
          role="owner"
          workspaceName="Studio"
          workspaceLogoUrl={null}
          userName="A"
          userEmail="a@b.c"
          userAvatarUrl={null}
        />
      </SidebarProvider>
    );
  }

  async function spyMobile(isMobile: boolean) {
    const sidebarModule = await import("@/components/ui/sidebar");
    return vi.spyOn(sidebarModule, "useSidebar").mockReturnValue({
      state: "expanded",
      open: true,
      setOpen: vi.fn(),
      openMobile: isMobile,
      setOpenMobile: setOpenMobileSpy,
      isMobile,
      toggleSidebar: vi.fn(),
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
    setOpenMobileSpy.mockClear();
  });

  it("calls setOpenMobile(false) when a nav link is clicked on mobile", async () => {
    await spyMobile(true);
    renderMobileSidebar();

    fireEvent.click(screen.getByRole("link", { name: /bookings/i }));
    expect(setOpenMobileSpy).toHaveBeenCalledWith(false);
  });

  it("calls setOpenMobile(false) when the footer Settings link is clicked on mobile", async () => {
    await spyMobile(true);
    renderMobileSidebar();

    const settingsLinks = screen.getAllByRole("link", { name: /settings/i });
    fireEvent.click(settingsLinks[settingsLinks.length - 1]!);
    expect(setOpenMobileSpy).toHaveBeenCalledWith(false);
  });

  it("does not call setOpenMobile when a nav link is clicked on desktop", async () => {
    await spyMobile(false);
    renderMobileSidebar();

    fireEvent.click(screen.getByRole("link", { name: /bookings/i }));
    expect(setOpenMobileSpy).not.toHaveBeenCalled();
  });
});
