/**
 * Dev seed script — populates the DB with two demo workspaces and fixture data.
 *
 * Usage:  pnpm seed
 *
 * WARNING: this drops the tenant-scoped collections (workspaces, users, clients,
 * bookings, inquiries, gallery_collections, gallery_items, transactions, activity_logs).
 * Never run against production.
 *
 * The two seeded workspaces use fake clerkOrgId / clerkUserId values so the app
 * can render their data when you point requireOrg() at them via Clerk impersonation
 * or by manually editing the active org in the Clerk dashboard during dev.
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
} from "./models";

const DEMO_WORKSPACES = [
  {
    slug: "sarah-bell-photo",
    name: "Sarah Bell Photography",
    businessType: "photographer" as const,
    clerkOrgId: "org_demo_sarah",
    ownerUserId: "user_demo_sarah",
    ownerEmail: "sarah@example.com",
    ownerName: "Sarah Bell",
    primaryColor: "#1a1a1a",
  },
  {
    slug: "rosewood-venue",
    name: "Rosewood Venue",
    businessType: "venue" as const,
    clerkOrgId: "org_demo_rosewood",
    ownerUserId: "user_demo_rosewood",
    ownerEmail: "owner@rosewood.example",
    ownerName: "Marcus Hale",
    primaryColor: "#2d3b2a",
  },
];

const DEMO_CLIENTS = [
  { name: "Emma & Liam Carter", email: "emma.carter@example.com", phone: "+1 415 555 0142" },
  { name: "Priya Shah", email: "priya@example.com", phone: "+1 415 555 0188" },
  { name: "Ana & Tomás Ribeiro", email: "ana.ribeiro@example.com", phone: null },
  { name: "Northwood Corp Events", email: "events@northwood.example", phone: "+1 415 555 0211" },
];

const BOOKING_TITLES = [
  "Carter Wedding — Pier 27",
  "Shah Engagement Shoot",
  "Ribeiro Anniversary Vow Renewal",
  "Northwood Annual Gala",
];

function daysFromNow(d: number): Date {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x;
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
  ];
  for (const c of collections) {
    if (tenantNames.includes(c.collectionName)) {
      await c.deleteMany({});
    }
  }
}

async function seedWorkspace(w: (typeof DEMO_WORKSPACES)[number]) {
  const now = new Date();
  const workspace = await Workspace.create({
    slug: w.slug,
    name: w.name,
    ownerUserId: w.ownerUserId,
    clerkOrgId: w.clerkOrgId,
    businessType: w.businessType,
    country: "PH",
    timezone: "Asia/Manila",
    branding: {
      primaryColor: w.primaryColor,
      secondaryColor: "#f5f5f5",
      tagline: w.businessType === "venue" ? "Historic venue in the Bay Area" : "Wedding storytelling",
      description: `${w.name} — sample seeded workspace.`,
    },
    publicPage: { templateId: "default" },
    plan: "starter",
    onboardingCompletedAt: now,
  });

  await User.create({
    clerkUserId: w.ownerUserId,
    email: w.ownerEmail,
    name: w.ownerName,
    memberships: [{ workspaceId: workspace._id, role: "owner" }],
    onboardingStep: "done",
    onboardingCompletedAt: now,
  });

  const clients = await Client.insertMany(
    DEMO_CLIENTS.map((c, i) => ({
      workspaceId: workspace._id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      source: i % 2 === 0 ? "form" : "manual",
      totalSpent: (i + 1) * 1200,
      tags: i === 0 ? ["VIP"] : [],
    }))
  );

  const bookings = await Booking.insertMany(
    clients.map((c, i) => ({
      workspaceId: workspace._id,
      clientId: c._id,
      clientName: c.name,
      title: BOOKING_TITLES[i],
      eventType: i === 3 ? "corporate" : "wedding",
      status: ["inquiry", "quoted", "booked", "completed"][i],
      startAt: daysFromNow((i + 1) * 14),
      endAt: daysFromNow((i + 1) * 14),
      location: { address: `${100 + i} Ayala Ave, Makati, Metro Manila` },
      amount: { total: 45000 + i * 15000, deposit: 15000, currency: "PHP" },
    }))
  );

  await Inquiry.insertMany([
    {
      workspaceId: workspace._id,
      name: "Jordan Patel",
      email: "jordan.patel@example.com",
      phone: "+1 415 555 0177",
      message: "Hi! Looking for availability for a small wedding in October.",
      eventDate: daysFromNow(150),
      eventType: "wedding",
      budgetRange: "$3-5k",
      status: "new",
    },
    {
      workspaceId: workspace._id,
      name: "Lena Okafor",
      email: "lena.o@example.com",
      message: "Brand portrait session for a launch — do you take corporate work?",
      eventType: "corporate",
      status: "contacted",
    },
  ]);

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
      cloudinaryPublicId: `gallurio/${workspace._id}/seed/sample-${n}`,
      url: `https://res.cloudinary.com/demo/image/upload/sample.jpg`,
      width: 1600,
      height: 1067,
      format: "jpg",
      sizeBytes: 250_000,
      caption: `Sample ${n}`,
      order: n,
    }))
  );

  await Transaction.insertMany(
    bookings
      .filter((_, i) => i < 2)
      .map((b) => ({
        workspaceId: workspace._id,
        bookingId: b._id,
        clientId: b.clientId,
        amount: 15000,
        currency: "PHP",
        type: "deposit",
        method: "hitpay",
        paidAt: daysFromNow(-5),
      }))
  );

  await ActivityLog.create({
    workspaceId: workspace._id,
    actorUserId: w.ownerUserId,
    entity: "workspace",
    action: "created",
  });

  console.log(`  ✓ ${w.slug} — ${clients.length} clients, ${bookings.length} bookings`);
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

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in NODE_ENV=production");
  }

  console.log("→ Connecting to MongoDB…");
  await connectDB();

  console.log("→ Syncing indexes (drops stale, rebuilds from schemas)…");
  await syncAllIndexes();

  console.log("→ Dropping tenant collections…");
  await dropTenantCollections();

  console.log("→ Seeding demo workspaces…");
  for (const w of DEMO_WORKSPACES) {
    await seedWorkspace(w);
  }

  console.log("\n✓ Seed complete.");
  console.log("\nNote: Clerk org IDs are fake placeholders (org_demo_*). To actually");
  console.log("sign in as one of these workspaces, either:");
  console.log("  a) Update the Workspace.clerkOrgId in MongoDB to a real Clerk org ID, or");
  console.log("  b) Create a Clerk org in the dashboard and run pnpm seed:link <slug> <orgId>");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
