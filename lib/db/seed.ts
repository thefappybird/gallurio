/**
 * Development seed script.
 *
 * Usage:
 *   pnpm seed
 *
 * This script hard-resets the CURRENT development database, recreates indexes,
 * then seeds two real-login owners:
 *
 * - `SEED_OWNER_*` -> the main demo workspace with healthy dashboard, bookings,
 *   inquiries, teams, and a published minimal portfolio.
 * - `SUB_EXPIRED_*` -> a gated owner on a free workspace whose paid
 *   subscription has already expired.
 *
 * Required env vars:
 *   SEED_OWNER_WORKOS_USER_ID
 *   SEED_OWNER_EMAIL
 *   SEED_OWNER_PASSWORD
 *   SUB_EXPIRED_WORKOS_USER_ID
 *   SUB_EXPIRED_WORKOS_EMAIL
 *   SUB_EXPIRED_WORKOS_PASSWORD
 *
 * Optional env vars:
 *   SEED_OWNER_NAME
 *   SUB_EXPIRED_WORKOS_NAME
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { connectDB } from "./mongoose";
import {
  Workspace,
  User,
  Client,
  Booking,
  Inquiry,
  GalleryCollection,
  GalleryItem,
  Transaction,
  ActivityLog,
  Team,
  TeamMembership,
  TEAM_COLOR_PALETTE,
  PortfolioDraft,
  PageviewRollup,
  PromoCode,
  Invitation,
} from "./models";
import { Notification } from "./models/Notification";
import { buildSeedGalleryItem } from "./seedGalleryItem";
import { recordBookingForClient } from "./clientTransactions";
import {
  buildExpiredSubscriptionState,
  buildPortfolioPageviewFixtures,
  readExpiredSeedOwner,
  readSeedOwner,
  PROMO_CODE_SEEDS,
  type SeedIdentity,
} from "./seed-fixtures";
import { getTemplate } from "@/lib/page-builder/templates";

type SessionRange = { startAt: Date; endAt: Date };
type TeamRef = { _id: mongoose.Types.ObjectId; name: string; color: string };
type ClientRef = { _id: mongoose.Types.ObjectId; name: string; email: string | null; phone: string | null };

const MAIN_WORKSPACE = {
  slug: "seed-owner-demo",
  name: "North Star Stories",
  businessType: "photographer" as const,
  country: "PH",
  currency: "PHP",
  timezone: "Asia/Manila",
};

const EXPIRED_WORKSPACE = {
  slug: "expired-sub-demo",
  name: "Archive House Studio",
  businessType: "photographer" as const,
  country: "PH",
  currency: "PHP",
  timezone: "Asia/Manila",
};

const TEAM_NAMES = [
  "Main",
  "Wedding North",
  "Wedding South",
  "Studio",
  "Portraits",
  "Corporate",
  "Weekend Crew",
  "Films",
  "Luxury Events",
  "After Dark",
  "Travel Unit",
  "Brand Shoots",
] as const;

// The final team deliberately remains inactive. It gives the Teams screen an
// archival state to show without taking away the active teams used by the
// bookings and dashboard screenshots.
const INACTIVE_TEAM_NAME = "After Dark";

const DUMMY_MEMBER_NAMES = [
  "Paolo Villanueva",
  "Bianca Ramos",
  "Miguel Dela Cruz",
  "Andrea Lim",
  "Rafael Bautista",
  "Kristine Ocampo",
  "Joaquin Reyes",
  "Therese Aguilar",
  "Enzo Panganiban",
  "Danica Salvador",
  "Lorenzo Mercado",
  "Patricia Sy",
  "Gabriel Alcantara",
  "Maria Isabel Yulo",
  "Nathaniel Uy",
  "Camille Estrada",
  "Julian Tiongson",
  "Reina Macaraeg",
  "Christian Bernardo",
  "Alexa Buenaventura",
];

const CLIENT_SEEDS = [
  ["Isabelle & Marco Rivera", "isabelle.rivera@gmail.com", "+63 917 428 6013", "VIP"],
  ["Katrina Soriano", "katrina.soriano@gmail.com", "+63 928 310 4477", "repeat"],
  ["Jomar Cabrera", "jomar.cabrera@outlook.com", "+63 915 776 2208", "corporate"],
  ["Maya Tanjuatco", "maya.tanjuatco@gmail.com", "+63 906 553 8891", "portrait"],
  ["Olivia Delos Santos", "olivia.dls@gmail.com", "+63 977 214 6650", "wedding"],
  ["Diego Alonzo", "diego.alonzo@yahoo.com", "+63 918 902 3374", "referral"],
  ["Arianne Bolisay", "arianne.bolisay@gmail.com", "+63 939 641 7702", "editorial"],
  ["Northline Events Co.", "events@northline.ph", "+63 2 8541 9930", "b2b"],
  ["Hannah Villamor", "hannah.villamor@gmail.com", "+63 995 118 4426", "family"],
  ["Marcus Tanchanco", "marcus.tanchanco@gmail.com", "+63 917 660 5518", "venue"],
  ["Mia Serrano", "mia.serrano@gmail.com", "+63 926 447 9081", "brand"],
  ["Evergreen Hotels Manila", "weddings@evergreenhotels.ph", "+63 2 8823 7714", "hotel"],
  ["Sofia Regalado", "sofia.regalado@gmail.com", "+63 947 205 3369", "elopement"],
  ["Noel Bautista", "noel.bautista@gmail.com", "+63 916 872 4405", "repeat"],
  ["Camila Hipolito", "camila.hipolito@gmail.com", "+63 908 337 1192", "referral"],
  ["Summit Peak Coffee", "marketing@summitpeak.ph", "+63 2 8776 2240", "campaign"],
] as const;

// Realistic inbound-lead identities so the inquiry inbox reads like real
// traffic instead of numbered placeholders.
const LEAD_SEEDS = [
  ["Angelica Fajardo", "angelica.fajardo@gmail.com", "+63 917 331 8802"],
  ["Renz Dimaculangan", "renz.dima@gmail.com", "+63 928 774 1195"],
  ["Trisha Ynares", "trisha.ynares@gmail.com", "+63 906 208 6637"],
  ["Kevin Ang", "kevin.ang@outlook.com", "+63 915 540 9923"],
  ["Michelle Lacsamana", "michelle.lacsamana@gmail.com", "+63 977 862 3318"],
  ["Aldrin Poblete", "aldrin.poblete@gmail.com", "+63 939 117 5560"],
  ["Nicole Rustia", "nicole.rustia@gmail.com", "+63 995 623 7741"],
  ["Francis Gutierrez", "francis.gutierrez@yahoo.com", "+63 918 445 2276"],
  ["Jasmine Villaruel", "jasmine.villaruel@gmail.com", "+63 947 738 9014"],
  ["Carlo Maranan", "carlo.maranan@gmail.com", "+63 926 951 3387"],
  ["Denise Tolentino", "denise.tolentino@gmail.com", "+63 908 264 7752"],
  ["Ryan Escalona", "ryan.escalona@gmail.com", "+63 916 583 1108"],
  ["Pauline Sarmiento", "pauline.sarmiento@gmail.com", "+63 995 476 2295"],
  ["Emman Castañeda", "emman.castaneda@gmail.com", "+63 917 809 6634"],
] as const;

const VENUES = [
  "Blue Leaf Cosmopolitan, Quezon City",
  "The Peninsula Manila, Makati",
  "Fernwood Gardens, Quezon City",
  "Shangri-La The Fort, Taguig",
  "Hillcreek Gardens, Tagaytay",
  "Manila Hotel, Ermita",
  "Glass Garden, Pasig",
  "Marco Polo Ortigas, Pasig",
  "Casa Real de Malolos, Bulacan",
  "Whitespace Manila, Makati",
  "Sofitel Philippine Plaza, Pasay",
  "Alta Veranda de Tibig, Batangas",
  "The Glasshouse at Enderun, Taguig",
  "Balesin Island Club, Quezon",
] as const;

const EVENT_TYPES = [
  "wedding",
  "corporate",
  "portrait",
  "engagement",
  "anniversary",
  "other",
] as const;

// Both seeded workspaces run on Asia/Manila (UTC+8, no DST). Session instants
// are built from Manila wall-clock rather than the seeding machine's local
// timezone, because the app enforces "a session starts and ends on one calendar
// day in the WORKSPACE timezone" (sessionsAreSameDayInTz). Building them from
// machine-local time on any non-Manila box silently pushed sessions across
// Manila midnight, which the calendar then splits into an evening-head plus a
// morning-continuation candle and refuses to drag.
const WORKSPACE_TZ = "Asia/Manila";
const MANILA_UTC_OFFSET_HOURS = 8;

// Sessions are kept inside these Manila hours so they never cross midnight in
// Manila (the workspace day) or in UTC (the storage day).
const EARLIEST_START_HOUR = 8;
const LATEST_END_HOUR = 21;

const manilaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: WORKSPACE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const manilaTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: WORKSPACE_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function dayOffset(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/** Instant for a Manila wall-clock date and time. Date.UTC normalizes overflow. */
function manilaWallClock(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - MANILA_UTC_OFFSET_HOURS, minute, 0, 0));
}

