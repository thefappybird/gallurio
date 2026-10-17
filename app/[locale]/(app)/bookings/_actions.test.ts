import { describe, it, expect, vi, beforeEach } from "vitest";

const requireOrgMock = vi.fn();
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: () => requireOrgMock(),
}));
const emitMock = vi.fn();
vi.mock("@/lib/sockets/emitDataChanged", () => ({
  emitDataChanged: (...args: unknown[]) => emitMock(...args),
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
  emitMock.mockClear();
});

describe("updateInvoiceThemeAction", () => {
  it("returns owner_only for a non-owner caller", async () => {
    requireOrgMock.mockResolvedValue({ role: "staff", workspace: { _id: "ws1" } });
    const { updateInvoiceThemeAction } = await import("./_actions");
    const result = await updateInvoiceThemeAction({
      preset: "minimal",
      main: "#1a1a1a",
      accent: "#ffffff",
    });
    expect(result).toEqual({ error: "owner_only" });
  });

  it("ignores client-sent colors for a preset and resolves from INVOICE_THEME_PRESETS", async () => {
    requireOrgMock.mockResolvedValue({ role: "owner", workspace: { _id: "ws1" } });
    const { updateInvoiceThemeAction } = await import("./_actions");
    const result = await updateInvoiceThemeAction({
      preset: "luxury",
      main: "#000000",
      accent: "#000000",
    });
    expect(result).toEqual({ ok: true });
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: "ws1" },
      {
        $set: {
          invoiceTheme: { preset: "luxury", savedThemeId: null, main: "#1e2431", accent: "#2f3a52", text: "#eceef4" },
        },
      }
    );
  });

  it("emits workspace.updated after a successful save and nothing for a non-owner", async () => {
    const { updateInvoiceThemeAction } = await import("./_actions");
    requireOrgMock.mockResolvedValue({ role: "staff", workspace: { _id: "ws1" } });
    await updateInvoiceThemeAction({ preset: "luxury", main: "#000000", accent: "#000000" });
    expect(emitMock).not.toHaveBeenCalled();
    requireOrgMock.mockResolvedValue({ role: "owner", workspace: { _id: "ws1" } });
    await updateInvoiceThemeAction({ preset: "luxury", main: "#000000", accent: "#000000" });
    expect(emitMock).toHaveBeenCalledWith("ws1", { type: "workspace.updated" });
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
      {
        $set: {
          invoiceTheme: { preset: "custom", savedThemeId: null, main: "#123456", accent: "#abcdef", text: "#FFFFFF" },
        },
      }
    );
  });

  const savedKit = {
    primaryColor: "#102030",
    accentColor: "#405060",
    foregroundColor: "#f0f0f0",
    backgroundColor: "#0a0a0a",
  };
  const wsWithThemes = {
    _id: "ws1",
    publicPage: {
      publishedAt: new Date("2026-01-01"),
      brandKit: { ...savedKit, primaryColor: "#ece5d8", foregroundColor: "#1f1c16", backgroundColor: "#fcfaf6" },
      savedThemes: [{ id: "s1", name: "Mine", brandKit: savedKit }],
    },
  };

  it("snapshots a saved theme from this workspace's savedThemes", async () => {
    requireOrgMock.mockResolvedValue({ role: "owner", workspace: wsWithThemes });
    const { updateInvoiceThemeAction } = await import("./_actions");
    const result = await updateInvoiceThemeAction({
      preset: "saved",
      savedThemeId: "s1",
      main: "#000000",
      accent: "#000000",
    });
    expect(result).toEqual({ ok: true });
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: "ws1" },
      {
        $set: {
          invoiceTheme: { preset: "saved", savedThemeId: "s1", main: "#102030", accent: "#405060", text: "#f0f0f0" },
        },
      }
    );
  });

  it("rejects a saved id not in this workspace (other workspace or missing)", async () => {
    requireOrgMock.mockResolvedValue({ role: "owner", workspace: wsWithThemes });
    const { updateInvoiceThemeAction } = await import("./_actions");
    for (const savedThemeId of ["other-ws-theme", undefined]) {
      const result = await updateInvoiceThemeAction({ preset: "saved", savedThemeId, main: "#000000", accent: "#000000" });
      expect(result).toEqual({ error: "invalid_data" });
    }
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it("snapshots the published brand kit for the portfolio preset, ignoring client colors", async () => {
    requireOrgMock.mockResolvedValue({ role: "owner", workspace: wsWithThemes });
    const { updateInvoiceThemeAction } = await import("./_actions");
    await updateInvoiceThemeAction({ preset: "portfolio", main: "#000000", accent: "#000000" });
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: "ws1" },
      {
        $set: {
          invoiceTheme: { preset: "portfolio", savedThemeId: null, main: "#ece5d8", accent: "#405060", text: "#1f1c16" },
        },
      }
    );
  });

  it("rejects the portfolio preset while the portfolio is unpublished (no draft kit leak)", async () => {
    requireOrgMock.mockResolvedValue({
      role: "owner",
      workspace: { ...wsWithThemes, publicPage: { ...wsWithThemes.publicPage, publishedAt: null } },
    });
    const { updateInvoiceThemeAction } = await import("./_actions");
    const result = await updateInvoiceThemeAction({ preset: "portfolio", main: "#000000", accent: "#000000" });
    expect(result).toEqual({ error: "invalid_data" });
    expect(updateOneMock).not.toHaveBeenCalled();
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
