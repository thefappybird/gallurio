/**
 * Focused dev seed for manually testing the portfolio maker.
 *
 * Usage:  pnpm seed:portfolio
 *
 * What it does (idempotent - safe to re-run):
 * - Upserts a DEDICATED demo workspace (slug `portfolio-demo`).
 *   It NEVER touches your real workspace, so the destructive gallery reset below
 *   only ever affects this demo tenant.
 * - Creates 2 GalleryCollections of items using Picsum photo URLs.
 * - Seeds Home + Gallery Puck data that references those collections, sets a
 *   brand kit + contact-panel config, and PUBLISHES the page.
 *
 * Override the demo slug with SEED_PORTFOLIO_SLUG=my-slug pnpm seed:portfolio.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { connectDB } from "./mongoose";
import { Workspace, GalleryCollection, GalleryItem } from "./models";
import { buildSeedGalleryItem } from "./seedGalleryItem";
import { HERO_PRESET, CTA_PRESET } from "@/lib/page-builder/blocks/sectionPresets";
import { galleryGridDefaultProps } from "@/lib/page-builder/blocks/GalleryGridBlock";
import { galleryMasonryDefaultProps } from "@/lib/page-builder/blocks/GalleryMasonryBlock";
import { galleryCarouselDefaultProps } from "@/lib/page-builder/blocks/GalleryCarouselBlock";
import { featuredWorkDefaultProps } from "@/lib/page-builder/blocks/FeaturedWorkBlock";

const SLUG = process.env.SEED_PORTFOLIO_SLUG || "portfolio-demo";
const OWNER_ID = "user_demo_portfolio";

type SeededItem = {
  _id: mongoose.Types.ObjectId;
  assetId: string;
  url: string;
};

type CollectionSpec = {
  name: string;
  slug: string;
  captions: string[];
};

const COLLECTIONS: CollectionSpec[] = [
  {
    name: "Weddings",
    slug: "weddings",
    captions: ["Garden ceremony", "First dance", "Golden hour portraits", "The vows", "Reception", "Send-off"],
  },
  {
    name: "Portraits",
    slug: "portraits",
    captions: ["Studio light", "On location", "Editorial", "Black & white", "Candid", "Headshot"],
  },
];

async function seedCollection(
  workspaceId: mongoose.Types.ObjectId,
  spec: CollectionSpec,
  order: number
): Promise<SeededItem[]> {
  const collection = await GalleryCollection.create({
    workspaceId,
    name: spec.name,
    slug: spec.slug,
    isPublic: true,
    order,
  });

  const items: SeededItem[] = [];
  for (let i = 0; i < spec.captions.length; i += 1) {
    const assetId = `seed-${String(workspaceId)}-${spec.slug}-${i}`;
    const url = `https://picsum.photos/seed/${spec.slug}-${i}/1200/1500`;

    const doc = await GalleryItem.create(
      buildSeedGalleryItem({
        workspaceId,
        collectionId: collection._id,
        assetId,
        url,
        width: 1200,
        height: 1500,
        sizeBytes: 300_000,
        format: "jpg",
        caption: spec.captions[i],
        altText: `${spec.name} - ${spec.captions[i]}`,
        order: i,
      })
    );
    items.push({ _id: doc._id, assetId, url });
  }

  // Set a cover for completeness.
  collection.coverItemId = items[0]._id;
  await collection.save();

  console.log(`  OK collection "${spec.name}" (${spec.slug}) - ${items.length} items`);
  return items;
}

function buildHomeData(opts: {
  weddingsCollectionId: string;
  heroBackgroundPublicId: string;
}) {
  // Merge the hero preset with a real background image for the demo.
  const heroProps = {
    ...HERO_PRESET,
    backgroundImagePublicId: opts.heroBackgroundPublicId,
  };

  return {
    root: { props: {} },
    content: [
      {
        type: "HeroPreset",
        props: { id: "seed-hero", ...heroProps },
      },
      {
        type: "GalleryGrid",
        props: {
          id: "seed-grid",
          ...galleryGridDefaultProps,
          collectionId: opts.weddingsCollectionId,
          columns: 3,
          maxItems: 6,
        },
      },
      {
        type: "CtaPreset",
        props: { id: "seed-cta", ...CTA_PRESET },
      },
    ],
    zones: {},
  };
}

function buildGalleryData(opts: {
  weddingsCollectionId: string;
  portraitsCollectionId: string;
  featuredItemIds: string[];
}) {
  return {
    root: { props: {} },
    content: [
      {
        type: "FeaturedWork",
        props: {
          id: "seed-featured",
          ...featuredWorkDefaultProps,
          heading: "Featured work",
          subheading: "A few favourites",
          // Puck persists array fields as objects - exercise the real shape.
          itemIds: opts.featuredItemIds.map((id) => ({ id })),
          layout: "stagger",
        },
      },
      {
        type: "GalleryMasonry",
        props: {
          id: "seed-masonry",
          ...galleryMasonryDefaultProps,
          collectionId: opts.weddingsCollectionId,
          columns: 3,
          gap: "normal",
          maxItems: 18,
        },
      },
      {
        type: "GalleryCarousel",
        props: {
          id: "seed-carousel",
          ...galleryCarouselDefaultProps,
          collectionId: opts.portraitsCollectionId,
          aspect: "portrait",
          autoplay: false,
          maxItems: 12,
        },
      },
    ],
    zones: {},
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in NODE_ENV=production");
  }

  console.log("-> Connecting to MongoDB...");
  await connectDB();

  // Resolve the dedicated demo workspace (by slug).
  let workspace = await Workspace.findOne({ slug: SLUG });
  const now = new Date();

  if (!workspace) {
    workspace = await Workspace.create({
      slug: SLUG,
      name: "Portfolio Demo Studio",
      ownerUserId: OWNER_ID,
      businessType: "photographer",
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
      branding: {
        primaryColor: "#1a1a1a",
        secondaryColor: "#f5f5f5",
        tagline: "Fine-art wedding & portrait photography",
        description: "Demo workspace for portfolio-maker testing.",
      },
      plan: "pro",
      onboardingCompletedAt: now,
    });
    console.log(`  OK created demo workspace "${workspace.slug}"`);
  } else {
    console.log(`  OK reusing workspace "${workspace.slug}" (${String(workspace._id)})`);
    console.warn(
      "  ! resetting this workspace's gallery collections/items so the seed is idempotent"
    );
  }

  // Idempotency: clear this demo workspace's gallery data before re-seeding.
  await GalleryItem.deleteMany({ workspaceId: workspace._id });
  await GalleryCollection.deleteMany({ workspaceId: workspace._id });

  console.log("-> Seeding collections...");
  const weddings = await seedCollection(workspace._id, COLLECTIONS[0], 0);
  await seedCollection(workspace._id, COLLECTIONS[1], 1);

  const weddingsCollectionId = String(
    (await GalleryCollection.findOne({ workspaceId: workspace._id, slug: "weddings" }).select("_id").lean())!._id
  );
  const portraitsCollectionId = String(
    (await GalleryCollection.findOne({ workspaceId: workspace._id, slug: "portraits" }).select("_id").lean())!._id
  );

  const featuredItemIds = weddings.slice(0, 3).map((i) => String(i._id));
  const heroBackgroundPublicId = weddings[0].assetId;

  console.log("-> Writing Puck data + brand kit + contact config, then publishing...");
  workspace.set("publicPage", {
    templateId: "wedding-photographer",
    data: {
      home: buildHomeData({ weddingsCollectionId, heroBackgroundPublicId }),
      gallery: buildGalleryData({ weddingsCollectionId, portraitsCollectionId, featuredItemIds }),
    },
    brandKit: {
      themePreset: "editorial",
      fontPair: "playfair-inter",
      primaryColor: "#1a1a1a",
      secondaryColor: "#efe9e1",
      accentColor: "#2f5d56",
      backgroundColor: "#fbf9f6",
      foregroundColor: "#161514",
      radius: "subtle",
      buttonStyle: "solid",
    },
    seoTitle: "Portfolio Demo Studio - Wedding & Portrait Photography",
    seoDescription: "Fine-art wedding and portrait photography based in Metro Manila.",
    inquiryRecipientEmail: "demo@example.com",
    contact: {
      title: "Let's work together",
      description: "Tell me about your event and I'll be in touch within 24 hours.",
      buttonStyle: "solid",
      buttonColor: "accent",
    },
    publishedAt: now,
    lastPublishedAt: now,
    latestVersion: 1,
  });
  // `data.home`/`data.gallery` are Schema.Types.Mixed - mark modified so Mongoose
  // persists the freshly-assigned Puck JSON.
  workspace.markModified("publicPage.data");
  await workspace.save();

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  console.log("\nOK Seed complete. Test the published portfolio at:");
  console.log(`    Home    -> ${base}/w/${workspace.slug}`);
  console.log(`    Gallery -> ${base}/w/${workspace.slug}/gallery`);
  console.log('    Contact -> click any "Get in touch" CTA or the header Contact button');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
