// @vitest-environment node
import { describe, it, expect } from "vitest";
import BillingLayout from "./layout";

// Group-less route with no segment layout before this change — the root
// layout's provider is now scoped to ROOT_CLIENT_MESSAGE_KEYS, so every
// non-marketing leaf needs its own bare (full-catalog) provider.
// See lib/i18n/clientMessages.ts.
describe("BillingLayout", () => {
  it("wraps children in a bare NextIntlClientProvider (full catalog inherited)", () => {
    const element = BillingLayout({ children: null });
    expect(
      typeof element.type === "function" && element.type.name === "NextIntlClientProvider"
    ).toBe(true);
    expect((element.props as { messages?: unknown }).messages).toBeUndefined();
  });
});
