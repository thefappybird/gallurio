import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BOOKINGS_CALENDAR_FALLBACK, CalendarSkeleton } from "./calendar-skeleton";

describe("CalendarSkeleton", () => {
  it("is aria-busy with the calendar's real height class and a 6x7 month grid", () => {
    const { container } = render(<CalendarSkeleton />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root.className).toContain("h-[calc(100dvh-14rem)]");
    expect(root.className).toContain("min-h-0");
    expect(container.querySelectorAll("[data-calendar-skeleton-cell]")).toHaveLength(42);
  });

  it("uses fallbackClassName instead of the default height class", () => {
    const { container } = render(
      <CalendarSkeleton fallbackClassName={BOOKINGS_CALENDAR_FALLBACK} />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("lg:h-[calc(100dvh-188px)]");
  });
});
