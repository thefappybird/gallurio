import { describe, expect, it } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DocumentPreviewDialog } from "./document-preview-dialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Expand
      </button>
      <DocumentPreviewDialog open={open} onOpenChange={setOpen} title="Invoice preview" closeLabel="Close preview">
        <p>doc body</p>
      </DocumentPreviewDialog>
    </>
  );
}

describe("DocumentPreviewDialog", () => {
  it("opens a titled dialog and Escape closes it, returning focus to the opener", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Expand" });
    opener.focus();
    fireEvent.click(opener);

    expect(await screen.findByRole("dialog", { name: "Invoice preview" })).toBeInTheDocument();
    expect(screen.getByText("doc body")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
});
