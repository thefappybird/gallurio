"use client";

import type { PortfolioBrandKit, PortfolioContactConfig } from "@/lib/page-builder/types";

type Props = {
  contact: PortfolioContactConfig;
  brandKit: PortfolioBrandKit;
  /** Fallback heading when contact.title is empty. */
  defaultTitle: string;
  /** Fallback description when contact.description is empty. */
  defaultDescription: string;
  /** Label for the submit button placeholder. */
  submitLabel: string;
};

const COLOR_KEYS = ["primary", "secondary", "accent", "background", "foreground"] as const;

const RADIUS_MAP: Record<string, string> = {
  sharp: "0",
  subtle: "0.25rem",
  rounded: "0.5rem",
};

function resolveColor(
  token: string | undefined,
  brandKit: PortfolioBrandKit,
  fallback: string,
): string {
  if (!token) return fallback;
  if (token.startsWith("#")) return token;
  switch (token) {
    case "primary":    return brandKit.primaryColor;
    case "secondary":  return brandKit.secondaryColor;
    case "accent":     return brandKit.accentColor;
    case "background": return brandKit.backgroundColor;
    case "foreground": return brandKit.foregroundColor;
    default:           return fallback;
  }
}

function resolveButtonStyle(
  contact: PortfolioContactConfig,
  brandKit: PortfolioBrandKit,
): React.CSSProperties {
  const colorHex = resolveColor(contact.buttonColor, brandKit, brandKit.primaryColor);
  const textColorHex = contact.buttonTextColor
    ? resolveColor(contact.buttonTextColor, brandKit, colorHex)
    : undefined;
  const style = contact.buttonStyle ?? "solid";
  let result: React.CSSProperties;
  if (style === "outline") {
    result = { backgroundColor: "transparent", color: textColorHex ?? colorHex, border: `2px solid ${colorHex}` };
  } else if (style === "soft") {
    result = { backgroundColor: `${colorHex}26`, color: textColorHex ?? colorHex, border: "none" };
  } else {
    result = { backgroundColor: colorHex, color: textColorHex ?? "#ffffff", border: "none" };
  }
  if (contact.buttonBorderWidth) {
    const borderColor = resolveColor(contact.buttonBorderColor, brandKit, colorHex);
    result = { ...result, border: `${contact.buttonBorderWidth}px solid ${borderColor}` };
  }
  return result;
}

function resolvePopupStyle(
  contact: PortfolioContactConfig,
  brandKit: PortfolioBrandKit,
): React.CSSProperties {
  const bgHex = resolveColor(contact.backgroundColor, brandKit, brandKit.backgroundColor);
  const fgHex = resolveColor(contact.textColor, brandKit, brandKit.foregroundColor);
  const base: React.CSSProperties = { backgroundColor: bgHex, color: fgHex };

  const style = contact.popupStyle ?? "solid";
  let result: React.CSSProperties;
  if (style === "outline") {
    result = { ...base, backgroundColor: `${bgHex}d9`, border: `2px solid ${fgHex}` };
  } else if (style === "soft") {
    result = { ...base, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" };
  } else {
    result = { ...base, border: `1px solid ${fgHex}26` };
  }
  if (contact.popupBorderWidth) {
    const borderColor = resolveColor(contact.popupBorderColor, brandKit, fgHex);
    result = { ...result, border: `${contact.popupBorderWidth}px solid ${borderColor}` };
  }
  return result;
}

/**
 * Inline real-time preview of the contact modal for the portfolio editor.
 * Mirrors the visual structure of ContactModal without portals or dialog
 * semantics, so it updates instantly as the user changes contact settings.
 */
export function ContactFormPreview({
  contact,
  brandKit,
  defaultTitle,
  defaultDescription,
  submitLabel,
}: Props) {
  const title = contact.title?.trim() || defaultTitle;
  const description = contact.description?.trim() || defaultDescription;
  const fgHex = resolveColor(contact.textColor, brandKit, brandKit.foregroundColor);

  const brandRadius = RADIUS_MAP[brandKit.radius ?? "sharp"] ?? "0";
  const popupStyles: React.CSSProperties = {
    ...resolvePopupStyle(contact, brandKit),
    borderRadius: contact.popupRadius ? (RADIUS_MAP[contact.popupRadius] ?? "0") : brandRadius,
  };
  const buttonStyles: React.CSSProperties = {
    ...resolveButtonStyle(contact, brandKit),
    width: "100%",
    padding: "0.625rem 1rem",
    fontWeight: 600,
    fontSize: "0.9375rem",
    cursor: "default",
    fontFamily: "inherit",
    borderRadius: contact.buttonRadius ? (RADIUS_MAP[contact.buttonRadius] ?? "0") : brandRadius,
  };

  const inputStyle: React.CSSProperties = {
    height: "2.25rem",
    border: `1px solid ${fgHex}25`,
    backgroundColor: "transparent",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    marginBottom: "0.25rem",
    opacity: 0.6,
    display: "block",
  };

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/45" />

      {/* Popup */}
      <div
        className="relative z-10 mx-4 w-full max-w-sm overflow-y-auto"
        style={popupStyles}
      >
        <div style={{ padding: "1.25rem" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "1rem",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  marginBottom: description ? "0.375rem" : 0,
                }}
              >
                {title}
              </div>
              {description && (
                <div style={{ fontSize: "0.9375rem", opacity: 0.72 }}>{description}</div>
              )}
            </div>
            {/* Placeholder close button */}
            <div
              style={{
                flexShrink: 0,
                width: "44px",
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.4,
                fontSize: "1.125rem",
              }}
            >
              ✕
            </div>
          </div>

          {/* Placeholder form fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            {(["Name", "Email", "Phone"] as const).map((field) => (
              <div key={field}>
                <span style={labelStyle}>{field}</span>
                <div style={inputStyle} />
              </div>
            ))}

            <div>
              <span style={labelStyle}>Preferred contact</span>
              <div style={{ ...inputStyle, height: "2.25rem" }} />
            </div>

            <button type="button" style={buttonStyles} tabIndex={-1}>
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
