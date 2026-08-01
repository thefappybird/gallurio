import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { CsvImportDialog } from "./csv-import-dialog";

// next-intl navigation is aliased to the stub via vitest.config.ts resolve
// so useRouter() works without extra mocking.

// Prevent sonner toast from throwing in jsdom
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Import-results dialog does not need real rendering in these tests
vi.mock("./import-results-dialog", () => ({
  ImportResultsDialog: () => null,
}));

// Default: fetch never gets called in smoke/preview tests; mock it for import tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// URL.createObjectURL is not available in happy-dom; stub it so downloadTemplate works
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
}

function renderDialog(overrides: Partial<Parameters<typeof CsvImportDialog>[0]> = {}) {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    defaultCurrency: "PHP",
    ...overrides,
  };
  return renderWithProviders(<CsvImportDialog {...defaultProps} />);
}

// Build a minimal FileReader that calls onload synchronously with the given text.
// Must be a real class (constructable with `new`) — vi.fn() stubs are not constructors.
function mockFileReader(text: string) {
  const original = globalThis.FileReader;
  class MockFileReader {
    onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
    readAsText() {
      if (this.onload) {
        this.onload({ target: { result: text } } as unknown as ProgressEvent<FileReader>);
      }
    }
  }
  globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
  return () => {
    globalThis.FileReader = original;
  };
}

const VALID_CSV = [
  "clientName,clientEmail,startAt,endAt,title,eventType,status,amountTotal,amountDeposit,currency,locationAddress,notes",
  "Jane Smith,jane@example.com,2026-06-15T09:00,2026-06-15T18:00,Smith Wedding,wedding,booked,50000,10000,PHP,Grand Ballroom,Ceremony",
].join("\n");

const INVALID_CSV = [
  "clientName,clientEmail,startAt,endAt,title,eventType,status,amountTotal,amountDeposit,currency,locationAddress,notes",
  ",,bad-date,,,,,,,,," , // missing required clientName + bad startAt
].join("\n");

