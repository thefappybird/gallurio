import { describe, it, expect } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { Dialog, DialogContent } from "./dialog";

// A dialog is a structural frame — it must stay sharp via --radius-surface, like
// cards, not soften with the control radius.
describe("dialog corner radius", () => {
  it("renders the popup with the structural-frame radius", () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>content</DialogContent>
      </Dialog>,
    );
    const popup = document.querySelector('[data-slot="dialog-content"]')!;
    expect(popup).not.toBeNull();
    expect(popup.className).toContain("rounded-[var(--radius-surface)]");
    expect(popup.className).not.toContain("rounded-xl");
  });
});
