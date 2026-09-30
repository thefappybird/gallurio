import { describe, it, expect, vi, afterEach } from "vitest";
import { setUrlParams } from "./url-params";

afterEach(() => vi.restoreAllMocks());

describe("setUrlParams", () => {
  it("pushes the mutated query built from window.location, keeping other params", () => {
    window.history.replaceState(null, "", "/en/bookings?view=calendar&detail=abc");
    const push = vi.spyOn(window.history, "pushState");

    setUrlParams((p) => {
      p.delete("detail");
      p.set("edit", "xyz");
    });

    expect(push).toHaveBeenCalledWith(window.history.state, "", "/en/bookings?view=calendar&edit=xyz");
  });
});
