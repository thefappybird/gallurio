/**
 * Smoke tests for CustomizePanel.
 *
 * next-themes: wrapped in NextThemesProvider (mirrors theme-toggle.test.tsx).
 * next-intl's useLocale: mocked to return "en".
 * @/lib/i18n/navigation: already stubbed via vitest alias in vitest.config.ts.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { renderWithProviders } from "@/test-utils/render";
import { CustomizePanel } from "./_panel";

// authkit-nextjs and WorkOS SDK import next/cache which is not resolvable in the
// test environment. Mock the entire auth/WorkOS surface so nothing is loaded.
vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
  saveSession: vi.fn(async () => undefined),
}));

vi.mock("@/lib/workos", () => ({
  workos: { userManagement: {}, multiFactorAuth: {} },
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/lib/auth/activeWorkspace", () => ({
  getActiveWorkspaceId: vi.fn(),
  setActiveWorkspace: vi.fn(),
  clearActiveWorkspace: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn() }),
}));

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/app/[locale]/(app)/settings/_actions", () => ({
  updateTimeFormatAction: vi.fn(),
}));

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useLocale: () => "en",
  };
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}

describe("CustomizePanel", () => {
  it("renders without crashing", () => {
    renderWithProviders(
      <Wrapper>
        <CustomizePanel />
      </Wrapper>
    );
  });

  it("shows the Theme section heading", () => {
    renderWithProviders(
      <Wrapper>
        <CustomizePanel />
      </Wrapper>
    );
    expect(screen.getByText("Theme")).toBeInTheDocument();
  });

  it("shows the Language section heading", () => {
    renderWithProviders(
      <Wrapper>
        <CustomizePanel />
      </Wrapper>
    );
    expect(screen.getByText("Language")).toBeInTheDocument();
  });

  it("renders buttons for the five active locales (en, fil, id, ar, th), not removed Malay", () => {
    renderWithProviders(
      <Wrapper>
        <CustomizePanel />
      </Wrapper>
    );
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Filipino")).toBeInTheDocument();
    expect(screen.getByText("Bahasa Indonesia")).toBeInTheDocument();
    expect(screen.getByText("العربية")).toBeInTheDocument();
    expect(screen.getByText("ภาษาไทย")).toBeInTheDocument();
    expect(screen.queryByText("Bahasa Melayu")).not.toBeInTheDocument();
  });

  it("disables the language buttons and shows a spinner on the clicked one while the locale change is pending", () => {
    renderWithProviders(
      <Wrapper>
        <CustomizePanel />
      </Wrapper>
    );
    const filipinoButton = screen.getByRole("button", { name: "Filipino" });
    fireEvent.click(filipinoButton);
    expect(filipinoButton).toBeDisabled();
    expect(filipinoButton.querySelector("svg")).toBeTruthy();
  });

  it("shows a busy state on the time-format toggle while the update Action is in flight", async () => {
    const { updateTimeFormatAction } = await import(
      "@/app/[locale]/(app)/settings/_actions"
    );
    let resolveAction!: (value: { ok: boolean }) => void;
    (updateTimeFormatAction as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      })
    );

    renderWithProviders(
      <Wrapper>
        <CustomizePanel />
      </Wrapper>
    );

    const button12h = screen.getByRole("button", { name: "12h" });
    fireEvent.click(button12h);
    await act(async () => {});

    expect(updateTimeFormatAction).toHaveBeenCalledTimes(1);
    expect(button12h).toBeDisabled();
    expect(button12h.querySelector("svg")).toBeTruthy();

    resolveAction({ ok: true });
    await waitFor(() => expect(button12h).not.toBeDisabled());
  });
});
