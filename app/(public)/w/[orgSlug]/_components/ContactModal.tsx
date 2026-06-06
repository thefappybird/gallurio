"use client";

import { useCallback, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { PortfolioContactConfig } from "@/lib/page-builder/types";
import { useGlobalContactTrigger } from "@/lib/hooks/useGlobalContactTrigger";
import { ContactForm, type InquiryFormLabels, type SubmitAppearance } from "./ContactForm";
import { ContactConfirmation } from "./ContactConfirmation";

export type ContactModalLabels = {
  /** Default heading when the workspace hasn't set a custom contact.title. */
  title: string;
  /** Default intro when the workspace hasn't set a custom contact.description. */
  description: string;
  close: string;
  confirmTitle: string;
  confirmBody: string;
  confirmClose: string;
  form: InquiryFormLabels;
};

const CONTACT_RADIUS_MAP: Record<string, string> = {
  sharp: "0",
  subtle: "0.25rem",
  rounded: "0.5rem",
};

/** Resolves a color value (token name OR custom hex) to a CSS color string. */
function resolveContactColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (value.startsWith("#")) return value;
  return `var(--pf-color-${value}, ${fallback})`;
}

function resolveSubmitAppearance(contact?: PortfolioContactConfig | null): SubmitAppearance {
  const color = resolveContactColor(contact?.buttonColor, "var(--pf-color-primary)");
  const style = (contact?.buttonStyle || "solid") as SubmitAppearance["style"];
  const borderRadius = contact?.buttonRadius ? CONTACT_RADIUS_MAP[contact.buttonRadius] : undefined;
  const textColor = contact?.buttonTextColor
    ? resolveContactColor(contact.buttonTextColor, "inherit")
    : undefined;
  const border = contact?.buttonBorderWidth
    ? `${contact.buttonBorderWidth}px solid ${resolveContactColor(contact.buttonBorderColor, "currentColor")}`
    : undefined;
  return { color, style, borderRadius, textColor, border };
}

function resolvePopupExtraStyles(popupStyle?: string): React.CSSProperties {
  if (popupStyle === "outline") {
    return {
      backgroundColor: "color-mix(in srgb, var(--pf-color-bg, #ffffff) 85%, transparent)",
      border: "2px solid var(--pf-color-fg, #111111)",
    };
  }
  if (popupStyle === "soft") {
    return {
      boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
      border: "none",
    };
  }
  // solid (default): thin border in both themes
  return { border: "1px solid color-mix(in srgb, var(--pf-color-fg, #111111) 14%, transparent)" };
}

export function ContactModal({
  workspaceSlug,
  contact,
  labels,
  brandVars,
}: {
  workspaceSlug: string;
  contact?: PortfolioContactConfig | null;
  labels: ContactModalLabels;
  /** Brand-kit CSS vars (--pf-color-*, --pf-font-*, --pf-radius). The modal
   *  renders through a Portal at document.body, escaping the page wrapper that
   *  sets these — so we re-apply them here or the popup has no background. */
  brandVars?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const openModal = useCallback(() => {
    setSubmitted(false);
    setOpen(true);
  }, []);
  useGlobalContactTrigger(openModal);

  const title = contact?.title?.trim() || labels.title;
  const description = contact?.description?.trim() || labels.description;
  const submitAppearance = resolveSubmitAppearance(contact);
  const popupExtraStyles = resolvePopupExtraStyles(contact?.popupStyle);
  const popupBorderRadius = contact?.popupRadius
    ? CONTACT_RADIUS_MAP[contact.popupRadius]
    : "var(--pf-radius)";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-pf-backdrop
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        />
        <DialogPrimitive.Popup
          className="pf-contact-popup"
          style={{
            // Re-apply brand vars: the Portal escapes the page wrapper that sets them.
            ...(brandVars as React.CSSProperties),
            position: "fixed",
            zIndex: 101,
            backgroundColor: resolveContactColor(contact?.backgroundColor, "var(--pf-color-bg, #ffffff)"),
            color: resolveContactColor(contact?.textColor, "var(--pf-color-fg, #111111)"),
            fontFamily: "var(--pf-font-body)",
            display: "flex",
            flexDirection: "column",
            outline: "none",
            borderRadius: popupBorderRadius,
            ...popupExtraStyles,
            ...(contact?.popupBorderWidth
              ? { border: `${contact.popupBorderWidth}px solid ${resolveContactColor(contact.popupBorderColor, "var(--pf-color-fg, #111111)")}` }
              : {}),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "1.25rem 1.25rem 0.75rem",
            }}
          >
            <div>
              <DialogPrimitive.Title
                style={{
                  fontFamily: "var(--pf-font-heading)",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description
                  style={{ margin: "0.375rem 0 0", fontSize: "0.9375rem", opacity: 0.72 }}
                >
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label={labels.close}
              className="pf-modal-close"
              style={{
                flexShrink: 0,
                width: "44px",
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                color: "var(--pf-color-fg)",
                border: "none",
                borderRadius: "var(--pf-radius)",
                cursor: "pointer",
                fontSize: "1.25rem",
                lineHeight: 1,
              }}
            >
              <span aria-hidden="true">✕</span>
            </DialogPrimitive.Close>
          </div>

          <div style={{ padding: "0 1.25rem 1.25rem", overflowY: "auto" }}>
            {submitted ? (
              <ContactConfirmation
                title={labels.confirmTitle}
                body={labels.confirmBody}
                closeLabel={labels.confirmClose}
                onClose={() => setOpen(false)}
              />
            ) : (
              <ContactForm
                workspaceSlug={workspaceSlug}
                labels={labels.form}
                submitAppearance={submitAppearance}
                onSuccess={() => setSubmitted(true)}
              />
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>

      <style>{`
        .pf-modal-close:focus-visible { outline: 2px solid var(--pf-color-accent); outline-offset: 2px; }
        .pf-modal-close:hover { background-color: color-mix(in srgb, var(--pf-color-fg) 8%, transparent); }
        .pf-contact-popup {
          top: 0; left: 0; right: 0; bottom: 0;
          width: 100%; max-height: 100dvh;
        }
        @media (min-width: 640px) {
          .pf-contact-popup {
            top: 50%; left: 50%; right: auto; bottom: auto;
            transform: translate(-50%, -50%);
            width: calc(100% - 2rem); max-width: 32rem;
            max-height: 90dvh;
          }
        }
      `}</style>
    </DialogPrimitive.Root>
  );
}
