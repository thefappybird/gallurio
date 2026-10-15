# Bookings import: QA fixes plan

Source: exploratory Playwright pass (Run 1, 16 files, preview only). Run 2 (commits) is pending a re-run after these fixes.

## Backend wave (lib + route) — first
- A1 `Event Date`-style headers map to start date, not title (`SYNONYMS.title` avoids date/time words).
- A2 XLSX date cells become wall-clock strings (`2031-06-11`, `2031-06-11 14:30`), not UTC instants. Export round-trip must stay exact.
- A3 XLSX: header = first row with 2+ non-empty cells (skips banner rows); first sheet that has such a row (skips instruction tabs).
- A4 CSV delimiter detection: `,` `;` tab, chosen from the header line outside quotes.
- A5 `decodeCsvBytes(bytes)`: strict UTF-8, falls back to windows-1252. Used by the route preview and the client.
- A6 `isProbablyText(bytes)`: rejects binary files posing as CSV.
- A7 Preview (multipart) gets its own rate-limit bucket (30 / 5 min); commit keeps 10 / 5 min.
- A8 Stable error codes: `too_many_rows` (+ `count`, `max`) on preview and commit; `rate_limited` carries `seconds`.

## Frontend wave (import sheet + locales) — second
- B1 CSV intake reads bytes: binary → "not a CSV" error; decode via `decodeCsvBytes`.
- B2 CSV over 2 MB is refused up front (same cap as XLSX) instead of freezing the tab.
- B3 Files over 500 rows are refused at intake with the count, for CSV and XLSX.
- B4 XLSX preview errors are specific: too large, too many rows, rate limited, offline, unreadable.
- B5 Empty file and header-only file get their own messages on the upload step.
- B6 375px review table: the row's reason shows under its title; dates do not wrap.
- B7 Root 404: `app/not-found.tsx` → `app/global-not-found.tsx` + `experimental.globalNotFound` (root layout sits under `[locale]`; the old file nested `<html>` inside Next's built-in layout).
- All new copy in en, fil, id, ar, th.

## Verify
Scoped unit tests per change; orchestrator typecheck; then the Playwright re-run (Run 1 regressions + Run 2 commits) and DB cleanup.
