/**
 * Tests for the Workspace Mongoose model.
 * Uses in-memory Mongo — never mocks Mongoose.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

import { vi } from "vitest";

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
});

describe("Workspace.publicPage.siteIcon defaults", () => {
  it("new workspace has siteIcon defaulting to { url: '', assetId: '' }", async () => {
    const ws = await Workspace.create({
      slug: "test-studio",
      name: "Test Studio",
      ownerUserId: "user_test_123",
      businessType: "photographer",
      country: "PH",
      currency: "PHP",
      timezone: "Asia/Manila",
    });

    expect(ws.publicPage?.siteIcon?.url).toBe("");
    expect(ws.publicPage?.siteIcon?.assetId).toBe("");
  });
});

describe("Workspace.publicPage.seo defaults", () => {
  it("new workspace has seo.noindex defaulting to false", async () => {
    const ws = await Workspace.create({
      slug: "seo-studio",
      name: "SEO Studio",
      ownerUserId: "user_seo_1",
    });

    expect(ws.publicPage?.seo?.noindex).toBe(false);
  });

  it("new workspace has seo string fields defaulting to empty string", async () => {
    const ws = await Workspace.create({
      slug: "seo-studio-2",
      name: "SEO Studio 2",
      ownerUserId: "user_seo_2",
    });

    expect(ws.publicPage?.seo?.ogImageUrl).toBe("");
    expect(ws.publicPage?.seo?.ogImageAssetId).toBe("");
    expect(ws.publicPage?.seo?.galleryDescription).toBe("");
  });
});

describe("Workspace.publicPage.settingsDraft defaults", () => {
  it("new workspace has no settingsDraft until /settings/public-page saves one", async () => {
    const ws = await Workspace.create({
      slug: "settings-draft-studio",
      name: "Settings Draft Studio",
      ownerUserId: "user_settings_1",
    });

    expect(ws.publicPage?.settingsDraft).toBeUndefined();
  });
});

it("new workspace has formDir defaulting to empty string", async () => {
  const ws = await Workspace.create({
    slug: "dir-test-studio",
    name: "Dir Test Studio",
    ownerUserId: "user_dir_1",
  });
  expect(ws.publicPage?.formDir).toBe("");
});

describe("Workspace.contact.addressLat / addressLng defaults", () => {
  it("new workspace has addressLat and addressLng defaulting to null", async () => {
    const ws = await Workspace.create({
      slug: "address-coords-studio",
      name: "Address Coords Studio",
      ownerUserId: "user_coords_1",
    });
    expect(ws.contact?.addressLat).toBeNull();
    expect(ws.contact?.addressLng).toBeNull();
  });
});

describe("Workspace.invoiceTheme defaults", () => {
  it("new workspace has invoiceTheme defaulting to the classic preset", async () => {
    const ws = await Workspace.create({
      slug: "invoice-theme-studio",
      name: "Invoice Theme Studio",
      ownerUserId: "user_invoice_1",
    });
    expect(ws.invoiceTheme?.preset).toBe("classic");
    expect(ws.invoiceTheme?.main).toBe("#1A1A1A");
    expect(ws.invoiceTheme?.accent).toBe("#FFFFFF");
  });
});
