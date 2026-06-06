import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import * as React from "react";

// ── Clerk mocks ────────────────────────────────────────────────────────────────
// SignOutButton and UserButton are Clerk client components that require a loaded
// clerk-js bundle. Replace them with inert stubs so the test environment works.
vi.mock("@clerk/nextjs", () => ({
  SignOutButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <div data-testid="clerk-user-button" />,
}));

// ClientUserButton wraps UserButton — mock the whole module so we don't hit
// Clerk internals at all.
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
      <AppSidebar role={role} workspaceName="Test Workspace" workspaceLogoUrl={null} />
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
  it("renders zero SidebarTrigger elements inside the sidebar itself", () => {
    // The single collapse trigger lives in layout.tsx's header (outside this
    // component). The sidebar must not render its own trigger.
    // data-sidebar="trigger" is the attribute set by shadcn's SidebarTrigger.
    renderSidebar("owner");
    const triggers = document.querySelectorAll('[data-sidebar="trigger"]');
    expect(triggers).toHaveLength(0);
  });
});
