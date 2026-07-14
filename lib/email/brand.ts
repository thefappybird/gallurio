const GALLURIO_TEAL = "#0d8fa1";
const HEX6 = /^#[0-9a-fA-F]{6}$/;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://gallurio.app").replace(/\/$/, "");
export const GALLURIO_LOGO_URL = `${APP_URL}/brand/gallurio-sq-white.png`;

export type Brand = {
  kind: "platform" | "partner";
  name: string;
  logoUrl?: string;
  accentHex: string;
  replyTo?: string;
  poweredByGallurio: boolean;
};

type WorkspaceBrandInput = {
  name?: string;
  logoUrl?: string;
  publicPage?: { header?: { logoUrl?: string }; brandKit?: { accentColor?: string } };
  contact?: { email?: string };
};

export function gallurioBrand(): Brand {
  return {
    kind: "platform",
    name: "Gallurio",
    logoUrl: GALLURIO_LOGO_URL,
    accentHex: GALLURIO_TEAL,
    poweredByGallurio: false,
  };
}

export function resolveWorkspaceBrand(ws: WorkspaceBrandInput): Brand {
  const accent = ws.publicPage?.brandKit?.accentColor;
  const logoUrl = ws.logoUrl;
  return {
    kind: "partner",
    name: ws.name?.trim() || "Gallurio",
    logoUrl: logoUrl && logoUrl.trim() ? logoUrl : undefined,
    accentHex: accent && HEX6.test(accent) ? accent : GALLURIO_TEAL,
    replyTo: ws.contact?.email || undefined,
    poweredByGallurio: true,
  };
}

export function ctaTextColor(accentHex: string): "#ffffff" | "#1a1a1a" {
  const hex = HEX6.test(accentHex) ? accentHex : GALLURIO_TEAL;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // Relative luminance (sRGB, simple gamma) — readable-text threshold.
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? "#1a1a1a" : "#ffffff";
}
