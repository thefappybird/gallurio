"use client";

import type { CSSProperties } from "react";
import type { PortfolioContactConfig } from "@/lib/page-builder/types";

export type ButtonAppearance = {
  color: string;
  style: "solid" | "outline" | "soft";
  borderRadius?: string;
  textColor?: string;
  border?: string;
  errorColor?: string;
};

const CONTACT_RADIUS_MAP: Record<string, string> = {
  sharp: "0",
  subtle: "0.25rem",
  rounded: "0.5rem",
};

function resolveContactColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (value.startsWith("#")) return value;
  return `var(--pf-color-${value}, ${fallback})`;
}

export function buildButtonStyle(
  appearance: ButtonAppearance,
  disabled: boolean,
  overrides?: Partial<CSSProperties>
): CSSProperties {
  const color = appearance.color;
  const base: CSSProperties = {
    width: "100%",
    minHeight: "48px",
    borderRadius: appearance.borderRadius ?? "var(--pf-radius)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
    fontSize: "1rem",
    fontFamily: "var(--pf-font-body)",
    ...overrides,
  };

  let style: CSSProperties;
  if (appearance.style === "outline") {
    style = {
      ...base,
      backgroundColor: "transparent",
      color: appearance.textColor ?? color,
      border: appearance.border ?? `1px solid ${color}`,
    };
  } else if (appearance.style === "soft") {
    style = {
      ...base,
      backgroundColor: `color-mix(in srgb, ${color} 16%, var(--pf-color-bg))`,
      color: appearance.textColor ?? color,
      border: appearance.border ?? "none",
    };
  } else {
    style = {
      ...base,
      backgroundColor: color,
      color: appearance.textColor ?? "var(--pf-color-bg)",
      border: appearance.border ?? "none",
    };
  }

  return style;
}

/**
 * Visual-only subset of a contact button's style — color/background/border/
 * radius WITHOUT layout sizing (width / min-height / font). Use when a
 * differently-sized control (e.g. the location picker's small square "apply"
 * icon-button) should adopt the submit button's *look* without being forced to
 * the full-width 48px submit size.
 */
export function buildButtonVisualStyle(
  appearance: ButtonAppearance,
  disabled: boolean
): CSSProperties {
  const {
    width: _width,
    minHeight: _minHeight,
    fontSize: _fontSize,
    fontFamily: _fontFamily,
    ...visual
  } = buildButtonStyle(appearance, disabled);
  return visual;
}

export function resolveSubmitAppearance(contact?: PortfolioContactConfig | null): ButtonAppearance {
  const border = contact?.buttonBorderWidth
    ? `${contact.buttonBorderWidth}px solid ${resolveContactColor(contact.buttonBorderColor, "currentColor")}`
    : undefined;

  return {
    color: resolveContactColor(contact?.buttonColor, "var(--pf-color-primary)"),
    style: (contact?.buttonStyle || "solid") as ButtonAppearance["style"],
    borderRadius: contact?.buttonRadius ? CONTACT_RADIUS_MAP[contact.buttonRadius] : undefined,
    textColor: contact?.buttonTextColor
      ? resolveContactColor(contact.buttonTextColor, "inherit")
      : undefined,
    border,
    errorColor: contact?.errorMessageColor
      ? resolveContactColor(contact.errorMessageColor, "var(--pf-color-accent)")
      : undefined,
  };
}

export function resolveAddSessionAppearance(contact?: PortfolioContactConfig | null): ButtonAppearance {
  const border = contact?.addSessionButtonBorderWidth
    ? `${contact.addSessionButtonBorderWidth}px solid ${resolveContactColor(contact.addSessionButtonBorderColor, "currentColor")}`
    : "1px dashed color-mix(in srgb, var(--pf-color-fg) 40%, transparent)";

  return {
    color: resolveContactColor(contact?.addSessionButtonColor, "var(--pf-color-fg)"),
    style: (contact?.addSessionButtonStyle || "outline") as ButtonAppearance["style"],
    borderRadius: contact?.addSessionButtonRadius
      ? CONTACT_RADIUS_MAP[contact.addSessionButtonRadius]
      : undefined,
    textColor: contact?.addSessionButtonTextColor
      ? resolveContactColor(contact.addSessionButtonTextColor, "var(--pf-color-fg)")
      : undefined,
    border,
  };
}
