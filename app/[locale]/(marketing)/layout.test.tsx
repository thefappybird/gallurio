import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { enMessages } from "@/test-utils/messages";
import { pickMessages, MARKETING_CLIENT_MESSAGE_KEYS } from "@/lib/i18n/clientMessages";

const captured: { messages?: unknown } = {};

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    NextIntlClientProvider: (props: { messages?: unknown; children: React.ReactNode }) => {
      captured.messages = props.messages;
      return props.children;
    },
  };
});

vi.mock("next-intl/server", () => ({
  getMessages: vi.fn(async () => enMessages),
}));

vi.mock("./_components/marketing-header", () => ({
  MarketingHeader: () => <div data-testid="marketing-header" />,
}));
vi.mock("./_components/marketing-footer", () => ({
  MarketingFooter: () => <div data-testid="marketing-footer" />,
}));

import MarketingLayout from "./layout";

describe("MarketingLayout", () => {
  it("wraps children in a provider scoped to only the marketing message subset", async () => {
    const page = await MarketingLayout({
      children: <div data-testid="child" />,
      params: Promise.resolve({ locale: "fil" }),
    });
    render(page);

    expect(captured.messages).toEqual(pickMessages(enMessages, MARKETING_CLIENT_MESSAGE_KEYS));
  });

  it("passes the route locale to getMessages instead of relying on request-header inference", async () => {
    const { getMessages } = await import("next-intl/server");
    await MarketingLayout({
      children: <div data-testid="child" />,
      params: Promise.resolve({ locale: "fil" }),
    });

    expect(getMessages).toHaveBeenCalledWith({ locale: "fil" });
  });
});

// Guard against a marketing client component reading a useTranslations()
// namespace that MARKETING_CLIENT_MESSAGE_KEYS doesn't ship — that renders as
// MISSING_MESSAGE for every visitor instead of failing a test. Explicit
// shared-component paths supplement the (marketing)-tree scan because
// ThemeToggle/LocaleSwitcher live outside app/[locale]/(marketing)/.
describe("marketing client message coverage", () => {
  it("covers every useTranslations namespace reachable from a marketing use-client file", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const marketingDir = path.resolve(__dirname);
    const sharedFiles = [
      path.resolve(__dirname, "../../../components/app/theme-toggle.tsx"),
      path.resolve(__dirname, "../../../components/app/locale-switcher.tsx"),
      path.resolve(__dirname, "../../../components/app/billed-as-note.tsx"),
      path.resolve(__dirname, "../../../components/app/beta-plan-card.tsx"),
    ];

    function collectTsxFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectTsxFiles(full);
        return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx") ? [full] : [];
      });
    }

    const candidateFiles = [...collectTsxFiles(marketingDir), ...sharedFiles];
    const useClientFiles = candidateFiles.filter((file) =>
      fs.readFileSync(file, "utf8").startsWith('"use client"')
    );
    expect(useClientFiles.length).toBeGreaterThan(0);

    const namespacePattern = /useTranslations\(\s*["']([\w.]+)["']\s*\)/g;
    const namespaces = new Set<string>();
    for (const file of useClientFiles) {
      const content = fs.readFileSync(file, "utf8");
      for (const match of content.matchAll(namespacePattern)) {
        namespaces.add(match[1]);
      }
    }
    expect(namespaces.size).toBeGreaterThan(0);

    const picked = pickMessages(enMessages, MARKETING_CLIENT_MESSAGE_KEYS);

    function resolvesToObject(tree: Record<string, unknown>, namespace: string): boolean {
      let node: unknown = tree;
      for (const segment of namespace.split(".")) {
        if (typeof node !== "object" || node === null || !(segment in node)) return false;
        node = (node as Record<string, unknown>)[segment];
      }
      return typeof node === "object" && node !== null;
    }

    for (const namespace of namespaces) {
      expect(resolvesToObject(picked, namespace), `namespace "${namespace}" missing from MARKETING_CLIENT_MESSAGE_KEYS`).toBe(true);
    }
  });

  it("stays small and never ships the terms/privacy body copy", () => {
    const picked = pickMessages(enMessages, MARKETING_CLIENT_MESSAGE_KEYS) as {
      marketing: { terms: Record<string, unknown>; privacy: Record<string, unknown> };
    };

    const byteSize = Buffer.byteLength(JSON.stringify(picked), "utf8");
    expect(byteSize).toBeLessThan(15 * 1024);

    expect(Object.keys(picked.marketing.terms)).toEqual(["title"]);
    expect(Object.keys(picked.marketing.privacy)).toEqual(["title"]);
  });
});
