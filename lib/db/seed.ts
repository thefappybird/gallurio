/**
 * Dev seed script — populates the DB with two demo workspaces and fixture data.
 *
 * Usage:  pnpm seed
 *
 * WARNING: this drops the tenant-scoped collections (workspaces, users, clients,
 * bookings, inquiries, gallery_collections, gallery_items, transactions, activity_logs).
 * Never run against production.
 *
 * By default the two seeded workspaces use placeholder workosUserId values
 * (user_demo_*). For a one-step reset you can sign in as them: set
 * SEED_OWNER_WORKOS_USER_ID (your real WorkOS user_... id) in .env.local and
 * both demo workspaces are owned by you, so AuthKit sign-in lands straight in a
 * populated workspace. Optional: SEED_OWNER_EMAIL, SEED_OWNER_NAME.
 *
 * Fixtures are deterministic — a seeded PRNG (mulberry32) means re-running gives
 * identical data, which keeps screenshots and dashboard widgets stable.
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
  TEAM_COLOR_PALETTE,
} from "./models";
import { recordBookingForClient } from "./clientTransactions";
import type { BookingStatus } from "@/lib/validators/booking";

const DEMO_WORKSPACES = [
  {
    slug: "sarah-bell-photo",
    name: "Sarah Bell Photography",
    businessType: "photographer" as const,
    ownerUserId: "user_demo_sarah",
    ownerEmail: "sarah@example.com",
    ownerName: "Sarah Bell",
    primaryColor: "#1a1a1a",
  },
  {
    slug: "rosewood-venue",
    name: "Rosewood Venue",
    businessType: "venue" as const,
    ownerUserId: "user_demo_rosewood",
    ownerEmail: "owner@rosewood.example",
    ownerName: "Marcus Hale",
    primaryColor: "#2d3b2a",
  },
];

const CLIENT_NAMES = [
  "Emma & Liam Carter",
  "Priya Shah",
  "Ana & Tomás Ribeiro",
  "Northwood Corp Events",
  "Jordan Patel",
  "Lena Okafor",
  "Maya Tanaka",
  "Diego & Sofia Vasquez",
  "Aiyana Cloud",
  "The Hendersons",
  "Olivia Park",
  "Westridge Holdings",
];

const EVENT_TYPES = ["wedding", "corporate", "portrait", "engagement", "anniversary", "other"];

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function dayOffset(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function dropTenantCollections() {
  const collections = await mongoose.connection.db?.collections();
  if (!collections) return;
  const tenantNames = [
    "workspaces",
    "users",
    "clients",
    "bookings",
    "inquiries",
    "gallerycollections",
    "galleryitems",
    "transactions",
    "activitylogs",
    "teams",
    "teammemberships",
    "invitations",
  ];
  for (const c of collections) {
    if (tenantNames.includes(c.collectionName)) {
      await c.deleteMany({});
    }
  }
}

async function seedWorkspace(
  w: (typeof DEMO_WORKSPACES)[number],
  seedNumber: number,
  ownerUserId: string
) {
  const now = new Date();
  const rand = mulberry32(0xc0ffee + seedNumber);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const range = (min: number, max: number) =>
    Math.floor(rand() * (max - min + 1)) + min;

  const workspace = await Workspace.create({
    slug: w.slug,
    name: w.name,
    ownerUserId,
    businessType: w.businessType,
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    branding: {
      primaryColor: w.primaryColor,
      secondaryColor: "#f5f5f5",
      tagline: w.businessType === "venue" ? "Historic venue in Metro Manila" : "Wedding storytelling",
      description: `${w.name} — sample seeded workspace.`,
    },
    publicPage: { templateId: "minimal" },
    plan: "starter",
    onboardingCompletedAt: now,
  });

  const mainTeam = await Team.create({
    workspaceId: workspace._id,
    name: "Main",
    color: TEAM_COLOR_PALETTE[0],
    isDefault: true,
    isActive: true,
    memberCount: 0,
    createdByWorkosUserId: ownerUserId,
  });

  // The owner User is created once in main() after all workspaces are seeded,
  // so a shared (env-driven) owner gets a single User doc with a membership for
  // every workspace instead of colliding on the unique workosUserId index.

  // 12 clients with varied totalSpent so "Top clients" has signal.
  const clients = await Client.insertMany(
    CLIENT_NAMES.map((name, i) => ({
      workspaceId: workspace._id,
      name,
      email: `${name.split(/\s+/)[0].toLowerCase()}@example.com`,
      phone: i % 3 === 0 ? null : `+63 917 555 ${String(1000 + i).padStart(4, "0")}`,
      source: pick(["form", "manual", "referral", "import"] as const),
      totalSpent: range(15, 350) * 1000,
      tags: i === 0 ? ["VIP"] : i % 5 === 0 ? ["repeat"] : [],
      lastBookingAt: dayOffset(-range(5, 180)),
    }))
  );

  // 25 bookings spread from -90 to +90 days. Guarantee at least 1 on today,
  // 2-3 in the next 7 days, and a healthy mix of statuses for the pipeline funnel.
  const bookingPayloads: Array<{
    workspaceId: mongoose.Types.ObjectId;
    teamId: mongoose.Types.ObjectId;
    clientId: mongoose.Types.ObjectId;
    clientName: string;
    title: string;
    eventType: string;
    status: BookingStatus;
    sessions: { startAt: Date; endAt: Date }[];
    firstSessionStart: Date;
    lastSessionEnd: Date;
    location: { address: string };
    amount: { total: number; deposit: number; currency: string };
  }> = [];

  // Realistic start/end time helper so calendar events render in the time
  // grid (not the all-day strip). 2–6 hours, business hours.
  const timedSlot = (dayDelta: number): { start: Date; end: Date } => {
    const start = new Date();
    start.setDate(start.getDate() + dayDelta);
    const startHour = range(9, 17); // 9am – 5pm start
    const durationHours = range(2, 6);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + durationHours);
    return { start, end };
  };

  // Today's event — guaranteed.
  const todaySlot = timedSlot(0);
  bookingPayloads.push({
    workspaceId: workspace._id,
    teamId: mainTeam._id,
    clientId: clients[0]._id,
    clientName: clients[0].name,
    title: `${clients[0].name.split("&")[0].trim()} — ${w.businessType === "venue" ? "Venue Walkthrough" : "Editorial Shoot"}`,
    eventType: "wedding",
    status: "booked",
    sessions: [{ startAt: todaySlot.start, endAt: todaySlot.end }],
    firstSessionStart: todaySlot.start,
    lastSessionEnd: todaySlot.end,
    location: { address: "100 Ayala Ave, Makati, Metro Manila" },
    amount: { total: 75_000, deposit: 25_000, currency: workspace.currency },
  });

  for (let i = 0; i < 24; i += 1) {
    const dayDelta = range(-90, 90);
    const client = pick(clients);
    const status: BookingStatus =
      dayDelta < -7
        ? rand() > 0.85
          ? "cancelled"
          : "completed"
        : dayDelta < 0
          ? "completed"
          : rand() > 0.7
            ? "booked"
            : rand() > 0.4
              ? "booked"
              : "inquiry";
    const eventType = pick(EVENT_TYPES);
    const total = range(20, 250) * 1000;
    const slot = timedSlot(dayDelta);
    bookingPayloads.push({
      workspaceId: workspace._id,
      teamId: mainTeam._id,
      clientId: client._id,
      clientName: client.name,
      title: `${client.name.split("&")[0].trim()} — ${eventType[0].toUpperCase()}${eventType.slice(1)}`,
      eventType,
      status,
      sessions: [{ startAt: slot.start, endAt: slot.end }],
      firstSessionStart: slot.start,
      lastSessionEnd: slot.end,
      location: { address: `${100 + i} Ayala Ave, Makati, Metro Manila` },
      amount: {
        total,
        deposit: Math.floor(total * 0.3),
        currency: workspace.currency,
      },
    });
  }

  const bookings = await Booking.insertMany(bookingPayloads);

  // recordBookingForClient creates Transaction docs and updates client summaries
  // — replaces the old explicit Transaction.insertMany.
  for (const b of bookings) {
    await recordBookingForClient({
      workspaceId: workspace._id,
      clientId: b.clientId,
      booking: {
        _id: b._id,
        amount: b.amount,
        firstSessionStart: b.firstSessionStart,
        teamId: mainTeam._id,
      },
      source: "seed",
    });
  }

  // Supplementary transactions for demo variety (does not roll up to Client summaries).
  // Adds balance payments, refunds, and mixed methods so revenue-by-method and refund
  // widgets have meaningful data on demo dashboards.
  const completedBookings = bookings.filter((b) => b.status === "completed");
  const supplementaryTxs: Array<{
    workspaceId: mongoose.Types.ObjectId;
    bookingId: mongoose.Types.ObjectId;
    clientId: mongoose.Types.ObjectId;
    amount: number;
    currency: string;
    type: "balance" | "refund";
    method: "paddle" | "cash" | "transfer";
    paidAt: Date;
  }> = [];

  const methods = ["paddle", "cash", "transfer"] as const;

  // Balance payments for completed bookings.
  for (const b of completedBookings) {
    const total = (b.amount as { total: number }).total;
    const deposit = (b.amount as { deposit: number }).deposit;
    const balance = Math.floor(total - deposit);
    if (balance <= 0) continue;
    const offsetDays = range(-89, -1);
    supplementaryTxs.push({
      workspaceId: workspace._id,
      bookingId: b._id,
      clientId: b.clientId,
      amount: balance,
      currency: workspace.currency,
      type: "balance",
      method: pick(methods),
      paidAt: dayOffset(offsetDays),
    });
  }

  // A handful of refunds spread across the trailing 90 days.
  const refundCount = Math.min(5, completedBookings.length);
  for (let i = 0; i < refundCount; i += 1) {
    const b = pick(completedBookings);
    const total = (b.amount as { total: number }).total;
    supplementaryTxs.push({
      workspaceId: workspace._id,
      bookingId: b._id,
      clientId: b.clientId,
      amount: -Math.floor(total * range(5, 20) / 100),
      currency: workspace.currency,
      type: "refund",
      method: pick(methods),
      paidAt: dayOffset(-range(1, 89)),
    });
  }

  if (supplementaryTxs.length > 0) {
    await Transaction.insertMany(supplementaryTxs);
  }

  // 15 inquiries across trailing 30 days, mix of statuses (some converted).
  const inquiryPayloads = Array.from({ length: 15 }).map((_, i) => {
    const status = pick(["new", "new", "approved", "booked", "archived"] as const);
    return {
      workspaceId: workspace._id,
      name: pick([
        "Lena Okafor",
        "Jordan Patel",
        "Maya Tanaka",
        "Diego Vasquez",
        "Olivia Park",
        "Aiyana Cloud",
        "Hiroshi Sato",
        "Mia Bernal",
      ]),
      email: `lead${i}@example.com`,
      phone: rand() > 0.4 ? `+63 917 555 ${String(2000 + i).padStart(4, "0")}` : null,
      message: pick([
        "Hi! Looking for availability later this year.",
        "Brand portrait session for a launch — do you take corporate work?",
        "Considering you for our wedding — what's your starting package?",
        "Need a venue for ~120 guests in October.",
      ]),
      eventDate: dayOffset(range(30, 200)),
      eventType: pick(EVENT_TYPES),
      budgetRange: pick(["under 50k", "50-100k", "100-250k", "250k+"]),
      status,
      createdAt: dayOffset(-range(0, 30)),
    };
  });
  await Inquiry.insertMany(inquiryPayloads);

  const collection = await GalleryCollection.create({
    workspaceId: workspace._id,
    name: "Featured Work",
    slug: "featured",
    isPublic: true,
    order: 0,
  });

  await GalleryItem.insertMany(
    [1, 2, 3, 4].map((n) => ({
      workspaceId: workspace._id,
      collectionId: collection._id,
      assetId: `seed-${workspace._id}-sample-${n}`,
      url: `https://picsum.photos/seed/seed-${n}/1600/1067`,
      width: 1600,
      height: 1067,
      format: "jpg",
      sizeBytes: 250_000,
      caption: `Sample ${n}`,
      order: n,
    }))
  );

  // 20 activity log entries spanning the booking/inquiry/transaction creates.
  const activityPayloads: Array<{
    workspaceId: mongoose.Types.ObjectId;
    actorUserId: string;
    entity: "booking" | "client" | "inquiry" | "gallery" | "transaction" | "workspace";
    entityId: mongoose.Types.ObjectId | null;
    action: "created" | "updated" | "deleted" | "status_changed";
  }> = [
    {
      workspaceId: workspace._id,
      actorUserId: ownerUserId,
      entity: "workspace",
      entityId: null,
      action: "created",
    },
  ];
  for (let i = 0; i < 19; i += 1) {
    const kind = pick(["booking", "client", "inquiry", "transaction"] as const);
    activityPayloads.push({
      workspaceId: workspace._id,
      actorUserId: ownerUserId,
      entity: kind,
      entityId:
        kind === "booking"
          ? pick(bookings)._id
          : kind === "client"
            ? pick(clients)._id
            : null,
      action: pick(["created", "updated", "status_changed"] as const),
    });
  }
  await ActivityLog.insertMany(activityPayloads);

  console.log(
    `  ✓ ${w.slug} — ${clients.length} clients, ${bookings.length} bookings (+ transactions), ${inquiryPayloads.length} inquiries`
  );
  return workspace;
}

async function syncAllIndexes() {
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    const dropped = await model.syncIndexes();
    if (dropped.length > 0) {
      console.log(`  ✓ ${name}: dropped ${dropped.length} stale → ${dropped.join(", ")}`);
    }
  }
}

type OwnerInfo = {
  email: string;
  name: string;
  memberships: Array<{
    workspaceId: mongoose.Types.ObjectId;
    role: "owner";
    lastAccessedAt: Date | null;
  }>;
};

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in NODE_ENV=production");
  }

  // Optional: wire the demo data to your real WorkOS identity so you can sign in
  // and immediately own the seeded workspaces. Set these in .env.local:
  //   SEED_OWNER_WORKOS_USER_ID  (your real user_... id from WorkOS / AuthKit)
  //   SEED_OWNER_EMAIL           (optional; re-synced from WorkOS on first sign-in)
  //   SEED_OWNER_NAME            (optional display name)
  // When SEED_OWNER_WORKOS_USER_ID is set, ALL demo workspaces are owned by you.
  // When unset, the per-workspace placeholder ids (user_demo_*) are used.
  const sharedOwnerId = process.env.SEED_OWNER_WORKOS_USER_ID?.trim() || null;
  const sharedOwnerEmail = process.env.SEED_OWNER_EMAIL?.trim() || null;
  const sharedOwnerName = process.env.SEED_OWNER_NAME?.trim() || null;
  const now = new Date();

  console.log("→ Connecting to MongoDB…");
  await connectDB();

  // Drop documents BEFORE syncing indexes: a pre-migration collection can hold
  // legacy docs (e.g. users with no workosUserId) that would break a unique
  // index build. Emptying first lets indexes rebuild cleanly.
  console.log("→ Dropping tenant collections…");
  await dropTenantCollections();

  console.log("→ Syncing indexes (drops stale, rebuilds from schemas)…");
  await syncAllIndexes();

  console.log("→ Seeding demo workspaces…");
  const owners = new Map<string, OwnerInfo>();

  for (let i = 0; i < DEMO_WORKSPACES.length; i += 1) {
    const w = DEMO_WORKSPACES[i];
    const ownerUserId = sharedOwnerId ?? w.ownerUserId;
    const workspace = await seedWorkspace(w, i, ownerUserId);

    let owner = owners.get(ownerUserId);
    if (!owner) {
      owner = {
        email: sharedOwnerId ? sharedOwnerEmail ?? w.ownerEmail : w.ownerEmail,
        name: sharedOwnerId ? sharedOwnerName ?? w.ownerName : w.ownerName,
        memberships: [],
      };
      owners.set(ownerUserId, owner);
    }
    owner.memberships.push({
      workspaceId: workspace._id,
      role: "owner",
      // Stamp the FIRST workspace as most-recently-accessed so getActiveWorkspaceId
      // lands the owner there on sign-in instead of showing a workspace chooser.
      lastAccessedAt: owner.memberships.length === 0 ? now : null,
    });
  }

  console.log("→ Creating owner users…");
  for (const [ownerUserId, info] of owners) {
    await User.create({
      workosUserId: ownerUserId,
      email: info.email,
      name: info.name,
      memberships: info.memberships,
      onboardingStep: "done",
      onboardingCompletedAt: now,
    });
  }

  console.log("\n✓ Seed complete.");
  if (sharedOwnerId) {
    console.log(
      `\nBoth demo workspaces are owned by SEED_OWNER_WORKOS_USER_ID=${sharedOwnerId}.`
    );
    console.log("Sign in via AuthKit as that user to land in Sarah Bell Photography;");
    console.log("use the workspace switcher to reach Rosewood Venue.");
  } else {
    console.log("\nNote: owner WorkOS user IDs are placeholders (user_demo_*), so you");
    console.log("cannot sign in as these workspaces yet. For a one-step reset, set");
    console.log("SEED_OWNER_WORKOS_USER_ID (your real user_... id) in .env.local, then re-run.");
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
