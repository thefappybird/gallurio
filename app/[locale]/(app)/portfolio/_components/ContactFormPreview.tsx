"use client";

import { ContactForm, type InquiryFormLabels, type SubmitAppearance } from "@/app/(public)/w/[orgSlug]/_components/ContactForm";
import type { ButtonAppearance } from "@/app/(public)/w/[orgSlug]/_components/contactButtonAppearance";
import type { PortfolioBrandKit, PortfolioContactConfig } from "@/lib/page-builder/types";

type Props = {
  contact: PortfolioContactConfig;
  brandKit: PortfolioBrandKit;
  labels: InquiryFormLabels;
  submitAppearance: SubmitAppearance;
  addSessionAppearance: ButtonAppearance;
  defaultTitle: string;
  defaultDescription: string;
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

function resolvePopupStyle(contact: PortfolioContactConfig, brandKit: PortfolioBrandKit): React.CSSProperties {
  const fallbackBg = brandKit.backgroundColor;
  const fallbackFg = brandKit.foregroundColor;

  return {
    backgroundColor: resolveContactColor(contact.backgroundColor, fallbackBg),
    color: resolveContactColor(contact.textColor, fallbackFg),
    fontFamily: "var(--pf-font-body)",
    borderRadius: contact.popupRadius
      ? (CONTACT_RADIUS_MAP[contact.popupRadius] ?? "var(--pf-radius)")
      : "var(--pf-radius)",
    border: contact.popupBorderWidth
      ? `${contact.popupBorderWidth}px solid ${resolveContactColor(contact.popupBorderColor, "var(--pf-color-fg, #111111)")}`
      : "1px solid color-mix(in srgb, var(--pf-color-fg) 14%, transparent)",
  };
}

export function ContactFormPreview({
  contact,
  brandKit,
  labels,
  submitAppearance,
  addSessionAppearance,
  defaultTitle,
  defaultDescription,
}: Props) {
  const title = contact.title?.trim() || defaultTitle;
  const description = contact.description?.trim() || defaultDescription;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-auto bg-black/45 p-4">
      <div
        aria-label="Contact form preview"
        className="flex w-full max-w-lg flex-col overflow-hidden"
        style={{
          ...resolvePopupStyle(contact, brandKit),
          maxHeight: "calc(100dvh - 2rem)",
        }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "var(--pf-font-heading)" }}>
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm opacity-75">{description}</p> : null}
          </div>
          <span className="text-lg opacity-50">x</span>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-3">
          <ContactForm
            workspaceSlug="preview"
            labels={labels}
            submitAppearance={submitAppearance}
            addSessionAppearance={addSessionAppearance}
            onSuccess={() => {}}
            preview
            compactLocationPicker
            scrollable
          />
        </div>
      </div>
    </div>
  );
}
