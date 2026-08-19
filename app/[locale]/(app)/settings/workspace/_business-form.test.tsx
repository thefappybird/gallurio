/**
 * Tests for the WorkspaceBusinessForm's contact-address LocationPicker wiring
 * (address / lat / lng roundtrip into the form's submitted payload).
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(
    () => (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key
  ),
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

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

const updateWorkspaceBusinessAction = vi.fn().mockResolvedValue({ ok: true });
const previewCurrencyRestatementAction = vi.fn().mockResolvedValue({ bookingsCount: 0 });
vi.mock("../_actions", () => ({
  updateWorkspaceBusinessAction: (...args: unknown[]) =>
    updateWorkspaceBusinessAction(...args),
  previewCurrencyRestatementAction: (...args: unknown[]) =>
    previewCurrencyRestatementAction(...args),
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

describe("WorkspaceBusinessForm — currency change lock + restatement dialog", () => {
  it("disables the currency select and shows the locked hint when a lock is active", () => {
    render(
      <WorkspaceBusinessForm
        defaults={baseDefaults}
        locale="en"
        currencyLockedUntil="2026-11-17T00:00:00.000Z"
      />
    );

    const select = screen.getByLabelText("currency") as HTMLSelectElement;
    expect(select).toBeDisabled();
    expect(screen.getByText(/currencyLockedUntil/)).toBeInTheDocument();
  });

  it("opens the confirm dialog when the currency select changes to a different value", async () => {
    previewCurrencyRestatementAction.mockResolvedValueOnce({ bookingsCount: 3 });
    render(<WorkspaceBusinessForm defaults={baseDefaults} locale="en" />);

    const select = screen.getByLabelText("currency") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "SGD" } });

    expect(await screen.findByText("currencyConfirmTitle")).toBeInTheDocument();
  });

  it("shows the previewed booking count in the confirm dialog body", async () => {
    previewCurrencyRestatementAction.mockResolvedValueOnce({ bookingsCount: 3 });
    render(<WorkspaceBusinessForm defaults={baseDefaults} locale="en" />);

    const select = screen.getByLabelText("currency") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "SGD" } });

    await waitFor(() => {
      expect(screen.getByText(/currencyConfirmBody/).textContent).toContain('"count":3');
    });
  });

  it("includes the projected unlock date in the confirm dialog body", async () => {
    previewCurrencyRestatementAction.mockResolvedValueOnce({ bookingsCount: 3 });
    render(<WorkspaceBusinessForm defaults={baseDefaults} locale="en" />);

    const select = screen.getByLabelText("currency") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "SGD" } });

    await waitFor(() => {
      expect(screen.getByText(/currencyConfirmBody/).textContent).toMatch(/"date":/);
    });
  });

  it("reverts the currency select when the confirm dialog is cancelled", async () => {
    previewCurrencyRestatementAction.mockResolvedValueOnce({ bookingsCount: 3 });
    render(<WorkspaceBusinessForm defaults={baseDefaults} locale="en" />);

    const select = screen.getByLabelText("currency") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "SGD" } });

    await screen.findByText("currencyConfirmTitle");
    fireEvent.click(screen.getByRole("button", { name: "currencyConfirmCancel" }));

    await waitFor(() => {
      expect(select.value).toBe("PHP");
    });
  });

  it("commits the new currency and submits it when the confirm dialog is confirmed", async () => {
    previewCurrencyRestatementAction.mockResolvedValueOnce({ bookingsCount: 3 });
    render(<WorkspaceBusinessForm defaults={baseDefaults} locale="en" />);

    const select = screen.getByLabelText("currency") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "SGD" } });

    await screen.findByText("currencyConfirmTitle");
    fireEvent.click(screen.getByRole("button", { name: "currencyConfirmConfirm" }));

    await waitFor(() => {
      expect(select.value).toBe("SGD");
    });

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => {
      expect(updateWorkspaceBusinessAction).toHaveBeenCalledWith(
        expect.objectContaining({ currency: "SGD" })
      );
    });
  });

  it("shows the localized lock error with the formatted unlock date on a locked submit", async () => {
    updateWorkspaceBusinessAction.mockResolvedValueOnce({
      error: "currency_change_locked",
      params: { unlockDate: "2026-11-17T00:00:00.000Z" },
    });
    render(<WorkspaceBusinessForm defaults={baseDefaults} locale="en" />);

    fireEvent.change(screen.getByLabelText("businessName"), { target: { value: "New name" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("currencyChangeLockedError")
      );
    });
  });

  it("shows the FX rate error and does not treat it as saved on fx_rate_unavailable", async () => {
    updateWorkspaceBusinessAction.mockResolvedValueOnce({ error: "fx_rate_unavailable" });
    render(<WorkspaceBusinessForm defaults={baseDefaults} locale="en" />);

    fireEvent.change(screen.getByLabelText("businessName"), { target: { value: "New name" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("currencyChangeRateError");
    });
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
