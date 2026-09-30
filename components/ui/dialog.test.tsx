import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, enMessages } from "@/test-utils/render";
import { Dialog, DialogContent } from "./dialog";

const frenchCloseMessages = {
  ...enMessages,
  common: { ...enMessages.common, close: "Fermer" },
};

describe("Dialog i18n close button", () => {
  it("renders the icon-only close button's sr-only label from common.close", () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>content</DialogContent>
      </Dialog>,
      { messages: frenchCloseMessages }
    );
    expect(screen.getByRole("button", { name: "Fermer" })).toBeInTheDocument();
  });
});