function manilaToday(): [number, number, number] {
  const [year, month, day] = manilaDateFormatter.format(new Date()).split("-").map(Number);
  return [year!, month!, day!];
}

function dateAt(dayDelta: number, hour: number, minute: number, durationHours: number): SessionRange {
  const [year, month, day] = manilaToday();
  const startAt = manilaWallClock(year, month, day + dayDelta, hour, minute);
  const endAt = new Date(startAt.getTime() + durationHours * 3_600_000);
  // Fail the seed rather than write a session the app itself would reject.
  if (manilaDateFormatter.format(startAt) !== manilaDateFormatter.format(endAt)) {
    throw new Error(
      `Seed built a session crossing Manila midnight: ${startAt.toISOString()} -> ${endAt.toISOString()} ` +
        `(${hour}:00 + ${durationHours}h). Keep sessions within ${EARLIEST_START_HOUR}:00-${LATEST_END_HOUR}:00 Manila.`
    );
  }
  return { startAt, endAt };
}

/** The Manila calendar date of an instant, as `YYYY-MM-DD`. */
function isoDateLocal(date: Date): string {
  return manilaDateFormatter.format(date);
}

function buildPayments(
  firstSessionStart: Date,
  total: number,
  deposit: number,
  status: "booked" | "completed" | "cancelled"
) {
  const depositCreatedAt = new Date(firstSessionStart);
  depositCreatedAt.setDate(depositCreatedAt.getDate() - 21);
  const balanceCreatedAt = new Date(firstSessionStart);
  balanceCreatedAt.setDate(balanceCreatedAt.getDate() - 7);
  const balance = Math.max(total - deposit, 0);

  return [
    {
      price: deposit,
      status: "paid" as const,
      createdAt: depositCreatedAt,
      paidAt: depositCreatedAt,
      title: "Reservation deposit",
    },
    {
      price: balance,
      status: status === "completed" ? ("paid" as const) : ("unpaid" as const),
      createdAt: balanceCreatedAt,
      paidAt: status === "completed" ? balanceCreatedAt : null,
      title: status === "cancelled" ? "Cancelled balance" : "Final balance",
    },
  ];
}

