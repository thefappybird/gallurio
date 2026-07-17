import { describe, it, expect } from "vitest";
import { HANDLED_LEMONSQUEEZY_EVENTS } from "./webhook";
import { LEMONSQUEEZY_WEBHOOK_HANDLERS } from "./webhookHandlers";

describe("LEMONSQUEEZY_WEBHOOK_HANDLERS registry", () => {
  it("has exactly one handler for each of the 12 handled event names", () => {
    const keys = Object.keys(LEMONSQUEEZY_WEBHOOK_HANDLERS).sort();
    expect(keys).toEqual([...HANDLED_LEMONSQUEEZY_EVENTS].sort());
  });
});
