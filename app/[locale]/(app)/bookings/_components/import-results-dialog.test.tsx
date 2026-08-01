import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { ImportResultsDialog } from "./import-results-dialog";
import type { ImportErrorEntry } from "@/app/api/bookings/import/route";

const VALIDATION_ERROR: ImportErrorEntry = {
  index: 0,
  row: { title: "", clientName: "Unknown", startAt: "2026-05-25T10:00:00.000Z" },
  field: "title",
  kind: "validation",
  message: "Title is required",
};

const SERVER_ERROR: ImportErrorEntry = {
  index: 2,
  row: {
    title: "Test Shoot",
    clientName: "Jane Doe",
    clientEmail: "jane@example.com",
    startAt: "2026-05-30T14:00:00.000Z",
  },
  kind: "server",
  message: "Database write failed",
};

function renderDialog(
  open: boolean,
  errors: ImportErrorEntry[] = [VALIDATION_ERROR, SERVER_ERROR],
  summary: { created: number; updated: number; skipped: number } | undefined = {
    created: 3,
    updated: 0,
    skipped: 1,
  },
  onClose = vi.fn()
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ImportResultsDialog open={open} onClose={onClose} errors={errors} summary={summary} />
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

  it("heads each error with the booking title and client", () => {
    // A line number alone identifies nothing in a 500-row file.
    renderDialog(true);
    expect(screen.getByText("Test Shoot")).toBeDefined();
    expect(screen.getByText("Jane Doe · jane@example.com")).toBeDefined();
  });

  it("names a titleless row rather than leaving the header blank", () => {
    renderDialog(true);
    expect(screen.getByText("Untitled booking")).toBeDefined();
  });

  it("shows the summary with created and skipped counts", () => {
    renderDialog(true);
    // Summary: "Imported 3 · Skipped 1"
    expect(screen.getByText(/imported 3/i)).toBeDefined();
    expect(screen.getByText(/skipped 1/i)).toBeDefined();
  });

  it("drops the summary and explains nothing was written when previewing", () => {
    // The same dialog explains preview failures, where a written/skipped
    // count would be a lie.
    // Rendered directly: passing `undefined` to renderDialog would fall back
    // to its default summary, which is the opposite of what this asserts.
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ImportResultsDialog open onClose={vi.fn()} errors={[VALIDATION_ERROR]} />
      </NextIntlClientProvider>
    );
    expect(screen.queryByText(/skipped/i)).toBeNull();
    expect(screen.getByText(/nothing has been imported yet/i)).toBeDefined();
  });

  it("clicking an error row expands it to show the raw row section", () => {
    renderDialog(true);
    const toggles = screen.getAllByRole("button", { name: /raw row/i });
    expect(screen.queryByText(/"clientName"/)).toBeNull();
    fireEvent.click(toggles[0]);
    expect(screen.getByText(/"clientName"/)).toBeDefined();
  });

  it("does not render when closed", () => {
    renderDialog(false);
    expect(screen.queryByText("Title is required")).toBeNull();
    expect(screen.queryByText("Database write failed")).toBeNull();
  });

  it("renders nothing in the error list when errors array is empty", () => {
    renderDialog(true, [], { created: 5, updated: 0, skipped: 0 });
    expect(screen.queryByText("Title is required")).toBeNull();
    // Summary should still show.
    expect(screen.getByText(/imported 5/i)).toBeDefined();
  });
});
