export type SeedIdentity = {
  workosUserId: string;
  email: string;
  name: string;
};

export type PromoCodeSeed = {
  title: string;
  code: string;
  type: "lifetime" | "yearly" | "monthly" | "beta";
  expiresAt: null;
};

export const PROMO_CODE_SEEDS: PromoCodeSeed[] = [
  { title: "Lifetime Pro", code: "LIFETIME2026", type: "lifetime", expiresAt: null },
  { title: "1 Year Pro", code: "YEARPRO2026", type: "yearly", expiresAt: null },
  { title: "1 Month Pro", code: "MONTHPRO2026", type: "monthly", expiresAt: null },
];

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
    lsCheckoutWorkflowRunId: null,
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
