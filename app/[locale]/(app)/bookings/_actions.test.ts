import { describe, it, expect, vi, beforeEach } from "vitest";

const requireOrgMock = vi.fn();
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: () => requireOrgMock(),
}));
vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));
const updateOneMock = vi.fn(async (...args: unknown[]) => {
  void args;
  return { acknowledged: true };
});
vi.mock("@/lib/db/models", () => ({
  Workspace: { updateOne: (...args: unknown[]) => updateOneMock(...args) },
}));

beforeEach(() => {
  requireOrgMock.mockReset();
  updateOneMock.mockClear();
});

describe("updateInvoiceThemeAction", () => {
  it("returns owner_only for a non-owner caller", async () => {
    requireOrgMock.mockResolvedValue({ role: "staff", workspace: { _id: "ws1" } });
    const { updateInvoiceThemeAction } = await import("./_actions");
    const result = await updateInvoiceThemeAction({
      preset: "classic",
      main: "#1a1a1a",
      accent: "#ffffff",
    });
    expect(result).toEqual({ error: "owner_only" });
  });

  it("ignores client-sent colors for a preset and resolves from INVOICE_THEME_PRESETS", async () => {
    requireOrgMock.mockResolvedValue({ role: "owner", workspace: { _id: "ws1" } });
    const { updateInvoiceThemeAction } = await import("./_actions");
    const result = await updateInvoiceThemeAction({
      preset: "slate",
      main: "#000000",
      accent: "#000000",
    });
    expect(result).toEqual({ ok: true });
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: "ws1" },
      { $set: { invoiceTheme: { preset: "slate", main: "#1E293B", accent: "#0EA5A4" } } }
    );
  });

  it("persists client-sent colors for the custom preset", async () => {
    requireOrgMock.mockResolvedValue({ role: "owner", workspace: { _id: "ws1" } });
    const { updateInvoiceThemeAction } = await import("./_actions");
    const result = await updateInvoiceThemeAction({
      preset: "custom",
      main: "#123456",
      accent: "#abcdef",
    });
    expect(result).toEqual({ ok: true });
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: "ws1" },
      { $set: { invoiceTheme: { preset: "custom", main: "#123456", accent: "#abcdef" } } }
    );
  });

  it("rejects a malformed hex color", async () => {
    requireOrgMock.mockResolvedValue({ role: "owner", workspace: { _id: "ws1" } });
    const { updateInvoiceThemeAction } = await import("./_actions");
    const result = await updateInvoiceThemeAction({
      preset: "custom",
      main: "not-a-color",
      accent: "#ffffff",
    });
    expect(result).toEqual({ error: "invalid_data" });
    expect(updateOneMock).not.toHaveBeenCalled();
  });
});
