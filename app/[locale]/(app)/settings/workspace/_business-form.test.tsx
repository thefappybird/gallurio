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

vi.mock("@/components/ui/timezone-combobox", () => ({
  TimezoneCombobox: ({
    id,
    value,
    onChange,
    invalid,
    ariaDescribedby,
  }: {
    id?: string;
    value: string;
    onChange: (v: string) => void;
    invalid?: boolean;
    ariaDescribedby?: string;
  }) => (
    <button
      type="button"
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedby}
      onClick={() => onChange("")}
    >
      {value}
    </button>
  ),
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

describe("WorkspaceBusinessForm — native email validation must not swallow submit", () => {
  it("surfaces the zod email error instead of letting the browser silently block submit", async () => {
    render(<WorkspaceBusinessForm defaults={baseDefaults} />);

    fireEvent.change(screen.getByLabelText("contactEmail"), {
      target: { value: "not-an-email" },
    });

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
  });
});

describe("WorkspaceBusinessForm — field error a11y wiring", () => {
  it("wires aria-invalid + aria-describedby to a role=alert message for invalid name/slug/contactEmail, and keeps the slug status indicator", async () => {
    render(<WorkspaceBusinessForm defaults={baseDefaults} />);

    fireEvent.change(screen.getByLabelText("businessName"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/workspaceUrl/), { target: { value: "ab" } });
    fireEvent.change(screen.getByLabelText("contactEmail"), { target: { value: "not-an-email" } });

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    const nameInput = await screen.findByLabelText("businessName");
    await waitFor(() => expect(nameInput).toHaveAttribute("aria-invalid", "true"));
    const nameErrorId = nameInput.getAttribute("aria-describedby");
    expect(nameErrorId).toBeTruthy();
    const nameError = document.getElementById(nameErrorId!);
    expect(nameError).toHaveAttribute("role", "alert");
    expect(nameError).toHaveTextContent(/at least/i);

    const slugInput = screen.getByLabelText(/workspaceUrl/);
    expect(slugInput).toHaveAttribute("aria-invalid", "true");
    const slugDescribedBy = slugInput.getAttribute("aria-describedby");
    expect(slugDescribedBy).toBeTruthy();
    const slugError = document.getElementById(slugDescribedBy!.split(" ")[0]!);
    expect(slugError).toHaveAttribute("role", "alert");
    expect(slugError).toHaveTextContent(/at least 3 characters/i);

    // SlugStatusIndicator (aria-live region) still renders alongside the field.
    expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument();

    const emailInput = screen.getByLabelText("contactEmail");
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    const emailDescribedBy = emailInput.getAttribute("aria-describedby");
    expect(emailDescribedBy).toBeTruthy();
    const emailError = document.getElementById(emailDescribedBy!);
    expect(emailError).toHaveAttribute("role", "alert");
    expect(emailError).toHaveTextContent(/enter a valid email/i);
  });
});

describe("WorkspaceBusinessForm — timezone a11y wiring", () => {
  it("marks the TimezoneCombobox trigger invalid and links it to #timezone-error when timezone is empty", async () => {
    render(<WorkspaceBusinessForm defaults={baseDefaults} />);

    const trigger = screen.getByLabelText("timezone");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(trigger).toHaveAttribute("aria-invalid", "true"));
    expect(trigger.getAttribute("aria-describedby")).toBe("timezone-error");
    expect(document.getElementById("timezone-error")).toHaveAttribute("role", "alert");
  });
});

describe("WorkspaceBusinessForm — valid state", () => {
  it("renders no alert and no aria-invalid on the name field when the form is untouched", () => {
    render(<WorkspaceBusinessForm defaults={baseDefaults} />);

    expect(screen.getByLabelText("businessName")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
