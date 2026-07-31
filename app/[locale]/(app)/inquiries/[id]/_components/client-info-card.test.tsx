import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const updateInquiryPhoneAction = vi.fn();
const findInquiryClientMatchesAction = vi.fn();
vi.mock("@/app/[locale]/(app)/inquiries/_actions", () => ({
  updateInquiryPhoneAction: (...a: unknown[]) => updateInquiryPhoneAction(...a),
  findInquiryClientMatchesAction: (...a: unknown[]) => findInquiryClientMatchesAction(...a),
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
});

describe("ClientInfoCard — duplicate-client indicator", () => {
  it("shows a labelled resolve action only when a match exists", async () => {
    // The glyph must never be the only signal, so assert on the accessible
    // name rather than on an icon.
    findInquiryClientMatchesAction.mockResolvedValue({
      ok: true,
      matches: [{ _id: "c1", name: "Maria Santos" }],
    });
    const onResolveClient = vi.fn();
    renderWithProviders(
      <ClientInfoCard {...baseProps} onResolveClient={onResolveClient} />
    );

    const button = await screen.findByRole("button", { name: /resolve client/i });
    fireEvent.click(button);
    expect(onResolveClient).toHaveBeenCalledOnce();
  });

  it("stays hidden when the inquiry has no competing client", async () => {
    // The common case. A false indicator on every inquiry would be noise.
    findInquiryClientMatchesAction.mockResolvedValue({ ok: true, matches: [] });
    renderWithProviders(<ClientInfoCard {...baseProps} onResolveClient={vi.fn()} />);

    await waitFor(() => expect(findInquiryClientMatchesAction).toHaveBeenCalledWith("inq-1"));
    expect(screen.queryByRole("button", { name: /resolve client/i })).toBeNull();
  });
});

describe("ClientInfoCard", () => {
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
