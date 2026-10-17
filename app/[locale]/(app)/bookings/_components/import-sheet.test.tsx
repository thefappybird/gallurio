import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ImportSheet } from "./import-sheet";
import { toast } from "sonner";

// next-intl navigation is aliased to the stub via vitest.config.ts resolve
// so useRouter() works without extra mocking.

// Prevent sonner toast from throwing in jsdom
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

const invalidateSpy = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-data-events", () => ({ useInvalidateFor: () => invalidateSpy }));

// Import-results dialog does not need real rendering in these tests
vi.mock("./import-results-dialog", () => ({
  ImportResultsDialog: ({
    open,
    tone,
    errors,
  }: {
    open: boolean;
    tone?: string;
    errors: { message: string }[];
  }) =>
    open ? (
      <div data-testid="results" data-tone={tone ?? "error"}>
        {errors.map((e) => e.message).join("|")}
      </div>
    ) : null,
}));

// Default: fetch never gets called in smoke/preview tests; mock it for import tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// URL.createObjectURL is not available in happy-dom; stub it so downloadTemplate works
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
}

function renderDialog(overrides: Partial<Parameters<typeof ImportSheet>[0]> = {}) {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    defaultCurrency: "PHP",
    ...overrides,
  };
  return renderWithProviders(<ImportSheet {...defaultProps} />);
}

// Build a minimal FileReader that calls onload synchronously with the given text.
// Must be a real class (constructable with `new`) — vi.fn() stubs are not constructors.
function mockFileReader(text: string | Uint8Array) {
  const original = globalThis.FileReader;
  const bytes = typeof text === "string" ? new TextEncoder().encode(text) : text;
  class MockFileReader {
    onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
    readAsArrayBuffer() {
      if (this.onload) {
        const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        this.onload({ target: { result: buf } } as unknown as ProgressEvent<FileReader>);
      }
    }
  }
  globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
  return () => {
    globalThis.FileReader = original;
  };
}

/** Drops a CSV on the sheet and waits for it to settle on the review step. */
async function uploadCsv(text: string) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, {
      target: { files: [new File([text], "rows.csv", { type: "text/csv" })] },
    });
  });
  await waitFor(() => expect(screen.getByText(/row\(s\) found/i)).toBeInTheDocument());
}

// Explicit UTC instants, not "2026-06-15T09:00": a naive datetime is read as
// local time by whoever parses it, so the same row could be same-day here and
// midnight-crossing on a UTC CI box. These are 09:00–18:00 in Asia/Manila.
const VALID_CSV = [
  "clientName,clientEmail,startAt,endAt,title,eventType,status,amountTotal,amountDeposit,currency,locationAddress,notes",
  "Jane Smith,jane@example.com,2026-06-15T01:00:00.000Z,2026-06-15T10:00:00.000Z,Smith Wedding,wedding,booked,50000,10000,PHP,Grand Ballroom,Ceremony",
].join("\n");

const INVALID_CSV = [
  "clientName,clientEmail,startAt,endAt,title,eventType,status,amountTotal,amountDeposit,currency,locationAddress,notes",
  ",,bad-date,,,,,,,,," , // missing required clientName + bad startAt
].join("\n");

