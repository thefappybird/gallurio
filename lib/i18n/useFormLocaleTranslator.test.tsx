import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import { useFormLocaleTranslator } from "./useFormLocaleTranslator";

describe("useFormLocaleTranslator", () => {
  it("resolves English synchronously for locale=en (no async wait needed)", () => {
    const { result } = renderHook(() =>
      useFormLocaleTranslator("en", "publicPage.inquiryForm")
    );
    expect(result.current("title")).toBe(enMessages.publicPage.inquiryForm.title);
  });

  it("returns the English fallback immediately for a non-English locale, then the real translation once the bundle loads", async () => {
    const { result } = renderHook(() =>
      useFormLocaleTranslator("ar", "publicPage.inquiryForm")
    );

    // Synchronous first render: the ar bundle hasn't loaded yet.
    expect(result.current("title")).toBe(enMessages.publicPage.inquiryForm.title);

    await waitFor(() => {
      expect(result.current("title")).toBe(arMessages.publicPage.inquiryForm.title);
    });
  });

  it("caches a locale across hook instances — a second mount for an already-loaded locale has the real translation on first render, no fallback flash", async () => {
    const first = renderHook(() =>
      useFormLocaleTranslator("ar", "publicPage.inquiryForm")
    );
    await waitFor(() => {
      expect(first.result.current("title")).toBe(arMessages.publicPage.inquiryForm.title);
    });

    const second = renderHook(() =>
      useFormLocaleTranslator("ar", "publicPage.inquiryForm")
    );
    expect(second.result.current("title")).toBe(arMessages.publicPage.inquiryForm.title);
  });
});
