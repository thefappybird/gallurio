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
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  buildContactLabelStyle,
  buildContactValueStyle,
  buildContactIconColor,
  buildContactIconSize,
  contactGridTemplate,
  type BlockStyle,
  type TextAlign,
} from "@/lib/page-builder/styleToolkit";
import { SocialIconLink, type SocialPlatform } from "./SocialIconLink";

export type ContactDetailsProps = {
  _style?: BlockStyle;
  columns?: number;
  email?: string;
  phone?: string;
  address?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
};

export const contactDetailsDefaultProps: ContactDetailsProps = {};

type Socials = {
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  website?: string | null;
};

/**
 * Normalize a social handle or URL to a fully-qualified https URL.
 * Returns null for website values that can't be parsed as a URL.
 * Exported for unit testing.
 */
export function normalizeSocialUrl(platform: SocialPlatform, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (platform === "instagram") {
    return v.startsWith("http") ? v : `https://instagram.com/${v}`;
  }
  if (platform === "facebook") {
    return v.startsWith("http") ? v : `https://facebook.com/${v}`;
  }
  if (platform === "tiktok") {
    return v.startsWith("http") ? v : `https://tiktok.com/@${v}`;
  }
  // website: accept http(s) URLs or bare domains (e.g. "example.com")
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w-]+(\.[\w-]+)+/.test(v)) return `https://${v}`;
  return null;
}

export function ContactDetailsBlock({
  _style,
  columns,
  email,
  phone,
  address,
  instagram,
  facebook,
  tiktok,
  website,
  puck,
}: ContactDetailsProps & { puck?: BlockPuck }) {
  const workspace = getRenderWorkspaceFrom(puck);
  const contact = workspace?.contact ?? null;
  const confirmMessage = workspace?.chrome?.socialLinkConfirm;

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

  const labelStyle = buildContactLabelStyle(_style);
  const valueStyle = buildContactValueStyle(_style);
  const iconColor = buildContactIconColor(_style);
  const iconSize = buildContactIconSize(_style);

  return (
    <dl
      ref={puck?.dragRef ?? undefined}
      data-block="contact-details"
      style={{
        display: "grid",
        gridTemplateColumns: contactGridTemplate(columns),
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
          labelStyle={labelStyle}
          value={
            <a
              href={`mailto:${effectiveEmail}`}
              style={{ ...valueStyle, textDecoration: "none" }}
            >
              {effectiveEmail}
            </a>
          }
          valueStyle={valueStyle}
        />
      )}
      {effectivePhone && (
        <ContactRow
          label="Phone"
          labelStyle={labelStyle}
          value={
            <a
              href={`tel:${effectivePhone}`}
              style={{ ...valueStyle, textDecoration: "none" }}
            >
              {effectivePhone}
            </a>
          }
          valueStyle={valueStyle}
        />
      )}
      {effectiveAddress && (
        <ContactRow
          label="Address"
          labelStyle={labelStyle}
          value={effectiveAddress}
          valueStyle={valueStyle}
        />
      )}
      {hasSocials && (
        <SocialsRow
          socials={effectiveSocials}
          labelStyle={labelStyle}
          iconColor={iconColor}
          iconSize={iconSize}
          confirmMessage={confirmMessage}
          valueAlign={_style?.valueAlign}
        />
      )}
    </dl>
  );
}

function ContactRow({
  label,
  value,
  labelStyle,
  valueStyle,
}: {
  label: string;
  value: React.ReactNode;
  labelStyle: React.CSSProperties;
  valueStyle: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
      <dt style={labelStyle}>{label}</dt>
      <dd style={valueStyle}>{value}</dd>
    </div>
  );
}

function SocialsRow({
  socials,
  labelStyle,
  iconColor,
  iconSize,
  confirmMessage,
  valueAlign,
}: {
  socials: Socials;
  labelStyle: React.CSSProperties;
  iconColor: string;
  iconSize: number;
  confirmMessage?: string;
  /** Controls flex justify-content of the icons row. Unset → center (default). */
  valueAlign?: TextAlign;
}) {
  const links: { label: string; href: string; platform: SocialPlatform }[] = [];
  if (socials.instagram) {
    const href = normalizeSocialUrl("instagram", socials.instagram);
    if (href) links.push({ label: "Instagram", href, platform: "instagram" });
  }
  if (socials.facebook) {
    const href = normalizeSocialUrl("facebook", socials.facebook);
    if (href) links.push({ label: "Facebook", href, platform: "facebook" });
  }
  if (socials.tiktok) {
    const href = normalizeSocialUrl("tiktok", socials.tiktok);
    if (href) links.push({ label: "TikTok", href, platform: "tiktok" });
  }
  if (socials.website) {
    const href = normalizeSocialUrl("website", socials.website);
    if (href) links.push({ label: "Website", href, platform: "website" });
  }
  if (links.length === 0) return null;

  const justifyContent =
    valueAlign === "left" ? "flex-start" :
    valueAlign === "right" ? "flex-end" :
    "center";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <dt style={labelStyle}>Follow</dt>
      <dd
        data-testid="socials-row"
        style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "0.875rem", color: iconColor, justifyContent }}
      >
        {links.map(({ label, href, platform }) => (
          <SocialIconLink
            key={platform}
            href={href}
            platform={platform}
            size={iconSize}
            confirmMessage={confirmMessage}
            label={label}
          />
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
