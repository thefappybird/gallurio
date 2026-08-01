export const INVOICE_THEME_PRESETS = {
  classic: { main: "#1A1A1A", accent: "#FFFFFF" },
  slate: { main: "#1E293B", accent: "#0EA5A4" },
  navyGold: { main: "#0F1B33", accent: "#C9A24B" },
  forest: { main: "#1F3D2B", accent: "#E8E2D0" },
} as const;
export type InvoiceThemePresetId = keyof typeof INVOICE_THEME_PRESETS;
export type InvoiceTheme = { preset: InvoiceThemePresetId | "custom"; main: string; accent: string };
export type InvoiceThemePreviewBusiness = {
  name: string;
  logoUrl: string;
  address: string;
  email: string;
  currency: string;
};

export function resolveInvoiceTheme(theme: InvoiceTheme | null | undefined): { main: string; accent: string } {
  if (theme?.preset === "custom") return { main: theme.main, accent: theme.accent };
  if (theme && theme.preset in INVOICE_THEME_PRESETS) return INVOICE_THEME_PRESETS[theme.preset as InvoiceThemePresetId];
  return INVOICE_THEME_PRESETS.classic;
}
