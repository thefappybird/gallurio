/**
 * ContactDetailsBlock — renders the workspace's contact details (email, phone,
 * address, socials). This is a DATA block: the values come from the workspace
 * server context (never Puck props), so it is server-rendered. The heading and
 * description around it are separate Heading/Text blocks in a composition.
 *
 * All branding via `--pf-*` CSS variables. No `rounded-*` Tailwind classes.
 */

import type { ComponentConfig } from "@measured/puck";
import { getRenderWorkspaceFrom, type BlockPuck } from "@/lib/page-builder/blockContext";
import { resolveBlockStyle, resolveBlockAttrs, productionStyleField, type BlockStyle } from "@/lib/page-builder/styleToolkit";

export type ContactDetailsProps = {
  _style?: BlockStyle;
  email?: string;
  phone?: string;
  address?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
};

export const contactDetailsDefaultProps: ContactDetailsProps = {};

export function ContactDetailsBlock({
  _style,
  email,
  phone,
  address,
  instagram,
  facebook,
  tiktok,
  website,
  puck,
}: ContactDetailsProps & { puck?: BlockPuck }) {
  const contact = getRenderWorkspaceFrom(puck)?.contact ?? null;

  const effectiveEmail = email?.trim() || contact?.email;
  const effectivePhone = phone?.trim() || contact?.phone;
  const effectiveAddress = address?.trim() || contact?.address;
  const effectiveSocials: Socials = {
    instagram: instagram?.trim() || contact?.socials?.instagram,
    facebook: facebook?.trim() || contact?.socials?.facebook,
    tiktok: tiktok?.trim() || contact?.socials?.tiktok,
    website: website?.trim() || contact?.socials?.website,
  };
  const hasSocials =
    effectiveSocials.instagram ||
    effectiveSocials.facebook ||
    effectiveSocials.tiktok ||
    effectiveSocials.website;

  return (
    <dl
      ref={puck?.dragRef ?? undefined}
      data-block="contact-details"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.875rem",
        margin: 0,
        padding: "0.5rem 0",
        fontFamily: "var(--pf-font-body)",
        color: "var(--pf-color-fg)",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      {effectiveEmail && (
        <ContactRow
          label="Email"
          value={
            <a href={`mailto:${effectiveEmail}`} style={{ color: "var(--pf-color-accent)", textDecoration: "none", fontWeight: 500 }}>
              {effectiveEmail}
            </a>
          }
        />
      )}
      {effectivePhone && (
        <ContactRow
          label="Phone"
          value={
            <a href={`tel:${effectivePhone}`} style={{ color: "var(--pf-color-accent)", textDecoration: "none", fontWeight: 500 }}>
              {effectivePhone}
            </a>
          }
        />
      )}
      {effectiveAddress && <ContactRow label="Address" value={effectiveAddress} />}
      {hasSocials && <SocialsRow socials={effectiveSocials} />}
    </dl>
  );
}

function ContactRow({ label, value }: { label: string; value: React.ReactNode }) {
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

function safeWebsiteHref(raw: string): string | null {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w-]+(\.[\w-]+)+/.test(v)) return `https://${v}`;
  return null;
}

function SocialsRow({ socials }: { socials: Socials }) {
  const links: { label: string; href: string }[] = [];
  if (socials.instagram)
    links.push({ label: "Instagram", href: socials.instagram.startsWith("http") ? socials.instagram : `https://instagram.com/${socials.instagram}` });
  if (socials.facebook)
    links.push({ label: "Facebook", href: socials.facebook.startsWith("http") ? socials.facebook : `https://facebook.com/${socials.facebook}` });
  if (socials.tiktok)
    links.push({ label: "TikTok", href: socials.tiktok.startsWith("http") ? socials.tiktok : `https://tiktok.com/@${socials.tiktok}` });
  if (socials.website) {
    const href = safeWebsiteHref(socials.website);
    if (href) links.push({ label: "Website", href });
  }
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
      <dd data-testid="socials-row" style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        {links.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--pf-color-accent)", textDecoration: "none" }}
          >
            {label}
          </a>
        ))}
      </dd>
    </div>
  );
}

export const contactDetailsBlockConfig: ComponentConfig<ContactDetailsProps> = {
  label: "Contact Details",
  inline: true,
  defaultProps: contactDetailsDefaultProps,
  fields: {
    _style: productionStyleField,
  },
  render: ContactDetailsBlock,
};
