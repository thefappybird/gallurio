import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { isRtl, useIsRtl } from "./rtl";

describe("isRtl", () => {
  it("returns true for Arabic", () => {
    expect(isRtl("ar")).toBe(true);
  });
});

describe("useIsRtl", () => {
  it("reflects the active locale", () => {
    const ar = renderHook(() => useIsRtl(), {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale="ar" messages={enMessages}>
          {children}
        </NextIntlClientProvider>
      ),
    });
    expect(ar.result.current).toBe(true);

    const en = renderHook(() => useIsRtl(), {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale="en" messages={enMessages}>
          {children}
        </NextIntlClientProvider>
      ),
    });
    expect(en.result.current).toBe(false);
  });
});