function firstAndLastSession(sessions: SessionRange[]) {
  const starts = sessions.map((session) => session.startAt.getTime());
  const ends = sessions.map((session) => session.endAt.getTime());
  return {
    firstSessionStart: new Date(Math.min(...starts)),
    lastSessionEnd: new Date(Math.max(...ends)),
  };
}

function teamForIndex(teams: TeamRef[], index: number): TeamRef {
  return teams[index % teams.length]!;
}

function clientForIndex(clients: ClientRef[], index: number): ClientRef {
  return clients[index % clients.length]!;
}

function eventTypeForIndex(index: number) {
  return EVENT_TYPES[index % EVENT_TYPES.length]!;
}

async function wipeDatabase() {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB connection not ready");
  }
  await mongoose.connection.db.dropDatabase();
}

async function syncAllIndexes() {
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    await model.syncIndexes();
  }
}

async function createUser(identity: SeedIdentity, membership: {
  workspaceId: mongoose.Types.ObjectId;
  role: "owner" | "staff";
  lastAccessedAt: Date | null;
}) {
  return User.create({
    workosUserId: identity.workosUserId,
    email: identity.email,
    name: identity.name,
    memberships: [membership],
    onboardingStep: "done",
    onboardingCompletedAt: new Date(),
    timeFormat: "12h",
  });
}

async function createMainWorkspace(owner: SeedIdentity) {
  const now = new Date();
  const workspace = await Workspace.create({
    slug: MAIN_WORKSPACE.slug,
    name: MAIN_WORKSPACE.name,
    ownerUserId: owner.workosUserId,
    businessType: MAIN_WORKSPACE.businessType,
    country: MAIN_WORKSPACE.country,
    currency: MAIN_WORKSPACE.currency,
    timezone: MAIN_WORKSPACE.timezone,
    contact: {
      email: owner.email,
      phone: "+63 917 000 4242",
      address: "Level 8, 111 Paseo de Roxas, Makati, Metro Manila",
      socials: {
        instagram: "https://instagram.com/northstarstories",
        facebook: "https://facebook.com/northstarstories",
        website: "https://northstarstories.example.com",
      },
    },
    plan: "pro",
    everSubscribed: true,
    lsSubscriptionId: "seed_owner_active_subscription",
    lsCustomerId: "seed_owner_customer",
    lsSubscriptionStatus: "active",
    lsCurrentPeriodEnd: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
    onboardingCompletedAt: now,
  });

  await createUser(owner, {
    workspaceId: workspace._id,
    role: "owner",
    lastAccessedAt: now,
  });

  return workspace;
}

async function createExpiredWorkspace(owner: SeedIdentity) {
  const now = new Date();
  const billingState = buildExpiredSubscriptionState(now);

  const workspace = await Workspace.create({
    slug: EXPIRED_WORKSPACE.slug,
    name: EXPIRED_WORKSPACE.name,
    ownerUserId: owner.workosUserId,
    businessType: EXPIRED_WORKSPACE.businessType,
    country: EXPIRED_WORKSPACE.country,
    currency: EXPIRED_WORKSPACE.currency,
    timezone: EXPIRED_WORKSPACE.timezone,
    onboardingCompletedAt: now,
    ...billingState,
  });

  await createUser(owner, {
    workspaceId: workspace._id,
    role: "owner",
    lastAccessedAt: now,
  });

  const team = await Team.create({
    workspaceId: workspace._id,
    name: "Main",
    color: TEAM_COLOR_PALETTE[0]!,
    isDefault: true,
    isActive: true,
    memberCount: 1,
    createdByWorkosUserId: owner.workosUserId,
  });

  await TeamMembership.create({
    workspaceId: workspace._id,
    teamId: team._id,
    workosUserId: owner.workosUserId,
    role: "lead",
  });

  return workspace;
}

async function createTeamsAndMembers(
  workspaceId: mongoose.Types.ObjectId,
  owner: SeedIdentity
): Promise<TeamRef[]> {
  const teams = await Team.insertMany(
    TEAM_NAMES.map((name, index) => ({
      workspaceId,
      name,
      color: TEAM_COLOR_PALETTE[index % TEAM_COLOR_PALETTE.length]!,
      isDefault: index === 0,
      isActive: name !== INACTIVE_TEAM_NAME,
      memberCount: 0,
      createdByWorkosUserId: owner.workosUserId,
    }))
  );

  const users = await User.insertMany(
    DUMMY_MEMBER_NAMES.map((name, index) => ({
      workosUserId: `seed_dummy_member_${String(index + 1).padStart(2, "0")}`,
      email: `seed-member-${String(index + 1).padStart(2, "0")}@example.com`,
      name,
      avatarUrl: `https://i.pravatar.cc/160?img=${(index % 70) + 1}`,
      memberships: [{ workspaceId, role: "staff", lastAccessedAt: null }],
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      timeFormat: index % 2 === 0 ? "12h" : "24h",
    }))
  );

  const membershipMap = new Map<string, { teamId: mongoose.Types.ObjectId; workosUserId: string; role: "member" | "lead" }>();
  const teamMemberCounts = new Map<string, number>();

  function addMembership(teamId: mongoose.Types.ObjectId, workosUserId: string, role: "member" | "lead") {
    const key = `${teamId.toString()}::${workosUserId}`;
    if (membershipMap.has(key)) return;
    membershipMap.set(key, { teamId, workosUserId, role });
    teamMemberCounts.set(teamId.toString(), (teamMemberCounts.get(teamId.toString()) ?? 0) + 1);
  }

  addMembership(teams[0]!._id, owner.workosUserId, "lead");

  for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
    const team = teams[teamIndex]!;
    const leadUser = users[teamIndex % users.length]!;
    addMembership(team._id, leadUser.workosUserId, "lead");

    const memberOne = users[(teamIndex + 5) % users.length]!;
    const memberTwo = users[(teamIndex + 9) % users.length]!;
    addMembership(team._id, memberOne.workosUserId, "member");
    addMembership(team._id, memberTwo.workosUserId, "member");

    if (teamIndex % 2 === 0) {
      const crossMember = users[(teamIndex + 13) % users.length]!;
      addMembership(team._id, crossMember.workosUserId, "member");
    }
  }

  await TeamMembership.insertMany([...membershipMap.values()].map((row) => ({
    workspaceId,
    ...row,
  })));

  await Promise.all(
    teams.map((team) =>
      Team.updateOne(
        { _id: team._id },
        { $set: { memberCount: teamMemberCounts.get(team._id.toString()) ?? 0 } }
      )
    )
  );

  return teams.map((team) => ({
    _id: team._id,
    name: team.name,
    color: team.color,
  }));
}

