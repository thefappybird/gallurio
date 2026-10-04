import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { nextFitCookie, useTableFitCookie } from "./use-table-fit-cookie";

const measured = vi.hoisted(() => ({
  ref: { current: null as HTMLElement | null },
  remainingHeight: 800 as number | null,
}));

vi.mock("@/hooks/use-viewport-remaining-height", () => ({
  useViewportRemainingHeight: () => measured,
}));

function setNode(top: number, withRow = true) {
  const el = document.createElement("div");
  el.innerHTML = withRow
    ? "<table><tbody><tr><td>x</td></tr></tbody></table>"
    : "<p>empty</p>";
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  measured.ref.current = el;
}

function setDesktop(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as never;
}

function clearCookie() {
  document.cookie = "gw_table_fit_bookings=; max-age=0; path=/";
}

describe("nextFitCookie", () => {
  it("returns a cookie string when the fit differs from the stored value", () => {
    expect(nextFitCookie("bookings", 14, "a=1; gw_table_fit_bookings=12")).toBe(
      "gw_table_fit_bookings=14; SameSite=Lax; max-age=31536000; path=/"
    );
  });

  it("returns null when the stored value already matches", () => {
    expect(nextFitCookie("clients", 12, "gw_table_fit_clients=12")).toBeNull();
  });
});

describe("useTableFitCookie", () => {
  beforeEach(clearCookie);
  afterEach(clearCookie);

  it("writes the cookie on desktop when the table is at the top with rows", () => {
    setDesktop(true);
    setNode(100);
    renderHook(() => useTableFitCookie("bookings", 49));
    expect(document.cookie).toContain("gw_table_fit_bookings=");
  });

  it("does not write below lg", () => {
    setDesktop(false);
    setNode(100);
    renderHook(() => useTableFitCookie("bookings", 49));
    expect(document.cookie).not.toContain("gw_table_fit_bookings=");
  });

  it("does not write when the page is scrolled (top < 0)", () => {
    setDesktop(true);
    setNode(-200);
    renderHook(() => useTableFitCookie("bookings", 49));
    expect(document.cookie).not.toContain("gw_table_fit_bookings=");
  });

  it("does not write when the table has no rows", () => {
    setDesktop(true);
    setNode(100, false);
    renderHook(() => useTableFitCookie("bookings", 49));
    expect(document.cookie).not.toContain("gw_table_fit_bookings=");
  });
});
