import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthLayout from "./layout";

// A bare NextIntlClientProvider infers its locale from the server-render
// AsyncLocalStorage context, which a plain RTL client render doesn't have
// ("Couldn't infer the locale prop"). Keep the real component identity (name)
// so the structural check below still matches it; just skip locale inference.
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    NextIntlClientProvider: function NextIntlClientProvider({
      children,
    }: {
      children: React.ReactNode;
    }) {
      return children;
    },
  };
});

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

  // Non-marketing branches keep today's full-catalog behaviour: a bare
  // NextIntlClientProvider (no `messages`) inherits the full request-locale
  // catalog from next-intl's server config, unlike the root layout's now-scoped
  // provider. See lib/i18n/clientMessages.ts.
  it("wraps its content in a bare NextIntlClientProvider (full catalog inherited)", () => {
    const element = AuthLayout({ children: null });

    function findProvider(node: unknown): { messages?: unknown } | null {
      if (!node || typeof node !== "object" || !("type" in node)) return null;
      const el = node as { type: unknown; props: { children?: unknown; messages?: unknown } };
      if (typeof el.type === "function" && el.type.name === "NextIntlClientProvider") {
        return el.props;
      }
      const children = el.props?.children;
      if (Array.isArray(children)) {
        for (const child of children) {
          const found = findProvider(child);
          if (found) return found;
        }
        return null;
      }
      return findProvider(children);
    }

    const providerProps = findProvider(element);
    expect(providerProps).not.toBeNull();
    expect(providerProps?.messages).toBeUndefined();
  });
});