async function createClients(workspaceId: mongoose.Types.ObjectId): Promise<ClientRef[]> {
  const clients = await Client.insertMany(
    CLIENT_SEEDS.map(([name, email, phone, tag], index) => ({
      workspaceId,
      name,
      email,
      phone,
      tags: [tag],
      source: index % 3 === 0 ? "form" : index % 3 === 1 ? "manual" : "referral",
      totalSpent: 18_000 + index * 7_500,
      lastBookingAt: dayOffset(-(index + 2)),
      bookingsCount: 1 + (index % 4),
      notes:
        index % 2 === 0
          ? "Prefers quick approvals and evening touchpoints."
          : "Open to upsell bundles when turnaround is clear.",
      lastPaymentAmount: 8_000 + index * 1_250,
      lastPaymentDate: dayOffset(-(index + 3)),
    }))
  );

  return clients.map((client) => ({
    _id: client._id,
    name: client.name,
    email: client.email ?? null,
    phone: client.phone ?? null,
  }));
}

async function createGalleryFixtures(workspaceId: mongoose.Types.ObjectId) {
  const collections = await GalleryCollection.insertMany([
    {
      workspaceId,
      name: "Weddings",
      slug: "weddings",
      isPublic: true,
      order: 0,
    },
    {
      workspaceId,
      name: "Editorial",
      slug: "editorial",
      isPublic: true,
      order: 1,
    },
    {
      workspaceId,
      name: "Celebrations",
      slug: "celebrations",
      isPublic: true,
      order: 2,
    },
  ]);

  const items = collections.flatMap((collection, collectionIndex) =>
    Array.from({ length: 10 }, (_, itemIndex) =>
      buildSeedGalleryItem({
        workspaceId,
        collectionId: collection._id,
        assetId: `seed-${workspaceId}-${collection.slug}-${itemIndex + 1}`,
        url: `https://picsum.photos/seed/${collection.slug}-${itemIndex + 1}/1600/1067`,
        width: 1600,
        height: 1067,
        format: "jpg",
        sizeBytes: 280_000,
        caption: `${collection.name} sample ${itemIndex + 1}`,
        altText: `${collection.name} sample ${itemIndex + 1}`,
        order: collectionIndex * 10 + itemIndex,
      })
    )
  );

  await GalleryItem.insertMany(items);
}

