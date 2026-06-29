// ponytail: production subdomain ROUTING (wildcard DNS + proxy rewrite) is a separate
// deploy task — this helper is display only; the app still serves /w/{slug}.

export function portfolioBaseDomain(): string | null {
  return process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN?.trim() || null;
}

export function portfolioPublicUrl(slug: string): string {
  const baseDomain = portfolioBaseDomain();
  if (baseDomain) {
    return `https://${slug}.${baseDomain}`;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/w/${slug}`;
}

export type PortfolioUrlParts = {
  mode: "subdomain" | "path";
  /** Text shown before the editable slug input (empty string when not applicable). */
  prefix: string;
  slug: string;
  /** Text shown after the editable slug input (empty string when not applicable). */
  suffix: string;
  /** Full resolved URL (same as portfolioPublicUrl). */
  full: string;
};

export function portfolioUrlParts(slug: string): PortfolioUrlParts {
  const baseDomain = portfolioBaseDomain();
  if (baseDomain) {
    return {
      mode: "subdomain",
      prefix: "",
      slug,
      suffix: `.${baseDomain}`,
      full: `https://${slug}.${baseDomain}`,
    };
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    mode: "path",
    prefix: `${appUrl}/w/`,
    slug,
    suffix: "",
    full: `${appUrl}/w/${slug}`,
  };
}
