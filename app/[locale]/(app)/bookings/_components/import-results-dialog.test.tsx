import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { ImportResultsDialog } from "./import-results-dialog";
import type { ImportErrorEntry } from "@/app/api/bookings/import/route";

const VALIDATION_ERROR: ImportErrorEntry = {
  index: 0,
  row: { title: "", client: "Unknown", start: "2026-05-25T10:00:00.000Z" },
  field: "title",
  kind: "validation",
  message: "Title is required",
};

const SERVER_ERROR: ImportErrorEntry = {
  index: 2,
  row: { title: "Test Shoot", client: "Jane Doe", start: "2026-05-30T14:00:00.000Z" },
  kind: "server",
  message: "Database write failed",
};

function renderDialog(
  open: boolean,
  errors: ImportErrorEntry[] = [VALIDATION_ERROR, SERVER_ERROR],
  created = 3,
  skipped = 1,
  onClose = vi.fn()
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ImportResultsDialog
        open={open}
        onClose={onClose}
        errors={errors}
        created={created}
        skipped={skipped}
      />
    </NextIntlClientProvider>
  );
}

describe("ImportResultsDialog", () => {
  it("renders both error rows when open", () => {
    renderDialog(true);
    // Each error row shows its message.
    expect(screen.getByText("Title is required")).toBeDefined();
    expect(screen.getByText("Database write failed")).toBeDefined();
  });

  it("shows the summary with created and skipped counts", () => {
    renderDialog(true, [VALIDATION_ERROR, SERVER_ERROR], 3, 1);
    // Summary: "Imported 3 · Skipped 1"
    expect(screen.getByText(/imported 3/i)).toBeDefined();
    expect(screen.getByText(/skipped 1/i)).toBeDefined();
  });

  it("clicking an error row expands it to show the raw row section", () => {
    renderDialog(true);
    // The ErrorRow component renders a button wrapping the entire row.
    // Find the button that contains the validation error message and click it.
    const rowButton = screen.getByText("Title is required").closest("button");
    expect(rowButton).not.toBeNull();
    fireEvent.click(rowButton!);
    // After expanding, the "Raw row" label and the JSON should be visible.
    expect(screen.getByText(/raw row/i)).toBeDefined();
  });

  it("does not render when closed", () => {
    renderDialog(false);
    expect(screen.queryByText("Title is required")).toBeNull();
    expect(screen.queryByText("Database write failed")).toBeNull();
  });

  it("renders nothing in the error list when errors array is empty", () => {
    renderDialog(true, [], 5, 0);
    expect(screen.queryByText("Title is required")).toBeNull();
    // Summary should still show.
    expect(screen.getByText(/imported 5/i)).toBeDefined();
  });
});
