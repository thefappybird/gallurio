/**
 * One-time migration: upgrade Workspace.publicPage to the Phase-2 shape.
 *
 * Changes applied:
 * 1. data: Mixed (old flat Puck Data) → { home: <previous value>, gallery: null }
 * 2. data: null                       → { home: null, gallery: null }
 * 3. $unset legacy `blocks` array
 * 4. Initialize `brandKit` subdoc from workspace.branding colors where missing
 *
 * Safe to re-run — already-migrated documents are detected and skipped.
 *
 * Usage:
 *   pnpm tsx lib/db/migrations/2026-05-portfolio-page-shape.ts [--dry-run]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { connectDB } from "../mongoose";

const isDryRun = process.argv.includes("--dry-run");

async function run() {
  console.log(`→ Migration: portfolio-page-shape (${isDryRun ? "DRY RUN" : "LIVE"})`);
  await connectDB();

  const db = mongoose.connection.db;
  if (!db) throw new Error("No DB connection");

  const col = db.collection("workspaces");

  const cursor = col.find({});
  let migrated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    const publicPage = doc.publicPage as Record<string, unknown> | undefined | null;
    const currentData = publicPage?.data as unknown;
    const hasNewShape =
      currentData !== null &&
      typeof currentData === "object" &&
      ("home" in (currentData as object) || "gallery" in (currentData as object));

    // If data already has the two-zone shape, only check brandKit
    const brandKit = publicPage?.brandKit as Record<string, unknown> | undefined | null;
    const hasBrandKit =
      brandKit != null && typeof brandKit === "object" && "themePreset" in brandKit;

    if (hasNewShape && hasBrandKit) {
      // Already fully migrated — still unset legacy blocks if present
      if (publicPage?.blocks != null) {
        if (!isDryRun) {
          await col.updateOne(
            { _id: doc._id },
            { $unset: { "publicPage.blocks": 1 } }
          );
        }
        console.log(`  [blocks-cleanup] ${doc._id}`);
        migrated++;
      } else {
        skipped++;
      }
      continue;
    }

    // Build the new data shape
    let newHomeData: unknown = null;
    if (currentData != null && !hasNewShape) {
      // Old flat Puck Data object — promote to home zone
      newHomeData = currentData;
    }

    // Build brandKit from existing branding colors + defaults
    const branding = doc.branding as Record<string, unknown> | undefined;
    const newBrandKit = hasBrandKit
      ? brandKit
      : {
          themePreset: "minimal",
          fontPair: "merriweather-only",
          primaryColor: typeof branding?.primaryColor === "string" ? branding.primaryColor : "#111111",
          secondaryColor: typeof branding?.secondaryColor === "string" ? branding.secondaryColor : "#f5f5f5",
          accentColor: "#2f5d56",
          backgroundColor: "#ffffff",
          foregroundColor: "#111111",
          radius: "sharp",
          buttonStyle: "solid",
        };

    const updateOps: Record<string, unknown> = {
      $set: {
        "publicPage.data": { home: newHomeData, gallery: null },
        "publicPage.brandKit": newBrandKit,
      },
      $unset: { "publicPage.blocks": 1 },
    };

    console.log(
      `  [migrate] ${doc._id} slug=${doc.slug ?? "(none)"} ` +
        `hasOldData=${currentData != null && !hasNewShape} brandKitNew=${!hasBrandKit}`
    );

    if (!isDryRun) {
      await col.updateOne({ _id: doc._id }, updateOps);
    }

    migrated++;
  }

  console.log(
    `\n✓ Migration complete. Migrated/cleaned: ${migrated}, Already up-to-date: ${skipped}`
  );
  if (isDryRun) {
    console.log("  (dry run — no writes performed)");
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
