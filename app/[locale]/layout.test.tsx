// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { enMessages } from "@/test-utils/messages";
import { pickMessages, ROOT_CLIENT_MESSAGE_KEYS } from "@/lib/i18n/clientMessages";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getMessages: vi.fn(async () => enMessages),
}));

import RootLayout from "./layout";

describe("RootLayout", () => {
  it("scopes its NextIntlClientProvider to ROOT_CLIENT_MESSAGE_KEYS only", async () => {
    const html = await RootLayout({
      children: null,
      params: Promise.resolve({ locale: "en" }),
    });

    const body = (html.props as { children: React.ReactElement }).children;
    const themeProvider = (body.props as { children: React.ReactElement }).children;
    const provider = (themeProvider.props as { children: React.ReactElement }).children;

    expect((provider.props as { messages?: unknown }).messages).toEqual(
      pickMessages(enMessages, ROOT_CLIENT_MESSAGE_KEYS)
    );
  });
});
