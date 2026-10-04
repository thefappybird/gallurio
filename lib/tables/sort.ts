// Pure table-sort config shared by server pages (parse + query) and client
// headers (key lists). No server-only / client-only imports.

export type SortDir = "asc" | "desc";

type SortColumn = { field: string; text?: boolean; defaultDir?: SortDir };

// Note: bookings `total` sorts by raw `amount.total`, although the table shows
// FX-converted workspace-currency values. Mixed-currency workspaces may see a
// sort order that differs slightly from the displayed numbers.
export const SORT_CONFIG = {
  bookings: {
    default: "bookedAt",
    columns: {
      bookedAt: { field: "bookedAt", defaultDir: "desc" },
      date: { field: "firstSessionStart", defaultDir: "desc" },
      title: { field: "title", text: true },
      client: { field: "clientName", text: true },
      status: { field: "status" },
      total: { field: "amount.total", defaultDir: "desc" },
    },
  },
  inquiries: {
    default: "submitted",
    columns: {
      submitted: { field: "createdAt", defaultDir: "desc" },
      bookedAt: { field: "bookedAt", defaultDir: "desc" },
      eventDate: { field: "eventDate", defaultDir: "desc" },
      status: { field: "status" },
      client: { field: "name", text: true },
      eventTitle: { field: "eventTitle", text: true },
      eventType: { field: "eventType" },
      source: { field: "source.kind" },
    },
  },
} as const satisfies Record<
  string,
  { default: string; columns: Record<string, SortColumn> }
>;

export type SortTable = keyof typeof SORT_CONFIG;

export type ParsedSort = { key: string; dir: SortDir; field: string; text: boolean };

export function parseSort(
  table: SortTable,
  sp: { sort?: string; dir?: string }
): ParsedSort {
  const cfg = SORT_CONFIG[table];
  const columns: Record<string, SortColumn> = cfg.columns;
  const key = sp.sort && Object.hasOwn(columns, sp.sort) ? sp.sort : cfg.default;
  const col = columns[key]!;
  const natural: SortDir = col.defaultDir ?? "asc";
  // An unknown key resets to the default column's own default direction.
  const validKey = key === sp.sort;
  const dir: SortDir =
    validKey && (sp.dir === "asc" || sp.dir === "desc") ? sp.dir : natural;
  return { key, dir, field: col.field, text: col.text === true };
}
