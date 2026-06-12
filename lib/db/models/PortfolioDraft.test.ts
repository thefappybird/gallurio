import { describe, beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import mongoose from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { PortfolioDraft } from "./PortfolioDraft";

beforeAll(async () => {
  await startInMemoryMongo();
  await PortfolioDraft.createIndexes();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

const wsA = () => new mongoose.Types.ObjectId();

describe("PortfolioDraft", () => {
  it("persists a snapshot with timestamps", async () => {
    const d = await PortfolioDraft.create({
      workspaceId: wsA(),
      name: "New Draft",
      templateId: "minimal",
      data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
      brandKit: { themePreset: "minimal" },
    });
    expect(d.name).toBe("New Draft");
    expect(d.createdAt).toBeInstanceOf(Date);
    expect(d.updatedAt).toBeInstanceOf(Date);
  });

  it("does not leak a draft across workspaces (tenant isolation)", async () => {
    const a = wsA();
    const b = wsA();
    await PortfolioDraft.create({ workspaceId: a, name: "Secret A" });
    const found = await PortfolioDraft.findOne({ workspaceId: b, name: "Secret A" }).lean();
    expect(found).toBeNull();
  });
});
