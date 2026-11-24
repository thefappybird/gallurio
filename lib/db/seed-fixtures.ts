import type { PortfolioFontKey } from "@/lib/page-builder/fonts";
import type { BUSINESS_TYPE_VALUES } from "@/lib/validators/workspace";

export type SeedIdentity = {
  workosUserId: string;
  email: string;
  name: string;
};

export type PromoCodeSeed = {
  title: string;
  code: string;
  type: "lifetime" | "yearly" | "monthly" | "beta" | "beta2mo" | "demo1mo";
  expiresAt: null;
};

export const PROMO_CODE_SEEDS: PromoCodeSeed[] = [
  { title: "Lifetime Pro", code: "LIFETIME2026", type: "lifetime", expiresAt: null },
  { title: "1 Year Pro", code: "YEARPRO2026", type: "yearly", expiresAt: null },
  { title: "1 Month Pro", code: "MONTHPRO2026", type: "monthly", expiresAt: null },
  { title: "Beta thank-you: 2 months Pro", code: "BETA2PRO", type: "beta2mo", expiresAt: null },
  { title: "Portfolio Maker demo: 1 month Pro", code: "DEMOPRO2026", type: "demo1mo", expiresAt: null },
];

export type DiscoverSampleSeed = {
  slug: string;
  name: string;
  businessType: (typeof BUSINESS_TYPE_VALUES)[number];
  pitch: string;
  /** Which tile kind this listing exercises: og image, Home-image cover, or brand tile (no image). */
  image: "og" | "cover" | "none";
  coverWidth: number;
  coverHeight: number;
  brand: { background: string; foreground: string; accent: string; headingFont: PortfolioFontKey };
};

