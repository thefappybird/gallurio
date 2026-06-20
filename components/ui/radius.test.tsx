import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Card } from "./card";
import { Badge } from "./badge";

// Mixed-roundness contract (CLAUDE.md → Design rules): structural frames stay
// sharp via --radius-surface; interactive controls soften via the control
// radius. These classes drive off the CSS-var seam, so a future "rounded"
// preset re-radiuses both without touching components.
describe("primitive corner radii", () => {
  it("renders structural surfaces sharp and controls soft", () => {
    const { container: cardC } = render(<Card>body</Card>);
    const card = cardC.querySelector('[data-slot="card"]')!;
    expect(card.className).toContain("rounded-[var(--radius-surface)]");
    expect(card.className).not.toContain("rounded-xl");

    const { container: badgeC } = render(<Badge>new</Badge>);
    const badge = badgeC.querySelector('[data-slot="badge"]')!;
    expect(badge.className).toContain("rounded-md");
    expect(badge.className).not.toContain("rounded-4xl");
  });
});
