/**
 * Tests for the WorkspaceBusinessForm's contact-address LocationPicker wiring
 * (address / lat / lng roundtrip into the form's submitted payload).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock("@/hooks/useSlugAvailability", () => ({
  useSlugAvailability: vi.fn(() => ({ status: "idle" })),
}));

const uploadAsset = vi.fn();
vi.mock("@/lib/storage/uploadAsset.client", () => ({
  uploadAsset: (...args: unknown[]) => uploadAsset(...args),
}));

// Typed against the real union so per-test overrides can return cancelled/error
// without TS narrowing the mock to the default "ok" shape.
const requestCropMock = vi.fn<(file: File) => Promise<CropRequestResult>>(async () => ({
  status: "ok",
  file: new File(["cropped"], "cropped.webp", { type: "image/webp" }),
}));
vi.mock("@/lib/media/useImageCropper", () => ({
  useImageCropper: () => ({
    cropDialog: null,
    requestCrop: requestCropMock,
  }),
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
import type { CropRequestResult } from "@/lib/media/useImageCropper";

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
    render(<WorkspaceBusinessForm defaults={baseDefaults} />);

    const select = screen.getByLabelText("businessType") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toContain("artists");
  });

  it("shows the free-text 'other' input only when 'other' is selected, and surfaces the required error", async () => {
    render(<WorkspaceBusinessForm defaults={baseDefaults} />);

    expect(screen.queryByLabelText("businessTypeOtherLabel")).not.toBeInTheDocument();

    const select = screen.getByLabelText("businessType") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "other" } });

    const otherInput = screen.getByLabelText("businessTypeOtherLabel");
    expect(otherInput).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(await screen.findByText(/tell us your business type/i)).toBeInTheDocument();
  });
});

describe("WorkspaceBusinessForm — logo upload", () => {
  beforeEach(() => {
    uploadAsset.mockReset();
    requestCropMock.mockReset();
    requestCropMock.mockImplementation(async () => ({
      status: "ok" as const,
      file: new File(["cropped"], "cropped.webp", { type: "image/webp" }),
    }));
  });

  it("does not upload and never enters the uploading state when the crop is cancelled", async () => {
    requestCropMock.mockResolvedValueOnce({ status: "cancelled" });

    render(<WorkspaceBusinessForm defaults={baseDefaults} />);

    const fileInput = document.getElementById("logoFile") as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(requestCropMock).toHaveBeenCalled());
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(screen.queryByText("logoUploading")).not.toBeInTheDocument();
  });

  it("shows the size-error copy and never calls uploadAsset when the crop gate rejects an oversized file", async () => {
    requestCropMock.mockResolvedValueOnce({ status: "error", reason: "file_too_large" });

    render(<WorkspaceBusinessForm defaults={baseDefaults} />);

    const fileInput = document.getElementById("logoFile") as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText("logoErrors.size")).toBeInTheDocument();
    expect(uploadAsset).not.toHaveBeenCalled();
  });

  it("hands the cropped file (not the original) to uploadAsset for the logo", async () => {
    uploadAsset.mockResolvedValueOnce({
      asset: { assetId: "logo-1", url: "https://cdn.cf.net/logo.png" },
    });

    render(<WorkspaceBusinessForm defaults={baseDefaults} />);

    const fileInput = document.getElementById("logoFile") as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(uploadAsset).toHaveBeenCalledWith(
        expect.objectContaining({ name: "cropped.webp", type: "image/webp" }),
        expect.anything(),
        expect.anything(),
      ),
    );
  });
});

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