async function createPublishedPortfolio(workspace: {
  _id: mongoose.Types.ObjectId;
  name: string;
}) {
  // Use a current, content-rich template for the marketing screenshots. The
  // secondary drafts let the refreshed drafts dialog and template switcher
  // demonstrate real versioning rather than a single empty state.
  const editorialTemplate = getTemplate("editorial");
  const boldTemplate = getTemplate("bold");
  const minimalTemplate = getTemplate("minimal");
  if (!editorialTemplate || !boldTemplate || !minimalTemplate) {
    throw new Error("Required portfolio templates not found");
  }

  const seed = editorialTemplate.seedData({ workspace: { name: workspace.name } });
  const publishedAt = new Date();

  const draftMetadata = {
    seoTitle: `${workspace.name} | Event Photography Portfolio`,
    seoDescription: "Documentary wedding, portrait, and brand photography in Metro Manila.",
    seo: {
      keywords: ["wedding photographer", "metro manila", "editorial portraits"],
      galleryDescription: "Selected work across weddings, portraits, and live events.",
      noindex: false,
    },
  };

  await PortfolioDraft.insertMany([
    {
      workspaceId: workspace._id,
      name: "Minimal Launch Layout",
      templateId: minimalTemplate.id,
      data: minimalTemplate.seedData({ workspace: { name: workspace.name } }),
      brandKit: minimalTemplate.defaultBrandKit,
      contact: minimalTemplate.defaultContact,
      header: minimalTemplate.defaultHeader,
      collectionsPopup: minimalTemplate.defaultCollectionsPopup,
      ...draftMetadata,
      createdAt: dayOffset(-9),
      updatedAt: dayOffset(-9),
    },
    {
      workspaceId: workspace._id,
      name: "Bold Campaign Concept",
      templateId: boldTemplate.id,
      data: boldTemplate.seedData({ workspace: { name: workspace.name } }),
      brandKit: boldTemplate.defaultBrandKit,
      contact: boldTemplate.defaultContact,
      header: boldTemplate.defaultHeader,
      collectionsPopup: boldTemplate.defaultCollectionsPopup,
      ...draftMetadata,
      createdAt: dayOffset(-4),
      updatedAt: dayOffset(-4),
    },
    {
      workspaceId: workspace._id,
      name: "Editorial Summer Refresh",
      templateId: editorialTemplate.id,
      data: seed,
      brandKit: editorialTemplate.defaultBrandKit,
      contact: editorialTemplate.defaultContact,
      header: editorialTemplate.defaultHeader,
      collectionsPopup: editorialTemplate.defaultCollectionsPopup,
      ...draftMetadata,
      createdAt: dayOffset(-1),
      updatedAt: dayOffset(-1),
    },
  ]);

  await Workspace.updateOne(
    { _id: workspace._id },
    {
      $set: {
        publicPage: {
          templateId: editorialTemplate.id,
          data: seed,
          brandKit: editorialTemplate.defaultBrandKit,
          contact: editorialTemplate.defaultContact,
          header: editorialTemplate.defaultHeader,
          collectionsPopup: editorialTemplate.defaultCollectionsPopup,
          seoTitle: `${workspace.name} | Event Photography Portfolio`,
          seoDescription: "Documentary wedding, portrait, and brand photography in Metro Manila.",
          inquiryRecipientEmail: "hello@northstarstories.example.com",
          publishedAt,
          lastPublishedAt: publishedAt,
          latestVersion: 1,
          guideDismissedAt: publishedAt,
          storyPromptCompletedAt: publishedAt,
          formLocale: "en",
          formDir: "",
          siteIcon: {
            url: "https://picsum.photos/seed/site-icon/256/256",
            assetId: "seed-site-icon",
          },
          seo: {
            keywords: ["wedding photographer", "metro manila", "editorial portraits"],
            ogImageUrl: "https://picsum.photos/seed/og-image/1200/630",
            ogImageAssetId: "seed-og-image",
            galleryDescription: "Selected work across weddings, portraits, and live events.",
            noindex: false,
          },
          settingsDraft: {
            seoTitle: `${workspace.name} | Event Photography Portfolio`,
            seoDescription: "Documentary wedding, portrait, and brand photography in Metro Manila.",
            siteIcon: {
              url: "https://picsum.photos/seed/site-icon/256/256",
              assetId: "seed-site-icon",
            },
            seo: {
              keywords: ["wedding photographer", "metro manila", "editorial portraits"],
              ogImageUrl: "https://picsum.photos/seed/og-image/1200/630",
              ogImageAssetId: "seed-og-image",
              galleryDescription: "Selected work across weddings, portraits, and live events.",
              noindex: false,
            },
          },
        },
      },
    }
  );
}

