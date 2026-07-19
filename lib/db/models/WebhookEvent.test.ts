import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { WebhookEvent } from "./WebhookEvent";

beforeAll(async () => {
  await startInMemoryMongo();
}, 120_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
});

describe("WebhookEvent model", () => {
  it("creates a document with the default status 'received'", async () => {
    const doc = await WebhookEvent.create({
      eventKey: "hash_abc",
      eventName: "subscription_created",
      resourceId: "sub_123",
    });

    expect(doc.status).toBe("received");
  });

  it("rejects a second document with the same provider+eventKey", async () => {
    // Index builds happen asynchronously after model registration; wait for
    // them before relying on the unique constraint.
    await WebhookEvent.init();

    await WebhookEvent.create({
      eventKey: "hash_dup",
      eventName: "subscription_created",
      resourceId: "sub_dup",
    });

    await expect(
      WebhookEvent.create({
        eventKey: "hash_dup",
        eventName: "subscription_created",
        resourceId: "sub_dup",
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  it("defaults attemptCount to 1 and processedAt/failedAt/lastError/payload to null", async () => {
    const doc = await WebhookEvent.create({
      eventKey: "hash_defaults",
      eventName: "subscription_created",
      resourceId: "sub_defaults",
    });

    expect(doc.attemptCount).toBe(1);
    expect(doc.processedAt).toBeNull();
    expect(doc.failedAt).toBeNull();
    expect(doc.lastError).toBeNull();
    expect(doc.payload).toBeNull();
  });
});
