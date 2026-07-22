import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthLayout from "./layout";

vi.mock("next/image", () => ({
  default: () => <span data-testid="brand-logo" />,
}));

vi.mock("@/components/app/ambient-background", () => ({
  AmbientBackground: () => <div data-testid="ambient-background" />,
}));

vi.mock("./_components/auth-brand-pane", () => ({
  AuthBrandPane: () => <div data-testid="auth-brand-pane" />,
}));

describe("AuthLayout", () => {
  it("keeps the brand pane visually distinct from the form pane", () => {
    render(
      <AuthLayout>
        <div data-testid="auth-form" />
      </AuthLayout>,
    );

    const brandPane = screen.getByTestId("auth-brand-pane").parentElement;
    expect(brandPane).toHaveClass("bg-primary", "text-primary-foreground");
    expect(screen.getByTestId("auth-form").parentElement).not.toHaveClass("bg-primary");
  });
});
