import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const updateInquiryPhoneAction = vi.fn();
vi.mock("@/app/[locale]/(app)/inquiries/_actions", () => ({
  updateInquiryPhoneAction: (...a: unknown[]) => updateInquiryPhoneAction(...a),
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
