import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const updateInquiryPhoneAction = vi.fn();
const findInquiryClientMatchesAction = vi.fn();
const resolveInquiryClientAction = vi.fn();
vi.mock("@/app/[locale]/(app)/inquiries/_actions", () => ({
  updateInquiryPhoneAction: (...a: unknown[]) => updateInquiryPhoneAction(...a),
  findInquiryClientMatchesAction: (...a: unknown[]) => findInquiryClientMatchesAction(...a),
  resolveInquiryClientAction: (...a: unknown[]) => resolveInquiryClientAction(...a),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ClientInfoCard } from "./client-info-card";

const baseProps = {
  inquiryId: "inq-1",
  name: "Maria Santos",
  email: "maria@example.com",
  phone: "+63912345678",
  preferredContact: "email",
  status: "inquiry",
};

beforeEach(() => {
  updateInquiryPhoneAction.mockReset();
  updateInquiryPhoneAction.mockResolvedValue({ ok: true });
  findInquiryClientMatchesAction.mockReset();
  findInquiryClientMatchesAction.mockResolvedValue({ ok: true, matches: [] });
  resolveInquiryClientAction.mockReset();
  resolveInquiryClientAction.mockResolvedValue({ ok: true, clientId: "c1" });
});

describe("ClientInfoCard — duplicate-client indicator", () => {
  it("opens the match dialog when the resolve action is used", async () => {
    // The card owns the dialog: neither parent passes a resolve callback, so a
    // callback prop would leave the indicator unreachable in the real app.
    findInquiryClientMatchesAction.mockResolvedValue({
      ok: true,
      matches: [{ _id: "c1", name: "Maria Santos", email: null, phone: null, notes: null, tags: [], bookingsCount: 0, totalSpent: 0, createdAt: "2026-01-01T00:00:00.000Z" }],
    });
    renderWithProviders(<ClientInfoCard {...baseProps} />);

    fireEvent.click(await screen.findByRole("button", { name: /resolve client/i }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("stays hidden when the inquiry has no competing client", async () => {
    // The common case. A false indicator on every inquiry would be noise.
    findInquiryClientMatchesAction.mockResolvedValue({ ok: true, matches: [] });
    renderWithProviders(<ClientInfoCard {...baseProps} />);

    await waitFor(() => expect(findInquiryClientMatchesAction).toHaveBeenCalledWith("inq-1"));
    expect(screen.queryByRole("button", { name: /resolve client/i })).toBeNull();
  });
});

describe("ClientInfoCard", () => {
  it("resolves a duplicate without refreshing the inquiries page", async () => {
    findInquiryClientMatchesAction.mockResolvedValue({
      ok: true,
      matches: [{ _id: "c1", name: "Maria Santos", email: "maria@example.com", phone: "+63912345678", notes: null, tags: [], bookingsCount: 0, totalSpent: 0, createdAt: "2026-01-01T00:00:00.000Z" }],
    });
    renderWithProviders(<ClientInfoCard {...baseProps} />);

    fireEvent.click(await screen.findByRole("button", { name: /resolve client/i }));
    fireEvent.click(screen.getByRole("radio", { name: "Maria Santos" }));
    fireEvent.click(screen.getByRole("button", { name: "Link client" }));

    await waitFor(() => expect(resolveInquiryClientAction).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("calls onInquiryChanged with the new phone after a successful phone save", async () => {
    const onInquiryChanged = vi.fn();
    renderWithProviders(
      <ClientInfoCard {...baseProps} onInquiryChanged={onInquiryChanged} />
    );

    // Open edit mode
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "+63999999999" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateInquiryPhoneAction).toHaveBeenCalledOnce());
    expect(onInquiryChanged).toHaveBeenCalledWith("inq-1", { phone: "+63999999999" });
  });
});
