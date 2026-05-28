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

function resolveSubmitAppearance(contact?: PortfolioContactConfig | null): SubmitAppearance {
  const colorVar = contact?.buttonColor ? `--pf-color-${contact.buttonColor}` : "--pf-color-primary";
  const style = (contact?.buttonStyle || "solid") as SubmitAppearance["style"];
  return { colorVar, style };
}

export function ContactModal({
  workspaceSlug,
  contact,
  labels,
}: {
  workspaceSlug: string;
  contact?: PortfolioContactConfig | null;
  labels: ContactModalLabels;
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
            position: "fixed",
            zIndex: 101,
            backgroundColor: "var(--pf-color-bg)",
            color: "var(--pf-color-fg)",
            fontFamily: "var(--pf-font-body)",
            display: "flex",
            flexDirection: "column",
            outline: "none",
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
              style={{
                flexShrink: 0,
                width: "40px",
                height: "40px",
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
            border: 1px solid color-mix(in srgb, var(--pf-color-fg) 16%, transparent);
          }
        }
      `}</style>
    </DialogPrimitive.Root>
  );
}
