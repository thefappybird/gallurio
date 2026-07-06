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

describe("WorkspaceBusinessForm — contact address LocationPicker", () => {
  it("submits the typed address along with its lat/lng", async () => {
    render(<WorkspaceBusinessForm defaults={baseDefaults} />);

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
});
