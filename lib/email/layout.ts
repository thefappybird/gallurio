import { escapeHtml } from "./escapeHtml";
import { Brand, ctaTextColor } from "./brand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailBlock =
  | { type: "p"; text: string }
  | { type: "heading"; text: string }
  | { type: "rows"; rows: Array<{ label: string; value: string }> }
  | { type: "spacer" };

export type RenderEmailOpts = {
  brand: Brand;
  locale: "en" | "fil" | "ms" | "id";
  preheader: string;
  title: string;
  subtitle?: string;
  blocks: EmailBlock[];
  cta?: { label: string; url: string };
  secondaryCta?: { label: string; url: string };
  supportLine?: string;
};

// ---------------------------------------------------------------------------
// Color tokens
// ---------------------------------------------------------------------------

const LIGHT_BG = "#f8f8f8";
const LIGHT_TEXT = "#424242";
const LIGHT_BORDER = "#e6e6e6";
const FOOTER_CHARCOAL = "#353535";
const WHITE = "#ffffff";
const DARK_BG = "#353535";
const DARK_TEXT = "#eaeaea";
const DARK_BORDER = "#4a4a4a";
const DARK_TEAL = "#2fb3d9";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function e(s: unknown): string {
  return escapeHtml(s);
}

function ctaButton(
  label: string,
  url: string,
  accentHex: string,
  style: "primary" | "secondary",
): string {
  const safeUrl = e(url);
  const safeLabel = e(label);
  const bg = style === "primary" ? accentHex : LIGHT_BG;
  const textColor = style === "primary" ? ctaTextColor(accentHex) : LIGHT_TEXT;
  const border = style === "secondary" ? `border:2px solid ${accentHex};` : "";
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto;">',
    "  <tr>",
    `    <td bgcolor="${bg}" style="border-radius:4px;${border}">`,
    `      <a href="${safeUrl}" target="_blank"`,
    `         style="display:inline-block;padding:0 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;color:${textColor};text-decoration:none;border-radius:4px;min-height:44px;line-height:44px;"`,
    `         >${safeLabel}</a>`,
    "    </td>",
    "  </tr>",
    "</table>",
  ].join("\n");
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "p":
      return `<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:${LIGHT_TEXT};">${e(block.text)}</p>`;
    case "heading":
      return `<h2 style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:${LIGHT_TEXT};">${e(block.text)}</h2>`;
    case "rows": {
      const rowsHtml = block.rows
        .map(
          (row) =>
            `  <tr>\n    <td style="padding:6px 8px;font-family:Arial,sans-serif;font-size:13px;color:#6b6b6b;white-space:nowrap;vertical-align:top;">${e(row.label)}</td>\n    <td style="padding:6px 8px;font-family:Arial,sans-serif;font-size:13px;color:${LIGHT_TEXT};vertical-align:top;">${e(row.value)}</td>\n  </tr>`,
        )
        .join("\n");
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;border-collapse:collapse;">\n${rowsHtml}\n</table>`;
    }
    case "spacer":
      return `<div style="height:16px;">&nbsp;</div>`;
  }
}

