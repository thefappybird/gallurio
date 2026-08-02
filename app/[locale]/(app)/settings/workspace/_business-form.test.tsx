/**
 * Tests for the WorkspaceBusinessForm's contact-address LocationPicker wiring
 * (address / lat / lng roundtrip into the form's submitted payload).
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock("@/hooks/useSlugAvailability", () => ({
  useSlugAvailability: vi.fn(() => ({ status: "idle" })),
}));

vi.mock("@/lib/storage/uploadAsset.client", () => ({
  uploadAsset: vi.fn(),
}));

vi.mock("@/lib/utils/handleActionResult", () => ({
  toastActionResult: vi.fn(() => true),
}));

const updateWorkspaceBusinessAction = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../_actions", () => ({
  updateWorkspaceBusinessAction: (...args: unknown[]) =>
    updateWorkspaceBusinessAction(...args),
}));

vi.mock("@/components/ui/location-picker", () => ({
  LocationPicker: ({
    value,
    onChange,
  }: {
    value: { address: string; lat: number | null; lng: number | null };
    onChange: (v: { address: string; lat: number | null; lng: number | null }) => void;
  }) => (
    <input
      aria-label="Business address"
      value={value.address}
      onChange={(e) => onChange({ address: e.target.value, lat: 14.5995, lng: 120.9842 })}
    />
  ),
}));

import { WorkspaceBusinessForm } from "./_business-form";
import type { UpdateWorkspaceBusinessInput } from "@/lib/validators/workspace";

const baseDefaults: UpdateWorkspaceBusinessInput = {
  name: "Luna Studio",
  slug: "luna-studio",
  businessType: "photographer",
  businessTypeOther: "",
  country: "PH",
  currency: "PHP",
  timezone: "Asia/Manila",
  contactEmail: "",
  contactAddress: "",
  contactAddressLat: null,
  contactAddressLng: null,
  logoUrl: "",
  logoAssetId: "",
};

describe("WorkspaceBusinessForm — artists business type + other free text", () => {
  it("renders an 'artists' option in the business type select", () => {
    render(<WorkspaceBusinessForm defaults={baseDefaults} portfolioDomain={null} />);

    const select = screen.getByLabelText("businessType") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toContain("artists");
  });

  it("shows the free-text 'other' input only when 'other' is selected, and surfaces the required error", async () => {
    render(<WorkspaceBusinessForm defaults={baseDefaults} portfolioDomain={null} />);

    expect(screen.queryByLabelText("businessTypeOtherLabel")).not.toBeInTheDocument();

    const select = screen.getByLabelText("businessType") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "other" } });

    const otherInput = screen.getByLabelText("businessTypeOtherLabel");
    expect(otherInput).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(await screen.findByText(/tell us your business type/i)).toBeInTheDocument();
  });
});

describe("WorkspaceBusinessForm — contact address LocationPicker", () => {
  it("submits the typed address along with its lat/lng", async () => {
    render(<WorkspaceBusinessForm defaults={baseDefaults} portfolioDomain={null} />);

    const addressInput = screen.getByLabelText("Business address");
    fireEvent.change(addressInput, { target: { value: "123 Rizal St, Manila" } });

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => {
      expect(updateWorkspaceBusinessAction).toHaveBeenCalledWith(
        expect.objectContaining({
          contactAddress: "123 Rizal St, Manila",
          contactAddressLat: 14.5995,
          contactAddressLng: 120.9842,
        })
      );
    });
  });

  it("shows the public subdomain as a suffix when portfolio subdomains are enabled", () => {
    render(<WorkspaceBusinessForm defaults={baseDefaults} portfolioDomain="gallurio.com" />);

    expect(screen.getByText(".gallurio.com")).toBeInTheDocument();
    expect(screen.queryByText("gallurio.com/w/")).not.toBeInTheDocument();
  });
});
