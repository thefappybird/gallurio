import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { hasIncompleteMetadata, IncompleteMetadataBadge } from "./imageMetaCompleteness";

describe("hasIncompleteMetadata", () => {
  it("is true when altText is null", () => {
    expect(hasIncompleteMetadata({ altText: null })).toBe(true);
  });
  it("is true when altText is undefined", () => {
    expect(hasIncompleteMetadata({ altText: undefined })).toBe(true);
  });
  it("is true when altText is an empty/whitespace-only string", () => {
    expect(hasIncompleteMetadata({ altText: "" })).toBe(true);
    expect(hasIncompleteMetadata({ altText: "   " })).toBe(true);
  });
  it("is false when altText is set", () => {
    expect(hasIncompleteMetadata({ altText: "Bride and groom" })).toBe(false);
  });
  it("does not treat a missing title/caption alone as incomplete", () => {
    // altText present is enough, regardless of title/caption.
    expect(hasIncompleteMetadata({ altText: "Bride and groom" })).toBe(false);
  });
});

describe("IncompleteMetadataBadge", () => {
  it("exposes the explanation as its accessible name, not just an icon", () => {
    renderWithProviders(
      <IncompleteMetadataBadge label="Missing alt text — this photo may not display as intended." />
    );
    expect(
      screen.getByRole("button", { name: /missing alt text/i })
    ).toBeTruthy();
  });

  it("is a real, tab-reachable button — not a hover-only decoration", () => {
    renderWithProviders(
      <IncompleteMetadataBadge label="Missing alt text — this photo may not display as intended." />
    );
    const trigger = screen.getByRole("button", { name: /missing alt text/i });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).not.toHaveAttribute("tabindex", "-1");
    // Tooltip open-on-hover/-on-focus itself is base-ui's TooltipTrigger
    // (same primitive InfoHint already ships), not re-verified here — jsdom
    // does not implement real `:focus-visible`/pointer-type heuristics, so
    // that half is confirmed by the Playwright pass instead.
  });
});
