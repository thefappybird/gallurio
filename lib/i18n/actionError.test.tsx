import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { useActionError } from "./actionError";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("useActionError", () => {
  it("translates known codes, parses inline params, and falls back to generic", () => {
    const { result } = renderHook(() => useActionError(), { wrapper });
    const errMsg = result.current;
    const generic = enMessages.app.errors.generic;

    // Known code resolves.
    expect(errMsg("client_not_found")).toBe("Client not found.");
    // Unknown / empty / nullish all fall back to generic (no raw code leaks).
    expect(errMsg("THIS_CODE_DOES_NOT_EXIST")).toBe(generic);
    expect(errMsg(undefined)).toBe(generic);
    expect(errMsg(null)).toBe(generic);
    expect(errMsg("")).toBe(generic);
    // Inline "code:value" form maps value to {count}.
    expect(errMsg("max_themes_reached:5")).toBe(
      "You've reached your theme limit (5).",
    );
    // Explicit params pass through.
    expect(errMsg("rate_limited", { seconds: 30 })).toBe(
      "Too many attempts. Try again in 30 seconds.",
    );
  });
});
