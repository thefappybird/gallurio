import type React from "react";
import { X as XIcon } from "lucide-react";
import { colorTokenToVar, fontFamilyValue } from "../styleToolkit";
import type { PortfolioCollectionsPopupConfig } from "../types";

const RADIUS_PX: Record<string, string> = { sharp: "0px", subtle: "6px", rounded: "16px" };

function radiusToCss(r?: string): string | undefined {
  if (!r) return undefined;
  return RADIUS_PX[r];
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
  const bg = config.backgroundColor ? colorTokenToVar(config.backgroundColor) : undefined;
  const borderWidth = config.borderWidth ?? 0;
  const borderColor = config.borderColor ? colorTokenToVar(config.borderColor) : undefined;
  const shellRadius = radiusToCss(config.radius || undefined);

  const title = config.titleText?.trim() ? config.titleText : collectionName;

  const closeSize = config.closeButtonSize ?? 36;
  const closeRadius = config.closeButtonRadius ? radiusToCss(config.closeButtonRadius) : "50%";
  const closeBorderW = config.closeButtonBorderWidth ?? 1;
  const closeBorderColor = config.closeButtonBorderColorToken
    ? colorTokenToVar(config.closeButtonBorderColorToken)
    : "var(--pf-color-foreground, rgba(0,0,0,0.2))";
  const closeBg = config.closeButtonBgColorToken
    ? colorTokenToVar(config.closeButtonBgColorToken)
    : "var(--pf-color-surface, #fff)";

  const commonShell: React.CSSProperties = {
    backgroundColor: bg ?? "var(--pf-color-surface, #fff)",
    borderWidth: borderWidth > 0 ? `${borderWidth}px` : "1px",
    borderStyle: "solid",
    borderColor:
      borderWidth > 0 && borderColor
        ? borderColor
        : "var(--pf-color-border, rgba(0,0,0,0.12))",
    borderRadius: shellRadius ?? "0px",
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
          color: "var(--pf-color-foreground, #111)",
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
          backgroundColor: bg ?? "var(--pf-color-surface, #fff)",
          padding: "16px 56px 12px 16px",
          borderBottom: "1px solid var(--pf-color-border, rgba(0,0,0,0.1))",
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
            fontFamily: fontFamilyValue(config.titleFontFamily || undefined) ?? "inherit",
            color: config.titleColorToken
              ? (colorTokenToVar(config.titleColorToken) ??
                "var(--pf-color-foreground, #111)")
              : "var(--pf-color-foreground, #111)",
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
