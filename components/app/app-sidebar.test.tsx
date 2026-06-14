import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import * as React from "react";

// signOutAction is a server action — stub it to avoid server-only imports.
vi.mock("@/lib/auth/signOut", () => ({
  signOutAction: vi.fn(),
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

describe("AppSidebar account identity", () => {
  it("shows the user's name and email in the footer (no clickable badge)", () => {
    renderSidebar("owner");
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    // The old account dropdown trigger is gone.
    expect(
      screen.queryByRole("button", { name: /account menu/i }),
    ).not.toBeInTheDocument();
  });
});

describe("AppSidebar footer logout", () => {
  it("renders a logout trigger button in the sidebar footer", () => {
    renderSidebar("owner");
    const btn = screen.getByRole("button", { name: /log.?out/i });
    expect(btn).toBeInTheDocument();
    // The trigger no longer submits directly — it opens a confirmation dialog.
    expect(btn).toHaveAttribute("type", "button");
  });

  it("opens a confirmation dialog when the logout button is clicked", () => {
    renderSidebar("owner");
    expect(screen.queryByText("Log out?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /log.?out/i }));
    expect(screen.getByText("Log out?")).toBeInTheDocument();
  });

  it("renders the logout button for staff role too", () => {
    renderSidebar("staff");
    const btn = screen.getByRole("button", { name: /log.?out/i });
    expect(btn).toBeInTheDocument();
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