describe("CsvImportDialog", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ── 1. Smoke test ─────────────────────────────────────────────────────────
  it("renders without crashing when open", () => {
    renderDialog();
    expect(screen.getByText("Import bookings")).toBeInTheDocument();
  });

  it("renders cancel button", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("closes when cancel is clicked", () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not render when open=false", () => {
    renderDialog({ open: false });
    expect(screen.queryByText("Import bookings")).not.toBeInTheDocument();
  });

  // ── 2. Template download ───────────────────────────────────────────────────
  it("template download button is present", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /download csv template/i })).toBeInTheDocument();
  });

  it("clicking template download button invokes URL.createObjectURL", () => {
    const createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /download csv template/i }));
    expect(createSpy).toHaveBeenCalledOnce();
    createSpy.mockRestore();
  });

  // ── 3. File upload triggers preview state ─────────────────────────────────
  it("uploading an XLSX sends it to the server and previews the returned rows", async () => {
    // XLSX is binary, so it goes to the server-side preview endpoint rather
    // than being parsed in the browser.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          preview: true,
          headers: ["title", "clientName", "startAt"],
          rows: [
            {
              title: "Garden Wedding",
              clientName: "Ana Cruz",
              startAt: "2026-06-15T01:00:00.000Z",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    try {
      renderDialog();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([new Uint8Array([0x50, 0x4b])], "rows.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/row\(s\) found/i)).toBeInTheDocument();
      });
      expect(screen.getByText("Garden Wedding")).toBeInTheDocument();

      const [, init] = fetchSpy.mock.calls[0];
      expect((init as RequestInit).body).toBeInstanceOf(FormData);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("uploading a valid CSV file shows the preview table", async () => {
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toBeTruthy();

      const file = new File([VALID_CSV], "rows.csv", { type: "text/csv" });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/row\(s\) found/i)).toBeInTheDocument();
      });
    } finally {
      restore();
    }
  });

  it("never sends part of a multi-session group", async () => {
    // The route rebuilds `sessions` from the rows it receives and $sets the
    // whole array. Sending 2 of a booking's 3 sessions deletes the third from
    // an existing booking, silently, and reports success.
    const partial = [
      "clientName,clientEmail,startAt,endAt,title,eventType,status,amountTotal,amountDeposit,currency,locationAddress,notes,booking_id,session_index",
      "Ana,a@example.com,2026-06-15T09:00,2026-06-15T12:00,Trip,wedding,booked,1,0,PHP,X,,65b7f2c1a4d3e2b1c0f9a8d7,0",
      "Ana,a@example.com,NOT-A-DATE,,Trip,wedding,booked,1,0,PHP,X,,65b7f2c1a4d3e2b1c0f9a8d7,1",
    ].join("\n");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ created: 0, updated: 0, skipped: 0, errors: [] }),
    });
    const restore = mockFileReader(partial);
    try {
      renderDialog();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { files: [new File([partial], "g.csv", { type: "text/csv" })] } });
      });
      await waitFor(() => expect(screen.getByText(/2 row\(s\) found/i)).toBeInTheDocument());

      // The whole group is unimportable, so there is nothing to import.
      expect(screen.queryByRole("button", { name: /import \d+ booking/i })).toBeNull();
    } finally {
      restore();
    }
  });

  it("does not report failure when every row was already imported", async () => {
    // Re-running a file is a benign no-op. Treating "nothing written" as a
    // failure tells the user something broke when nothing did.
    const { toast } = await import("sonner");
    vi.mocked(toast.error).mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        created: 0,
        updated: 0,
        skipped: 1,
        validationErrors: 0,
        serverErrors: 0,
        errors: [{ index: 0, row: {}, kind: "duplicate", message: "Skipped: already exists" }],
      }),
    });
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { files: [new File([VALID_CSV], "r.csv", { type: "text/csv" })] } });
      });
      await waitFor(() => expect(screen.getByText(/1 row\(s\) found/i)).toBeInTheDocument());
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));
      });

      expect(toast.error).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("surfaces a rate-limit response instead of crashing the dialog", async () => {
    // The route rate-limits at 10 imports / 5 min. That body is {error} with no
    // `errors` array, so reading data.errors.length blows up the render.
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate_limited" }),
    });
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { files: [new File([VALID_CSV], "rows.csv", { type: "text/csv" })] } });
      });
      await waitFor(() => expect(screen.getByText(/1 row\(s\) found/i)).toBeInTheDocument());

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));
      });

      // The dialog must still be on screen — a thrown render is the bug.
      expect(screen.getByText(/1 row\(s\) found/i)).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("previews the formula-guarded title the way it will be stored", async () => {
    // The exporter writes "'=SUM(1)"; the route strips that apostrophe on
    // commit. Without the same strip here the user previews one value and
    // gets another.
    const guarded = VALID_CSV.replace("Smith Wedding", "'=SUM(1) Wedding");
    const restore = mockFileReader(guarded);
    try {
      renderDialog();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { files: [new File([guarded], "rows.csv", { type: "text/csv" })] } });
      });

      await waitFor(() => {
        expect(screen.getByText("=SUM(1) Wedding")).toBeInTheDocument();
      });
    } finally {
      restore();
    }
  });

  it("shows valid row count after uploading a valid CSV", async () => {
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([VALID_CSV], "rows.csv", { type: "text/csv" });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/1 valid/i)).toBeInTheDocument();
      });
    } finally {
      restore();
    }
  });

  it("shows import button with row count after uploading a valid CSV", async () => {
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([VALID_CSV], "rows.csv", { type: "text/csv" });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /import 1 booking/i })).toBeInTheDocument();
      });
    } finally {
      restore();
    }
  });

  // ── 4. Validation errors for malformed rows ────────────────────────────────
  it("shows invalid row count when CSV has malformed rows", async () => {
    const restore = mockFileReader(INVALID_CSV);
    try {
      renderDialog();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([INVALID_CSV], "bad.csv", { type: "text/csv" });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/with errors/i)).toBeInTheDocument();
      });
    } finally {
      restore();
    }
  });

  it("surfaces error message text in the preview table for a bad row", async () => {
    const restore = mockFileReader(INVALID_CSV);
    try {
      renderDialog();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([INVALID_CSV], "bad.csv", { type: "text/csv" });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // The error cell in the table should contain some non-empty validation message
      await waitFor(() => {
        const errorCells = document.querySelectorAll("td");
        const hasError = Array.from(errorCells).some(
          (td) => td.className.includes("destructive") && td.textContent && td.textContent.trim() !== ""
        );
        expect(hasError).toBe(true);
      });
    } finally {
      restore();
    }
  });

  it("shows no-valid-rows message when all rows are invalid", async () => {
    const restore = mockFileReader(INVALID_CSV);
    try {
      renderDialog();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([INVALID_CSV], "bad.csv", { type: "text/csv" });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/no valid rows/i)).toBeInTheDocument();
      });
    } finally {
      restore();
    }
  });

  // ── 5. Non-CSV file rejected ───────────────────────────────────────────────
  it("shows parse error when a non-CSV file is uploaded", async () => {
    renderDialog();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "image.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await waitFor(() => {
      expect(screen.getByText(/could not read this file/i)).toBeInTheDocument();
    });
  });
});