async function createBookingsAndTransactions(
  workspace: {
    _id: mongoose.Types.ObjectId;
    currency: string;
  },
  owner: SeedIdentity,
  teams: TeamRef[],
  clients: ClientRef[]
) {
  const featured = [
    {
      team: teams[0]!,
      client: clients[0]!,
      title: "Isabelle & Marco Rivera - Editorial wedding coverage",
      eventType: "wedding",
      status: "booked" as const,
      sessions: [dateAt(0, 11, 0, 5)],
      total: 128_000,
      deposit: 48_000,
      location: "Makati Shangri-La Ballroom, Makati",
      notes: "Second shooter arrives 90 minutes early for prep and detail coverage.",
    },
    {
      team: teams[1]!,
      client: clients[1]!,
      title: "Katrina Soriano - Engagement session",
      eventType: "engagement",
      status: "booked" as const,
      sessions: [dateAt(2, 15, 30, 3)],
      total: 32_000,
      deposit: 12_000,
      location: "Pinto Art Museum, Antipolo",
      notes: "Golden-hour outdoor portraits plus 30-minute indoor backup plan.",
    },
    {
      team: teams[2]!,
      client: clients[7]!,
      title: "Northline Events Co. - Leadership summit day one",
      eventType: "corporate",
      status: "booked" as const,
      sessions: [dateAt(4, 9, 0, 8), dateAt(5, 9, 0, 7)],
      total: 94_000,
      deposit: 35_000,
      location: "The Peninsula Manila, Makati",
      notes: "Need fast same-day selects for the keynote screen.",
    },
    {
      team: teams[4]!,
      client: clients[4]!,
      title: "Olivia Delos Santos - Bridal editorial",
      eventType: "portrait",
      status: "booked" as const,
      sessions: [dateAt(7, 13, 0, 4)],
      total: 28_000,
      deposit: 10_000,
      location: "BGC studio loft, Taguig",
      notes: "White seamless setup plus window-light portraits.",
    },
    {
      team: teams[5]!,
      client: clients[5]!,
      title: "Diego Alonzo - Anniversary film stills",
      eventType: "anniversary",
      status: "completed" as const,
      sessions: [dateAt(-4, 16, 0, 4)],
      total: 42_000,
      deposit: 14_000,
      location: "The Rooftop at Solaire, Paranaque",
      notes: "Client requested a strong blue-hour set before dinner.",
    },
    {
      team: teams[6]!,
      client: clients[6]!,
      title: "Arianne Bolisay - Brand relaunch portraits",
      eventType: "corporate",
      status: "completed" as const,
      sessions: [dateAt(-12, 10, 0, 6)],
      total: 58_000,
      deposit: 20_000,
      location: "Whitespace Manila, Makati",
      notes: "Deliver hero selects first for the campaign deck.",
    },
  ];

  // Fill the calendar and the dashboard's trailing 52-week heatmap with a
  // believable operating rhythm: every day carries work, with repeated
  // weekdays producing two or three sessions on the busiest days. Rotating the
  // patterns prevents a synthetic stripe while keeping weekends visibly
  // busier for marketing screenshots.
  const weeklyBookingPatterns = [
    [0, 1, 2, 3, 4, 5, 5, 6, 6], // heavy weekend
    [0, 0, 1, 2, 3, 3, 4, 5, 6], // heavy Mon/Thu
    [0, 1, 1, 2, 3, 4, 4, 5, 6, 6], // midweek doubles
    [0, 1, 2, 2, 3, 4, 5, 5, 6], // Wed/Sat doubles
  ] as const;
  const generated = Array.from({ length: 64 }, (_, weekIndex) => {
    const weekdays = weeklyBookingPatterns[weekIndex % weeklyBookingPatterns.length]!;

    return weekdays.map((weekdayOffset, bookingInWeek) => {
      const index = weekIndex * 10 + bookingInWeek;
      const team = teamForIndex(teams, index + 3);
      const client = clientForIndex(clients, index + 2);
      const status =
        index % 11 === 0
          ? ("cancelled" as const)
          : index % 4 === 0
            ? ("completed" as const)
            : ("booked" as const);
      // Starts 52 weeks ago, with enough forward bookings to keep the calendar
      // and upcoming-work cards full after a reseed.
      const dayDelta = -364 + weekIndex * 7 + weekdayOffset;
      // Session lengths span short portrait sittings to full wedding days so
      // the dashboard heatmap's hours-per-day buckets all get used instead of
      // clustering in the middle two. Start is pulled back far enough that a
      // long session still ends the same day.
      const duration = 2 + (index % 9);
      const startHour = Math.min(
        EARLIEST_START_HOUR + ((index + weekdayOffset) % 8),
        LATEST_END_HOUR - duration
      );
      // Bounded so a year of bookings stays in a realistic PHP package range
      // instead of drifting into seven figures as the index grows.
      const total = 24_000 + (index % 13) * 6_500;
      const deposit = Math.floor(total * 0.35);

      return {
        team,
        client,
        title: `${client.name} - ${eventTypeForIndex(index + 3)} coverage`,
        eventType: eventTypeForIndex(index + 3),
        status,
        sessions: [dateAt(dayDelta, startHour, 0, duration)],
        total,
        deposit,
        location: VENUES[index % VENUES.length]!,
        notes:
          status === "cancelled"
            ? "Client postponed after venue availability changed."
            : "Keep a fast-turnaround teaser set in the first delivery batch.",
      };
    });
  }).flat();

  const allSpecs = [...featured, ...generated];

  const bookings = await Booking.insertMany(
    allSpecs.map((spec, index) => {
      const { firstSessionStart, lastSessionEnd } = firstAndLastSession(spec.sessions);
      return {
        workspaceId: workspace._id,
        teamId: spec.team._id,
        clientId: spec.client._id,
        clientName: spec.client.name,
        title: spec.title,
        eventType: spec.eventType,
        status: spec.status,
        sessions: spec.sessions,
        firstSessionStart,
        lastSessionEnd,
        location: {
          label: spec.location.split(",")[0],
          address: spec.location,
        },
        amount: {
          total: spec.total,
          deposit: spec.deposit,
          currency: workspace.currency,
        },
        payments: buildPayments(firstSessionStart, spec.total, spec.deposit, spec.status),
        invoiceNumber: `INV-${String(index + 1).padStart(4, "0")}`,
        notes: spec.notes,
        customFields: {
          deliveryWindow: spec.status === "completed" ? "7 days" : "14 days",
          shotListReady: index % 3 === 0,
        },
      };
    })
  );

  for (const booking of bookings) {
    await recordBookingForClient({
      workspaceId: workspace._id,
      clientId: booking.clientId,
      booking: {
        _id: booking._id,
        amount: booking.amount,
        firstSessionStart: booking.firstSessionStart,
        teamId: booking.teamId,
      },
      source: "seed",
    });
  }

  const supplementalTransactions = bookings.flatMap((booking, index) => {
    const paidAt = new Date(booking.firstSessionStart);
    paidAt.setDate(paidAt.getDate() - 2);
    const balance = Math.max((booking.amount?.total ?? 0) - (booking.amount?.deposit ?? 0), 0);
    const rows: Array<Record<string, unknown>> = [];

    if (booking.status === "completed" && balance > 0) {
      rows.push({
        workspaceId: workspace._id,
        bookingId: booking._id,
        teamId: booking.teamId,
        clientId: booking.clientId,
        amount: balance,
        currency: workspace.currency,
        type: "balance",
        method: index % 2 === 0 ? "transfer" : "cash",
        paidAt,
        notes: "Final balance settled in full.",
      });
    }

    if (booking.status === "completed" && index % 7 === 0) {
      rows.push({
        workspaceId: workspace._id,
        bookingId: booking._id,
        teamId: booking.teamId,
        clientId: booking.clientId,
        amount: -4_000,
        currency: workspace.currency,
        type: "refund",
        method: "transfer",
        paidAt: new Date(paidAt.getTime() + 24 * 60 * 60 * 1000),
        notes: "Travel fee adjustment refunded after venue moved closer.",
      });
    }

    return rows;
  });

  if (supplementalTransactions.length > 0) {
    await Transaction.insertMany(supplementalTransactions);
  }

  await ActivityLog.insertMany(
    bookings.slice(0, 18).map((booking, index) => ({
      workspaceId: workspace._id,
      actorUserId: owner.workosUserId,
      entity: "booking" as const,
      entityId: booking._id,
      action: index % 3 === 0 ? "created" : index % 3 === 1 ? "updated" : "status_changed",
      createdAt: dayOffset(-(index + 1)),
      meta: {
        title: booking.title,
        status: booking.status,
      },
    }))
  );

  return bookings;
}

