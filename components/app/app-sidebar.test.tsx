import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import * as React from "react";

// ClientUserButton uses dropdown primitives and auth — stub it for sidebar tests.
vi.mock("@/components/app/client-user-button", () => ({
  ClientUserButton: () => <div data-testid="client-user-button" />,
}));

// ThemeToggle pulls in next-themes which isn't relevant to these assertions.
vi.mock("@/components/app/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

// next/image needs a DOM-safe stub in happy-dom.
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

// ── i18n navigation ────────────────────────────────────────────────────────────
// usePathname is provided by the vitest alias for @/lib/i18n/navigation which
// returns "/" by default. No additional mock needed.

// ── helpers ────────────────────────────────────────────────────────────────────
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

// ── Tests ──────────────────────────────────────────────────────────────────────
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

    it("does NOT render a gallery link", () => {
      renderSidebar("owner");
      expect(screen.queryByRole("link", { name: /gallery/i })).not.toBeInTheDocument();
    });

    it("renders the Settings link", () => {
      renderSidebar("owner");
      // Multiple "settings" links may exist (workspace logo link + footer link)
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

    it("does NOT render the dashboard nav link", () => {
      renderSidebar("staff");
      expect(screen.queryByRole("link", { name: /^dashboard$/i })).not.toBeInTheDocument();
    });

    it("does NOT render the teams nav link", () => {
      renderSidebar("staff");
      expect(screen.queryByRole("link", { name: /^teams$/i })).not.toBeInTheDocument();
    });

    it("does NOT render inquiries or portfolio nav links", () => {
      renderSidebar("staff");
      expect(screen.queryByRole("link", { name: /^inquiries$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /^portfolio$/i })).not.toBeInTheDocument();
    });
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

// ── Mobile sidebar close on nav click ─────────────────────────────────────────
// The sidebar UI components (Sidebar, SidebarMenuButton) call the module-local
// useSidebar() and rely on a real SidebarProvider for context.  AppSidebar
// itself imports and calls the exported useSidebar() — after the fix that's
// the only call we need to intercept for isMobile/setOpenMobile.
// Strategy: wrap with SidebarProvider (satisfies UI internals), then spy on
// the exported useSidebar so AppSidebar's own call gets the mobile fixture
// with a captured setOpenMobile spy.
describe("AppSidebar mobile close on nav", () => {
  const setOpenMobileSpy = vi.fn();

  function renderMobileSidebar() {
    return renderWithProviders(
      <SidebarProvider>
        <AppSidebar
          role="owner"
          workspaceName="Studio"
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

    // The footer Settings link is the last "settings"-labelled link.
    const settingsLinks = screen.getAllByRole("link", { name: /settings/i });
    fireEvent.click(settingsLinks[settingsLinks.length - 1]);
    expect(setOpenMobileSpy).toHaveBeenCalledWith(false);
  });

  it("does NOT call setOpenMobile when a nav link is clicked on desktop", async () => {
    await spyMobile(false);
    renderMobileSidebar();

    fireEvent.click(screen.getByRole("link", { name: /bookings/i }));
    expect(setOpenMobileSpy).not.toHaveBeenCalled();
  });
});