describe("ImportSheet", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.message).mockClear();
    sessionStorage.clear();
  });

  // ── 1. Smoke test ─────────────────────────────────────────────────────────
  it("renders without crashing when open", () => {
    renderDialog();
    expect(screen.getByText("Import bookings")).toBeInTheDocument();
  });

  it("explains the missing client name on the review row", async () => {
    const csv = "title,clientName,startAt\nQA row,,2031-11-01 10:00";
    const restore = mockFileReader(csv);
    try {
      renderDialog();
      await uploadCsv(csv);
      expect(screen.getAllByText(/Client name is missing/i).length).toBeGreaterThan(0);
    } finally {
      restore();
    }
  });

  it("explains how to convert an old Excel file", () => {
    renderDialog();
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["old workbook"], "old.xls")] },
    });
    expect(screen.getByText(/Save it as \.xlsx/i)).toBeInTheDocument();
  });

  it("renders cancel button", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("lets the upload drop zone use the available sheet height", () => {
    renderDialog();
    expect(screen.getByTestId("import-upload-step")).toHaveClass("min-h-full");
    expect(screen.getByRole("button", { name: /drop.*csv.*xlsx/i })).toHaveClass("flex-1");
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
  it("offers both templates as downloads from the route", () => {
    // Built server-side, not from a Blob here: the XLSX is a zip, and serving
    // both from one place is what stops them disagreeing.
    renderDialog();
    expect(
      screen.getByRole("link", { name: /download csv template/i })
    ).toHaveAttribute("href", "/api/bookings/import?format=csv");
    expect(
      screen.getByRole("link", { name: /download xlsx template/i })
    ).toHaveAttribute("href", "/api/bookings/import?format=xlsx");
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
      expect(screen.getAllByText("Garden Wedding").length).toBeGreaterThan(0);

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

  it("offers a team picker only when there is more than one team to pick", async () => {
    // A single-team workspace has no choice to make, so the control would be
    // noise; the route defaults to the only team either way. The picker lives
    // on the review step, next to the button that commits the import.
    const one = [{ id: "t1", name: "Main", color: "#000", isActive: true, isLead: true }];
    const restore = mockFileReader(VALID_CSV);
    try {
      const { unmount } = renderDialog({ teams: one });
      await uploadCsv(VALID_CSV);
      expect(screen.queryByLabelText(/team/i)).toBeNull();
      unmount();

      renderDialog({
        teams: [...one, { id: "t2", name: "Second Shooters", color: "#111", isActive: true, isLead: true }],
      });
      await uploadCsv(VALID_CSV);
      expect(screen.getByLabelText(/team/i)).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("asks before re-importing rows that already exist, naming the team", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        needsConfirmation: true,
        duplicates: [{ index: 0, title: "Smith Wedding", teamName: "Main" }],
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

      expect(await screen.findByText(/already imported/i)).toBeInTheDocument();
      expect(screen.getByText(/Main/)).toBeInTheDocument();
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
        expect(screen.getAllByText("=SUM(1) Wedding").length).toBeGreaterThan(0);
      });
    } finally {
      restore();
    }
  });

  it("previews a date-only start cell without a time", async () => {
    const csv = ["clientName,startAt,title", "Jane Smith,6/15/2026,Smith Wedding"].join("\n");
    const restore = mockFileReader(csv);
    try {
      renderDialog({ workspaceTimezone: "Asia/Manila" });
      await uploadCsv(csv);
      expect(screen.getAllByText(/Jun 15, 2026/).length).toBeGreaterThan(0);
    } finally {
      restore();
    }
  });

  it("previews a start cell that has a time with the time", async () => {
    const csv = ["clientName,startAt,title", "Jane Smith,6/15/2026 9:00 AM,Smith Wedding"].join("\n");
    const restore = mockFileReader(csv);
    try {
      renderDialog({ workspaceTimezone: "Asia/Manila" });
      await uploadCsv(csv);
      expect(screen.getAllByText(/Jun 15, 2026,? (at )?9:00\sAM/).length).toBeGreaterThan(0);
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
        expect(screen.getByText(/1 total/i)).toBeInTheDocument();
      });
    } finally {
      restore();
    }
  });

  it("counts a row with a dropped cell as ready with notes and imports it", async () => {
    // "TBD" is not an amount. The row used to fail over it; now the amount is
    // dropped, the preview says so, and the booking still goes in.
    const csv = [
      "clientName,startAt,endAt,title,amountTotal",
      "Jane Smith,2026-06-15T01:00:00.000Z,2026-06-15T10:00:00.000Z,Smith Wedding,TBD",
    ].join("\n");
    const restore = mockFileReader(csv);
    try {
      renderDialog();
      await uploadCsv(csv);
      expect(screen.getByText(/1 total/)).toBeInTheDocument();
      expect(screen.getByText(/1 with notes/)).toBeInTheDocument();
      expect(screen.queryByText(/skipped/)).not.toBeInTheDocument();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ created: 1, updated: 0, skipped: 0, shifts: 0, errors: [] }),
      });
      fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));
      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.rows).toHaveLength(1);
      expect(body.rows[0].title).toBe("Smith Wedding");
    } finally {
      restore();
    }
  });

  it("opens every note for a row from a tappable notes cell, not only on hover", async () => {
    const csv = [
      "clientName,startAt,endAt,title,amountTotal",
      "Jane Smith,2026-06-15T01:00:00.000Z,2026-06-15T10:00:00.000Z,Smith Wedding,TBD",
    ].join("\n");
    const restore = mockFileReader(csv);
    try {
      renderDialog();
      await uploadCsv(csv);
      expect(screen.queryByTestId("results")).not.toBeInTheDocument();
      // Rendered twice (inline under the title below sm, in the Notes column above).
      fireEvent.click(screen.getAllByRole("button", { name: /isn't an amount/ })[0]);
      const dialog = screen.getByTestId("results");
      expect(dialog).toHaveAttribute("data-tone", "note");
      expect(dialog).toHaveTextContent(/isn't an amount/);
    } finally {
      restore();
    }
  });

  it("opens the same notes dialog from the 'with notes' count", async () => {
    const csv = [
      "clientName,startAt,endAt,title,amountTotal",
      "Jane Smith,2026-06-15T01:00:00.000Z,2026-06-15T10:00:00.000Z,Smith Wedding,TBD",
    ].join("\n");
    const restore = mockFileReader(csv);
    try {
      renderDialog();
      await uploadCsv(csv);
      fireEvent.click(screen.getByRole("button", { name: /1 with notes/ }));
      expect(screen.getByTestId("results")).toHaveAttribute("data-tone", "note");
    } finally {
      restore();
    }
  });

  it("fails a row that crosses midnight in the workspace timezone", async () => {
    // 09:00Z-17:00Z is one UTC day, which is all the Zod schema compares, but
    // 17:00-01:00 in Manila. The route rejects it at commit; previewing it as
    // valid is how a clean-looking file failed on submit.
    const csv = [
      "clientName,clientEmail,startAt,endAt,title",
      "Jane Smith,,2026-09-12T09:00:00.000Z,2026-09-12T17:00:00.000Z,Overnight",
    ].join("\n");
    const restore = mockFileReader(csv);
    try {
      renderDialog({ workspaceTimezone: "Asia/Manila" });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, {
          target: { files: [new File([csv], "rows.csv", { type: "text/csv" })] },
        });
      });

      await waitFor(() => {
        expect(screen.getAllByText(/same day in your workspace timezone/i)[0]).toBeInTheDocument();
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

  // ── intake guards ──────────────────────────────────────────────────────────
  async function dropFile(file: File) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
  }

  it("decodes a windows-1252 CSV instead of showing replacement characters", async () => {
    const header = "clientName,startAt,title";
    const row = "José Peña,2026-06-15T01:00:00.000Z,Boda";
    const bytes = Uint8Array.from(
      Array.from(`${header}\n${row}`).map((c) => (c.charCodeAt(0) > 255 ? 63 : c.charCodeAt(0)))
    );
    const restore = mockFileReader(bytes);
    try {
      renderDialog();
      await dropFile(new File([bytes], "ansi.csv", { type: "text/csv" }));
      await waitFor(() => expect(screen.getAllByText(/José Peña/).length).toBeGreaterThan(0));
    } finally {
      restore();
    }
  });

  it("refuses a binary file renamed to .csv", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
    const restore = mockFileReader(png);
    try {
      renderDialog();
      await dropFile(new File([png], "pic.csv", { type: "text/csv" }));
      expect(await screen.findByText(/doesn't look like a CSV/i)).toBeInTheDocument();
      expect(screen.getByTestId("import-upload-step")).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("refuses a CSV over 2 MB up front", async () => {
    renderDialog();
    const big = new File(["a"], "big.csv", { type: "text/csv" });
    Object.defineProperty(big, "size", { value: 2_000_001 });
    await dropFile(big);
    expect(await screen.findByText(/2 MB limit/i)).toBeInTheDocument();
  });

  it("refuses more than 500 rows with the count", async () => {
    const csv = [
      "clientName,startAt,title",
      ...Array.from({ length: 501 }, (_, i) => `C${i},2026-06-15T01:00:00.000Z,T${i}`),
    ].join("\n");
    const restore = mockFileReader(csv);
    try {
      renderDialog();
      await dropFile(new File([csv], "many.csv", { type: "text/csv" }));
      expect(await screen.findByText(/has 501 rows. Import up to 500/i)).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("says so when the file is empty", async () => {
    const restore = mockFileReader("");
    try {
      renderDialog();
      await dropFile(new File([""], "e.csv", { type: "text/csv" }));
      expect(await screen.findByText("This file is empty.")).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("says so when there are headers but no rows", async () => {
    const restore = mockFileReader("clientName,startAt,title\n");
    try {
      renderDialog();
      await dropFile(new File(["x"], "h.csv", { type: "text/csv" }));
      expect(await screen.findByText(/headers but no rows/i)).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it.each([
    [413, { error: "import_too_large" }, /2 MB limit/i],
    [400, { error: "too_many_rows", count: 600, max: 500 }, /has 600 rows/i],
    [429, { error: "rate_limited", seconds: 12 }, /12 seconds/i],
    [400, { error: "unreadable_file" }, /Could not read this file/i],
  ])("maps XLSX preview error %s to specific copy", async (status, body, copy) => {
    mockFetch.mockResolvedValue({ ok: false, status, json: async () => body });
    renderDialog();
    await dropFile(new File([new Uint8Array([0x50, 0x4b])], "r.xlsx"));
    expect(await screen.findByText(copy)).toBeInTheDocument();
  });

  it("tells the owner to check their connection when the XLSX upload fails to send", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    renderDialog();
    await dropFile(new File([new Uint8Array([0x50, 0x4b])], "r.xlsx"));
    expect(await screen.findByText(/Check your connection/i)).toBeInTheDocument();
  });

  it("repeats a row's reason under its title for narrow screens", async () => {
    const csv = ",x@example.com,bad-date,,Title,,,,,,,";
    const full = `clientName,clientEmail,startAt,endAt,title,eventType,status,amountTotal,amountDeposit,currency,locationAddress,notes\n${csv}`;
    const restore = mockFileReader(full);
    try {
      renderDialog();
      await uploadCsv(full);
      const reasons = document.querySelectorAll("td div.sm\\:hidden");
      expect(reasons).toHaveLength(1);
      expect(reasons[0].querySelector("button")).not.toBeNull();
      expect(document.querySelector("th.hidden.sm\\:table-cell")).not.toBeNull();
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
        expect(screen.getByText(/1 skipped/i)).toBeInTheDocument();
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

describe("ImportSheet steps", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(toast.error).mockClear();
    sessionStorage.clear();
  });

  // Headers no Gallurio file would ever have, so the mapping step is required.
  const FOREIGN_CSV = [
    "Customer,Event,Date,Package Price,Deal Status",
    "Jane Smith,Smith Wedding,06/15/2026,₱50,000.00,Confirmed",
  ].join("\n");

  it("shows only one step at a time", async () => {
    const restore = mockFileReader(FOREIGN_CSV);
    try {
      renderDialog();
      // Upload step: no mapping grid yet.
      expect(screen.queryByText("Match your columns to ours")).not.toBeInTheDocument();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, {
          target: { files: [new File([FOREIGN_CSV], "f.csv", { type: "text/csv" })] },
        });
      });

      // Map step: the dropzone and the preview table are both gone.
      expect(await screen.findByText("Match your columns to ours")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /drop.*csv.*xlsx/i })).toBeNull();
      expect(screen.queryByText(/row\(s\) found/i)).toBeNull();
    } finally {
      restore();
    }
  });

  it("goes straight to review when our own headers need no matching", async () => {
    // The round-trip case: our template and our exports must stay one click.
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();
      await uploadCsv(VALID_CSV);
      expect(screen.queryByText("Match your columns to ours")).not.toBeInTheDocument();
      expect(screen.getByText("Columns matched automatically")).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("can reopen the matching it skipped", async () => {
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();
      await uploadCsv(VALID_CSV);
      fireEvent.click(screen.getByRole("button", { name: "Review" }));
      expect(await screen.findByText("Match your columns to ours")).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("applies a value-mapping suggestion even when the user never touches its dropdown", async () => {
    // "Confirmed" -> "booked" is a known suggestion. The banner and dropdown
    // show it as already resolved, so it must actually import that way without
    // any simulated interaction with the value step's dropdown.
    const csv = [
      "Customer,Event,Date,Deal Status",
      "Jane Smith,Smith Wedding,06/15/2026,Confirmed",
    ].join("\n");
    const restore = mockFileReader(csv);
    try {
      renderDialog();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, {
          target: { files: [new File([csv], "f.csv", { type: "text/csv" })] },
        });
      });
      await screen.findByText("Match your columns to ours");

      // Required fields already auto-matched; advance past mapping.
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      // On the value step, without touching the "Confirmed" dropdown at all.
      await screen.findByText("Confirmed");
      expect(screen.queryByText(/unmatched/i)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      // The row imports as "booked", not as an unrecognized-value failure.
      expect(
        await screen.findByRole("button", { name: /import 1 booking/i })
      ).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("will not continue past matching until the required fields are answered", async () => {
    const restore = mockFileReader("Ref,Notes\nA-1,hello");
    try {
      renderDialog();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, {
          target: { files: [new File(["Ref,Notes\nA-1,hello"], "f.csv", { type: "text/csv" })] },
        });
      });
      await screen.findByText("Match your columns to ours");
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
      // Title is optional now: only client name and start remain.
      expect(screen.getByText(/Match the 2 required fields to continue/)).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("lets matching continue with no title column and marks title optional", async () => {
    const csv = "Customer,Date\nJane Smith,06/15/2026";
    const restore = mockFileReader(csv);
    try {
      renderDialog();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, {
          target: { files: [new File([csv], "f.csv", { type: "text/csv" })] },
        });
      });
      // Both required columns match on their own, so it lands on review.
      fireEvent.click(await screen.findByRole("button", { name: "Review" }));
      await screen.findByText("Match your columns to ours");
      expect(screen.getByText(/Optional — we'll make one from the client and event type/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    } finally {
      restore();
    }
  });

  it("holds a busy state over the import and the refresh that follows it", async () => {
    // Reporting success while the table behind the sheet is still stale is what
    // makes an import feel broken, so the overlay covers both.
    let release: (value: unknown) => void = () => {};
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        release = () =>
          resolve({
            ok: true,
            status: 200,
            json: async () => ({ created: 1, updated: 0, shifts: 1, skipped: 0, errors: [] }),
          });
      })
    );
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();
      await uploadCsv(VALID_CSV);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));
      });
      expect(screen.getByText("Importing your bookings")).toBeInTheDocument();

      await act(async () => {
        release(null);
      });
      await waitFor(() =>
        expect(screen.queryByText("Importing your bookings")).not.toBeInTheDocument()
      );
    } finally {
      restore();
    }
  });

  it("warns that a lost start response is uncertain and permits a retry with the same request ID", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Still offline"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ created: 1, updated: 0, shifts: 1, skipped: 0, errors: [] }),
      });
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();
      await uploadCsv(VALID_CSV);
      fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "Couldn't confirm whether the import started. Check your connection and reopen Import to resume before trying again."
        )
      );
      expect(screen.getByRole("button", { name: /import 1 booking/i })).toBeEnabled();

      fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
      const first = JSON.parse(mockFetch.mock.calls[0][1].body);
      const retry = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(retry.requestId).toBe(first.requestId);
    } finally {
      restore();
    }
  });

  it("recovers a job when its start response is lost", async () => {
    const jobId = "cccccccccccccccccccccccc";
    mockFetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ job: { jobId, status: "running" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ job: { jobId, status: "running", doneGroups: 1, totalGroups: 3 } }),
      });
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();
      await uploadCsv(VALID_CSV);
      fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));
      expect(await screen.findByText("Processed 1 of 3")).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch.mock.calls[1][0]).toMatch(/\?requestId=/);
      expect(sessionStorage.getItem("gw:booking-import-job")).toBe(jobId);
      expect(toast.error).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("says when another active job is shown instead of the submitted file", async () => {
    const jobId = "dddddddddddddddddddddddd";
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: "import_active", jobId }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ job: { jobId, status: "running", doneGroups: 0, totalGroups: 3 } }),
      });
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();
      await uploadCsv(VALID_CSV);
      fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));
      expect(await screen.findByText("Processed 0 of 3")).toBeInTheDocument();
      expect(toast.message).toHaveBeenCalledWith(
        "Another import is already running. Showing its progress; this file has not started."
      );
    } finally {
      restore();
    }
  });

  it("uses a new request ID when retrying after a terminal job failure", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ jobId: "eeeeeeeeeeeeeeeeeeeeeeee" }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ job: { status: "failed", doneGroups: 0, totalGroups: 1 } }),
      })
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ jobId: "ffffffffffffffffffffffff" }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ job: { status: "running", doneGroups: 0, totalGroups: 1 } }),
      });
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();
      await uploadCsv(VALID_CSV);
      fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Import failed. Please try again."));
      fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));
      expect(await screen.findByText("Processed 0 of 1")).toBeInTheDocument();
      const first = JSON.parse(mockFetch.mock.calls[0][1].body);
      const retry = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(retry.requestId).not.toBe(first.requestId);
    } finally {
      restore();
    }
  });

  it("shows background progress and lets the owner close the sheet", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ jobId: "aaaaaaaaaaaaaaaaaaaaaaaa" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          job: { jobId: "aaaaaaaaaaaaaaaaaaaaaaaa", status: "running", doneGroups: 1, totalGroups: 3 },
        }),
      });
    const onClose = vi.fn();
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog({ onClose });
      await uploadCsv(VALID_CSV);
      fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));

      expect(await screen.findByText("Processed 1 of 3")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
      expect(screen.getByText(/import will continue/i)).toBeInTheDocument();
      fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
      expect(onClose).toHaveBeenCalledOnce();
      expect(sessionStorage.getItem("gw:booking-import-job")).toBe("aaaaaaaaaaaaaaaaaaaaaaaa");
    } finally {
      restore();
    }
  });

  it("applies a completed background job result and clears its resume key", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ jobId: "bbbbbbbbbbbbbbbbbbbbbbbb" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          job: {
            jobId: "bbbbbbbbbbbbbbbbbbbbbbbb",
            status: "completed",
            doneGroups: 1,
            totalGroups: 1,
            result: { created: 1, updated: 0, shifts: 1, skipped: 0, errors: [] },
          },
        }),
      });
    const onClose = vi.fn();
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog({ onClose });
      await uploadCsv(VALID_CSV);
      fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(sessionStorage.getItem("gw:booking-import-job")).toBeNull();
      expect(invalidateSpy).toHaveBeenCalledWith({ type: "bookings.imported" });
    } finally {
      restore();
    }
  });

  it("previews at most 100 rows and says how many more are not shown", async () => {
    const header = VALID_CSV.split("\n")[0];
    const lines = Array.from(
      { length: 150 },
      (_, i) =>
        `Jane ${i},jane${i}@example.com,2026-06-15T01:00:00.000Z,2026-06-15T10:00:00.000Z,Wedding ${i},wedding,booked,50000,10000,PHP,Ballroom,n`
    );
    const csv = [header, ...lines].join("\n");
    const restore = mockFileReader(csv);
    try {
      renderDialog();
      await uploadCsv(csv);
      expect(screen.getAllByRole("row")).toHaveLength(101);
      expect(screen.getByText("50 more rows not shown")).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("announces bookings.imported after a successful import", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ created: 1, updated: 0, shifts: 1, skipped: 0, errors: [] }),
    });
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog();
      await uploadCsv(VALID_CSV);
      fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));
      await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ type: "bookings.imported" }));
    } finally {
      restore();
    }
  });

  it("reports distinct booking and shift totals, then closes after a clean import", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ created: 1, updated: 0, shifts: 2, skipped: 0, errors: [] }),
    });
    const onClose = vi.fn();
    const restore = mockFileReader(VALID_CSV);
    try {
      renderDialog({ onClose });
      await uploadCsv(VALID_CSV);
      fireEvent.click(screen.getByRole("button", { name: /import 1 booking/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("1 booking and 2 shifts imported successfully.");
        expect(onClose).toHaveBeenCalledOnce();
      });
    } finally {
      restore();
    }
  });
});