async function createInquiries(
  workspace: {
    _id: mongoose.Types.ObjectId;
    currency: string;
  },
  teams: TeamRef[],
  owner: SeedIdentity
) {
  const leadClients = await Client.insertMany(
    LEAD_SEEDS.map(([name, email, phone]) => ({
      workspaceId: workspace._id,
      name,
      email,
      phone,
      source: "form",
      totalSpent: 0,
      bookingsCount: 0,
      notes: "Public portfolio inquiry lead.",
    }))
  );

  const conflictA = dateAt(0, 11, 0, 5);
  const conflictB = dateAt(4, 9, 0, 8);

  const inquirySpecs = Array.from({ length: 14 }, (_, index) => {
    const status =
      index < 6 ? "inquiry" : index < 10 ? "booked" : index < 12 ? "converted" : "archived";

    const baseSession =
      index === 0
        ? conflictA
        : index === 1
          ? conflictB
          : dateAt(9 + index * 2, 10 + (index % 5), 0, 2 + (index % 4));

    const eventDate = new Date(baseSession.startAt);
    return {
      status,
      client: leadClients[index]!,
      team: teamForIndex(teams, index + 1),
      title:
        status === "inquiry"
          ? "New portfolio inquiry"
          : status === "archived"
            ? "Archived lead follow-up"
            : "Approved inquiry booking",
      eventTitle: index % 2 === 0 ? "Garden celebration" : "Brand launch coverage",
      eventType: eventTypeForIndex(index + 1),
      guestCount: 30 + index * 12,
      location: {
        label: VENUES[index % VENUES.length]!.split(",")[0]!,
        address: VENUES[index % VENUES.length]!,
      },
      message:
        status === "archived"
          ? "Budget shifted for now, but keeping your package notes on file."
          : "Found the portfolio through Instagram and would love coverage details.",
      sessions: [
        {
          startDate: isoDateLocal(baseSession.startAt),
          startTime: manilaTimeFormatter.format(baseSession.startAt),
          endTime: manilaTimeFormatter.format(baseSession.endAt),
        },
      ],
      eventDate,
      createdAt: dayOffset(-(index + 1)),
      preferredContact: index % 2 === 0 ? "email" : "phone",
      budgetRange: index % 3 === 0 ? "50-100k" : index % 3 === 1 ? "100-250k" : "under 50k",
      source: {
        kind: "portfolio",
        utm_source: index % 2 === 0 ? "instagram" : "google",
        utm_medium: index % 2 === 0 ? "social" : "search",
        utm_campaign: index % 4 === 0 ? "summer-showcase" : "evergreen-portfolio",
        referrer: index % 2 === 0 ? "https://instagram.com" : "https://google.com",
      },
    };
  });

  const relatedBookings: mongoose.Types.ObjectId[] = [];

  for (const [index, spec] of inquirySpecs.entries()) {
    const draftStatus = spec.status === "inquiry" ? "draft" : "booked";
    const sessions = spec.sessions.map((session) => {
      const [year, month, day] = session.startDate.split("-").map(Number);
      const [startHour, startMinute] = session.startTime.split(":").map(Number);
      const [endHour, endMinute] = session.endTime.split(":").map(Number);
      return {
        startAt: manilaWallClock(year!, month!, day!, startHour!, startMinute!),
        endAt: manilaWallClock(year!, month!, day!, endHour!, endMinute!),
      };
    });
    const { firstSessionStart, lastSessionEnd } = firstAndLastSession(sessions);

    const booking = await Booking.create({
      workspaceId: workspace._id,
      teamId: spec.team._id,
      clientId: spec.client._id,
      clientName: spec.client.name,
      title: `${spec.client.name} - ${spec.eventTitle}`,
      eventType: spec.eventType,
      status: draftStatus,
      sessions,
      firstSessionStart,
      lastSessionEnd,
      location: spec.location,
      amount: {
        total: draftStatus === "draft" ? 0 : 46_000 + index * 3_000,
        deposit: draftStatus === "draft" ? 0 : 16_000 + index * 1_000,
        currency: workspace.currency,
      },
      payments:
        draftStatus === "draft"
          ? []
          : buildPayments(firstSessionStart, 46_000 + index * 3_000, 16_000 + index * 1_000, "booked"),
      notes:
        draftStatus === "draft"
          ? "Draft booking seeded from inquiry for inbox testing."
          : "Converted inquiry booking for detail modal screenshots.",
      createdFromInquiryId: null,
    });

    relatedBookings.push(booking._id);
  }

  const inquiries = await Inquiry.insertMany(
    inquirySpecs.map((spec, index) => {
      const bookingId = relatedBookings[index]!;
      return {
        workspaceId: workspace._id,
        name: spec.client.name,
        email: spec.client.email,
        phone: spec.client.phone,
        preferredContact: spec.preferredContact,
        message: spec.message,
        sessions: spec.sessions,
        eventDate: spec.eventDate,
        eventTitle: spec.eventTitle,
        eventType: spec.eventType,
        guestCount: spec.guestCount,
        location: spec.location,
        budgetRange: spec.budgetRange,
        source: spec.source,
        status: spec.status,
        clientId: spec.client._id,
        draftBookingId: spec.status === "inquiry" ? bookingId : null,
        convertedClientId: spec.status === "booked" || spec.status === "converted" ? spec.client._id : null,
        convertedBookingId: spec.status === "booked" || spec.status === "converted" ? bookingId : null,
        createdAt: spec.createdAt,
        updatedAt: spec.status === "inquiry" ? spec.createdAt : new Date(spec.createdAt.getTime() + 86_400_000),
      };
    })
  );

  await Promise.all(
    inquiries.slice(0, 10).map((inquiry, index) =>
      ActivityLog.create({
        workspaceId: workspace._id,
        actorUserId: owner.workosUserId,
        entity: "inquiry",
        entityId: inquiry._id,
        action: index % 2 === 0 ? "created" : "status_changed",
        createdAt: new Date(inquiry.createdAt),
        meta: {
          status: inquiry.status,
          name: inquiry.name,
        },
      })
    )
  );
}

