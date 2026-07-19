import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { InquiryActions } from "./inquiry-actions";

const refresh = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh }),
  Link: ({ children, href }: { children: ReactNode; href: string }) =>
    createElement("a", { href }, children),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

let resolveDecline!: (v: { ok: true }) => void;
const declineInquiryAction = vi.fn(
  () => new Promise((r) => { resolveDecline = r; })
);
const archiveInquiryAction = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../../_actions", () => ({
  declineInquiryAction: () => declineInquiryAction(),
  archiveInquiryAction: () => archiveInquiryAction(),
}));

beforeEach(() => {
  declineInquiryAction.mockClear();
  archiveInquiryAction.mockClear();
  refresh.mockReset();
});

describe("InquiryActions", () => {
  it("shows a spinner only on the clicked button while the other stays disabled without one", async () => {
    renderWithProviders(<InquiryActions inquiryId="inq-1" status="new" />);

    const declineBtn = screen.getByRole("button", { name: /decline/i });
    const archiveBtn = screen.getByRole("button", { name: /^archive$/i });

    fireEvent.click(declineBtn);

    // The clicked button enters its own busy/loading state.
    await waitFor(() => {
      expect(declineBtn).toHaveAttribute("aria-busy", "true");
    });
    // The other button is disabled (prevents a conflicting concurrent action)
    // but must NOT show a spinner of its own.
    expect(archiveBtn).toBeDisabled();
    expect(archiveBtn).not.toHaveAttribute("aria-busy", "true");

    resolveDecline({ ok: true });
    await waitFor(() => {
      expect(declineBtn).not.toHaveAttribute("aria-busy", "true");
    });
  });
});
