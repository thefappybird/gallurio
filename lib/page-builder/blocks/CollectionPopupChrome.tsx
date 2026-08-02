import type React from "react";
import { X as XIcon } from "lucide-react";
import { colorTokenToVar, fontFamilyValue } from "../styleToolkit";
import type { PortfolioCollectionsPopupConfig } from "../types";

const RADIUS_PX: Record<string, string> = { sharp: "0", subtle: "0.25rem", rounded: "0.5rem" };

function radiusToCss(r?: string): string | undefined {
  if (!r) return undefined;
  return RADIUS_PX[r];
}

/**
 * Resolve the popup shell's background CSS value. Exported as a pure function
 * (rather than inlined) so it's unit-testable without DOM/CSSOM style
 * introspection — happy-dom's CSSStyleDeclaration silently drops the
 * two-argument var(--x, fallback) syntax used here.
 *
 * Root cause of the "transparent modal" bug: CollectionPopupChrome portals
 * outside the public-page wrapper that carries the --pf-* CSS custom
 * properties (base-ui's Portal renders to document.body), so a bare
 * var(--pf-color-X) with no literal fallback resolves to nothing — an invalid
 * declared value — and the shell renders fully transparent. The literal
 * fallback (2nd var() arg) makes it resilient regardless of portal scope.
 * Default token is the theme background, matching the editor's effective
 * background swatch when no explicit popup color has been selected.
 */
export function resolvePopupBackground(token: PortfolioCollectionsPopupConfig["backgroundColor"]): string {
  const resolved = token ? colorTokenToVar(token) : undefined;
  return resolved ?? "var(--pf-color-bg, #ffffff)";
}

export function CollectionPopupChrome({
  collectionName,
  config,
  onClose,
  children,
  preview = false,
  closeDataAttr,
  noShell = false,
}: {
  collectionName: string;
  config: PortfolioCollectionsPopupConfig;
  onClose: () => void;
  children: React.ReactNode;
  preview?: boolean;
  /** When true, skips the outer shell <div> and renders chrome content directly. */
  noShell?: boolean;
  /** When provided, spread as a data-attribute (e.g. "data-popup-close") on the close button. */
  closeDataAttr?: string;
}) {
  const bg = resolvePopupBackground(config.backgroundColor);
  const borderWidth = config.borderWidth ?? 0;
  const borderColor = config.borderColor ? colorTokenToVar(config.borderColor) : undefined;
  const shellRadius = radiusToCss(config.radius || undefined);

  const title = config.titleText?.trim() ? config.titleText : collectionName;

  const closeSize = config.closeButtonSize ?? 36;
  // unset/cleared → rounded (16px); explicit value wins via RADIUS_PX lookup
  const closeRadius = radiusToCss(config.closeButtonRadius || "rounded") ?? "0.5rem";
  const closeBorderW = config.closeButtonBorderWidth ?? 1;
  const closeBorderColor = config.closeButtonBorderColorToken
    ? colorTokenToVar(config.closeButtonBorderColorToken)
    : "var(--pf-color-fg, rgba(0,0,0,0.2))";
  const closeBg = config.closeButtonBgColorToken
    ? colorTokenToVar(config.closeButtonBgColorToken)
    : "var(--pf-color-bg, #fff)";

  const commonShell: React.CSSProperties = {
    backgroundColor: bg,
    borderWidth: borderWidth > 0 ? `${borderWidth}px` : "1px",
    borderStyle: "solid",
    borderColor:
      borderWidth > 0 && borderColor
        ? borderColor
        : "color-mix(in srgb, var(--pf-color-fg, #111) 14%, transparent)",
    borderRadius: shellRadius ?? "var(--pf-radius)",
    fontFamily: "var(--pf-font-body)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const shellStyle: React.CSSProperties = preview
    ? { position: "absolute", inset: "5%", ...commonShell }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 100,
        maxHeight: "90vh",
        minWidth: "90vw",
        maxWidth: "900px",
        width: "90vw",
        ...commonShell,
      };

  const closeDataProps = closeDataAttr ? { [closeDataAttr]: "" } : {};

  const chromeContent = (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        {...closeDataProps}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: `${closeSize}px`,
          height: `${closeSize}px`,
          borderRadius: closeRadius,
          borderWidth: `${closeBorderW}px`,
          borderStyle: "solid",
          borderColor: closeBorderColor,
          background: closeBg,
          color: "var(--pf-color-fg, #111)",
          opacity: (config.closeButtonOpacity ?? 100) / 100,
          cursor: "pointer",
        }}
      >
        <XIcon aria-hidden style={{ width: "16px", height: "16px" }} />
      </button>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          backgroundColor: bg,
          padding: "16px 56px 12px 16px",
          borderBottom: "1px solid color-mix(in srgb, var(--pf-color-fg, #111) 14%, transparent)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: config.titleFontSize ? `${config.titleFontSize}px` : "1.125rem",
            fontWeight: config.titleBold ? 700 : 600,
            fontStyle: config.titleItalic ? "italic" : undefined,
            textDecoration: config.titleUnderline ? "underline" : undefined,
            lineHeight: 1.3,
            textAlign: (config.titleAlign || "left") as import("react").CSSProperties["textAlign"],
            fontFamily: fontFamilyValue(config.titleFontFamily || undefined) ?? "var(--pf-font-heading)",
            color: config.titleColorToken
              ? (colorTokenToVar(config.titleColorToken) ??
                "var(--pf-color-fg, #111)")
              : "var(--pf-color-fg, #111)",
          }}
        >
          {title}
        </h2>
      </div>

      {children}
    </>
  );

  if (noShell) return chromeContent;

  return <div style={shellStyle}>{chromeContent}</div>;
}
