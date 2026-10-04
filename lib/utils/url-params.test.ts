import { describe, it, expect, vi, afterEach } from "vitest";
import { setUrlParams } from "./url-params";

afterEach(() => vi.restoreAllMocks());

describe("setUrlParams", () => {
  it("pushes the mutated query built from window.location, keeping other params", () => {
    // Next marks its own history entries with __NA; its patched pushState skips
    // the useSearchParams sync when that state is passed back, so we must pass null.
    window.history.replaceState({ __NA: true }, "", "/en/bookings?view=calendar&detail=abc");
    const push = vi.spyOn(window.history, "pushState");

    setUrlParams((p) => {
      p.delete("detail");
      p.set("edit", "xyz");
    });

    expect(push).toHaveBeenCalledWith(null, "", "/en/bookings?view=calendar&edit=xyz");
  });
});
