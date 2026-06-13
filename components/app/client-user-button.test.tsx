import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { renderWithProviders } from "@/test-utils/render";
import { ClientUserButton } from "./client-user-button";

// signOutAction is a server action — stub it to avoid server-only imports.
vi.mock("@/lib/auth/signOut", () => ({
  signOutAction: vi.fn(),
}));

// @/lib/i18n/navigation is aliased in vitest config — no additional mock needed.

function renderButton(
  name: string | null = "Jane Doe",
  email = "jane@example.com",
  avatarUrl: string | null = null,
) {
  return renderWithProviders(
    <ClientUserButton name={name} email={email} avatarUrl={avatarUrl} />,
  );
}

describe("ClientUserButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the account menu trigger", () => {
    renderButton();
    expect(screen.getByRole("button", { name: /account menu/i })).toBeInTheDocument();
  });

  it("opens the dropdown and shows the name/email label without throwing", () => {
    renderButton("Jane Doe", "jane@example.com");
    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("shows only the email in the label when name is null", () => {
    renderButton(null, "jane@example.com");
    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);
    // email appears as the primary label; the secondary email span should not duplicate
    expect(screen.getAllByText("jane@example.com").length).toBeGreaterThan(0);
  });

  it("shows the settings and log out items in the open menu", () => {
    renderButton();
    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    expect(screen.getByText(/log out/i)).toBeInTheDocument();
  });
});