// Fictional listings for the dev-only Discover grid and banner (the banner needs
// 8 or more). Names, palettes and pitches come from docs/mockups/discover-browse.html;
// none is a real business. Fonts are mapped to the closest PORTFOLIO_FONTS key.
export const DISCOVER_SAMPLE_SEEDS: DiscoverSampleSeed[] = [
  { slug: "sample-marlowe-vale", name: "Marlowe & Vale", businessType: "photographer", image: "cover", coverWidth: 800, coverHeight: 1000, pitch: "Unhurried wedding and engagement photography across Cebu and the Visayas. Mostly natural light, a small team, delivered as an online gallery.", brand: { background: "#fff0d2", foreground: "#2f1f33", accent: "#d98e73", headingFont: "playfair" } },
  { slug: "sample-halden-studio", name: "Halden Studio", businessType: "artists", image: "none", coverWidth: 0, coverHeight: 0, pitch: "Brand identity and campaign photography for restaurants and independent shops.", brand: { background: "#1f3a34", foreground: "#f1efe6", accent: "#e0b873", headingFont: "fraunces" } },
  { slug: "sample-north-pier-films", name: "North Pier Films", businessType: "photographer", image: "og", coverWidth: 0, coverHeight: 0, pitch: "Wedding and event films shot on two cameras, with a short highlight cut and a full edit.", brand: { background: "#1d3544", foreground: "#e8f0f5", accent: "#f0c978", headingFont: "montserrat" } },
  { slug: "sample-tala-events", name: "Tala Events", businessType: "planner", image: "cover", coverWidth: 750, coverHeight: 900, pitch: "Full-service weddings and corporate events, from venue scouting to the last supplier out the door.", brand: { background: "#efd9c2", foreground: "#3b2a2a", accent: "#9a6a55", headingFont: "cormorant" } },
  { slug: "sample-oru-beauty", name: "Oru Beauty", businessType: "stylist", image: "none", coverWidth: 0, coverHeight: 0, pitch: "Bridal and editorial makeup, with trials at the studio or at your venue.", brand: { background: "#f1dfd9", foreground: "#3a1f26", accent: "#9c3f2c", headingFont: "cormorant" } },
  { slug: "sample-kabisera-catering", name: "Kabisera Catering", businessType: "catering", image: "cover", coverWidth: 900, coverHeight: 900, pitch: "Filipino and modern-fusion menus for weddings and parties of 30 to 300.", brand: { background: "#f4ead8", foreground: "#4a2b1d", accent: "#d6573a", headingFont: "fraunces" } },
  { slug: "sample-lumen-djs", name: "Lumen DJs", businessType: "entertainer", image: "og", coverWidth: 0, coverHeight: 0, pitch: "Wedding and private-event DJs with sound, lights and an MC if you want one.", brand: { background: "#2a2344", foreground: "#f3eefc", accent: "#ff9ec7", headingFont: "montserrat" } },
  { slug: "sample-sable-thread", name: "Sable & Thread", businessType: "stylist", image: "none", coverWidth: 0, coverHeight: 0, pitch: "Wardrobe and styling for shoots, brands and weddings.", brand: { background: "#121212", foreground: "#f3f1ec", accent: "#d2ae72", headingFont: "playfair" } },
  { slug: "sample-pinewake-photo", name: "Pinewake Photo", businessType: "photographer", image: "cover", coverWidth: 810, coverHeight: 1080, pitch: "Elopements and portraits in the Cordillera, planned around light and weather.", brand: { background: "#c8d8e6", foreground: "#1c2b3a", accent: "#4d6a86", headingFont: "inter" } },
  { slug: "sample-bloom-assembly", name: "Bloom Assembly", businessType: "planner", image: "cover", coverWidth: 800, coverHeight: 1000, pitch: "Garden weddings and intimate events, with floral design done in-house.", brand: { background: "#e9efdc", foreground: "#24402c", accent: "#5f8a5a", headingFont: "playfair" } },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function picsum(seed: string, width: number, height: number): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

/**
 * Workspace document for one sample: published, entitled (beta, no expiry),
 * renderable Home, `listedAt` staggered one day per index. Images reuse the
 * picsum.photos hotlinks the rest of the seed uses.
 */
export function buildDiscoverSampleWorkspace(sample: DiscoverSampleSeed, index: number, now: Date) {
  const listedAt = new Date(now.getTime() - index * DAY_MS);
  return {
    slug: sample.slug,
    name: sample.name,
    ownerUserId: `seed-discover-sample-${sample.slug}`,
    businessType: sample.businessType,
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    plan: "beta" as const,
    planGrantExpiresAt: null,
    onboardingCompletedAt: now,
    discover: {
      listed: true,
      listedAt,
      ...(sample.image === "cover"
        ? {
            coverUrl: picsum(sample.slug, sample.coverWidth, sample.coverHeight),
            coverAssetId: `seed-${sample.slug}-cover`,
            coverWidth: sample.coverWidth,
            coverHeight: sample.coverHeight,
          }
        : {}),
    },
    publicPage: {
      seoDescription: sample.pitch,
      publishedAt: listedAt,
      lastPublishedAt: listedAt,
      latestVersion: 1,
      brandKit: {
        headingFont: sample.brand.headingFont,
        bodyFont: sample.brand.headingFont,
        backgroundColor: sample.brand.background,
        foregroundColor: sample.brand.foreground,
        accentColor: sample.brand.accent,
        primaryColor: sample.brand.accent,
      },
      seo: {
        noindex: false,
        ...(sample.image === "og"
          ? { ogImageUrl: picsum(`${sample.slug}-og`, 1200, 630), ogImageAssetId: `seed-${sample.slug}-og` }
          : {}),
      },
      data: {
        home: {
          root: {},
          content: [
            { type: "Heading", props: { id: `${sample.slug}-heading`, text: sample.name } },
            {
              type: "GalleryGrid",
              props: {
                id: `${sample.slug}-grid`,
                images: [{ id: `${sample.slug}-1`, publicId: `seed-${sample.slug}-1`, alt: sample.name }],
              },
            },
          ],
        },
      },
    },
  };
}

export type SeedPageviewFixture = {
  date: Date;
  page: "home" | "gallery" | "contact" | "_site";
  views: number;
  visitors: number;
  inquiries: number;
  sources?: Record<string, number>;
};

function readRequiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required seed env var: ${key}`);
  }
  return value;
}

export function readSeedOwner(env: NodeJS.ProcessEnv): SeedIdentity {
  return {
    workosUserId: readRequiredEnv(env, "SEED_OWNER_WORKOS_USER_ID"),
    email: readRequiredEnv(env, "SEED_OWNER_EMAIL"),
    name: env.SEED_OWNER_NAME?.trim() || "Seed Owner",
  };
}

export function readExpiredSeedOwner(env: NodeJS.ProcessEnv): SeedIdentity {
  return {
    workosUserId: readRequiredEnv(env, "SUB_EXPIRED_WORKOS_USER_ID"),
    email: readRequiredEnv(env, "SUB_EXPIRED_WORKOS_EMAIL"),
    name: env.SUB_EXPIRED_WORKOS_NAME?.trim() || "Expired Subscription Owner",
  };
}

export function buildExpiredSubscriptionState(now: Date) {
  return {
    plan: "free" as const,
    everSubscribed: true,
    lsSubscriptionId: null,
    lsCustomerId: "seed_expired_customer",
    lsSubscriptionStatus: "canceled" as const,
    lsCurrentPeriodEnd: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
  };
}

export function buildPortfolioPageviewFixtures(referenceDate: Date, days = 35): SeedPageviewFixture[] {
  const fixtures: SeedPageviewFixture[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(referenceDate);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - i);

    const views = 120 + ((days - i) % 8) * 17 + (i % 3) * 11;
    const visitors = Math.max(42, Math.floor(views * 0.62));
    const inquiries = i % 6 === 0 ? 3 : i % 4 === 0 ? 2 : i % 2 === 0 ? 1 : 0;

    const homeViews = Math.floor(views * 0.48);
    const galleryViews = Math.floor(views * 0.34);
    const contactViews = views - homeViews - galleryViews;

    const homeVisitors = Math.max(16, Math.floor(visitors * 0.5));
    const galleryVisitors = Math.max(14, Math.floor(visitors * 0.33));
    const contactVisitors = Math.max(8, Math.floor(visitors * 0.17));

    fixtures.push({
      date,
      page: "_site",
      views,
      visitors,
      inquiries,
      sources: {
        instagram: Math.max(8, Math.floor(visitors * 0.31)),
        google: Math.max(6, Math.floor(visitors * 0.28)),
        direct: Math.max(5, Math.floor(visitors * 0.23)),
        referral: Math.max(4, Math.floor(visitors * 0.18)),
      },
    });
    fixtures.push({ date, page: "home", views: homeViews, visitors: homeVisitors, inquiries: 0 });
    fixtures.push({
      date,
      page: "gallery",
      views: galleryViews,
      visitors: galleryVisitors,
      inquiries: 0,
    });
    fixtures.push({
      date,
      page: "contact",
      views: contactViews,
      visitors: contactVisitors,
      inquiries: 0,
    });
  }

  return fixtures;
}