function blockText(block: EmailBlock): string {
  switch (block.type) {
    case "p":
      return block.text;
    case "heading":
      return block.text.toUpperCase();
    case "rows":
      return block.rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    case "spacer":
      return "";
  }
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

export function renderBrandedEmail(opts: RenderEmailOpts): { html: string; text: string } {
  const { brand, preheader, title, subtitle, blocks, cta, secondaryCta, supportLine } = opts;
  const isPlatform = brand.kind === "platform";
  const accentHex = brand.accentHex;
  const year = new Date().getFullYear();

  // Header
  const headerBg = isPlatform ? accentHex : WHITE;
  const headerTextColor = isPlatform ? ctaTextColor(accentHex) : LIGHT_TEXT;
  const headerBorderBottom = isPlatform ? "" : `border-bottom:3px solid ${accentHex};`;
  const brandDisplay = brand.logoUrl
    ? `<img src="${e(brand.logoUrl)}" height="28" alt="${e(brand.name)}" style="display:block;border:0;" />`
    : `<span style="font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:${headerTextColor};">${e(brand.name)}</span>`;

  // Footer
  let footerHtml: string;
  let footerText: string;
  if (isPlatform) {
    footerHtml = [
      `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;">Your event business, beautifully managed.</p>`,
      `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;"><a href="mailto:support@gallurio.com" style="color:#aaaaaa;">support@gallurio.com</a></p>`,
      `<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;">&copy; ${year} Gallurio. All rights reserved.</p>`,
    ].join("\n");
    footerText = `Your event business, beautifully managed.\nsupport@gallurio.com\n© ${year} Gallurio. All rights reserved.`;
  } else {
    footerHtml = [
      `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;">${e(brand.name)}</p>`,
      `<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;"><a href="https://gallurio.com" style="color:#aaaaaa;">Powered by Gallurio</a></p>`,
    ].join("\n");
    footerText = `${brand.name}\nPowered by Gallurio`;
  }

  // Blocks
  const blocksHtml = blocks.map(renderBlock).join("\n");

  // CTAs
  let ctasHtml = "";
  if (cta || secondaryCta) {
    const parts = [];
    if (cta) parts.push(ctaButton(cta.label, cta.url, accentHex, "primary"));
    if (secondaryCta) parts.push(ctaButton(secondaryCta.label, secondaryCta.url, accentHex, "secondary"));
    ctasHtml = `<div style="text-align:center;padding:8px 0 16px;">${parts.join("\n")}</div>`;
  }

  // Support line
  const supportHtml = supportLine
    ? `<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:#888888;text-align:center;">${e(supportLine)}</p>`
    : "";

  // Dark mode CSS
  const darkStyle = [
    "<style>",
    "@media (prefers-color-scheme: dark) {",
    `  .email-body { background-color: ${DARK_BG} !important; }`,
    `  .email-card { background-color: #2a2a2a !important; border-color: ${DARK_BORDER} !important; }`,
    `  .email-text { color: ${DARK_TEXT} !important; }`,
    `  .email-footer { background-color: ${FOOTER_CHARCOAL} !important; }`,
    `  a { color: ${DARK_TEAL} !important; }`,
    "}",
    "</style>",
  ].join("\n");

  const html = [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '<meta name="x-apple-disable-message-reformatting" />',
    `<title>${e(title)}</title>`,
    darkStyle,
    "</head>",
    `<body style="margin:0;padding:0;background-color:${LIGHT_BG};" class="email-body">`,
    "",
    `<!-- Preheader -->`,
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${e(preheader)}</div>`,
    "",
    `<!-- Outer wrapper -->`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${LIGHT_BG};">`,
    "  <tr>",
    '    <td style="padding:24px 16px;">',
    "",
    "      <!-- Card: max 600px -->",
    `      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background-color:${WHITE};border:1px solid ${LIGHT_BORDER};border-radius:4px;" class="email-card">`,
    "",
    "        <!-- Header strip -->",
    "        <tr>",
    `          <td style="padding:20px 32px;background-color:${headerBg};border-radius:4px 4px 0 0;${headerBorderBottom}">`,
    `            ${brandDisplay}`,
    "          </td>",
    "        </tr>",
    "",
    "        <!-- Body -->",
    "        <tr>",
    `          <td style="padding:32px 32px 24px;" class="email-text">`,
    `            <h1 style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:${LIGHT_TEXT};">${e(title)}</h1>`,
    subtitle ? `            <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:15px;color:#777777;">${e(subtitle)}</p>` : "",
    `            <div style="height:1px;background-color:${LIGHT_BORDER};margin:0 0 24px;"></div>`,
    `            ${blocksHtml}`,
    `            ${ctasHtml}`,
    `            ${supportHtml}`,
    "          </td>",
    "        </tr>",
    "",
    "        <!-- Footer -->",
    "        <tr>",
    `          <td style="padding:20px 32px;background-color:${FOOTER_CHARCOAL};border-radius:0 0 4px 4px;text-align:center;" class="email-footer">`,
    `            ${footerHtml}`,
    "          </td>",
    "        </tr>",
    "",
    "      </table>",
    "    </td>",
    "  </tr>",
    "</table>",
    "",
    "</body>",
    "</html>",
  ]
    .filter((line) => line !== "")
    .join("\n");

  // Plain text
  const textParts: string[] = [title];
  if (subtitle) textParts.push(subtitle);
  textParts.push("");
  for (const block of blocks) {
    const t = blockText(block);
    if (t) textParts.push(t);
  }
  if (cta) textParts.push(`${cta.label}: ${cta.url}`);
  if (secondaryCta) textParts.push(`${secondaryCta.label}: ${secondaryCta.url}`);
  if (supportLine) textParts.push("", supportLine);
  textParts.push("", footerText);

  return { html, text: textParts.join("\n") };
}
