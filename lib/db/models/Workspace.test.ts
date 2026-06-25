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
