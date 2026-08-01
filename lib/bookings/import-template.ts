import { wallTimeInTzToUtc } from "@/lib/utils/timezone";

/**
 * Every column the importer reads, in the order the exporter writes them.
 *
 * One list, two consumers: the import dialog's structure table and the
 * downloadable template. They drifted apart before — the table never mentioned
 * locationLat/locationLng, so two importable columns were undocumented.
 */
export const IMPORT_COLUMNS = [
  { name: "clientName", required: true },
  { name: "clientEmail", required: false },
  { name: "startAt", required: true },
  { name: "endAt", required: false },
  { name: "title", required: true },
  { name: "eventType", required: false },
  { name: "status", required: false },
  { name: "amountTotal", required: false },
  { name: "amountDeposit", required: false },
  { name: "currency", required: false },
  { name: "locationAddress", required: false },
  { name: "notes", required: false },
  { name: "booking_id", required: false },
  { name: "session_index", required: false },
  { name: "clientId", required: false },
  { name: "clientPhone", required: false },
  { name: "locationLat", required: false },
  { name: "locationLng", required: false },
  { name: "payments", required: false },
] as const;

export const IMPORT_TEMPLATE_HEADERS: string[] = IMPORT_COLUMNS.map((c) => c.name);

/**
 * A template that actually imports. Two rows, one booking: the first carries
 * every column the importer accepts, the second adds a second session.
 *
 * Times are emitted as UTC instants derived from wall time in the workspace's
 * own timezone. A naive "2026-06-15T09:00" would be read as local time by
 * whoever parses it — the browser during preview, the container at commit — so
 * the old template could preview clean and then fail the same-day check on the
 * server. `clientId` is the one column left blank on purpose: any id invented
 * here belongs to no client in this workspace and would be refused.
 */
export function buildImportTemplateRows(timeZone: string, currency: string): string[][] {
  const day1 = "2026-06-15";
  const day2 = "2026-06-16";
  const at = (date: string, time: string) => wallTimeInTzToUtc(date, time, timeZone);

  const payments = JSON.stringify([
    {
      price: 15000,
      status: "paid",
      title: "Second instalment",
      method: "remit",
      paidAt: at(day1, "00:00"),
    },
    { price: 25000, status: "unpaid", title: "Balance on the day", method: "cash" },
  ]);

  const byName: Record<string, string>[] = [
    {
      clientName: "Jane Smith",
      clientEmail: "jane@example.com",
      startAt: at(day1, "09:00"),
      endAt: at(day1, "18:00"),
      title: "Smith Wedding",
      eventType: "wedding",
      status: "booked",
      amountTotal: "50000",
      amountDeposit: "10000",
      currency,
      locationAddress: "Grand Ballroom, Manila",
      notes: "Ceremony + reception",
      // Not an id from an export — any non-ObjectId value is just a key that
      // ties rows into one multi-session booking.
      booking_id: "smith-wedding",
      session_index: "0",
      clientId: "",
      clientPhone: "+63 917 555 0142",
      locationLat: "14.5995",
      locationLng: "120.9842",
      // 10000 deposit + 40000 of payments settles the 50000 total.
      payments,
    },
    {
      clientName: "Jane Smith",
      startAt: at(day2, "09:00"),
      endAt: at(day2, "13:00"),
      title: "Smith Wedding",
      booking_id: "smith-wedding",
      session_index: "1",
    },
  ];

  return byName.map((row) => IMPORT_TEMPLATE_HEADERS.map((h) => row[h] ?? ""));
}
