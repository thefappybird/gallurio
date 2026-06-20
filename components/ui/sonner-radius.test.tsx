import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { Toaster } from "./sonner";

// Toasts are interactive controls, not structural frames — they soften with the
// control radius rather than being forced sharp.
describe("toast corner radius", () => {
  it("renders toasts with the control radius", async () => {
    render(<Toaster />);
    toast("saved");
    await waitFor(() => {
      const el = document.querySelector("[data-sonner-toast]");
      expect(el).not.toBeNull();
      expect((el as HTMLElement).className).toContain("rounded-[var(--radius)]");
      expect((el as HTMLElement).className).not.toContain("rounded-none");
    });
  });
});