async function createPortfolioAnalytics(workspaceId: mongoose.Types.ObjectId) {
  // Six months makes the year/custom portfolio dashboard filters useful while
  // retaining enough recent daily detail for the default monthly charts.
  const fixtures = buildPortfolioPageviewFixtures(new Date(), 180);
  await PageviewRollup.insertMany(
    fixtures.map((fixture) => ({
      workspaceId,
      ...fixture,
    }))
  );
}

async function createNotifications(workspaceId: mongoose.Types.ObjectId, owner: SeedIdentity) {
  await Notification.insertMany([
    {
      workspaceId,
      recipientWorkosUserId: owner.workosUserId,
      triggeredByWorkosUserId: "system",
      type: "inquiry.created",
      entityType: "inquiry",
      entityId: new mongoose.Types.ObjectId(),
      title: "New portfolio inquiry",
      body: "A new inquiry came in from the public contact form.",
      href: "/inquiries",
      read: false,
      readAt: null,
      createdAt: dayOffset(-1),
    },
    {
      workspaceId,
      recipientWorkosUserId: owner.workosUserId,
      triggeredByWorkosUserId: "system",
      type: "booking.status_changed",
      entityType: "booking",
      entityId: new mongoose.Types.ObjectId(),
      title: "Booking updated",
      body: "A team updated the status of an upcoming booking.",
      href: "/bookings",
      read: true,
      readAt: dayOffset(-2),
      createdAt: dayOffset(-2),
    },
  ]);
}

async function createPendingInvitations(
  workspaceId: mongoose.Types.ObjectId,
  teams: TeamRef[],
  owner: SeedIdentity
) {
  await Invitation.insertMany([
    {
      workspaceId,
      email: "marina.lee@example.com",
      role: "staff",
      teamIds: [teams[1]!._id, teams[3]!._id],
      leadOnTeamIds: [teams[3]!._id],
      tokenHash: "a".repeat(64),
      invitedByWorkosUserId: owner.workosUserId,
      status: "pending",
      expiresAt: dayOffset(5),
      createdAt: dayOffset(-1),
      updatedAt: dayOffset(-1),
    },
    {
      workspaceId,
      email: "samir.khan@example.com",
      role: "staff",
      teamIds: [teams[2]!._id],
      leadOnTeamIds: [],
      tokenHash: "b".repeat(64),
      invitedByWorkosUserId: owner.workosUserId,
      status: "pending",
      expiresAt: dayOffset(10),
      createdAt: dayOffset(-2),
      updatedAt: dayOffset(-2),
    },
  ]);
}

async function seedMainWorkspace(owner: SeedIdentity) {
  const workspace = await createMainWorkspace(owner);
  const teams = await createTeamsAndMembers(workspace._id, owner);
  const clients = await createClients(workspace._id);

  await Promise.all([
    createGalleryFixtures(workspace._id),
    createPublishedPortfolio({ _id: workspace._id, name: workspace.name }),
  ]);

  await createBookingsAndTransactions(
    { _id: workspace._id, currency: workspace.currency },
    owner,
    teams,
    clients
  );
  await createInquiries({ _id: workspace._id, currency: workspace.currency }, teams, owner);
  await createPortfolioAnalytics(workspace._id);
  await createNotifications(workspace._id, owner);
  await createPendingInvitations(workspace._id, teams, owner);

  return workspace;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production");
  }

  const owner = readSeedOwner(process.env);
  const expiredOwner = readExpiredSeedOwner(process.env);

  console.log("-> Connecting to MongoDB");
  await connectDB();

  console.log("-> Wiping current development database");
  await wipeDatabase();

  console.log("-> Rebuilding indexes");
  await syncAllIndexes();

  console.log("-> Seeding main demo workspace");
  const mainWorkspace = await seedMainWorkspace(owner);

  console.log("-> Seeding expired subscription workspace");
  const expiredWorkspace = await createExpiredWorkspace(expiredOwner);

  console.log("-> Seeding promo codes");
  await PromoCode.insertMany(PROMO_CODE_SEEDS);

  console.log("");
  console.log("Seed complete.");
  console.log(`  Main owner       : ${owner.email}`);
  console.log(`  Main workspace   : ${mainWorkspace.slug}`);
  console.log(`  Expired owner    : ${expiredOwner.email}`);
  console.log(`  Expired workspace: ${expiredWorkspace.slug}`);
  console.log("  Notes            : owner workspace is active pro; expired workspace is gated free.");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore shutdown errors after a seed failure
  }
  process.exit(1);
});
