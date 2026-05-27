/**
 * ContactCardBlock — displays workspace contact details.
 *
 * Contact values (email, phone, address, socials) come from the workspace
 * server context set by the renderer page — NEVER from Puck block props.
 * Block props only control:
 * - Which contact fields to show (showEmail, showPhone, showAddress, showSocials)
 * - Heading text
 * - Optional description text
 * - Inline CTA label (opens contact form — Phase 5)
 *
 * Multi-tenant safety: contact data is read from getRenderWorkspace(), which is
 * scoped per request via React's cache() in serverContext.tsx.
 *
 * All branding via `--pf-*` CSS variables. No `rounded-*` Tailwind classes.
 */

import type { ComponentConfig, Field } from "@measured/puck";
import { getRenderWorkspace } from "@/lib/page-builder/serverContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContactCardProps = {
  heading: string;
  description?: string;
  showEmail: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showSocials: boolean;
  inlineCtaLabel?: string;
};

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

export const contactCardDefaultProps: ContactCardProps = {
  heading: "Get in Touch",
  description: "I'd love to hear about your vision. Reach out and let's talk.",
  showEmail: true,
  showPhone: true,
  showAddress: true,
  showSocials: true,
  inlineCtaLabel: "Send a Message",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContactCardBlock({
  heading,
  description,
  showEmail,
  showPhone,
  showAddress,
  showSocials,
  inlineCtaLabel,
}: ContactCardProps) {
  const workspace = getRenderWorkspace();
  const contact = workspace?.contact ?? null;
  const branding = workspace?.branding ?? null;

  return (
    <section
      data-block="contact-card"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        color: "var(--pf-color-fg)",
        fontFamily: "var(--pf-font-body)",
        padding: "4rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "40rem",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--pf-font-heading)",
            fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
            fontWeight: 700,
            lineHeight: 1.2,
            color: "var(--pf-color-fg)",
            margin: 0,
          }}
        >
          {heading}
        </h2>

        {description && (
          <p
            style={{
              fontSize: "1rem",
              lineHeight: 1.75,
              color: "var(--pf-color-fg)",
              opacity: 0.8,
              margin: 0,
            }}
          >
            {description}
          </p>
        )}

        {/* Studio name / tagline from branding */}
        {branding?.tagline && (
          <p
            data-testid="contact-tagline"
            style={{
              fontSize: "1.0625rem",
              fontStyle: "italic",
              color: "var(--pf-color-fg)",
              opacity: 0.65,
              margin: 0,
            }}
          >
            {branding.tagline}
          </p>
        )}

        {/* Contact details */}
        <dl
          data-testid="contact-details"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.875rem",
            margin: 0,
            padding: 0,
          }}
        >
          {showEmail && contact?.email && (
            <ContactRow
              label="Email"
              value={
                <a
                  href={`mailto:${contact.email}`}
                  style={{
                    color: "var(--pf-color-accent)",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  {contact.email}
                </a>
              }
            />
          )}

          {showPhone && contact?.phone && (
            <ContactRow
              label="Phone"
              value={
                <a
                  href={`tel:${contact.phone}`}
                  style={{
                    color: "var(--pf-color-accent)",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  {contact.phone}
                </a>
              }
            />
          )}

          {showAddress && contact?.address && (
            <ContactRow label="Address" value={contact.address} />
          )}

          {showSocials && contact?.socials && (
            <SocialsRow socials={contact.socials} />
          )}
        </dl>

        {/* Inline CTA */}
        {inlineCtaLabel && (
          <a
            href="#"
            role="button"
            data-cta="contact"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "flex-start",
              minHeight: "2.75rem",
              minWidth: "9rem",
              padding: "0 1.75rem",
              fontFamily: "var(--pf-font-body)",
              fontSize: "0.9375rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textDecoration: "none",
              cursor: "pointer",
              borderRadius: "var(--pf-radius)",
              backgroundColor: "var(--pf-color-accent)",
              color: "#ffffff",
              border: "2px solid transparent",
            }}
          >
            {inlineCtaLabel}
          </a>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

function ContactRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
      <dt
        style={{
          fontSize: "0.6875rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--pf-color-fg)",
          opacity: 0.45,
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: "0.9375rem" }}>{value}</dd>
    </div>
  );
}

type Socials = {
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  website?: string | null;
};

function SocialsRow({ socials }: { socials: Socials }) {
  const links: { label: string; href: string }[] = [];

  if (socials.instagram)
    links.push({
      label: "Instagram",
      href: socials.instagram.startsWith("http")
        ? socials.instagram
        : `https://instagram.com/${socials.instagram}`,
    });
  if (socials.facebook)
    links.push({
      label: "Facebook",
      href: socials.facebook.startsWith("http")
        ? socials.facebook
        : `https://facebook.com/${socials.facebook}`,
    });
  if (socials.tiktok)
    links.push({
      label: "TikTok",
      href: socials.tiktok.startsWith("http")
        ? socials.tiktok
        : `https://tiktok.com/@${socials.tiktok}`,
    });
  if (socials.website)
    links.push({
      label: "Website",
      href: socials.website,
    });

  if (links.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
      <dt
        style={{
          fontSize: "0.6875rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--pf-color-fg)",
          opacity: 0.45,
        }}
      >
        Follow
      </dt>
      <dd
        data-testid="socials-row"
        style={{
          margin: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        {links.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--pf-color-accent)",
              textDecoration: "none",
            }}
          >
            {label}
          </a>
        ))}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Puck registration
// ---------------------------------------------------------------------------

export const contactCardBlockConfig: ComponentConfig<ContactCardProps> = {
  label: "Contact Card",
  defaultProps: contactCardDefaultProps,
  fields: {
    heading: { type: "text", label: "Heading" },
    description: { type: "textarea", label: "Description (optional)" },
    showEmail: {
      type: "select",
      label: "Show email",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    } as Field<boolean>,
    showPhone: {
      type: "select",
      label: "Show phone",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    } as Field<boolean>,
    showAddress: {
      type: "select",
      label: "Show address",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    } as Field<boolean>,
    showSocials: {
      type: "select",
      label: "Show social links",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    } as Field<boolean>,
    inlineCtaLabel: {
      type: "text",
      label: "CTA button label (optional — leave empty to hide)",
    },
  },
  render: ContactCardBlock,
};
